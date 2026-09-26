/**
 * src/lib/ownerAuth.ts
 *
 * CANONICAL client-side owner auth/session provider for Maryam.
 *
 * There must be exactly ONE owner-auth lifecycle in the browser:
 *   login -> server creates authoritative session (token_...)
 *        -> client stores REAL session token
 *        -> every private request + every WebSocket (re)connect uses it
 *        -> stale/invalid tokens are detected and repaired via the
 *           existing legitimate owner re-auth flow (never by manual
 *           localStorage edits, never by treating a user id as a token).
 *
 * Rules enforced here:
 *  - NEVER treat a user id (e.g. 'usr_mohsin_owner') as a session token.
 *  - Detect legacy/invalid values and force re-auth instead of sending them.
 *  - Token values are never written to logs/reports from this module.
 */

export const OWNER_TOKEN_KEY = 'hoorvia_user_token';
export const OWNER_USER_KEY = 'hoorvia_user_data';
export const OWNER_COMPANION_KEY = 'hoorvia_companion_data';
export const OWNER_PLATFORM_MODE_KEY = 'hoorvia_platform_mode';

export const OWNER_USER_ID = 'usr_mohsin_owner';

// Existing legitimate local owner re-auth credential used by the app's
// first-boot auto-login flow. Kept in exactly one place. Never logged.
const OWNER_AUTO_LOGIN_PASSKEY = 'MohsinOwnerKey2026!';

export interface OwnerSession {
  token: string;
  user: any;
  companion: any;
}

/** Values that are user ids / placeholders / secrets - never valid session tokens. */
export function isStaleOwnerTokenValue(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return true;
  const v = value.trim();
  if (v.length === 0) return true;
  if (v === OWNER_USER_ID) return true;
  if (v === 'owner_secret_dev_session') return true;
  if (v === OWNER_AUTO_LOGIN_PASSKEY) return true;
  if (v === 'undefined' || v === 'null') return true;
  // Real server-issued session tokens look like token_<48 hex chars>.
  if (v.length < 20) return true;
  return false;
}

/** Current stored session token, or null when missing/stale. Never throws. */
export function getOwnerToken(): string | null {
  try {
    const raw = localStorage.getItem(OWNER_TOKEN_KEY);
    if (!raw || isStaleOwnerTokenValue(raw)) return null;
    return raw.trim();
  } catch {
    return null;
  }
}

/** Raw stored value (including stale ones) - for diagnostics/repair only. */
export function getRawStoredTokenValue(): string | null {
  try {
    return localStorage.getItem(OWNER_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredOwnerUser(): any | null {
  try {
    const raw = localStorage.getItem(OWNER_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Canonical auth headers for every private owner request. */
export function getOwnerAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getOwnerToken();
  if (!token) return { ...extra };
  return {
    ...extra,
    Authorization: `Bearer ${token}`,
    'x-hoorvia-token': token,
  };
}

/** Persist a freshly issued authoritative session. */
export function storeOwnerSession(session: OwnerSession): void {
  try {
    localStorage.setItem(OWNER_TOKEN_KEY, session.token);
    if (session.user) localStorage.setItem(OWNER_USER_KEY, JSON.stringify(session.user));
    if (session.companion) localStorage.setItem(OWNER_COMPANION_KEY, JSON.stringify(session.companion));
    if (session.user && session.user.role === 'owner' && session.user.id === OWNER_USER_ID) {
      localStorage.setItem(OWNER_PLATFORM_MODE_KEY, 'mohsin_maryam');
    }
  } catch {
    // Storage failures must not crash the app; requests will simply be unauthenticated.
  }
}

export function clearOwnerSession(): void {
  try {
    localStorage.removeItem(OWNER_TOKEN_KEY);
    localStorage.removeItem(OWNER_USER_KEY);
    localStorage.removeItem(OWNER_COMPANION_KEY);
  } catch {
    // ignore
  }
}

async function validateTokenWithServer(token: string): Promise<{ user: any; companion: any } | null> {
  try {
    const res = await fetch('/api/hoorvia/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-hoorvia-token': token,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.user) return null;
    return { user: data.user, companion: data.companion || null };
  } catch {
    return null;
  }
}

async function performOwnerReAuth(): Promise<OwnerSession | null> {
  try {
    const res = await fetch('/api/hoorvia/auth/owner-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey: OWNER_AUTO_LOGIN_PASSKEY }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.token || isStaleOwnerTokenValue(data.token)) return null;
    const session: OwnerSession = { token: data.token, user: data.user, companion: data.companion };
    storeOwnerSession(session);
    return session;
  } catch {
    return null;
  }
}

/**
 * Ensure a valid owner session exists and is stored.
 * - Returns the working session (validating any stored token first).
 * - Detects stale/invalid legacy values and repairs via re-auth.
 * - With forceRefresh=true, skips validation and mints a fresh session.
 */
export async function ensureOwnerSession(forceRefresh = false): Promise<OwnerSession | null> {
  if (!forceRefresh) {
    const existing = getOwnerToken();
    if (existing) {
      const validated = await validateTokenWithServer(existing);
      if (validated) {
        return { token: existing, user: validated.user, companion: validated.companion };
      }
      // Stored token is dead (expired / unknown after restart / foreign
      // instance). Drop it before re-auth so a bad value is never reused.
      clearOwnerSession();
    } else if (getRawStoredTokenValue()) {
      // A stale legacy value (e.g. user id) was stored - purge it.
      clearOwnerSession();
    }
  } else {
    clearOwnerSession();
  }
  return performOwnerReAuth();
}
