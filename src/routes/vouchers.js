import { Router } from 'express';
import { db } from '../db.js';
import { v4 as uuid } from 'uuid';
import { sendSMS } from '../services/sms.service.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/* POST /vouchers/generate {package_type,expiration_date,phone} */
router.post('/generate', async (req, res) => {
  const { package_type, expiration_date, phone } = req.body;
  
  // Required fields validation
  if (!package_type || !expiration_date || !phone) {
    return res.status(400).json({ 
      error: 'All fields are required: package_type, expiration_date, phone' 
    });
  }

  // Package type validation
  if (typeof package_type !== 'string' || package_type.trim().length === 0) {
    return res.status(400).json({ 
      error: 'Package type must be a non-empty string' 
    });
  }

  // Phone validation (basic format check)
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ 
      error: 'Invalid phone number format' 
    });
  }

  // Expiration date validation
  const expirationDate = new Date(expiration_date);
  if (isNaN(expirationDate.getTime())) {
    return res.status(400).json({ 
      error: 'Invalid expiration date format' 
    });
  }

  if (expirationDate <= new Date()) {
    return res.status(400).json({ 
      error: 'Expiration date must be in the future' 
    });
  }

  // Check if expiration date is not too far in the future (e.g., max 1 year)
  const maxExpirationDate = new Date();
  maxExpirationDate.setFullYear(maxExpirationDate.getFullYear() + 1);
  if (expirationDate > maxExpirationDate) {
    return res.status(400).json({ 
      error: 'Expiration date cannot be more than 1 year in the future' 
    });
  }

  const code = uuid().slice(0, 10).toUpperCase();
  
  try {
    await db.query(
      'INSERT INTO vouchers(code,package_type,expiration_date) VALUES($1,$2,$3)',
      [code, package_type, expirationDate]
    );
    sendSMS(phone, `Your voucher code: ${code} for ${package_type} package`);
    res.json({ code, package_type, expiration_date: expirationDate });
  } catch (error) {
    console.error('Voucher generation error:', error);
    res.status(500).json({ error: 'Failed to generate voucher' });
  }
});

/* POST /vouchers/validate {code} */
router.post('/validate', async (req, res) => {
  const { code } = req.body;
  
  // Required field validation
  if (!code) {
    return res.status(400).json({ 
      error: 'Voucher code is required' 
    });
  }

  // Code format validation (should be 10 characters, alphanumeric)
  if (typeof code !== 'string' || code.trim().length !== 10) {
    return res.status(400).json({ 
      error: 'Voucher code must be exactly 10 characters long' 
    });
  }

  // Code format validation (alphanumeric and uppercase)
  const codeRegex = /^[A-Z0-9]{10}$/;
  if (!codeRegex.test(code.trim().toUpperCase())) {
    return res.status(400).json({ 
      error: 'Voucher code must contain only uppercase letters and numbers' 
    });
  }

  try {
    const vRow = (
      await db.query(
        'SELECT * FROM vouchers WHERE code=$1 AND used=FALSE AND expiration_date>NOW()',
        [code]
      )
    ).rows[0];
    
    if (!vRow) {
      return res.json({ ok: false, reason: 'invalid_or_expired' });
    }

    // Check if user is trying to use their own voucher (optional business rule)
    // Uncomment the following lines if you want to prevent self-redemption
    // if (vRow.generated_by === req.user.id) {
    //   return res.status(400).json({ 
    //     error: 'You cannot redeem your own voucher' 
    //   });
    // }

    // Mark voucher as used and set used_by
    await db.query(
      'UPDATE vouchers SET used=TRUE, used_by=$1 WHERE code=$1', 
      [req.user.id, code]
    );
    
    res.json({ 
      ok: true, 
      package_type: vRow.package_type,
      code: vRow.code
    });
  } catch (error) {
    console.error('Voucher validation error:', error);
    res.status(500).json({ error: 'Failed to validate voucher' });
  }
});

export default router;
