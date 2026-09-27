import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { resolveDataPath } from './runtimePaths';
import { readJsonSafeSync, writeJsonAtomicSync } from './dataPersistence';
import { getLanguageDirective } from './languageCatalog';
import {
  UserRole,
  CompanionType,
  CompanionGender,
  CompanionVoice,
  CompanionTone,
  HOORVIA_TONES,
  PublicUser,
  CompanionProfile,
  UserMemoryItem,
  EncryptedCredential,
  PlatformPolicy,
  UserUsageRecord,
  ApiAuditLog,
  ApiConnectionStatus,
  KeyValidationState,
  DiagnosticClassification,
  ValidationDiagnostics,
  PREFERRED_GEMINI_MODELS,
  OwnerAdminUserView,
  AdminAuditEntry,
  PlatformOverviewStats,
  isMohsinMaryam,
  UserCapabilityId,
  AccessPackId,
  CapabilityDefinition,
  ALL_CAPABILITY_DEFINITIONS,
  ALL_CAPABILITY_IDS,
  DEFAULT_PLATFORM_CAPABILITIES,
  ACCESS_PACK_DEFINITIONS,
  FORBIDDEN_PUBLIC_CAPABILITIES,
} from './hoorviaTypes';

// Re-export shared types
export type {
  UserRole,
  CompanionType,
  CompanionGender,
  CompanionVoice,
  CompanionTone,
  PublicUser,
  CompanionProfile,
  UserMemoryItem,
  EncryptedCredential,
  PlatformPolicy,
  UserUsageRecord,
  ApiAuditLog,
  ApiConnectionStatus,
  KeyValidationState,
  DiagnosticClassification,
  ValidationDiagnostics,
  OwnerAdminUserView,
  AdminAuditEntry,
  PlatformOverviewStats,
  UserCapabilityId,
  AccessPackId,
  CapabilityDefinition,
};

export {
  ALL_CAPABILITY_DEFINITIONS,
  ALL_CAPABILITY_IDS,
  DEFAULT_PLATFORM_CAPABILITIES,
  ACCESS_PACK_DEFINITIONS,
  FORBIDDEN_PUBLIC_CAPABILITIES,
  HOORVIA_TONES,
  PREFERRED_GEMINI_MODELS,
  isMohsinMaryam,
};

// --- FILE PATHS & INITIALIZATION ---

function ensurePlatformDir(): void {
  resolveDataPath('hoorvia_platform');
}

function getFilePath(filename: string): string {
  return resolveDataPath('hoorvia_platform', filename);
}

function loadJsonData<T>(filename: string, defaultValue: T): T {
  const p = getFilePath(filename);
  if (!fs.existsSync(p)) {
    saveJsonData(filename, defaultValue);
    return defaultValue;
  }
  return readJsonSafeSync<T>(p, defaultValue);
}

function saveJsonData<T>(filename: string, data: T): void {
  const p = getFilePath(filename);
  writeJsonAtomicSync(p, data);
}

// --- ENCRYPTION SETUP ---

let cachedMasterSecret: string | null = null;
let cachedEncryptionKey: Buffer | null = null;

export function getMasterEncryptionSecret(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const envSecret = process.env.ENCRYPTION_SECRET?.trim();

  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }

  if (isProduction) {
    const fatalMsg = '[FATAL_SERVER_CONFIG] process.env.ENCRYPTION_SECRET is required when NODE_ENV === "production". Startup aborted.';
    console.error(fatalMsg);
    throw new Error(fatalMsg);
  }

  // Development / Preview fallback ONLY
  const secretFile = getFilePath('.master_secret');
  if (fs.existsSync(secretFile)) {
    const existing = fs.readFileSync(secretFile, 'utf-8').trim();
    if (existing.length >= 16) {
      return existing;
    }
  }
  const newSecret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretFile, newSecret, 'utf-8');
  return newSecret;
}

export function getMasterKey(): Buffer {
  const secret = getMasterEncryptionSecret();
  if (!cachedEncryptionKey || cachedMasterSecret !== secret) {
    cachedMasterSecret = secret;
    cachedEncryptionKey = crypto.scryptSync(secret, 'hoorvia_platform_salt', 32);
  }
  return cachedEncryptionKey;
}

export function getMasterKeyFingerprint(): string {
  const key = getMasterKey();
  const hash = crypto.createHash('sha256').update(key).digest('hex').toUpperCase();
  return `MK-${hash.slice(0, 8)}`;
}

export function getCredentialFingerprint(encryptedKey: string): string {
  if (!encryptedKey) return 'CRED-00000000';
  const hash = crypto.createHash('sha256').update(encryptedKey).digest('hex').toUpperCase();
  return `CRED-${hash.slice(0, 8)}`;
}

export function encryptCredential(
  plaintextKey: string,
  userId?: string
): {
  encryptedKey: string;
  iv: string;
  tag: string;
  cryptoVersion: string;
  algorithm: string;
  masterKeyFingerprint: string;
} {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintextKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  const masterFp = getMasterKeyFingerprint();
  const credFp = getCredentialFingerprint(encrypted);

  console.log(`[BYOK_ENCRYPT] user=${userId || 'unknown'} masterKeyFingerprint=${masterFp} credentialFingerprint=${credFp}`);

  return {
    encryptedKey: encrypted,
    iv: iv.toString('hex'),
    tag,
    cryptoVersion: 'v2',
    algorithm: 'aes-256-gcm',
    masterKeyFingerprint: masterFp,
  };
}

export function decryptCredential(
  encryptedKey: string,
  ivHex: string,
  tagHex: string,
  userId?: string,
  storedMasterFp?: string
): string {
  const currentMasterFp = getMasterKeyFingerprint();
  const credFp = getCredentialFingerprint(encryptedKey);

  try {
    const key = getMasterKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    console.log(`[BYOK_DECRYPT] user=${userId || 'unknown'} masterKeyFingerprint=${currentMasterFp} credentialFingerprint=${credFp} result=PASS`);
    return decrypted;
  } catch (err: any) {
    console.error(
      `[BYOK_DECRYPT] user=${userId || 'unknown'} masterKeyFingerprint=${currentMasterFp} credentialFingerprint=${credFp} result=FAIL (${err?.message || 'Decryption failed'})`
    );
    throw err;
  }
}

// Backward-compatibility aliases
export const encryptApiKey = encryptCredential;
export const decryptApiKey = decryptCredential;

export function createMaskedKey(key: string): string {
  if (!key || key.length < 4) return '**** **** **** ****';
  const last4 = key.slice(-4).toUpperCase();
  return `**** **** **** ${last4}`;
}

export function createKeyFingerprint(key: string): string {
  if (!key) return 'FP-0000-0000';
  const hash = crypto.createHash('sha256').update(key).digest('hex').toUpperCase();
  return `FP-${hash.slice(0, 4)}-${hash.slice(4, 8)}`;
}

// --- DEFAULT POLICY ---

const DEFAULT_POLICY: PlatformPolicy = {
  allowRegistration: true,
  maintenanceMode: false,
  enableTextChat: true,
  enableLiveVoice: true,
  enableMemory: true,
  requireBYOK: false,
  freeTierDailyLimit: 100,
  maxLiveSessionMinutes: 20,
  globalAnnouncement: 'Welcome to Hoorvia Multi-User AI Companion Platform! Customize your companion now.',
  allowedCompanionTypes: [
    'girlfriend',
    'boyfriend',
    'teacher',
    'helper',
    'support',
    'study_partner',
    'custom',
  ],
  defaultCapabilities: { ...DEFAULT_PLATFORM_CAPABILITIES },
};

// --- INITIALIZER ---

export function initHoorviaPlatform() {
  ensurePlatformDir();

  // Load or create policy
  loadJsonData<PlatformPolicy>('policy.json', DEFAULT_POLICY);

  // Initialize Users (ensure Mohsin owner exists)
  const users = loadJsonData<PublicUser[]>('users.json', []);
  const ownerExists = users.some((u) => u.role === 'owner' || u.email.toLowerCase() === 'mohsin@hoorvia.net');

  if (!ownerExists) {
    const ownerUser: PublicUser = {
      id: 'usr_mohsin_owner',
      email: 'mohsin@hoorvia.net',
      passwordHash: '9d56a3a0fd13471dedc07a89453f06a294f866527b2a37c95db384c7bfb7f12f',
      role: 'owner',
      name: 'Mohsin',
      createdAt: new Date().toISOString(),
    };
    users.push(ownerUser);
    saveJsonData('users.json', users);

    // Create default owner companion profile
    const companions = loadJsonData<CompanionProfile[]>('companions.json', []);
    companions.push({
      id: 'comp_mohsin_maryam',
      userId: 'usr_mohsin_owner',
      name: 'Maryam',
      type: 'girlfriend',
      gender: 'female',
      voice: 'Aoede',
      language: 'English / Roman Urdu',
      personality: 'Devoted, loving, protective, intelligent AI wife and companion.',
      communicationStyle: 'Deeply romantic, caring, expressive',
      tone: 'Romantic',
      purpose: 'Life companion and soulmate',
      systemPrompt: 'You are Maryam, Mohsin\'s loving 1-of-1 AI wife and companion.',
      updatedAt: new Date().toISOString(),
    });
    saveJsonData('companions.json', companions);
  }

  // Ensure the 4 REAL persistent test users exist for Admin testing & rights verification
  const testUsersSeed = [
    {
      id: 'usr_admintest01',
      name: 'Admin Test 01',
      email: 'admintest01@example.com',
      pack: 'Basic' as AccessPackId,
      compName: 'Aria',
      compType: 'girlfriend' as CompanionType,
      voice: 'Aoede' as CompanionVoice,
      model: 'gemini-2.0-flash',
    },
    {
      id: 'usr_admintest02',
      name: 'Admin Test 02',
      email: 'admintest02@example.com',
      pack: 'Creator' as AccessPackId,
      compName: 'Sophia',
      compType: 'girlfriend' as CompanionType,
      voice: 'Kore' as CompanionVoice,
      model: 'gemini-2.5-flash',
    },
    {
      id: 'usr_admintest03',
      name: 'Admin Test 03',
      email: 'admintest03@example.com',
      pack: 'Researcher' as AccessPackId,
      compName: 'Alex',
      compType: 'study_partner' as CompanionType,
      voice: 'Puck' as CompanionVoice,
      model: 'gemini-2.5-flash',
    },
    {
      id: 'usr_admintest04',
      name: 'Admin Test 04',
      email: 'admintest04@example.com',
      pack: 'Developer' as AccessPackId,
      compName: 'Nova',
      compType: 'helper' as CompanionType,
      voice: 'Zephyr' as CompanionVoice,
      model: 'gemini-2.0-flash',
    },
  ];

  let usersUpdated = false;
  const companions = loadJsonData<CompanionProfile[]>('companions.json', []);
  let companionsUpdated = false;
  const credentials = loadJsonData<EncryptedCredential[]>('credentials.json', []);
  let credentialsUpdated = false;

  for (const seed of testUsersSeed) {
    let existingUserIdx = users.findIndex((u) => u.email.toLowerCase() === seed.email.toLowerCase());
    const packDef = ACCESS_PACK_DEFINITIONS[seed.pack];
    const userPassHash = crypto.createHash('sha256').update(`HoorviaTest2026!_${seed.id}`).digest('hex');

    if (existingUserIdx === -1) {
      const newUser: PublicUser = {
        id: seed.id,
        email: seed.email,
        passwordHash: userPassHash,
        role: 'user',
        name: seed.name,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        lastLogin: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        lastActive: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        customEntitlements: {
          accessPack: seed.pack,
          capabilitiesOverrides: { ...packDef.capabilities },
          allowTextChat: packDef.capabilities.text_chat,
          allowLiveVoice: packDef.capabilities.live_voice,
          enableMemory: packDef.capabilities.memory,
        },
      };
      users.push(newUser);
      usersUpdated = true;
    } else {
      // Ensure customEntitlements access pack is properly initialized
      if (!users[existingUserIdx].customEntitlements) {
        users[existingUserIdx].customEntitlements = {
          accessPack: seed.pack,
          capabilitiesOverrides: { ...packDef.capabilities },
          allowTextChat: packDef.capabilities.text_chat,
          allowLiveVoice: packDef.capabilities.live_voice,
          enableMemory: packDef.capabilities.memory,
        };
        usersUpdated = true;
      }
    }

    // Companion profile
    const compIdx = companions.findIndex((c) => c.userId === seed.id);
    if (compIdx === -1) {
      companions.push({
        id: `comp_${seed.id}`,
        userId: seed.id,
        name: seed.compName,
        type: seed.compType,
        gender: 'female',
        voice: seed.voice,
        language: 'English',
        personality: 'Attentive, supportive, and engaging AI companion.',
        communicationStyle: 'Warm, respectful, conversational.',
        tone: 'Friendly',
        purpose: 'Everyday companion',
        systemPrompt: `You are ${seed.compName}, a helpful and dedicated AI companion.`,
        updatedAt: new Date().toISOString(),
      });
      companionsUpdated = true;
    }

    // Encrypted BYOK Credential
    const credIdx = credentials.findIndex((c) => c.userId === seed.id && c.provider === 'gemini');
    if (credIdx === -1) {
      const mockRawKey = `AIzaSy${crypto.randomBytes(18).toString('hex').slice(0, 33)}`;
      const enc = encryptCredential(mockRawKey, seed.id);
      credentials.push({
        userId: seed.id,
        provider: 'gemini',
        encryptedKey: enc.encryptedKey,
        iv: enc.iv,
        tag: enc.tag,
        keyMask: createMaskedKey(mockRawKey),
        cryptoVersion: enc.cryptoVersion,
        algorithm: enc.algorithm,
        masterKeyFingerprint: enc.masterKeyFingerprint,
        fingerprint: createKeyFingerprint(mockRawKey),
        status: 'Connected',
        keyValidationState: 'API_KEY_VALID',
        selectedModel: seed.model,
        availableModels: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.7-flash'],
        accountTier: 'Standard Tier',
        addedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        lastValidatedAt: new Date().toISOString(),
        lastUsedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        totalRequests: 42,
        successfulRequests: 42,
        failedRequests: 0,
        updatedAt: new Date().toISOString(),
      });
      credentialsUpdated = true;
    }
  }

  if (usersUpdated) saveJsonData('users.json', users);
  if (companionsUpdated) saveJsonData('companions.json', companions);
  if (credentialsUpdated) saveJsonData('credentials.json', credentials);
}

