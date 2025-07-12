export function sendSMS(to, text) {
  if (process.env.TWILIO_SID === 'mock') {
    console.log(`[SMS MOCK] → ${to}: ${text}`);
    return;
  }
  // In production: integrate Twilio or Africa's Talking
}
