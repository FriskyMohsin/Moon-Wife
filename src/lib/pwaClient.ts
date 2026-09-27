/**
 * pwaClient.ts — PWA helpers owned by the Pari AI client panel.
 *
 * Push-subscription helpers used by Settings. All routes live under the
 * client contract at /api/hoorvia/client/push/* with X-Hoorvia-Token auth.
 * Everything here degrades gracefully when the service worker or the
 * Notification API is unavailable (the PWA agent owns sw.js / manifest).
 */

const PUSH_BASE = '/api/hoorvia/client/push';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getSwRegistration(timeoutMs = 8000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  return Promise.race([
    navigator.serviceWorker.ready.then((r) => r as ServiceWorkerRegistration),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

export async function getVapidPublicKey(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${PUSH_BASE}/vapid-key`, {
      headers: { 'X-Hoorvia-Token': token },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.publicKey || data.vapidKey || null;
  } catch {
    return null;
  }
}

/** True when this browser already has an active push subscription. */
export async function isPushSubscribed(): Promise<boolean> {
  try {
    const reg = await getSwRegistration();
    if (!reg || !reg.pushManager) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

export interface PushOpResult {
  ok: boolean;
  reason?: string;
}

/**
 * Subscribe this browser for push notifications (reminders, proactive messages).
 * Call only after the user granted Notification permission.
 */
export async function subscribePush(token: string): Promise<PushOpResult> {
  if (!('Notification' in window)) return { ok: false, reason: 'Notifications are not supported in this browser.' };
  if (!('PushManager' in window)) return { ok: false, reason: 'Push messaging is not supported in this browser.' };

  const reg = await getSwRegistration();
  if (!reg) {
    return {
      ok: false,
      reason: 'App service worker is not active yet. Open the installed app once, then try again.',
    };
  }

  const vapidKey = await getVapidPublicKey(token);
  if (!vapidKey) return { ok: false, reason: 'Push server is not configured yet.' };

  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      });
    }

    const res = await fetch(`${PUSH_BASE}/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hoorvia-Token': token,
      },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, reason: data.error || 'Server rejected the push subscription.' };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message || 'Push subscription failed.' };
  }
}

/** Remove this browser's push subscription server-side and locally. */
export async function unsubscribePush(token: string): Promise<PushOpResult> {
  try {
    const reg = await getSwRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    const endpoint = sub ? sub.endpoint : null;

    if (endpoint) {
      await fetch(`${PUSH_BASE}/unsubscribe`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
    if (sub) {
      await sub.unsubscribe().catch(() => {});
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message || 'Push unsubscribe failed.' };
  }
}
