const axios  = require('axios');
const qs     = require('querystring');
const crypto = require('crypto');

class MTNMomoService {
  /* ------------------------------------------------------------------ */
  constructor() {
    // ---- Base settings ------------------------------------------------
    this.baseURL    = process.env.MTN_MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';

    this.subKey     = process.env.MTN_SUB_KEY;     // Collection product primary key
    this.apiUser    = process.env.MTN_API_USER;    // UUID returned by “Create API user”
    this.apiKey     = process.env.MTN_API_KEY;     // apiKey from /apikey call
    this.targetEnv  = process.env.MTN_TARGET_ENV || 'sandbox';

    // (optional) Disbursement key if you ever use it
    this.disbKey    = process.env.MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY;
  }

  /* ------------------------------------------------------------------ */
  /* 1. Generate access token                                            */
  /* ------------------------------------------------------------------ */
  async getAccessToken() {
    const basic = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString('base64');

    const { data } = await axios.post(
      `${this.baseURL}/collection/token/`,
      qs.stringify({ grant_type: 'client_credentials' }),
      {
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Ocp-Apim-Subscription-Key': this.subKey,
        },
      }
    );

    return data.access_token; // { access_token, expires_in, token_type }
  }

  /* ------------------------------------------------------------------ */
  /* 2. Request-to-Pay                                                   */
  /* ------------------------------------------------------------------ */
  async requestPayment(msisdn, amount, currency, externalId, payeeNote, payerMsg) {
    const token       = await this.getAccessToken();
    const referenceId = crypto.randomUUID();

    await axios.post(
      `${this.baseURL}/collection/v1_0/requesttopay`,
      {
        amount,
        currency,
        externalId,
        payer: { partyIdType: 'MSISDN', partyId: msisdn },
        payerMessage: payerMsg,
        payeeNote,
      },
      {
        headers: {
          Authorization:              `Bearer ${token}`,
          'X-Reference-Id':           referenceId,
          'X-Target-Environment':     this.targetEnv,
          'Ocp-Apim-Subscription-Key': this.subKey,
          'Content-Type':             'application/json',
        },
      }
    );

    return { referenceId, status: 'PENDING' };
  }

  /* ------------------------------------------------------------------ */
  /* 3. Check payment status                                             */
  /* ------------------------------------------------------------------ */
  async checkPaymentStatus(referenceId) {
    const token = await this.getAccessToken();

    const { data } = await axios.get(
      `${this.baseURL}/collection/v1_0/requesttopay/${referenceId}`,
      {
        headers: {
          Authorization:              `Bearer ${token}`,
          'X-Target-Environment':     this.targetEnv,
          'Ocp-Apim-Subscription-Key': this.subKey,
        },
      }
    );

    return data; // { status, amount, currency, ... }
  }

  /* ------------------------------------------------------------------ */
  /* 4. Helpers                                                          */
  /* ------------------------------------------------------------------ */
  generateReferenceId() {
    return crypto.randomUUID();
  }

  validatePhoneNumber(phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 12) {
      throw new Error('Invalid phone number length');
    }
    return digits;
  }

  formatAmount(amount) {
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) {
      throw new Error('Invalid amount');
    }
    return n.toFixed(2);
  }
}

module.exports = MTNMomoService;
