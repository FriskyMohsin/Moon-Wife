/**
 * Seed a demo user for screenshots (bypasses BYOK validation — demo only).
 * Run: npx tsx scripts/seed-demo-user.ts
 */
import { registerUser, createSessionToken, saveCompanionProfile, addUserCompanionMemory } from '../src/lib/hoorviaPlatform';
import { createClientTask } from '../src/lib/pariTasks';

const EMAIL = 'demo@example.com';

let user = registerUser(EMAIL, 'Demo1234!', 'Demo User').user;
if (!user) {
  // Already exists — fetch it
  const { getUserByEmail } = await import('../src/lib/hoorviaPlatform');
  user = getUserByEmail(EMAIL)!;
  console.log('Demo user already existed:', user.id);
} else {
  console.log('Demo user created:', user.id);
}

const companion = saveCompanionProfile(user.id, {
  name: 'Pari AI',
  type: 'companion',
  gender: 'female',
  voice: 'Aoede',
  language: 'English',
  personality: 'Warm, attentive, intelligent, and supportive AI companion.',
  communicationStyle: 'Friendly & Caring',
  tone: 'Friendly',
  purpose: 'Daily companion',
});

// Seed demo content (idempotent-ish: only if empty)
try {
  addUserCompanionMemory(user.id, companion.id, 'Loves doodh patti chai', 'preference');
} catch {}
try {
  createClientTask(user.id, { title: 'Test Pari AI screenshots', detail: 'Demo task for product screenshots', priority: 'med', source: 'manual' });
} catch {}

const token = createSessionToken(user);

console.log(JSON.stringify({
  token,
  user: { id: user.id, email: user.email, name: user.name, role: user.role },
  companion,
}));