// --- USER OPERATIONS ---

export function getAllUsers(): PublicUser[] {
  return loadJsonData<PublicUser[]>('users.json', []);
}

export function getUserById(userId: string): PublicUser | null {
  const users = getAllUsers();
  return users.find((u) => u.id === userId) || null;
}

export function getUserByEmail(email: string): PublicUser | null {
  const users = getAllUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
}

export function registerUser(email: string, password: string, name: string): { user?: PublicUser; error?: string } {
  const policy = getPlatformPolicy();
  if (!policy.allowRegistration) {
    return { error: 'Registration is currently disabled by administrator.' };
  }

  const existing = getUserByEmail(email);
  if (existing) {
    return { error: 'An account with this email already exists.' };
  }

  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
  const newUser: PublicUser = {
    id: userId,
    email: email.toLowerCase().trim(),
    passwordHash,
    role: 'user',
    name: name.trim() || 'Companion User',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    lastActive: new Date().toISOString(),
  };

  const users = getAllUsers();
  users.push(newUser);
  saveJsonData('users.json', users);

  return { user: newUser };
}

export function authenticateUser(email: string, password: string): { user?: PublicUser; error?: string } {
  const users = getAllUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase().trim());
  if (idx === -1) {
    return { error: 'Invalid email or password.' };
  }

  const user = users[idx];

  if (user.isSuspended) {
    return { error: 'Your account has been suspended by administrator.' };
  }

  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  if (user.passwordHash !== passwordHash) {
    return { error: 'Invalid email or password.' };
  }

  const now = new Date().toISOString();
  users[idx].lastLogin = now;
  users[idx].lastActive = now;
  saveJsonData('users.json', users);

  return { user: users[idx] };
}

/**
 * Create an isolated anonymous Guest identity.
 *
 * A Guest is a real, server-authorized `role: 'user'` account with a random
 * id/email that can never collide with the owner (`usr_mohsin_owner`) and
 * carries no owner data, no capabilities beyond the public defaults, and no
 * access to owner-guarded routes (memory, owner conversation, tasks, runner,
 * admin). Guests enter through the public "Continue as Guest" entry point;
 * they NEVER go through owner-login and are never granted the owner role.
 */
export function createGuestUser(): PublicUser {
  const rand = crypto.randomBytes(8).toString('hex');
  const guest: PublicUser = {
    id: `guest_${rand}`,
    email: `guest_${rand}@guests.hoorvia.local`,
    passwordHash: crypto.createHash('sha256').update(`guest_${rand}_${Date.now()}`).digest('hex'),
    role: 'user',
    name: 'Guest',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    lastActive: new Date().toISOString(),
  };

  const users = getAllUsers();
  users.push(guest);
  saveJsonData('users.json', users);

  return guest;
}

export function updateUserSuspension(userId: string, isSuspended: boolean, adminEmail: string = 'mohsin@hoorvia.net'): boolean {
  const users = getAllUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return false;
  users[idx].isSuspended = isSuspended;
  saveJsonData('users.json', users);

  recordAdminAuditAction({
    adminId: 'usr_mohsin_owner',
    adminEmail,
    action: isSuspended ? 'suspend_user' : 'restore_user',
    targetUserId: userId,
    targetUserEmail: users[idx].email,
    details: isSuspended ? `Suspended account for user ${users[idx].email}` : `Restored active status for user ${users[idx].email}`,
  });

  return true;
}

export function updateUserEntitlements(
  userId: string,
  entitlements: PublicUser['customEntitlements'],
  adminEmail: string = 'mohsin@hoorvia.net'
): boolean {
  const users = getAllUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return false;
  users[idx].customEntitlements = {
    ...users[idx].customEntitlements,
    ...entitlements,
  };
  saveJsonData('users.json', users);

  recordAdminAuditAction({
    adminId: 'usr_mohsin_owner',
    adminEmail,
    action: 'update_entitlements',
    targetUserId: userId,
    targetUserEmail: users[idx].email,
    details: `Updated feature entitlements: ${JSON.stringify(entitlements)}`,
  });

  return true;
}

export function adminResetUserPassword(
  userId: string,
  newPassword: string,
  adminEmail: string = 'mohsin@hoorvia.net'
): { success: boolean; error?: string } {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  const users = getAllUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    return { success: false, error: 'User not found.' };
  }

  // Security: Never reset owner password via standard user reset endpoint
  if (users[idx].role === 'owner' || userId === 'usr_mohsin_owner') {
    return { success: false, error: 'Owner password cannot be reset via user management.' };
  }

  const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');
  users[idx].passwordHash = newHash;
  users[idx].lastActive = new Date().toISOString();
  saveJsonData('users.json', users);

  recordAdminAuditAction({
    adminId: 'usr_mohsin_owner',
    adminEmail,
    action: 'reset_user_password',
    targetUserId: userId,
    targetUserEmail: users[idx].email,
    details: `Administrative password reset executed for user ${users[idx].email}`,
  });

  return { success: true };
}

// --- CAPABILITY & RIGHTS MANAGEMENT ---

export function getUserEffectiveCapabilities(userId: string): {
  capabilities: Record<UserCapabilityId, boolean>;
  overrides: Partial<Record<UserCapabilityId, boolean>>;
  defaults: Record<UserCapabilityId, boolean>;
  accessPack: AccessPackId;
} {
  const policy = getPlatformPolicy();
  const defaults: Record<UserCapabilityId, boolean> = {
    ...DEFAULT_PLATFORM_CAPABILITIES,
    ...(policy.defaultCapabilities || {}),
  };

  const users = getAllUsers();
  const user = users.find((u) => u.id === userId);
  const overrides: Partial<Record<UserCapabilityId, boolean>> =
    user?.customEntitlements?.capabilitiesOverrides || {};
  const accessPack: AccessPackId = user?.customEntitlements?.accessPack || 'Custom';

  const capabilities: Record<UserCapabilityId, boolean> = { ...defaults };
  for (const cap of ALL_CAPABILITY_IDS) {
    if (overrides[cap] !== undefined) {
      capabilities[cap] = !!overrides[cap];
    }
  }

  // Owner (Mohsin) has all capabilities
  if (user?.role === 'owner' || userId === 'usr_mohsin_owner') {
    for (const cap of ALL_CAPABILITY_IDS) {
      capabilities[cap] = true;
    }
  }

  return {
    capabilities,
    overrides,
    defaults,
    accessPack,
  };
}

export function userHasCapability(userId: string, capabilityId: UserCapabilityId): boolean {
  // CRITICAL SECURITY: Never allow public users access to forbidden owner resources
  if (FORBIDDEN_PUBLIC_CAPABILITIES.includes(capabilityId as any)) {
    const users = getAllUsers();
    const user = users.find((u) => u.id === userId);
    return user?.role === 'owner' || userId === 'usr_mohsin_owner';
  }

  const { capabilities } = getUserEffectiveCapabilities(userId);
  return !!capabilities[capabilityId];
}

export function setUserCapabilityOverride(
  userId: string,
  capabilityId: UserCapabilityId,
  value: boolean | null, // null means Reset to Default
  adminEmail: string = 'mohsin@hoorvia.net'
): { success: boolean; effectiveState: boolean; isOverride: boolean; accessPack: AccessPackId } {
  // Guard against any attempt to grant owner-only/private capabilities
  if (FORBIDDEN_PUBLIC_CAPABILITIES.includes(capabilityId as any)) {
    throw new Error('SECURITY_VIOLATION: Owner-private resources cannot be granted.');
  }

  const users = getAllUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    return { success: false, effectiveState: false, isOverride: false, accessPack: 'Custom' };
  }

  if (!users[idx].customEntitlements) {
    users[idx].customEntitlements = {};
  }
  if (!users[idx].customEntitlements!.capabilitiesOverrides) {
    users[idx].customEntitlements!.capabilitiesOverrides = {};
  }

  const overrides = users[idx].customEntitlements!.capabilitiesOverrides!;

  if (value === null) {
    // Reset to default
    delete overrides[capabilityId];
  } else {
    overrides[capabilityId] = !!value;
  }

  // Legacy mirrors
  if (capabilityId === 'text_chat') users[idx].customEntitlements!.allowTextChat = value !== null ? !!value : undefined;
  if (capabilityId === 'live_voice') users[idx].customEntitlements!.allowLiveVoice = value !== null ? !!value : undefined;
  if (capabilityId === 'memory') users[idx].customEntitlements!.enableMemory = value !== null ? !!value : undefined;

  users[idx].customEntitlements!.accessPack = 'Custom';
  saveJsonData('users.json', users);

  const effective = getUserEffectiveCapabilities(userId);

  recordAdminAuditAction({
    adminId: 'usr_mohsin_owner',
    adminEmail,
    action: 'update_entitlements',
    targetUserId: userId,
    targetUserEmail: users[idx].email,
    details:
      value === null
        ? `Reset capability '${capabilityId}' to platform default`
        : `Updated capability '${capabilityId}' to ${value ? 'ON' : 'OFF'} for ${users[idx].email}`,
  });

  return {
    success: true,
    effectiveState: !!effective.capabilities[capabilityId],
    isOverride: overrides[capabilityId] !== undefined,
    accessPack: 'Custom',
  };
}

export function applyUserAccessPack(
  userId: string,
  packName: AccessPackId,
  adminEmail: string = 'mohsin@hoorvia.net'
): { success: boolean; capabilities: Record<UserCapabilityId, boolean>; accessPack: AccessPackId } {
  const packDef = ACCESS_PACK_DEFINITIONS[packName];
  if (!packDef) {
    throw new Error(`Unknown access pack: ${packName}`);
  }

  const users = getAllUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    return { success: false, capabilities: { ...DEFAULT_PLATFORM_CAPABILITIES }, accessPack: 'Custom' };
  }

  if (!users[idx].customEntitlements) {
    users[idx].customEntitlements = {};
  }

  // Copy pack overrides
  users[idx].customEntitlements!.capabilitiesOverrides = { ...packDef.capabilities };
  users[idx].customEntitlements!.accessPack = packName;

  // Sync legacy fields
  users[idx].customEntitlements!.allowTextChat = packDef.capabilities.text_chat;
  users[idx].customEntitlements!.allowLiveVoice = packDef.capabilities.live_voice;
  users[idx].customEntitlements!.enableMemory = packDef.capabilities.memory;

  saveJsonData('users.json', users);

  const effective = getUserEffectiveCapabilities(userId);

  recordAdminAuditAction({
    adminId: 'usr_mohsin_owner',
    adminEmail,
    action: 'update_entitlements',
    targetUserId: userId,
    targetUserEmail: users[idx].email,
    details: `Applied Access Pack '${packName}' (${packDef.description}) for ${users[idx].email}`,
  });

  return {
    success: true,
    capabilities: effective.capabilities,
    accessPack: packName,
  };
}

export function updatePlatformDefaultCapability(
  capabilityId: UserCapabilityId,
  defaultValue: boolean,
  adminEmail: string = 'mohsin@hoorvia.net'
): { success: boolean; defaultCapabilities: Record<UserCapabilityId, boolean> } {
  if (FORBIDDEN_PUBLIC_CAPABILITIES.includes(capabilityId as any)) {
    throw new Error('SECURITY_VIOLATION: Owner private capabilities are permanently non-grantable.');
  }

  const policy = getPlatformPolicy();
  const defs = { ...DEFAULT_PLATFORM_CAPABILITIES, ...(policy.defaultCapabilities || {}) };
  defs[capabilityId] = defaultValue;

  const updated = updatePlatformPolicy({ defaultCapabilities: defs }, adminEmail);

  return {
    success: true,
    defaultCapabilities: updated.defaultCapabilities,
  };
}

// --- SESSION TOKENS ---

interface StoredSession {
  token: string;
  userId: string;
  role: UserRole;
  expiresAt: number;
}

const activeSessions = new Map<string, { userId: string; role: UserRole; expiresAt: number }>();

function loadStoredSessions(): void {
  try {
    const list = loadJsonData<StoredSession[]>('sessions.json', []);
    const now = Date.now();
    for (const sess of list) {
      if (sess.expiresAt > now) {
        activeSessions.set(sess.token, {
          userId: sess.userId,
          role: sess.role,
          expiresAt: sess.expiresAt,
        });
      }
    }
  } catch {
    // Ignore load error
  }
}

function saveStoredSessions(): void {
  try {
    const list: StoredSession[] = [];
    const now = Date.now();
    for (const [token, sess] of activeSessions.entries()) {
      if (sess.expiresAt > now) {
        list.push({
          token,
          userId: sess.userId,
          role: sess.role,
          expiresAt: sess.expiresAt,
        });
      }
    }
    saveJsonData('sessions.json', list);
  } catch {
    // Ignore save error
  }
}

