// src/routes/payments.js
import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import MTNMomoService from '../services/mtnmomo.service.js';

const router = Router();
router.use(requireAuth);

const momo = new MTNMomoService();

/* -------------------------------------------------------
   POST /payments/init { gateway, amount, phoneNumber, voucherCode }
-------------------------------------------------------- */
router.post('/init', async (req, res) => {
  try {
    const { gateway, amount, phoneNumber, voucherCode } = req.body;  // gateway = 'MTN' | 'Airtel'

    /* ---------- Basic field checks ---------- */
    if (!gateway || !amount) {
      return res.status(400).json({ error: 'Gateway and amount are required' });
    }
    if (gateway === 'MTN' && !phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required for MTN Mobile Money' });
    }

    /* ---------- Voucher validation ---------- */
    let voucherId = null;
    let packageType = null;

    if (voucherCode) {
      const { rows } = await db.query(
        `SELECT id, package_type, used, expiration_date
           FROM vouchers
          WHERE code = $1`,
        [voucherCode.trim()]
      );

      if (rows.length === 0) return res.status(400).json({ error: 'Invalid voucher code' });

      const v = rows[0];
      if (v.used)                    return res.status(400).json({ error: 'Voucher has already been used' });
      if (new Date(v.expiration_date) <= new Date())
                                     return res.status(400).json({ error: 'Voucher has expired' });

      /* Block a second payment if one is already PAID */
      const paidCheck = await db.query(
        `SELECT 1
           FROM payments
          WHERE voucher_code = $1
            AND status       = 'PAID'
          LIMIT 1`,
        [voucherCode.trim()]
      );
      if (paidCheck.rowCount > 0)
        return res.status(400).json({ error: 'Voucher is already paid for' });

      voucherId    = v.id;
      packageType  = v.package_type;
    }

    /* ---------- Insert initial payment row ---------- */
    const { rows: [p] } = await db.query(
      `INSERT INTO payments
         (user_id, gateway, amount, status, phone_number,
          voucher_id, voucher_code, package_type)
       VALUES
         ($1,$2,$3,'INIT',$4,$5,$6,$7)
       RETURNING id`,
      [req.user.id, gateway, amount, phoneNumber || null,
       voucherId, voucherCode || null, packageType]
    );
    const paymentId = p.id;

    /* ---------- Gateway handling ---------- */
    if (gateway === 'MTN') {
      try {
        const phone   = momo.validatePhoneNumber(phoneNumber);
        const amtStr  = momo.formatAmount(amount);

        const { referenceId } = await momo.requestPayment(
          phone, amtStr, 'EUR',
          `payment_${paymentId}`,
          `Payment for order ${paymentId}`,
          `Please pay ${amtStr} for your order`
        );

        await db.query(
          `UPDATE payments
              SET gateway_reference_id = $1,
                  status              = 'PENDING'
            WHERE id = $2`,
          [referenceId, paymentId]
        );

        pollPaymentStatus(paymentId, referenceId);   // background polling

        return res.json({
          paymentId,
          status: 'PENDING',
          referenceId,
          message: 'Payment request sent to MTN Mobile Money'
        });

      } catch (err) {
        await db.query(
          `UPDATE payments
              SET status = 'FAILED',
                  error_message = $1
            WHERE id = $2`,
          [err.message, paymentId]
        );
        console.error('MTN MoMo payment error:', err);
        return res.status(500).json({ error: 'Failed to initiate MTN Mobile Money payment', details: err.message });
      }
    }

    /* ---------- Other gateways (mock Airtel, etc.) ---------- */
    setTimeout(async () => {
      await db.query(`UPDATE payments SET status='PAID' WHERE id=$1`, [paymentId]);

      if (voucherId) {                      // mark voucher used on mock success
        await db.query(
          `UPDATE vouchers
              SET used    = TRUE,
                  used_by = $1
            WHERE id = $2
              AND used = FALSE`,
          [req.user.id, voucherId]
        );
      }
    }, 2000);

    res.json({ paymentId, redirectUrl: '/mock-gateway' });

  } catch (err) {
    console.error('Payment initialization error:', err);
    res.status(500).json({ error: 'Failed to initialize payment' });
  }
});

