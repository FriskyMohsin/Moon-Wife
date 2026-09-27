/**
 * Pari AI — Web Push plumbing (server side). Free/MIT (web-push).
 *
 * VAPID keypair is generated once with node:crypto and persisted; the
 * PWA client fetches the public key from GET /push/vapid-key and posts its
 * subscription to POST /push/subscribe. The reminder scheduler delivers
 * through sendPushToUser(). Expired subscriptions (410/404) are pruned.
 */
import crypto from 'crypto';
import * as webpush from 'web-push';
import { pariLoad, pariSave } from './pariStore';

const VAPID_FILE = 'push_vapid.json';
const SUBS_FILE = 'push_subs.json';

interface VapidStore {
  publicKey: string; // base64url uncompressed EC point
  privateKey: string; // base64url
  subject: string;
  createdAt: string;
}

export interface PushSubscriptionRecord {
  userId: string;
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    expirationTime?: number | null;
  };
  createdAt: string;
  updatedAt: string;
}

function loadVapid(): VapidStore | null {
  const v = pariLoad<VapidStore | null>(VAPID_FILE, null);
  return v && v.publicKey && v.privateKey ? v : null;
}

/**
 * Generate + persist the VAPID pair once. Pure node:crypto, no extra dep.
 * Returns the PUBLIC key (safe to expose to the PWA client).
 */
export function getOrCreateVapidPublicKey(): string {
  let vapid = loadVapid();
  if (!vapid) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pubJwk = publicKey.export({ format: 'jwk' }) as { x?: string; y?: string };
    const privJwk = privateKey.export({ format: 'jwk' }) as { d?: string };
    if (!pubJwk.x || !pubJwk.y || !privJwk.d) {
      throw new Error('VAPID key generation failed.');
    }
    const uncompressed = Buffer.concat([
      Buffer.from([0x04]),
      Buffer.from(pubJwk.x, 'base64url'),
      Buffer.from(pubJwk.y, 'base64url'),
    ]);
    vapid = {
      publicKey: uncompressed.toString('base64url'),
      privateKey: Buffer.from(privJwk.d, 'base64url').toString('base64url'),
      subject: 'mailto:pakbrandedagency@gmail.com',
      createdAt: new Date().toISOString(),
    };
    pariSave<VapidStore>(VAPID_FILE, vapid);
    console.log('[PariAI] Generated new VAPID keypair for push notifications.');
  }
  return vapid.publicKey;
}

let vapidConfigured = false;

function ensureVapidConfigured(): void {
  if (vapidConfigured) return;
  const vapid = loadVapid() || (() => {
    getOrCreateVapidPublicKey();
    return loadVapid()!;
  })();
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  vapidConfigured = true;
}

function loadSubs(): PushSubscriptionRecord[] {
  return pariLoad<PushSubscriptionRecord[]>(SUBS_FILE, []);
}

function saveSubs(subs: PushSubscriptionRecord[]): void {
  pariSave(SUBS_FILE, subs);
}

export function getPushSubscription(userId: string): PushSubscriptionRecord | null {
  return loadSubs().find((s) => s.userId === userId) || null;
}

/** One subscription per user (latest wins). Returns false on bad shape. */
export function savePushSubscription(userId: string, subscription: any): boolean {
  const endpoint = typeof subscription?.endpoint === 'string' ? subscription.endpoint : '';
  const p256dh = typeof subscription?.keys?.p256dh === 'string' ? subscription.keys.p256dh : '';
  const auth = typeof subscription?.keys?.auth === 'string' ? subscription.keys.auth : '';
  if (!endpoint || !p256dh || !auth) return false;

  const subs = loadSubs().filter((s) => s.userId !== userId);
  const now = new Date().toISOString();
  subs.push({
    userId,
    subscription: {
      endpoint,
      keys: { p256dh, auth },
      expirationTime: subscription.expirationTime ?? null,
    },
    createdAt: now,
    updatedAt: now,
  });
  saveSubs(subs);
  return true;
}

export function removePushSubscription(userId: string): boolean {
  const subs = loadSubs();
  const kept = subs.filter((s) => s.userId !== userId);
  if (kept.length === subs.length) return false;
  saveSubs(kept);
  return true;
}

export interface PushSendResult {
  sent: boolean;
  reason: 'no_subscription' | 'sent' | 'expired_pruned' | 'error';
}

/**
 * Deliver a push payload to a user. Never throws; expired endpoints are
 * pruned so future ticks don't retry dead subscriptions.
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<PushSendResult> {
  const record = getPushSubscription(userId);
  if (!record) return { sent: false, reason: 'no_subscription' };
  try {
    ensureVapidConfigured();
    await webpush.sendNotification(
      record.subscription as any,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || '/chat',
        tag: payload.tag || 'pari-reminder',
        ts: new Date().toISOString(),
      })
    );
    return { sent: true, reason: 'sent' };
  } catch (err: any) {
    const status = err?.statusCode;
    if (status === 404 || status === 410) {
      removePushSubscription(userId);
      console.log(`[PariAI] Pruned expired push subscription for user ${userId}.`);
      return { sent: false, reason: 'expired_pruned' };
    }
    console.warn('[PariAI] push send failed:', err?.message || err);
    return { sent: false, reason: 'error' };
  }
}