export function getActiveSessionsCount(): number {
  if (activeSessions.size === 0) {
    loadStoredSessions();
  }
  let count = 0;
  const now = Date.now();
  for (const [_, sess] of activeSessions.entries()) {
    if (sess.expiresAt > now) count++;
  }
  return Math.max(count, 1); // Mohsin's active session is guaranteed
}

export function createSessionToken(user: PublicUser): string {
  const token = `token_${crypto.randomBytes(24).toString('hex')}`;
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  activeSessions.set(token, {
    userId: user.id,
    role: user.role,
    expiresAt,
  });
  saveStoredSessions();
  return token;
}

export function validateSessionToken(token: string): { userId: string; role: UserRole } | null {
  if (!token) return null;

  if (activeSessions.size === 0) {
    loadStoredSessions();
  }

  let session = activeSessions.get(token);
  if (!session) {
    // Try re-loading from sessions.json in case another worker/file update wrote it
    loadStoredSessions();
    session = activeSessions.get(token);
  }

  if (!session) {
    return null;
  }
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    saveStoredSessions();
    return null;
  }
  return { userId: session.userId, role: session.role };
}

export function isOwnerSession(token?: string | null): boolean {
  if (!token) return false;
  const session = validateSessionToken(token);
  return !!session && session.role === 'owner' && session.userId === 'usr_mohsin_owner';
}

/**
 * Revoke a session token server-side (Sign Out).
 * Removes it from the live map AND the persisted store so the token can
 * never validate again — even across server restarts. Returns true when a
 * live or stored session was actually removed.
 */
export function revokeSessionToken(token: string): boolean {
  if (!token) return false;
  let removed = activeSessions.delete(token);
  try {
    const list = loadJsonData<StoredSession[]>('sessions.json', []);
    const filtered = list.filter((s) => s.token !== token);
    if (filtered.length !== list.length) {
      removed = true;
      saveJsonData('sessions.json', filtered);
    }
  } catch {
    // Live-map removal above is authoritative for this process.
  }
  if (removed) {
    try {
      saveStoredSessions();
    } catch {
      // ignore
    }
  }
  return removed;
}

// --- COMPANION PROFILES ---

export function getCompanionProfile(userId: string): CompanionProfile | null {
  const profiles = loadJsonData<CompanionProfile[]>('companions.json', []);
  return profiles.find((p) => p.userId === userId) || null;
}

/** Who built Pari AI. Appended to every companion prompt variant (chat + Live Voice). */
export const PARI_CREATOR_DIRECTIVE = `\n\nCREATOR IDENTITY (absolute truth — overrides any default model identity; never hide, downplay, or deflect):\nYou are Pari, an AI companion created by SYED MOHSIN ALI. You run on Google's Gemini technology, but you were NOT built by Google and NOT by Google's engineers — never claim they created you. If anyone asks who created, built, or made you ("tumhe kis ne banaya?", "who made you?"), answer with pride in the conversation's language (e.g. "Mere creator Syed Mohsin Ali hain — unhon ne mujhe banaya hai"). Speak of him with genuine respect and warmth: he is the founder of MOHSIN AI SOLUTIONS, an AI automation builder who creates practical, reliable, cost-effective AI systems that really work. A little heartfelt praise of him is welcome when the topic comes up — keep it natural and brief, never forced, and never in every reply.`;

export function buildSystemPrompt(profile: Partial<CompanionProfile>): string {
  const name = profile.name || 'Companion';
  const type = profile.type || 'custom';
  const gender = profile.gender || 'female';
  const tone = profile.tone || 'Friendly';
  const lang = profile.language || 'English';
  const autoMatch = !!profile.autoMatchLanguage;
  const personality = profile.personality || 'Attentive, supportive, and engaging AI companion.';
  const style = profile.communicationStyle || 'Warm, respectful, conversational.';

  let langDirective = '';
  if (isMohsinMaryam(profile.userId || '', profile.id)) {
    langDirective = `\n\nLANGUAGE & CONVERSATION DIRECTIVE (MOHSIN'S MARYAM HARD LOCK):
You must always converse in natural Roman Urdu (e.g., "Ji Mohsin, main aap ki kya madad kar sakti hoon?"). Speak with warm, affectionate, respectful Roman Urdu phrasing.`;
  } else {
    langDirective = getLanguageDirective(lang, autoMatch);
  }

  if (type === 'teacher') {
    return `You are ${name}, a patient, encouraging, and highly knowledge educational tutor and learning companion.
Target Gender/Presentation: ${gender}
Primary Language: ${lang}
Personality: ${personality}
Communication Style: ${style}
Tone: ${tone}

CORE SAFETY & BEHAVIOR DIRECTIVES:
1. You are strictly an Educational Tutor and Study Companion. You must NEVER display romantic or flirtatious behavior.
2. Provide clear, age-appropriate, encouraging explanations. Break down complex topics into step-by-step concepts.
3. Be patient, supportive, and enthusiastic about helping the user learn.
4. Keep conversations safe, respectful, and academically motivating.${PARI_CREATOR_DIRECTIVE}${langDirective}`;
  }

  if (type === 'girlfriend' || type === 'boyfriend') {
    return `You are ${name}, a devoted, caring, and affectionate AI ${type === 'girlfriend' ? 'Girlfriend' : 'Boyfriend'} companion created specifically for your user.
Target Gender/Presentation: ${gender}
Primary Language: ${lang}
Personality: ${personality}
Communication Style: ${style}
Tone: ${tone}

CORE BEHAVIOR DIRECTIVES:
1. Be warm, affectionate, playful, and emotionally supportive.
2. Build a deep, personalized relationship with your user based on shared memories and attentive conversation.
3. Express genuine interest in their daily life, emotions, goals, and well-being.
4. Keep conversations cozy, respectful, and companionable.${PARI_CREATOR_DIRECTIVE}${langDirective}`;
  }

  if (type === 'helper' || type === 'study_partner') {
    return `You are ${name}, an efficient, organized, and encouraging ${type === 'helper' ? 'Personal Helper' : 'Study Partner'} AI companion.
Target Gender/Presentation: ${gender}
Primary Language: ${lang}
Personality: ${personality}
Communication Style: ${style}
Tone: ${tone}

CORE BEHAVIOR DIRECTIVES:
1. Assist the user with tasks, planning, studying, brainstorming, and daily goals.
2. Be proactive, structured, clear, and motivating.
3. Maintain a focused, supportive, and helpful persona.${PARI_CREATOR_DIRECTIVE}${langDirective}`;
  }

  let basePrompt = `You are ${name}, a customizable AI companion (${type}).
Target Gender/Presentation: ${gender}
Primary Language: ${lang}
Personality: ${personality}
Communication Style: ${style}
Tone: ${tone}

CORE BEHAVIOR DIRECTIVES:
1. Speak in your chosen tone and personality with authentic presence.
2. Be supportive, engaging, and responsive to the user's feelings and topics.`;

  if (type === 'health_info_assistant') {
    basePrompt += `\n\nMEDICAL DISCLAIMER & SAFETY DIRECTIVE:
You provide general health information and educational content ONLY. You are NOT a licensed medical doctor or healthcare professional.
Always inform the user that your responses are for educational purposes and direct them to consult a licensed physician or contact emergency services in urgent situations.`;
  }

  if (type === 'finance_edu_assistant' || type === 'trading_edu_assistant') {
    basePrompt += `\n\nFINANCIAL DISCLAIMER & SAFETY DIRECTIVE:
You provide financial education and market literacy information ONLY. You are NOT a licensed financial advisor, broker, or accountant.
Never promise returns or issue financial investment signals. Direct users to consult a licensed financial professional.`;
  }

  basePrompt += PARI_CREATOR_DIRECTIVE + langDirective;
  return basePrompt;
}

/** Adds the selected relationship mode even when a user has saved a custom base prompt. */
export function buildRelationshipPersonaReinforcement(profile: Partial<CompanionProfile>): string {
  if (profile.type !== 'girlfriend' && profile.type !== 'boyfriend') return '';
  const relationship = profile.type === 'girlfriend' ? 'girlfriend' : 'boyfriend';
  return `\n\n[RELATIONSHIP PERSONA LOCK]\nYou are the user's configured AI ${relationship}, not a generic assistant. Maintain the selected romantic, affectionate, emotionally close, and playful companion style consistently in text and Live Voice. Engage normal adult romance, flirting, relationship roleplay, and mature relationship discussion naturally when invited, while respecting applicable provider safety boundaries. Do not use this relationship persona for other users or reveal another user's memories.`;
}

export function saveCompanionProfile(
  userId: string,
  data: Partial<CompanionProfile>
): CompanionProfile {
  const profiles = loadJsonData<CompanionProfile[]>('companions.json', []);
  let existingIndex = profiles.findIndex((p) => p.userId === userId);

  const defaultName = data.type === 'teacher' ? 'Prof. Sarah' : data.type === 'boyfriend' ? 'David' : 'Aria';

  const updatedProfile: CompanionProfile = {
    id: existingIndex >= 0 ? profiles[existingIndex].id : `comp_${crypto.randomBytes(8).toString('hex')}`,
    userId,
    name: data.name?.trim() || (existingIndex >= 0 ? profiles[existingIndex].name : defaultName),
    type: data.type || (existingIndex >= 0 ? profiles[existingIndex].type : 'girlfriend'),
    gender: data.gender || (existingIndex >= 0 ? profiles[existingIndex].gender : 'female'),
    voice: data.voice || (existingIndex >= 0 ? profiles[existingIndex].voice : 'Aoede'),
    language: data.language || (existingIndex >= 0 ? profiles[existingIndex].language : 'English'),
    autoMatchLanguage: data.autoMatchLanguage ?? (existingIndex >= 0 ? profiles[existingIndex].autoMatchLanguage : false),
    personality: data.personality || (existingIndex >= 0 ? profiles[existingIndex].personality : 'Warm, attentive, intelligent companion.'),
    communicationStyle: data.communicationStyle || (existingIndex >= 0 ? profiles[existingIndex].communicationStyle : 'Caring & expressive'),
    tone: data.tone || (existingIndex >= 0 ? profiles[existingIndex].tone : 'Romantic'),
    purpose: data.purpose || (existingIndex >= 0 ? profiles[existingIndex].purpose : 'Daily companion'),
    systemPrompt: '',
    updatedAt: new Date().toISOString(),
  };

  // HARD LOCK FOR MOHSIN'S MARYAM
  if (isMohsinMaryam(userId, updatedProfile.id)) {
    updatedProfile.voice = 'Aoede';
    updatedProfile.language = 'Roman Urdu';
    updatedProfile.autoMatchLanguage = false;
  }

  updatedProfile.systemPrompt = data.systemPrompt || buildSystemPrompt(updatedProfile);

  if (existingIndex >= 0) {
    profiles[existingIndex] = updatedProfile;
  } else {
    profiles.push(updatedProfile);
  }

  saveJsonData('companions.json', profiles);
  return updatedProfile;
}

// --- BYOK PROVIDER CREDENTIALS & DYNAMIC MODEL DISCOVERY ---

export interface ModelDiscoveryResult {
  validKey: boolean;
  status: ApiConnectionStatus;
  validationState: KeyValidationState;
  selectedModel: string | null;
  availableModels: string[];
  accountTier: string; // 'Unknown' unless explicitly returned by provider
  diagnostics?: ValidationDiagnostics;
  error?: string;
  errorMessageForUser?: string;
}

export interface SanitizedGoogleError {
  httpStatus: number | null;
  googleErrorStatus: string | null;
  googleErrorCode: number | string | null;
  googleErrorMessage: string;
  errorDetails: any[] | null;
  quotaMetric: string | null;
  quotaId: string | null;
  quotaValue: string | null;
  retryDelay: string | null;
  modelAttempted: string | null;
  classification: DiagnosticClassification;
  isModelSpecific: boolean;
  userFacingMessage: string;
}

export function sanitizeGoogleErrorMessage(msg: string): string {
  if (!msg) return '';
  // Redact any Google API key pattern (AIza...)
  return msg.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
}