/* -------------------------------------------------------
   GET /payments/status/:paymentId
-------------------------------------------------------- */
router.get('/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { rows } = await db.query(
      `SELECT *
         FROM payments
        WHERE id = $1`,
      [paymentId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Payment not found' });
    if (rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    res.json(rows[0]);
  } catch (err) {
    console.error('Payment status check error:', err);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

/* -------------------------------------------------------
   GET /payments/voucher/:voucherCode
-------------------------------------------------------- */
router.get('/voucher/:voucherCode', async (req, res) => {
  try {
    const { voucherCode } = req.params;
    const { rows } = await db.query(
      `SELECT p.*, u.fullname AS user_name, u.email AS user_email
         FROM payments p
    LEFT JOIN users u ON u.id = p.user_id
        WHERE p.voucher_code = $1
        ORDER BY p.created_at DESC`,
      [voucherCode.trim()]
    );
    res.json({ voucherCode: voucherCode.trim(), payments: rows, totalPayments: rows.length });
  } catch (err) {
    console.error('Voucher payments check error:', err);
    res.status(500).json({ error: 'Failed to get voucher payments' });
  }
});

/* -------------------------------------------------------
   POST /payments/webhook/mtn
-------------------------------------------------------- */
router.post('/webhook/mtn', async (req, res) => {
  try {
    const { referenceId, status } = req.body;
    console.log('MTN MoMo webhook received:', req.body);

    const { rows } = await db.query(
      `SELECT *
         FROM payments
        WHERE gateway_reference_id = $1`,
      [referenceId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Payment not found' });
    const payment = rows[0];

    /* translate MTN status */
    const map = { SUCCESSFUL: 'PAID', FAILED: 'FAILED', TIMEOUT: 'FAILED' };
    const newStatus = map[status] || 'PENDING';

    await db.query(
      `UPDATE payments
          SET status = $1,
              error_message = CASE WHEN $1='FAILED' THEN $2 ELSE NULL END,
              updated_at = NOW()
        WHERE id = $3`,
      [newStatus, status === 'FAILED' ? 'Payment failed on MTN' : null, payment.id]
    );

    if (newStatus === 'PAID' && payment.voucher_id) {
      await db.query(
        `UPDATE vouchers
            SET used    = TRUE,
                used_by = $1
          WHERE id  = $2
            AND used = FALSE`,
        [payment.user_id, payment.voucher_id]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('MTN webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/* -------------------------------------------------------
   GET /payments - List all payments
-------------------------------------------------------- */
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM payments ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

/* -------------------------------------------------------
   GET /payments/my - List payments for the logged-in user
-------------------------------------------------------- */
router.get('/my', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching user payments:', error);
    res.status(500).json({ error: 'Failed to fetch user payments' });
  }
});

/* -------------------------------------------------------
   Helper: poll MTN status every 10 s for 5 min
-------------------------------------------------------- */
async function pollPaymentStatus(paymentId, referenceId) {
  const maxAttempts = 30;
  let attempts = 0;

  const timer = setInterval(async () => {
    try {
      attempts++;
      const { status } = await momo.checkPaymentStatus(referenceId);
      console.log(`[POLL] Payment ${paymentId} → ${status}`);

      const map = { SUCCESSFUL: 'PAID', FAILED: 'FAILED', TIMEOUT: 'FAILED' };
      const newStatus = map[status] || 'PENDING';
      if (newStatus !== 'PENDING') {
        clearInterval(timer);
        await db.query(
          `UPDATE payments
              SET status = $1,
                  updated_at = NOW()
            WHERE id = $2`,
          [newStatus, paymentId]
        );
        if (newStatus === 'PAID') {
          const { rows } = await db.query(
            `SELECT user_id, voucher_id
               FROM payments
              WHERE id = $1`,
            [paymentId]
          );
          if (rows.length && rows[0].voucher_id) {
            await db.query(
              `UPDATE vouchers
                  SET used    = TRUE,
                      used_by = $1
                WHERE id  = $2
                  AND used = FALSE`,
              [rows[0].user_id, rows[0].voucher_id]
            );
          }
        }
      }

      if (attempts >= maxAttempts) {
        clearInterval(timer);
        await db.query(
          `UPDATE payments
              SET status = 'FAILED',
                  error_message = 'Payment polling timeout',
                  updated_at = NOW()
            WHERE id = $1`,
          [paymentId]
        );
      }
    } catch (err) {
      console.error(`[POLL] error on payment ${paymentId}:`, err);
    }
  }, 10_000);
}

export default router;
