import crypto from 'node:crypto';

export function isStripeConfigured(env = process.env) {
  return Boolean(env.STRIPE_SECRET_KEY && String(env.STRIPE_SECRET_KEY).trim().startsWith('sk_'));
}

export async function createStripeCheckoutSession({
  secretKey,
  refCode,
  bookingId,
  customerEmail,
  lineItems,
  successUrl,
  cancelUrl,
  fetchImpl = globalThis.fetch,
}) {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('client_reference_id', refCode);
  params.set('customer_email', customerEmail);
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);
  params.set('metadata[booking_id]', String(bookingId));
  params.set('metadata[ref_code]', refCode);

  lineItems.forEach((item, idx) => {
    params.set(`line_items[${idx}][quantity]`, '1');
    params.set(`line_items[${idx}][price_data][currency]`, 'eur');
    params.set(`line_items[${idx}][price_data][unit_amount]`, String(item.amountCents));
    params.set(`line_items[${idx}][price_data][product_data][name]`, item.name);
    if (item.description) {
      params.set(`line_items[${idx}][price_data][product_data][description]`, item.description);
    }
  });

  const resp = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `peloton-checkout-${refCode}`,
    },
    body: params.toString(),
  });

  const payload = await resp.json();
  if (!resp.ok || !payload.url) {
    throw new Error(payload?.error?.message || `Stripe Checkout failed (${resp.status})`);
  }
  return { id: payload.id, url: payload.url };
}

export async function fetchStripeSession(secretKey, sessionId, fetchImpl = globalThis.fetch) {
  const resp = await fetchImpl(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!resp.ok) return null;
  return resp.json();
}

export function verifyStripeWebhook(rawBodyBuffer, sigHeader, webhookSecret, toleranceSec = 300) {
  if (!sigHeader || !webhookSecret) {
    throw new Error('Missing Stripe signature or webhook secret');
  }
  const buf = Buffer.isBuffer(rawBodyBuffer) ? rawBodyBuffer : Buffer.from(String(rawBodyBuffer), 'utf-8');
  let timestamp = '';
  const signatures = [];

  for (const part of String(sigHeader).split(',')) {
    const [k, v] = part.trim().split('=');
    if (k === 't') timestamp = v;
    if (k === 'v1' && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) {
    throw new Error('Malformed Stripe-Signature header');
  }

  const tsNum = Number(timestamp);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(tsNum) || Math.abs(nowSec - tsNum) > toleranceSec) {
    throw new Error('Stripe webhook timestamp outside tolerance');
  }

  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`, 'utf-8'), buf]);
  const expectedHex = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
  const expectedBuf = Buffer.from(expectedHex, 'utf-8');

  const matched = signatures.some((sig) => {
    if (sig.length !== expectedHex.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig, 'utf-8'), expectedBuf);
  });

  if (!matched) {
    throw new Error('Invalid Stripe webhook signature');
  }

  return JSON.parse(buf.toString('utf-8'));
}