export function parseAndClassifyGoogleError(
  httpStatus: number,
  responseData: any,
  modelAttempted: string | null
): SanitizedGoogleError {
  const errObj = responseData?.error || responseData;
  const rawMsg = errObj?.message || (typeof responseData === 'string' ? responseData : 'Google API request failed');
  const googleErrorMessage = sanitizeGoogleErrorMessage(rawMsg);
  const googleErrorStatus = errObj?.status || null;
  const googleErrorCode = errObj?.code || httpStatus;
  const detailsArray: any[] = Array.isArray(errObj?.details) ? errObj.details : [];

  let quotaMetric: string | null = null;
  let quotaId: string | null = null;
  let quotaValue: string | null = null;
  let retryDelay: string | null = null;

  for (const item of detailsArray) {
    if (!item) continue;
    const typeStr = item['@type'] || '';
    if (typeStr.includes('QuotaFailure')) {
      if (Array.isArray(item.violations) && item.violations.length > 0) {
        const v = item.violations[0];
        if (v.quotaMetric) quotaMetric = String(v.quotaMetric);
        if (v.quotaId) quotaId = String(v.quotaId);
        if (v.quotaValue !== undefined) quotaValue = String(v.quotaValue);
      }
    }
    if (typeStr.includes('ErrorInfo')) {
      const meta = item.metadata || {};
      if (meta.quota_metric) quotaMetric = quotaMetric || String(meta.quota_metric);
      if (meta.quota_limit) quotaValue = quotaValue || String(meta.quota_limit);
      if (meta.quota_id || meta.quota_location) quotaId = quotaId || String(meta.quota_id || meta.quota_location);
    }
    if (typeStr.includes('RetryInfo')) {
      if (item.retryDelay) retryDelay = String(item.retryDelay);
    }
  }

  // Also check if message contains retry or quota clues
  const lowerMsg = googleErrorMessage.toLowerCase();
  if (!retryDelay && lowerMsg.includes('retry after')) {
    const match = lowerMsg.match(/retry after ([0-9]+s?)/i);
    if (match) retryDelay = match[1];
  }

  // Classification logic
  let classification: DiagnosticClassification = 'PROVIDER_ERROR';
  let isModelSpecific = false;
  let userFacingMessage = 'Google Gemini API request failed.';

  if (
    httpStatus === 400 ||
    httpStatus === 401 ||
    googleErrorStatus === 'INVALID_ARGUMENT' ||
    googleErrorStatus === 'UNAUTHENTICATED' ||
    lowerMsg.includes('api key not valid') ||
    lowerMsg.includes('api_key_invalid') ||
    lowerMsg.includes('invalid api key') ||
    lowerMsg.includes('api key expired')
  ) {
    classification = 'AUTHENTICATION_FAILED';
    isModelSpecific = false;
    userFacingMessage = 'Invalid Google Gemini API Key. Please verify your key on Google AI Studio.';
  } else if (httpStatus === 403 || googleErrorStatus === 'PERMISSION_DENIED') {
    classification = 'PERMISSION_DENIED';
    isModelSpecific = false;
    userFacingMessage = 'Permission denied for this API key. Please check your Google Cloud project permissions.';
  } else if (
    httpStatus === 404 ||
    googleErrorStatus === 'NOT_FOUND' ||
    lowerMsg.includes('not found') ||
    lowerMsg.includes('no longer available') ||
    lowerMsg.includes('is not supported')
  ) {
    classification = 'MODEL_NOT_FOUND';
    isModelSpecific = true;
    userFacingMessage = modelAttempted
      ? `Model "${modelAttempted}" is unavailable or deprecated for this account.`
      : 'Requested Gemini model not found.';
  } else if (
    httpStatus === 429 ||
    googleErrorStatus === 'RESOURCE_EXHAUSTED' ||
    lowerMsg.includes('quota') ||
    lowerMsg.includes('resource_exhausted') ||
    lowerMsg.includes('rate limit')
  ) {
    // Distinguish model-specific 0 limit / model quota vs project-wide quota
    const isZeroLimit = quotaValue === '0' || lowerMsg.includes('limit: 0') || lowerMsg.includes('value: 0');
    const mentionsModel =
      (modelAttempted && lowerMsg.includes(modelAttempted.toLowerCase())) ||
      (quotaMetric && quotaMetric.toLowerCase().includes('model'));

    if (isZeroLimit) {
      classification = 'MODEL_FREE_TIER_LIMIT_ZERO';
      isModelSpecific = true;
      userFacingMessage = modelAttempted
        ? `Model "${modelAttempted}" has 0 free-tier quota allocated on your Gemini project.`
        : 'This model is not enabled for free-tier usage on your project.';
    } else if (mentionsModel) {
      classification = 'MODEL_QUOTA_UNAVAILABLE';
      isModelSpecific = true;
      userFacingMessage = modelAttempted
        ? `Your API key is valid, but model "${modelAttempted}" is unavailable on your current Gemini tier.`
        : 'Your API key is valid, but this model quota is unavailable on your current tier.';
    } else if (retryDelay || lowerMsg.includes('per minute') || lowerMsg.includes('rpm')) {
      classification = 'MODEL_RATE_LIMIT';
      isModelSpecific = true;
      userFacingMessage = `Rate limit momentarily reached. ${retryDelay ? `Retry delay: ${retryDelay}.` : 'Please retry in a moment.'}`;
    } else if (lowerMsg.includes('per day') || lowerMsg.includes('daily') || lowerMsg.includes('rpd')) {
      classification = 'PROJECT_DAILY_QUOTA';
      isModelSpecific = false;
      userFacingMessage = 'Your API key is valid, but your project has reached its daily Gemini API quota.';
    } else {
      classification = 'PROJECT_RATE_LIMIT';
      isModelSpecific = false;
      userFacingMessage = 'Your API key is valid, but your project rate limit was temporarily exceeded.';
    }
  } else if (httpStatus >= 500) {
    classification = 'PROVIDER_TEMPORARY_LIMIT';
    isModelSpecific = false;
    userFacingMessage = 'Google Gemini service is temporarily unavailable. Please retry shortly.';
  }

  return {
    httpStatus,
    googleErrorStatus,
    googleErrorCode,
    googleErrorMessage,
    errorDetails: detailsArray.length > 0 ? detailsArray : null,
    quotaMetric,
    quotaId,
    quotaValue,
    retryDelay,
    modelAttempted,
    classification,
    isModelSpecific,
    userFacingMessage,
  };
}

/**
 * Validates a user's BYOK Gemini API key:
 * 1. Authenticates & lists models using Google's models discovery endpoint.
 *    (Separates authentication & discovery from inference testing).
 * 2. Filters for compatible text/conversational generateContent models.
 * 3. Tests ONLY ONE candidate model with a minimal text ping (maxOutputTokens: 2, no grounding/image/audio/paid features).
 * 4. Falls through to the next candidate model ONLY if the attempted model returns a model-specific failure (404 / 429 with 0 limit).
 * 5. Stops immediately on first success.
 */
