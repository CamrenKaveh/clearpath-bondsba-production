import Stripe from 'stripe';

let stripeClient = null;

export function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY || '';
}

export function getStripeClient() {
  if (stripeClient) return stripeClient;

  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2025-03-31.basil',
  });

  return stripeClient;
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET || '';
}

export function resolveAppUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` ||
    'http://127.0.0.1:4173'
  );
}

export function readStripeHeaderSignature(req) {
  return req.headers['stripe-signature'] || req.headers['Stripe-Signature'] || '';
}

export async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