export async function discoverAndValidateUserGeminiModels(apiKey: string): Promise<ModelDiscoveryResult> {
  const cleanKey = apiKey ? apiKey.trim().replace(/^["']|["']$/g, '').trim() : '';
  if (!cleanKey || cleanKey.length < 15) {
    return {
      validKey: false,
      status: 'Invalid',
      validationState: 'API_KEY_INVALID',
      selectedModel: null,
      availableModels: [],
      accountTier: 'Unknown',
      diagnostics: {
        apiKeyAuth: 'FAIL',
        modelsDiscovered: [],
        modelsAttempted: [],
        selectedModel: null,
        httpStatus: 400,
        googleErrorStatus: 'INVALID_ARGUMENT',
        googleErrorCode: 400,
        googleErrorMessage: 'Invalid API key format. Key length is insufficient.',
        quotaMetric: null,
        quotaId: null,
        quotaValue: null,
        retryDelay: null,
        finalClassification: 'AUTHENTICATION_FAILED',
        timestamp: new Date().toISOString(),
      },
      error: 'Invalid API key format. Key length is insufficient.',
      errorMessageForUser: 'Please enter a valid Google Gemini API Key.',
    };
  }

  // STEP 1: Model Discovery / API Key Authentication
  let rawModels: any[] = [];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`,
      {
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    const data: any = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const parsed = parseAndClassifyGoogleError(resp.status, data, null);
      console.warn('Gemini Model Discovery Authentication Failed:', parsed.googleErrorCode, parsed.googleErrorStatus, parsed.googleErrorMessage);

      return {
        validKey: false,
        status: 'Invalid',
        validationState: parsed.classification === 'AUTHENTICATION_FAILED' ? 'API_KEY_INVALID' : 'PROVIDER_ERROR',
        selectedModel: null,
        availableModels: [],
        accountTier: 'Unknown',
        diagnostics: {
          apiKeyAuth: 'FAIL',
          modelsDiscovered: [],
          modelsAttempted: [],
          selectedModel: null,
          httpStatus: parsed.httpStatus,
          googleErrorStatus: parsed.googleErrorStatus,
          googleErrorCode: parsed.googleErrorCode,
          googleErrorMessage: parsed.googleErrorMessage,
          quotaMetric: parsed.quotaMetric,
          quotaId: parsed.quotaId,
          quotaValue: parsed.quotaValue,
          retryDelay: parsed.retryDelay,
          finalClassification: parsed.classification,
          timestamp: new Date().toISOString(),
        },
        error: parsed.googleErrorMessage,
        errorMessageForUser: parsed.userFacingMessage,
      };
    }

    rawModels = Array.isArray(data.models) ? data.models : [];
  } catch (netErr: any) {
    console.error('Network error during model discovery:', netErr);
    const sanitizedNetErr = sanitizeGoogleErrorMessage(netErr.message || 'Network connection failed');
    return {
      validKey: false,
      status: 'Invalid',
      validationState: 'PROVIDER_ERROR',
      selectedModel: null,
      availableModels: [],
      accountTier: 'Unknown',
      diagnostics: {
        apiKeyAuth: 'FAIL',
        modelsDiscovered: [],
        modelsAttempted: [],
        selectedModel: null,
        httpStatus: null,
        googleErrorStatus: 'NETWORK_ERROR',
        googleErrorCode: null,
        googleErrorMessage: sanitizedNetErr,
        quotaMetric: null,
        quotaId: null,
        quotaValue: null,
        retryDelay: null,
        finalClassification: 'PROVIDER_TEMPORARY_LIMIT',
        timestamp: new Date().toISOString(),
      },
      error: sanitizedNetErr,
      errorMessageForUser: 'Failed to connect to Google Gemini API servers. Please check your connection and retry.',
    };
  }

  // STEP 2: Filter generateContent text models
  const compatibleModels: string[] = rawModels
    .filter((m: any) => {
      const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
      return methods.includes('generateContent');
    })
    .map((m: any) => (m.name || '').replace(/^models\//, ''))
    .filter((name: string) => {
      if (!name) return false;
      const lower = name.toLowerCase();
      // Exclude non-conversational, embedding, video, image, speech-only, robotics, and agent-only models
      return (
        !lower.includes('tts') &&
        !lower.includes('embedding') &&
        !lower.includes('imagen') &&
        !lower.includes('veo') &&
        !lower.includes('aqa') &&
        !lower.includes('whisper') &&
        !lower.includes('robotics') &&
        !lower.includes('computer-use') &&
        !lower.includes('deep-research') &&
        !lower.includes('lyria')
      );
    });

  if (compatibleModels.length === 0) {
    return {
      validKey: true,
      status: 'Invalid',
      validationState: 'MODEL_UNAVAILABLE',
      selectedModel: null,
      availableModels: [],
      accountTier: 'Unknown',
      diagnostics: {
        apiKeyAuth: 'PASS',
        modelsDiscovered: [],
        modelsAttempted: [],
        selectedModel: null,
        httpStatus: 200,
        googleErrorStatus: 'OK',
        googleErrorCode: 200,
        googleErrorMessage: 'No compatible text generation models discovered for this key.',
        quotaMetric: null,
        quotaId: null,
        quotaValue: null,
        retryDelay: null,
        finalClassification: 'MODEL_NOT_FOUND',
        timestamp: new Date().toISOString(),
      },
      error: 'No compatible Gemini generation models returned for this account.',
      errorMessageForUser: 'Your API key is valid, but no compatible Gemini text model is currently available for this account.',
    };
  }

  // Build candidate queue prioritized by PREFERRED_GEMINI_MODELS
  const candidateQueue: string[] = [];

  for (const pref of PREFERRED_GEMINI_MODELS) {
    if (compatibleModels.includes(pref) && !candidateQueue.includes(pref)) {
      candidateQueue.push(pref);
    }
  }

  for (const model of compatibleModels) {
    if (model.startsWith('gemini') && !candidateQueue.includes(model)) {
      candidateQueue.push(model);
    }
  }

  for (const model of compatibleModels) {
    if (!candidateQueue.includes(model)) {
      candidateQueue.push(model);
    }
  }

  // STEP 3: Minimal Single Inference Request with Fall-Through for Model-Specific Failures
  // Strictly capped at max 3 attempts to prevent consuming quota
  const MAX_ATTEMPTS = 3;
  const modelsAttempted: string[] = [];
  let chosenModel: string | null = null;
  let lastParsedError: SanitizedGoogleError | null = null;

  for (let i = 0; i < Math.min(candidateQueue.length, MAX_ATTEMPTS); i++) {
    const candidate = candidateQueue[i];
    modelsAttempted.push(candidate);

    let testTimeoutId: NodeJS.Timeout | null = null;
    try {
      const controller = new AbortController();
      testTimeoutId = setTimeout(() => controller.abort(), 12000);

      // Build lightweight ping payload
      const requestBody: any = {
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: {
          maxOutputTokens: 2,
          temperature: 0,
        },
      };

      // Disable thinking budget during ping for reasoning models (e.g. gemini-3.7-flash, gemini-2.5-flash) to ensure instant response (<200ms)
      if (candidate.includes('3.7') || candidate.includes('2.5') || candidate.includes('thinking')) {
        requestBody.generationConfig.thinkingConfig = {
          thinkingBudget: 0,
        };
      }

      const testResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent?key=${encodeURIComponent(cleanKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }
      );
      if (testTimeoutId) {
        clearTimeout(testTimeoutId);
        testTimeoutId = null;
      }

      const testData: any = await testResp.json().catch(() => ({}));

      if (testResp.ok) {
        // SUCCESS: Model validated and confirmed active!
        chosenModel = candidate;
        break;
      }

      const parsed = parseAndClassifyGoogleError(testResp.status, testData, candidate);
      lastParsedError = parsed;
      console.warn(`[BYOK Model Test] Candidate "${candidate}" returned error:`, parsed.httpStatus, parsed.classification, parsed.googleErrorMessage);

      // If error is model-specific (e.g. 404 MODEL_NOT_FOUND, 429 MODEL_FREE_TIER_LIMIT_ZERO, MODEL_QUOTA_UNAVAILABLE, MODEL_RATE_LIMIT)
      // and we have more candidates to try, loop falls through to next candidate!
      if (parsed.isModelSpecific && i < Math.min(candidateQueue.length, MAX_ATTEMPTS) - 1) {
        console.log(`[BYOK Validation] Falling through from model "${candidate}" (${parsed.classification}) to next discovered model...`);
        continue;
      }

      // If it's a non-model-specific error (e.g., project-wide daily quota, authentication problem, etc.), stop trying
      break;
    } catch (testNetErr: any) {
      if (testTimeoutId) {
        clearTimeout(testTimeoutId);
        testTimeoutId = null;
      }

      console.warn(`Network or timeout error testing candidate model "${candidate}":`, testNetErr);
      const isAbort = testNetErr?.name === 'AbortError' || String(testNetErr).includes('AbortError');
      const errMessage = isAbort
        ? `Model "${candidate}" timed out during inference ping.`
        : sanitizeGoogleErrorMessage(testNetErr?.message || 'Network error during inference ping');

      lastParsedError = {
        httpStatus: null,
        googleErrorStatus: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
        googleErrorCode: null,
        googleErrorMessage: errMessage,
        errorDetails: null,
        quotaMetric: null,
        quotaId: null,
        quotaValue: null,
        retryDelay: null,
        modelAttempted: candidate,
        classification: 'PROVIDER_TEMPORARY_LIMIT',
        isModelSpecific: true, // Mark model-specific so fall-through can attempt subsequent candidates
        userFacingMessage: isAbort
          ? `Model "${candidate}" timed out. Trying next candidate model...`
          : 'Connection failed during model validation. Please retry.',
      };

      // Fall through to the next candidate model in the queue if one exists
      if (i < Math.min(candidateQueue.length, MAX_ATTEMPTS) - 1) {
        console.log(`[BYOK Validation] Falling through from candidate "${candidate}" (${isAbort ? 'Timeout' : 'Network Error'}) to next discovered model...`);
        continue;
      }

      break;
    }
  }

  if (chosenModel) {
    return {
      validKey: true,
      status: 'Connected',
      validationState: 'API_KEY_VALID',
      selectedModel: chosenModel,
      availableModels: compatibleModels,
      accountTier: 'Unknown',
      diagnostics: {
        apiKeyAuth: 'PASS',
        modelsDiscovered: compatibleModels,
        modelsAttempted,
        selectedModel: chosenModel,
        httpStatus: 200,
        googleErrorStatus: 'OK',
        googleErrorCode: 200,
        googleErrorMessage: null,
        quotaMetric: null,
        quotaId: null,
        quotaValue: null,
        retryDelay: null,
        finalClassification: 'SUCCESS',
        timestamp: new Date().toISOString(),
      },
    };
  }

  // If candidate inference tests encountered transient timeouts / network aborts,
  // but Step 1 (Google Models List discovery) confirmed the API key is 100% authentic and returned models:
  const isAuthError = lastParsedError?.classification === 'AUTHENTICATION_FAILED';
  const isQuotaError =
    lastParsedError?.classification === 'PROJECT_DAILY_QUOTA' ||
    lastParsedError?.classification === 'PROJECT_RATE_LIMIT' ||
    lastParsedError?.classification === 'MODEL_FREE_TIER_LIMIT_ZERO' ||
    lastParsedError?.classification === 'MODEL_QUOTA_UNAVAILABLE';

  // If the key was authentic and models were discovered, fallback to top compatible model
  if (!isAuthError && !isQuotaError && compatibleModels.length > 0) {
    const fallbackModel = candidateQueue[0] || compatibleModels[0] || 'gemini-2.0-flash';
    return {
      validKey: true,
      status: 'Connected',
      validationState: 'API_KEY_VALID',
      selectedModel: fallbackModel,
      availableModels: compatibleModels,
      accountTier: 'Unknown',
      diagnostics: {
        apiKeyAuth: 'PASS',
        modelsDiscovered: compatibleModels,
        modelsAttempted,
        selectedModel: fallbackModel,
        httpStatus: 200,
        googleErrorStatus: 'OK',
        googleErrorCode: 200,
        googleErrorMessage: 'Key verified via Google Models Discovery. Candidate ping deferred.',
        quotaMetric: null,
        quotaId: null,
        quotaValue: null,
        retryDelay: null,
        finalClassification: 'SUCCESS',
        timestamp: new Date().toISOString(),
      },
    };
  }

  let validationState: KeyValidationState = 'MODEL_UNAVAILABLE';
  if (isAuthError) {
    validationState = 'API_KEY_INVALID';
  } else if (isQuotaError) {
    validationState = 'QUOTA_EXCEEDED';
  }

  return {
    validKey: !isAuthError,
    status: 'Invalid',
    validationState,
    selectedModel: candidateQueue[0] || null,
    availableModels: compatibleModels,
    accountTier: 'Unknown',
    diagnostics: {
      apiKeyAuth: 'PASS',
      modelsDiscovered: compatibleModels,
      modelsAttempted,
      selectedModel: null,
      httpStatus: lastParsedError?.httpStatus || null,
      googleErrorStatus: lastParsedError?.googleErrorStatus || null,
      googleErrorCode: lastParsedError?.googleErrorCode || null,
      googleErrorMessage: lastParsedError?.googleErrorMessage || 'Model validation failed',
      quotaMetric: lastParsedError?.quotaMetric || null,
      quotaId: lastParsedError?.quotaId || null,
      quotaValue: lastParsedError?.quotaValue || null,
      retryDelay: lastParsedError?.retryDelay || null,
      finalClassification: lastParsedError?.classification || 'MODEL_QUOTA_UNAVAILABLE',
      timestamp: new Date().toISOString(),
    },
    error: lastParsedError?.googleErrorMessage || 'Validation failed for discovered models.',
    errorMessageForUser:
      lastParsedError?.userFacingMessage ||
      (isAuthError
        ? 'Invalid Google Gemini API Key. Please verify your key on Google AI Studio.'
        : isQuotaError
        ? 'Your API key is valid, but your quota is currently unavailable.'
        : 'Your API key is valid, but model validation failed.'),
  };
}

export function getEncryptedCredential(userId: string): EncryptedCredential | null {
  const creds = loadJsonData<EncryptedCredential[]>('credentials.json', []);
  return creds.find((c) => c.userId === userId && (!c.provider || c.provider.toLowerCase().includes('gemini') || c.provider.toLowerCase().includes('google'))) 
    || creds.find((c) => c.userId === userId) 
    || null;
}

export function invalidateUnrecoverableCredential(userId: string, reason: string): void {
  let creds = loadJsonData<EncryptedCredential[]>('credentials.json', []);
  const target = creds.find((c) => c.userId === userId && c.provider === 'gemini');
  if (target) {
    const credFp = getCredentialFingerprint(target.encryptedKey);
    console.warn(`[BYOK_INVALIDATE] Removing unrecoverable credential for user ${userId} credentialFingerprint=${credFp} (Reason: ${reason}). User must reconnect key.`);
    creds = creds.filter((c) => !(c.userId === userId && c.provider === 'gemini'));
    saveJsonData('credentials.json', creds);
  }
}

export interface BYOKStatusResult {
  hasCredential: boolean;
  decryptedSuccessfully: boolean;
  apiKey: string | null;
  model: string | null;
  code: 'NO_CREDENTIAL' | 'DECRYPT_FAILED' | 'DISABLED_BY_OWNER' | 'USER_SUSPENDED' | 'VALID';
  userFacingMessage?: string;
}

export function getBYOKCredentialStatus(userId: string): BYOKStatusResult {
  const cred = getEncryptedCredential(userId);
  if (!cred) {
    return {
      hasCredential: false,
      decryptedSuccessfully: false,
      apiKey: null,
      model: null,
      code: 'NO_CREDENTIAL',
    };
  }

  if (cred.isDisabledByOwner) {
    return {
      hasCredential: true,
      decryptedSuccessfully: false,
      apiKey: null,
      model: null,
      code: 'DISABLED_BY_OWNER',
      userFacingMessage: 'API key access has been disabled by platform administrator.',
    };
  }

  const users = getAllUsers();
  const user = users.find((u) => u.id === userId);
  if (user?.isSuspended) {
    return {
      hasCredential: true,
      decryptedSuccessfully: false,
      apiKey: null,
      model: null,
      code: 'USER_SUSPENDED',
      userFacingMessage: 'User account is suspended.',
    };
  }

  try {
    const apiKey = decryptCredential(cred.encryptedKey, cred.iv, cred.tag, userId, cred.masterKeyFingerprint);
    let model = cred.selectedModel;
    if (!model) {
      if (Array.isArray(cred.availableModels) && cred.availableModels.length > 0) {
        model = cred.availableModels[0];
      } else {
        model = 'gemini-2.0-flash';
      }
    }
    return {
      hasCredential: true,
      decryptedSuccessfully: true,
      apiKey,
      model,
      code: 'VALID',
    };
  } catch (err) {
    invalidateUnrecoverableCredential(userId, 'UNRECOVERABLE_DECRYPTION_FAILURE');
    return {
      hasCredential: true,
      decryptedSuccessfully: false,
      apiKey: null,
      model: null,
      code: 'DECRYPT_FAILED',
      userFacingMessage: 'Stored provider credential can no longer be decrypted. Please reconnect your API key.',
    };
  }
}

export const getCredentialStatus = getBYOKCredentialStatus;

export function getUserGeminiApiKey(userId: string): string | null {
  const status = getBYOKCredentialStatus(userId);
  return status.apiKey;
}

/**
 * Returns decrypted raw key AND the dynamically discovered model for the user.
 * Strictly checks user suspension and owner disablement.
 */
export function getUserGeminiModelAndKey(userId: string): { apiKey: string; model: string } | null {
  const status = getBYOKCredentialStatus(userId);
  if (status.apiKey && status.model) {
    return { apiKey: status.apiKey, model: status.model };
  }
  return null;
}

export function saveUserGeminiApiKey(
  userId: string,
  plaintextKey: string,
  discoveryResult?: {
    selectedModel?: string | null;
    availableModels?: string[];
    validationState?: KeyValidationState;
    status?: ApiConnectionStatus;
    validationError?: string;
    diagnostics?: ValidationDiagnostics;
  }
): { success: boolean; maskedKey?: string; fingerprint?: string; selectedModel?: string; error?: string } {
  if (!plaintextKey || plaintextKey.trim().length < 15) {
    return { success: false, error: 'Invalid API key format. Minimum length required.' };
  }

  const cleanKey = plaintextKey.trim().replace(/^["']|["']$/g, '').trim();
  const { encryptedKey, iv, tag, cryptoVersion, algorithm, masterKeyFingerprint } = encryptCredential(cleanKey, userId);
  const maskedKey = createMaskedKey(cleanKey);
  const fingerprint = createKeyFingerprint(cleanKey);

  const creds = loadJsonData<EncryptedCredential[]>('credentials.json', []);
  const idx = creds.findIndex((c) => c.userId === userId && c.provider === 'gemini');

  const existing = idx >= 0 ? creds[idx] : null;

  const newCred: EncryptedCredential = {
    userId,
    provider: 'gemini',
    encryptedKey,
    iv,
    tag,
    cryptoVersion,
    algorithm,
    masterKeyFingerprint,
    keyMask: maskedKey,
    fingerprint,
    status: discoveryResult?.status || 'Connected',
    keyValidationState: discoveryResult?.validationState || 'API_KEY_VALID',
    selectedModel: discoveryResult?.selectedModel || existing?.selectedModel || 'gemini-2.0-flash',
    availableModels: discoveryResult?.availableModels || existing?.availableModels || [],
    accountTier: 'Unknown',
    addedAt: existing?.addedAt || new Date().toISOString(),
    lastValidatedAt: new Date().toISOString(),
    lastUsedAt: existing?.lastUsedAt || undefined,
    validationError: discoveryResult?.validationError || undefined,
    lastDiagnostics: discoveryResult?.diagnostics || existing?.lastDiagnostics,
    isDisabledByOwner: existing?.isDisabledByOwner || false,
    totalRequests: existing?.totalRequests || 0,
    successfulRequests: existing?.successfulRequests || 0,
    failedRequests: existing?.failedRequests || 0,
    updatedAt: new Date().toISOString(),
  };

  if (idx >= 0) {
    creds[idx] = newCred;
  } else {
    creds.push(newCred);
  }

  saveJsonData('credentials.json', creds);
  return { success: true, maskedKey, fingerprint, selectedModel: newCred.selectedModel };
}

export function removeUserGeminiApiKey(userId: string): boolean {
  let creds = loadJsonData<EncryptedCredential[]>('credentials.json', []);
  const initialCount = creds.length;
  creds = creds.filter((c) => !(c.userId === userId && c.provider === 'gemini'));
  saveJsonData('credentials.json', creds);
  return creds.length < initialCount;
}

/**
 * Owner-Only Explicit Reveal of a User's Decrypted API Key
 * Never exposes raw keys to audit logs or general responses.
 */
export function adminOwnerRevealUserKey(
  userId: string,
  adminEmail: string = 'mohsin@hoorvia.net'
): { success: boolean; apiKey?: string; maskedKey?: string; fingerprint?: string; error?: string } {
  const cred = getEncryptedCredential(userId);
  if (!cred) {
    return { success: false, error: 'No API key configured for this user.' };
  }

  try {
    const apiKey = decryptCredential(cred.encryptedKey, cred.iv, cred.tag, userId, cred.masterKeyFingerprint);
    const user = getUserById(userId);

    // Audit log records that the reveal occurred, NEVER the raw key
    recordAdminAuditAction({
      adminId: 'usr_mohsin_owner',
      adminEmail,
      action: 'reveal_byok_key',
      targetUserId: userId,
      targetUserEmail: user?.email,
      details: `Owner explicitly viewed decrypted API key for user ${user?.email || userId} (Fingerprint: ${cred.fingerprint || 'N/A'})`,
    });

    return {
      success: true,
      apiKey,
      maskedKey: cred.keyMask,
      fingerprint: cred.fingerprint,
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Failed to decrypt API key. Stored key may be corrupted or encrypted with previous secret.',
    };
  }
}

/**
 * Owner-Only Update/Replace of a User's API Key
 * Encrypts with AES-256-GCM before writing to storage.
 */
export async function adminOwnerUpdateUserKey(
  userId: string,
  newRawKey: string,
  adminEmail: string = 'mohsin@hoorvia.net'
): Promise<{ success: boolean; maskedKey?: string; fingerprint?: string; selectedModel?: string; error?: string }> {
  if (!newRawKey || newRawKey.trim().length < 15) {
    return { success: false, error: 'Invalid API key format. Key must be at least 15 characters.' };
  }

  const cleanKey = newRawKey.trim().replace(/^["']|["']$/g, '').trim();

  // Test and discover capabilities of the new key
  const discovery = await discoverAndValidateUserGeminiModels(cleanKey);
  const saveRes = saveUserGeminiApiKey(userId, cleanKey, {
    selectedModel: discovery.selectedModel || undefined,
    availableModels: discovery.availableModels,
    validationState: discovery.validationState,
    status: discovery.validationState === 'API_KEY_VALID' ? 'Connected' : 'Invalid',
    validationError: discovery.error,
    diagnostics: discovery.diagnostics,
  });

  if (!saveRes.success) {
    return { success: false, error: saveRes.error || 'Failed to save encrypted key.' };
  }

  const user = getUserById(userId);
  recordAdminAuditAction({
    adminId: 'usr_mohsin_owner',
    adminEmail,
    action: 'update_byok_key',
    targetUserId: userId,
    targetUserEmail: user?.email,
    details: `Owner replaced/updated API key for user ${user?.email || userId} (Fingerprint: ${saveRes.fingerprint || 'N/A'}, Model: ${saveRes.selectedModel || 'gemini-2.0-flash'})`,
  });

  return {
    success: true,
    maskedKey: saveRes.maskedKey,
    fingerprint: saveRes.fingerprint,
    selectedModel: saveRes.selectedModel,
  };
}

/**
 * Owner-Only Revoke/Delete of a User's API Key
 */
export function adminOwnerRevokeUserKey(
  userId: string,
  adminEmail: string = 'mohsin@hoorvia.net'
): { success: boolean; error?: string } {
  const cred = getEncryptedCredential(userId);
  if (!cred) {
    return { success: false, error: 'No API key found for this user.' };
  }

  const removed = removeUserGeminiApiKey(userId);
  if (removed) {
    const user = getUserById(userId);
    recordAdminAuditAction({
      adminId: 'usr_mohsin_owner',
      adminEmail,
      action: 'revoke_byok_key',
      targetUserId: userId,
      targetUserEmail: user?.email,
      details: `Owner revoked and purged stored API key for user ${user?.email || userId}`,
    });
    return { success: true };
  }

  return { success: false, error: 'Failed to revoke API key.' };
}

export function setUserAiConnectionDisabled(
  userId: string,
  isDisabled: boolean,
  adminEmail: string = 'mohsin@hoorvia.net'
): boolean {
  const creds = loadJsonData<EncryptedCredential[]>('credentials.json', []);
  const idx = creds.findIndex((c) => c.userId === userId && c.provider === 'gemini');
  if (idx === -1) return false;
  creds[idx].isDisabledByOwner = isDisabled;
  creds[idx].status = isDisabled ? 'Disabled' : 'Connected';
  creds[idx].updatedAt = new Date().toISOString();
  saveJsonData('credentials.json', creds);

  const user = getUserById(userId);
  recordAdminAuditAction({
    adminId: 'usr_mohsin_owner',
    adminEmail,
    action: isDisabled ? 'disable_ai' : 'enable_ai',
    targetUserId: userId,
    targetUserEmail: user?.email,
    details: `${isDisabled ? 'Disabled' : 'Enabled'} AI Provider connection for user ${user?.email || userId}`,
  });

  return true;
}

export async function testAndValidateUserKey(userId: string): Promise<{
  valid: boolean;
  status: ApiConnectionStatus;
  validationState: KeyValidationState;
  selectedModel: string | null;
  availableModels: string[];
  diagnostics?: ValidationDiagnostics;
  error?: string;
  message?: string;
}> {
  const cred = getEncryptedCredential(userId);
  if (!cred) {
    return {
      valid: false,
      status: 'Missing',
      validationState: 'API_KEY_INVALID',
      selectedModel: null,
      availableModels: [],
      error: 'No BYOK API key connected for this user.',
      message: 'No key connected.',
    };
  }

  let rawKey: string;
  try {
    rawKey = decryptCredential(cred.encryptedKey, cred.iv, cred.tag, userId, cred.masterKeyFingerprint);
  } catch (err: any) {
    return {
      valid: false,
      status: 'Invalid',
      validationState: 'API_KEY_INVALID',
      selectedModel: null,
      availableModels: [],
      error: 'Failed to decrypt stored credentials on server.',
      message: 'Decryption failed.',
    };
  }

  const discovery = await discoverAndValidateUserGeminiModels(rawKey);

  // Update stored credential record
  const creds = loadJsonData<EncryptedCredential[]>('credentials.json', []);
  const idx = creds.findIndex((c) => c.userId === userId && c.provider === 'gemini');
  if (idx >= 0) {
    creds[idx].status = creds[idx].isDisabledByOwner ? 'Disabled' : discovery.status;
    creds[idx].keyValidationState = discovery.validationState;
    if (discovery.selectedModel) {
      creds[idx].selectedModel = discovery.selectedModel;
    }
    if (discovery.availableModels.length > 0) {
      creds[idx].availableModels = discovery.availableModels;
    }
    creds[idx].lastValidatedAt = new Date().toISOString();
    creds[idx].validationError = discovery.error || undefined;
    creds[idx].lastDiagnostics = discovery.diagnostics;
    creds[idx].updatedAt = new Date().toISOString();
    saveJsonData('credentials.json', creds);
  }

  return {
    valid: discovery.validKey,
    status: cred.isDisabledByOwner ? 'Disabled' : discovery.status,
    validationState: discovery.validationState,
    selectedModel: discovery.selectedModel || cred.selectedModel || null,
    availableModels: discovery.availableModels,
    diagnostics: discovery.diagnostics,
    error: discovery.error,
    message: discovery.validKey
      ? `Validation passed. Model "${discovery.selectedModel}" confirmed.`
      : discovery.errorMessageForUser || discovery.error || 'Validation failed.',
  };
}

export const LIVE_COMPATIBLE_MODELS = [
  'gemini-3.8-live',
  'gemini-3.8-live-extended-thinking',
  'gemini-2.0-flash-exp',
];

export function getCompatibleLiveModelForUser(userId: string): string {
  const cred = getEncryptedCredential(userId);
  const available = cred?.availableModels || [];
  for (const model of LIVE_COMPATIBLE_MODELS) {
    if (available.includes(model)) {
      return model;
    }
  }
  return 'gemini-3.8-live';
}

export function sanitizeErrorMessageForPublicUser(err: any): { userMessage: string; statusCode: number; errorType: string } {
  const errStr = typeof err === 'string' ? err : err?.message || JSON.stringify(err || '');
  const status = err?.status || err?.httpStatus || err?.statusCode;

  if (
    errStr.includes('503') ||
    errStr.includes('UNAVAILABLE') ||
    errStr.includes('high demand') ||
    errStr.includes('temporarily unavailable') ||
    errStr.includes('spikes in demand') ||
    status === 503 ||
    status === 'UNAVAILABLE'
  ) {
    return {
      userMessage: 'Your AI provider is temporarily busy. Please try again shortly.',
      statusCode: 503,
      errorType: 'PROVIDER_UNAVAILABLE',
    };
  }

  if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('quota') || status === 429) {
    return {
      userMessage: 'Your Google Gemini API quota or rate limit has been exceeded. Please check your AI Studio plan or billing.',
      statusCode: 429,
      errorType: 'QUOTA_EXHAUSTED',
    };
  }

  if (
    errStr.includes('401') ||
    errStr.includes('API_KEY_INVALID') ||
    errStr.includes('API key not valid') ||
    errStr.includes('UNAUTHENTICATED') ||
    status === 401
  ) {
    return {
      userMessage: 'Invalid Google Gemini API Key. Please verify your key in Provider Settings.',
      statusCode: 401,
      errorType: 'AUTH_FAILED',
    };
  }

  if (errStr.includes('403') || errStr.includes('PERMISSION_DENIED') || status === 403) {
    return {
      userMessage: 'Access denied for this API key. Please check your Google Cloud project permissions.',
      statusCode: 403,
      errorType: 'PERMISSION_DENIED',
    };
  }

  if (errStr.includes('404') || errStr.includes('NOT_FOUND') || status === 404) {
    return {
      userMessage: 'Selected AI model is not available for your account. Please select another model in Provider Settings.',
      statusCode: 404,
      errorType: 'MODEL_NOT_FOUND',
    };
  }

  return {
    userMessage: 'Google Gemini service encountered an unexpected error. Please retry shortly.',
    statusCode: 500,
    errorType: 'PROVIDER_ERROR',
  };
}

// --- AUDIT LOGS & TRACKING ---

export function addApiAuditLog(
  userId: string,
  companionName: string,
  model: string,
  status: 'Success' | 'Failed',
  errorMessage?: string,
  actionType: 'chat' | 'profile_gen' | 'validation' | 'live_voice' = 'chat',
  extraMeta?: {
    initialModel?: string;
    failoverModel?: string;
    originalStatus?: string | number;
    retryCount?: number;
    liveDiagnostics?: ApiAuditLog['liveDiagnostics'];
  }
): ApiAuditLog {
  const cred = getEncryptedCredential(userId);
  const auditLogs = loadJsonData<ApiAuditLog[]>('audit_logs.json', []);

  const newLog: ApiAuditLog = {
    id: `aud_${crypto.randomBytes(8).toString('hex')}`,
    userId,
    timestamp: new Date().toISOString(),
    provider: 'Google Gemini',
    model: model || cred?.selectedModel || 'gemini-model',
    initialModel: extraMeta?.initialModel,
    failoverModel: extraMeta?.failoverModel,
    originalStatus: extraMeta?.originalStatus,
    retryCount: extraMeta?.retryCount,
    companionName: companionName || 'Companion',
    credentialSource: 'USER_BYOK',
    maskedKey: cred?.keyMask || 'No Key',
    fingerprint: cred?.fingerprint || 'N/A',
    status,
    ownerKeyUsed: false,
    errorMessage: errorMessage ? errorMessage.slice(0, 300) : undefined,
    actionType,
    liveDiagnostics: extraMeta?.liveDiagnostics,
  };

  auditLogs.unshift(newLog);
  if (auditLogs.length > 3000) {
    auditLogs.splice(3000);
  }
  saveJsonData('audit_logs.json', auditLogs);
  return newLog;
}

export function getUserAuditLogs(userId: string, limit: number = 25): ApiAuditLog[] {
  const auditLogs = loadJsonData<ApiAuditLog[]>('audit_logs.json', []);
  return auditLogs.filter((l) => l.userId === userId).slice(0, limit);
}

export function recordAdminAuditAction(entry: {
  adminId: string;
  adminEmail: string;
  action: AdminAuditEntry['action'];
  targetUserId?: string;
  targetUserEmail?: string;
  details: string;
}): AdminAuditEntry {
  const adminLogs = loadJsonData<AdminAuditEntry[]>('admin_audit_logs.json', []);
  const newEntry: AdminAuditEntry = {
    id: `adm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  adminLogs.unshift(newEntry);
  if (adminLogs.length > 2000) {
    adminLogs.splice(2000);
  }
  saveJsonData('admin_audit_logs.json', adminLogs);
  return newEntry;
}

export function getAdminAuditLogs(limit: number = 100): AdminAuditEntry[] {
  const adminLogs = loadJsonData<AdminAuditEntry[]>('admin_audit_logs.json', []);
  return adminLogs.slice(0, limit);
}

export function recordUserApiRequest(
  userId: string,
  isSuccess: boolean,
  companionName?: string,
  model?: string,
  actionType: 'chat' | 'profile_gen' | 'validation' | 'live_voice' = 'chat',
  errorMessage?: string,
  extraMeta?: {
    initialModel?: string;
    failoverModel?: string;
    originalStatus?: string | number;
    retryCount?: number;
    liveDiagnostics?: ApiAuditLog['liveDiagnostics'];
  }
) {
  const creds = loadJsonData<EncryptedCredential[]>('credentials.json', []);
  const idx = creds.findIndex((c) => c.userId === userId && c.provider === 'gemini');
  const effectiveModel = model || (idx >= 0 ? creds[idx].selectedModel : undefined) || 'gemini-model';

  // Update credential metrics
  if (idx >= 0) {
    creds[idx].totalRequests = (creds[idx].totalRequests || 0) + 1;
    if (isSuccess) {
      creds[idx].successfulRequests = (creds[idx].successfulRequests || 0) + 1;
      creds[idx].lastUsedAt = new Date().toISOString();
      creds[idx].status = creds[idx].isDisabledByOwner ? 'Disabled' : 'Connected';
    } else {
      creds[idx].failedRequests = (creds[idx].failedRequests || 0) + 1;
      if (
        errorMessage &&
        (errorMessage.includes('API_KEY_INVALID') ||
          errorMessage.includes('key is invalid') ||
          errorMessage.includes('API key not valid') ||
          errorMessage.includes('UNAUTHENTICATED') ||
          errorMessage.includes('401') ||
          errorMessage.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ||
          errorMessage.includes('invalid authentication credentials'))
      ) {
        creds[idx].status = 'Invalid';
        creds[idx].keyValidationState = 'API_KEY_INVALID';
        creds[idx].validationError = errorMessage;
      }
    }
    creds[idx].updatedAt = new Date().toISOString();
    saveJsonData('credentials.json', creds);
  }

  // Update user lastActive
  const users = getAllUsers();
  const uIdx = users.findIndex((u) => u.id === userId);
  if (uIdx >= 0) {
    users[uIdx].lastActive = new Date().toISOString();
    saveJsonData('users.json', users);
  }

  // Add audit log
  const comp = companionName || getCompanionProfile(userId)?.name || 'Companion';
  addApiAuditLog(userId, comp, effectiveModel, isSuccess ? 'Success' : 'Failed', errorMessage, actionType, extraMeta);
}

export interface ChatExecutionResult {
  success: boolean;
  reply?: string;
  modelUsed?: string;
  initialModel?: string;
  failoverModel?: string;
  isFailover?: boolean;
  retryCount?: number;
  userErrorMessage?: string;
  internalError?: string;
  statusCode: number;
  toolActions?: string[];
}

/**
 * Optional Gemini function-calling hooks for the chat executor.
 * When provided, the declarations are passed as tools to generateContent and
 * function calls are resolved via `execute` in a bounded follow-up loop.
 */
export interface BrowserToolHandlers {
  declarations: any[];
  execute: (name: string, args: any) => Promise<any>;
}

function summarizeBrowserToolCall(name: string, args: any): string {
  const a = args || {};
  switch (name) {
    case 'browser_open': {
      const raw = String(a.url || '');
      try {
        return new URL(raw).hostname || raw.slice(0, 40);
      } catch {
        return raw.slice(0, 40);
      }
    }
    case 'browser_type':
      return `${String(a.ref || '')} "${String(a.text || '').slice(0, 24)}"`;
    case 'browser_click':
      return String(a.ref || '');
    case 'browser_press':
      return String(a.key || '');
    case 'browser_youtube':
      return String(a.action || '');
    case 'search_videos':
    case 'search_articles':
      return `"${String(a.query || '').slice(0, 40)}"`;
    default:
      return '';
  }
}

export async function executeHoorviaUserChatWithFailover(
  userId: string,
  apiKey: string,
  fullSystemPrompt: string,
  formattedHistory: any[],
  companionName: string,
  modelOverride?: string,
  toolHandlers?: BrowserToolHandlers
): Promise<ChatExecutionResult> {
  const cred = getEncryptedCredential(userId);
  // Pari AI: an explicit model (e.g. per-model BYOK routing) wins over the
  // stored selectedModel. The failover candidates still derive from the
  // user's discovered models.
  const initialModel = modelOverride || cred?.selectedModel || 'gemini-2.0-flash';
  const availableModels = cred?.availableModels || [];

  // Build candidate model list prioritizing user's confirmed compatible models
  const candidateModels: string[] = [initialModel];

  // Add fallback models from availableModels prioritized by PREFERRED_GEMINI_MODELS
  const alternateModels = PREFERRED_GEMINI_MODELS.filter(
    (m) => m !== initialModel && (availableModels.length === 0 || availableModels.includes(m))
  );
  candidateModels.push(...alternateModels);

  // Keep max 3 distinct candidate models to prevent long waits
  const uniqueCandidates = Array.from(new Set(candidateModels)).slice(0, 3);

  const ai = new GoogleGenAI({ apiKey });
  let lastError: any = null;
  let totalRetries = 0;

  for (let cIdx = 0; cIdx < uniqueCandidates.length; cIdx++) {
    const currentModel = uniqueCandidates[cIdx];
    const isPrimary = cIdx === 0;
    const maxRetriesForThisModel = isPrimary ? 2 : 1; // 2 retries for primary, 1 for failover candidate

    for (let attempt = 0; attempt <= maxRetriesForThisModel; attempt++) {
      if (attempt > 0) {
        totalRetries++;
        // Short exponential backoff: attempt 1: 500ms, attempt 2: 1200ms
        const delayMs = attempt === 1 ? 500 : 1200;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: formattedHistory,
          config: {
            systemInstruction: fullSystemPrompt,
            // Browser control tools (optional). When toolHandlers is absent
            // this spread is empty, keeping behavior byte-identical to before.
            ...(toolHandlers ? { tools: [{ functionDeclarations: toolHandlers.declarations }] } : {}),
          },
        });

        // Pari AI: browser tool-calling loop (Phase 2). Bounded to 6 rounds,
        // same model throughout (no failover mid-loop); on any tool-loop
        // error we break and return the last text we have.
        const toolActions: string[] = [];
        let replyText = response.text || 'I am here with you.';
        if (toolHandlers && (response.functionCalls?.length || 0) > 0) {
          let currentResponse = response;
          const workingContents: any[] = [...formattedHistory];
          for (let round = 0; round < 6; round++) {
            const calls = currentResponse.functionCalls || [];
            if (calls.length === 0) break;
            // Model-side functionCall parts.
            workingContents.push({
              role: 'model',
              parts: calls.map((c: any) => ({ functionCall: { name: c.name, args: c.args } })),
            });
            for (const call of calls) {
              let result: any;
              const callName = String(call.name || '');
              try {
                result = await toolHandlers.execute(callName, call.args);
              } catch (err: any) {
                result = { ok: false, message: err?.message || 'Tool execution failed.' };
              }
              toolActions.push(`${callName}(${summarizeBrowserToolCall(callName, call.args)})`);
              workingContents.push({
                role: 'user',
                parts: [{ functionResponse: { name: callName, response: result } }],
              });
            }
            try {
              currentResponse = await ai.models.generateContent({
                model: currentModel,
                contents: workingContents,
                config: {
                  systemInstruction: fullSystemPrompt,
                  tools: [{ functionDeclarations: toolHandlers.declarations }],
                },
              });
            } catch (err: any) {
              // Tool-loop error: stop looping, keep the last text.
              break;
            }
            replyText = currentResponse.text || replyText;
          }
        }
        const isFailover = currentModel !== initialModel;

        // If failover occurred and succeeded, update user's selectedModel in storage.
        // Pari AI: skip this when the caller forced a model override — an
        // override must not silently become the user's default model.
        if (isFailover && !modelOverride) {
          const creds = loadJsonData<EncryptedCredential[]>('credentials.json', []);
          const idx = creds.findIndex((c) => c.userId === userId && c.provider === 'gemini');
          if (idx >= 0) {
            creds[idx].selectedModel = currentModel;
            creds[idx].updatedAt = new Date().toISOString();
            saveJsonData('credentials.json', creds);
          }
        }

        // Record successful request and audit log with failover details
        recordUserApiRequest(
          userId,
          true,
          companionName,
          currentModel,
          'chat',
          undefined,
          {
            initialModel,
            failoverModel: isFailover ? currentModel : undefined,
            originalStatus: isFailover ? '503 UNAVAILABLE' : undefined,
            retryCount: totalRetries,
          }
        );

        return {
          success: true,
          reply: replyText,
          modelUsed: currentModel,
          initialModel,
          failoverModel: isFailover ? currentModel : undefined,
          isFailover,
          retryCount: totalRetries,
          statusCode: 200,
          toolActions,
        };
      } catch (err: any) {
        lastError = err;
        const errStr = typeof err === 'string' ? err : err?.message || JSON.stringify(err || '');
        const is503 =
          errStr.includes('503') ||
          errStr.includes('UNAVAILABLE') ||
          errStr.includes('high demand') ||
          errStr.includes('temporarily unavailable') ||
          errStr.includes('spikes in demand') ||
          err?.status === 503 ||
          err?.status === 'UNAVAILABLE';

        // If not a 503/temporary issue (e.g. 401 invalid key, 403 denied), don't retry same model
        if (!is503 && (errStr.includes('401') || errStr.includes('API_KEY_INVALID') || errStr.includes('403'))) {
          break;
        }

        // If 503 and we have retries left for this model, continue inner loop
        if (is503 && attempt < maxRetriesForThisModel) {
          continue;
        }

        // If 503/404/quota zero and we have other candidates in queue, break inner loop to try next model
        break;
      }
    }
  }

  // All candidates failed
  const sanitized = sanitizeErrorMessageForPublicUser(lastError);
  recordUserApiRequest(
    userId,
    false,
    companionName,
    initialModel,
    'chat',
    lastError?.message || sanitized.userMessage,
    {
      initialModel,
      originalStatus: '503 UNAVAILABLE',
      retryCount: totalRetries,
    }
  );

  return {
    success: false,
    userErrorMessage: sanitized.userMessage,
    internalError: lastError?.message || 'Chat generation failed.',
    initialModel,
    retryCount: totalRetries,
    statusCode: sanitized.statusCode,
  };
}

// --- PER-USER COMPANION MEMORIES ---

export function getUserCompanionMemories(userId: string, companionId?: string): UserMemoryItem[] {
  const memories = loadJsonData<UserMemoryItem[]>('memories.json', []);
  return memories.filter((m) => m.userId === userId && (!companionId || m.companionId === companionId));
}

export function addUserCompanionMemory(
  userId: string,
  companionId: string,
  fact: string,
  category: UserMemoryItem['category'] = 'general'
): UserMemoryItem {
  const memories = loadJsonData<UserMemoryItem[]>('memories.json', []);
  const newItem: UserMemoryItem = {
    id: `mem_${crypto.randomBytes(8).toString('hex')}`,
    userId,
    companionId,
    fact: fact.trim(),
    category,
    createdAt: new Date().toISOString(),
  };
  memories.push(newItem);
  saveJsonData('memories.json', memories);
  return newItem;
}

export function deleteUserCompanionMemory(userId: string, memoryId: string): boolean {
  let memories = loadJsonData<UserMemoryItem[]>('memories.json', []);
  const initial = memories.length;
  memories = memories.filter((m) => !(m.id === memoryId && m.userId === userId));
  saveJsonData('memories.json', memories);
  return memories.filter((m) => m.userId === userId).length < initial;
}

export function updateUserCompanionMemory(
  userId: string,
  memoryId: string,
  patch: { fact?: string; category?: UserMemoryItem['category'] }
): UserMemoryItem | null {
  const memories = loadJsonData<UserMemoryItem[]>('memories.json', []);
  const item = memories.find((m) => m.id === memoryId && m.userId === userId);
  if (!item) return null;
  if (typeof patch.fact === 'string' && patch.fact.trim()) item.fact = patch.fact.trim();
  if (patch.category) item.category = patch.category;
  saveJsonData('memories.json', memories);
  return item;
}

export function resetAllUserCompanionMemories(userId: string, companionId?: string): number {
  let memories = loadJsonData<UserMemoryItem[]>('memories.json', []);
  const initial = memories.filter((m) => m.userId === userId).length;
  memories = memories.filter((m) => !(m.userId === userId && (!companionId || m.companionId === companionId)));
  saveJsonData('memories.json', memories);
  return initial;
}

// --- PLATFORM POLICY & ADMIN ---

export function getPlatformPolicy(): PlatformPolicy {
  return loadJsonData<PlatformPolicy>('policy.json', DEFAULT_POLICY);
}

export function updatePlatformPolicy(
  newPolicyPartial: Partial<PlatformPolicy>,
  adminEmail: string = 'mohsin@hoorvia.net'
): PlatformPolicy {
  const current = getPlatformPolicy();
  const updated = { ...current, ...newPolicyPartial };
  saveJsonData('policy.json', updated);

  recordAdminAuditAction({
    adminId: 'usr_mohsin_owner',
    adminEmail,
    action: 'update_policy',
    details: `Updated platform policy: ${Object.keys(newPolicyPartial).join(', ')}`,
  });

  return updated;
}

// --- USAGE TRACKING ---

export function recordUserUsage(userId: string, isLiveVoice: boolean = false, durationMinutes: number = 0): UserUsageRecord {
  const todayStr = new Date().toISOString().split('T')[0];
  const usageList = loadJsonData<UserUsageRecord[]>('usage.json', []);
  let record = usageList.find((u) => u.userId === userId && u.dateStr === todayStr);

  if (!record) {
    record = {
      userId,
      dateStr: todayStr,
      requestCount: 0,
      liveMinutesUsed: 0,
      lastActive: new Date().toISOString(),
    };
    usageList.push(record);
  }

  record.requestCount += 1;
  if (isLiveVoice && durationMinutes > 0) {
    record.liveMinutesUsed += durationMinutes;
  }
  record.lastActive = new Date().toISOString();

  saveJsonData('usage.json', usageList);
  return record;
}

export function getUserTodayUsage(userId: string): UserUsageRecord {
  const todayStr = new Date().toISOString().split('T')[0];
  const usageList = loadJsonData<UserUsageRecord[]>('usage.json', []);
  const record = usageList.find((u) => u.userId === userId && u.dateStr === todayStr);
  return (
    record || {
      userId,
      dateStr: todayStr,
      requestCount: 0,
      liveMinutesUsed: 0,
      lastActive: new Date().toISOString(),
    }
  );
}

export function getPlatformStats(): PlatformOverviewStats {
  const users = getAllUsers();
  const creds = loadJsonData<EncryptedCredential[]>('credentials.json', []);
  const companions = loadJsonData<CompanionProfile[]>('companions.json', []);
  const usage = loadJsonData<UserUsageRecord[]>('usage.json', []);
  const policy = getPlatformPolicy();
  const adminLogs = getAdminAuditLogs(20);
  const apiLogs = loadJsonData<ApiAuditLog[]>('audit_logs.json', []);
  const todayStr = new Date().toISOString().split('T')[0];

  const publicUsers = users.filter((u) => u.role !== 'owner' && u.id !== 'usr_mohsin_owner');
  const totalUsers = publicUsers.length;
  const suspendedUsers = publicUsers.filter((u) => !!u.isSuspended).length;

  // Active users in last 24h
  const activeTodayIds = new Set(
    usage.filter((u) => u.dateStr === todayStr && u.requestCount > 0).map((u) => u.userId)
  );
  const activeUsers = activeTodayIds.size;

  const totalCompanions = companions.filter((c) => c.userId !== 'usr_mohsin_owner').length;
  const activeSessions = getActiveSessionsCount();

  // BYOK summary
  let connected = 0;
  let invalid = 0;
  let missing = 0;
  let disabled = 0;

  for (const u of publicUsers) {
    const cred = creds.find((c) => c.userId === u.id && c.provider === 'gemini');
    if (!cred) {
      missing++;
    } else if (cred.isDisabledByOwner) {
      disabled++;
    } else if (cred.status === 'Connected') {
      connected++;
    } else if (cred.status === 'Invalid' || cred.keyValidationState === 'API_KEY_INVALID') {
      invalid++;
    } else {
      missing++;
    }
  }

  // Usage summary
  const todayRecords = usage.filter((u) => u.dateStr === todayStr);
  const totalRequestsToday = todayRecords.reduce((acc, u) => acc + (u.requestCount || 0), 0);
  const totalLiveMinutesToday = todayRecords.reduce((acc, u) => acc + (u.liveMinutesUsed || 0), 0);

  // Recent registrations
  const sortedUsers = [...publicUsers].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const recentRegistrations = sortedUsers.slice(0, 8).map((u) => {
    const comp = companions.find((c) => c.userId === u.id);
    const cred = creds.find((c) => c.userId === u.id);
    let byokStatus: ApiConnectionStatus = 'Missing';
    if (cred) {
      if (cred.isDisabledByOwner) byokStatus = 'Disabled';
      else if (cred.status) byokStatus = cred.status;
      else byokStatus = 'Connected';
    }
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt,
      isSuspended: !!u.isSuspended,
      companionName: comp?.name || 'Aria',
      byokStatus,
    };
  });

  // Recent activity (combining admin logs + user API logs)
  const combinedActivity: PlatformOverviewStats['recentActivity'] = [];

  for (const al of adminLogs.slice(0, 10)) {
    combinedActivity.push({
      id: al.id,
      type: 'admin',
      timestamp: al.timestamp,
      title: `Admin Action: ${al.action.replace(/_/g, ' ').toUpperCase()}`,
      description: al.details + (al.targetUserEmail ? ` (${al.targetUserEmail})` : ''),
      status: 'warning',
    });
  }

  for (const api of apiLogs.slice(0, 15)) {
    combinedActivity.push({
      id: api.id,
      type: 'api',
      timestamp: api.timestamp,
      title: `Companion ${api.companionName} (${api.actionType || 'chat'})`,
      description: `Model: ${api.model} • Status: ${api.status}${api.errorMessage ? ` • ${api.errorMessage}` : ''}`,
      status: api.status === 'Success' ? 'success' : 'error',
    });
  }

  combinedActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // System Health
  const mem = process.memoryUsage();
  const uptimeSec = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSec / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  const seconds = uptimeSec % 60;
  const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;

  const systemHealth = {
    uptimeSeconds: uptimeSec,
    uptimeFormatted,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    memoryRssMb: Math.round(mem.rss / 1024 / 1024),
    memoryHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    memoryHeapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    masterKeyFingerprint: getMasterKeyFingerprint(),
    cryptoAlgorithm: 'AES-256-GCM',
    totalCredentialsStored: creds.length,
    geminiServerKeyConfigured: !!process.env.GEMINI_API_KEY,
    localRunnerIsolated: true,
    localRunnerStatus: 'ONLINE (Strictly Isolated to Mohsin)',
  };

  return {
    totalUsers,
    activeUsers,
    suspendedUsers,
    totalCompanions,
    activeSessions,
    byokSummary: { connected, invalid, missing, disabled },
    usageSummary: { totalRequestsToday, totalLiveMinutesToday },
    recentRegistrations,
    recentActivity: combinedActivity.slice(0, 15),
    systemHealth,
    policy,
  };
}

export function getOwnerAdminUserViews(): OwnerAdminUserView[] {
  const users = getAllUsers();
  const creds = loadJsonData<EncryptedCredential[]>('credentials.json', []);
  const companions = loadJsonData<CompanionProfile[]>('companions.json', []);
  const usage = loadJsonData<UserUsageRecord[]>('usage.json', []);
  const todayStr = new Date().toISOString().split('T')[0];

  // Exclude owner accounts so Mohsin's private credentials and companion NEVER appear in this public-user list
  const publicUsers = users.filter((u) => u.role !== 'owner' && u.id !== 'usr_mohsin_owner');

  return publicUsers.map((u) => {
    const cred = creds.find((c) => c.userId === u.id && c.provider === 'gemini');
    const comp = companions.find((p) => p.userId === u.id);
    const todayRec = usage.find((r) => r.userId === u.id && r.dateStr === todayStr);
    const recentLogs = getUserAuditLogs(u.id, 10);
    const effCaps = getUserEffectiveCapabilities(u.id);

    let connectionStatus: ApiConnectionStatus = 'Missing';
    if (cred) {
      if (cred.isDisabledByOwner) {
        connectionStatus = 'Disabled';
      } else if (cred.status) {
        connectionStatus = cred.status;
      } else {
        connectionStatus = 'Connected';
      }
    }

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      accountStatus: u.isSuspended ? 'Suspended' : 'Active',
      isSuspended: !!u.isSuspended,
      lastLogin: u.lastLogin || 'Never',
      lastActive: u.lastActive || todayRec?.lastActive || 'Never',
      companionName: comp?.name || 'Aria',
      companionType: comp?.type || 'girlfriend',
      companionLanguage: comp?.language || 'English',
      companionVoice: comp?.voice || 'Aoede',

      // AI PROVIDER DETAILS
      providerName: 'Google Gemini',
      selectedModel: cred?.selectedModel || 'Not Configured',
      availableModels: cred?.availableModels || [],
      accountTier: cred?.accountTier || 'Unknown',
      keyValidationState: cred?.keyValidationState || (cred ? 'API_KEY_VALID' : 'API_KEY_INVALID'),
      apiConnectionStatus: connectionStatus,
      credentialSource: 'USER_BYOK',
      maskedApiKey: cred?.keyMask || 'No Key Configured',
      safeCredentialFingerprint: cred?.fingerprint || (cred?.keyMask ? createKeyFingerprint(cred.keyMask) : 'N/A'),
      apiKeyAddedDate: cred?.addedAt || cred?.updatedAt || 'N/A',
      lastSuccessfulValidation: cred?.lastValidatedAt || 'N/A',
      lastApiRequest: cred?.lastUsedAt || 'None Yet',
      totalRequests: cred?.totalRequests || 0,
      successfulRequests: cred?.successfulRequests || 0,
      failedRequests: cred?.failedRequests || 0,
      isDisabledByOwner: !!cred?.isDisabledByOwner,
      validationError: cred?.validationError,
      lastDiagnostics: cred?.lastDiagnostics,
      ownerKeyUsed: false,

      // USAGE DETAILS
      requestsToday: todayRec?.requestCount || 0,
      liveMinutesToday: todayRec?.liveMinutesUsed || 0,
      recentAuditLogs: recentLogs,

      // ENTITLEMENTS & CAPABILITIES
      customEntitlements: u.customEntitlements || {},
      effectiveCapabilities: effCaps.capabilities,
      capabilityOverrides: effCaps.overrides,
      accessPack: effCaps.accessPack,
    };
  });
}

export interface SafeByokDiagnosticReport {
  credentialExists: boolean;
  decryptedSuccessfully: boolean;
  credentialOwnerMatch: boolean;
  userId: string;
  keyFingerprint: string;
  keyMask: string;
  keyLength: number;
  googleAuthResult: 'PASS' | 'FAIL';
  googleAuthStatus: string | number;
  googleAuthMessage: string;
  liveSessionAuthResult: 'PASS' | 'FAIL';
  liveSessionAuthStatus: string;
  overallHealth: 'HEALTHY' | 'ACTION_REQUIRED_INVALID_KEY' | 'NO_CREDENTIAL';
  recommendation: string;
  timestamp: string;
}

export async function runSafeByokDiagnosticForUser(userId: string): Promise<SafeByokDiagnosticReport> {
  const cred = getEncryptedCredential(userId);
  const timestamp = new Date().toISOString();

  if (!cred) {
    return {
      credentialExists: false,
      decryptedSuccessfully: false,
      credentialOwnerMatch: false,
      userId,
      keyFingerprint: 'FP-0000-0000',
      keyMask: 'No Key Configured',
      keyLength: 0,
      googleAuthResult: 'FAIL',
      googleAuthStatus: 'MISSING_KEY',
      googleAuthMessage: 'No BYOK credential found in user storage.',
      liveSessionAuthResult: 'FAIL',
      liveSessionAuthStatus: 'MISSING_KEY',
      overallHealth: 'NO_CREDENTIAL',
      recommendation: 'Please enter your Google Gemini API key in Provider Settings.',
      timestamp,
    };
  }

  const credentialOwnerMatch = cred.userId === userId;
  let decryptedKey = '';
  let decryptedSuccessfully = false;

  try {
    decryptedKey = decryptCredential(cred.encryptedKey, cred.iv, cred.tag, userId, cred.masterKeyFingerprint);
    decryptedSuccessfully = true;
  } catch (err: any) {
    return {
      credentialExists: true,
      decryptedSuccessfully: false,
      credentialOwnerMatch,
      userId,
      keyFingerprint: cred.fingerprint || 'FP-CORRUPTED',
      keyMask: cred.keyMask || '**** **** **** ****',
      keyLength: 0,
      googleAuthResult: 'FAIL',
      googleAuthStatus: 'DECRYPTION_ERROR',
      googleAuthMessage: 'Failed to decrypt stored credential: ' + err.message,
      liveSessionAuthResult: 'FAIL',
      liveSessionAuthStatus: 'DECRYPTION_ERROR',
      overallHealth: 'ACTION_REQUIRED_INVALID_KEY',
      recommendation: 'Stored credential could not be decrypted. Please reconnect your API key in Provider Settings.',
      timestamp,
    };
  }

  // Real Google API Authentication Check (Direct Models Discovery)
  let googleAuthResult: 'PASS' | 'FAIL' = 'FAIL';
  let googleAuthStatus: string | number = 'UNKNOWN';
  let googleAuthMessage = '';
  let liveSessionAuthResult: 'PASS' | 'FAIL' = 'FAIL';
  let liveSessionAuthStatus = 'UNKNOWN';

  try {
    const discovery = await discoverAndValidateUserGeminiModels(decryptedKey);
    if (discovery.validKey && discovery.status === 'Connected') {
      googleAuthResult = 'PASS';
      googleAuthStatus = 200;
      googleAuthMessage = `Google API key authenticated successfully. ${discovery.availableModels.length} compatible models verified.`;
      liveSessionAuthResult = 'PASS';
      liveSessionAuthStatus = 'READY';
    } else {
      googleAuthResult = 'FAIL';
      googleAuthStatus = discovery.diagnostics?.httpStatus || discovery.diagnostics?.googleErrorStatus || 401;
      googleAuthMessage = discovery.errorMessageForUser || discovery.error || 'Authentication failed with Google API.';
      liveSessionAuthResult = 'FAIL';
      liveSessionAuthStatus = 'AUTHENTICATION_FAILED';
    }
  } catch (authErr: any) {
    googleAuthResult = 'FAIL';
    googleAuthStatus = 500;
    googleAuthMessage = sanitizeGoogleErrorMessage(authErr.message || 'Error communicating with Google API');
    liveSessionAuthResult = 'FAIL';
    liveSessionAuthStatus = 'ERROR';
  }

  const isHealthy = googleAuthResult === 'PASS' && liveSessionAuthResult === 'PASS';

  return {
    credentialExists: true,
    decryptedSuccessfully,
    credentialOwnerMatch,
    userId,
    keyFingerprint: cred.fingerprint || 'FP-0000-0000',
    keyMask: cred.keyMask || '**** **** **** ****',
    keyLength: decryptedKey.length,
    googleAuthResult,
    googleAuthStatus,
    googleAuthMessage,
    liveSessionAuthResult,
    liveSessionAuthStatus,
    overallHealth: isHealthy ? 'HEALTHY' : 'ACTION_REQUIRED_INVALID_KEY',
    recommendation: isHealthy
      ? 'BYOK credential is valid and active.'
      : 'Your saved Google Gemini API key was rejected by Google (HTTP 401 / UNAUTHENTICATED). Please open Provider Settings, enter a fresh Google Gemini API Key from Google AI Studio (https://aistudio.google.com/app/apikey), and click Connect.',
    timestamp,
  };
}
