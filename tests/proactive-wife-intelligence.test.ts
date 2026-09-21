/**
 * tests/proactive-wife-intelligence.test.ts
 * 
 * Phase 6 Automated Verification Suite: Permanent Creator Identity, Proactive Wife Intelligence,
 * Commitments, Reminders, Routines, Anti-Nagging, Bounded Autonomy, and Parity.
 */

import {
  getIdentityContext,
  isIdentityContextLoaded,
  isCreatorQuestion,
  PERMANENT_CREATOR_IDENTITY,
} from '../src/lib/identity';
import {
  createCommitment,
  listCommitments,
  completeCommitment,
  createReminder,
  listReminders,
  snoozeReminder,
  cancelReminder,
  createRoutine,
  listRoutines,
  evaluateProactiveDecision,
  getProactiveDiagnostics,
  loadProactiveStore,
  saveProactiveStore,
} from '../src/lib/proactiveManager';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    throw new Error(`Test failed: ${testName} - ${detail || ''}`);
  }
}

async function runPhase6Tests() {
  console.log('\n======================================================');
  console.log('PHASE 6: PERMANENT IDENTITY & PROACTIVE INTELLIGENCE SUITE');
  console.log('======================================================\n');

  // Reset proactive store for testing
  saveProactiveStore({
    commitments: [],
    reminders: [],
    routines: [],
    duplicateRemindersSuppressedCount: 0,
    lastProactiveAction: null,
    lastProactiveReason: null,
    lastProactiveTimestamp: null,
  });

  // 1. Permanent Creator Identity Verification
  console.log('Testing Section 1: Permanent Creator Identity Knowledge...');
  assert(isIdentityContextLoaded(), 'A1: Permanent identity loaded successfully');
  assert(PERMANENT_CREATOR_IDENTITY.creatorName === 'Mohsin', 'A2: Creator is Mohsin');
  assert(PERMANENT_CREATOR_IDENTITY.identityTitle === "Mohsin's Maryam", 'A3: Title is Mohsin\'s Maryam');

  assert(isCreatorQuestion('Who created you?'), 'B1: Recognizes English creator question');
  assert(isCreatorQuestion('Tumhe kisne banaya?'), 'B2: Recognizes Roman Urdu creator question');
  assert(isCreatorQuestion('Tum kiski ho?'), 'B3: Recognizes ownership question');
  assert(isCreatorQuestion('Who is Mohsin?'), 'B4: Recognizes Mohsin question');
  assert(!isCreatorQuestion('What is the time?'), 'B5: Ignores non-creator questions');

  const contextPrompt = getIdentityContext();
  assert(contextPrompt.includes('MOHSIN'), 'C1: Identity prompt includes Mohsin');
  assert(contextPrompt.includes("MOHSIN'S MARYAM"), 'C2: Identity prompt includes Mohsin\'s Maryam');
  assert(contextPrompt.includes('OWNER PRIVACY & ABSOLUTE DATA PROTECTION'), 'C3: Identity prompt includes owner privacy rules');
  assert(contextPrompt.includes('ONE-OF-ONE EXCLUSIVITY'), 'C4: Identity prompt includes factual exclusivity');
  assert(contextPrompt.includes('NEVER make technically unverifiable or false claims'), 'F1: Forbids false technical impossibility claims');
  assert(contextPrompt.includes('Private Core Memories'), 'G1: Protects private Core Memories');

  // 2. Commitments & Reminders & Routines
  console.log('\nTesting Section 2: Commitments, Reminders & Routines Management...');
  const rem1 = createReminder({
    title: 'Call Ammi in the evening',
    scheduledTime: new Date(Date.now() + 3600000).toISOString(),
    priority: 'HIGH',
  });
  assert(rem1.id.startsWith('rem_'), 'H1: Reminder ID generated');
  assert(listReminders().length === 1, 'H2: Reminder saved to store');

  const remRec = createReminder({
    title: 'Friday weekly project progress review',
    isRecurring: true,
    cronOrInterval: 'EVERY_FRIDAY',
  });
  assert(remRec.isRecurring === true, 'I1: Recurring reminder created');
  assert(remRec.cronOrInterval === 'EVERY_FRIDAY', 'I2: Interval set');

  const snoozed = snoozeReminder(rem1.id, 15);
  assert(snoozed?.status === 'SNOOZED', 'J1: Reminder snoozed');
  assert(snoozed?.snoozedUntil !== null, 'J2: Snoozed timestamp populated');

  const remToCancel = createReminder({ title: 'Temporary item' });
  const cancelled = cancelReminder(remToCancel.id);
  assert(cancelled?.status === 'CANCELLED', 'K1: Reminder cancelled');

  const comm1 = createCommitment({
    title: 'Website login page pending hai',
    relatedPersonOrProject: 'OmniRoute',
    priority: 'HIGH',
  });
  assert(comm1.status === 'PENDING', 'L1: Structured commitment created');

  const commUnclear = createCommitment({
    title: 'Baad mein report check karni hai',
    dueDateTime: 'unclear time phrase',
  });
  assert(commUnclear.dueDateTime === null, 'M1: Unclear due time does NOT invent timestamp');

  // 3. Proactive Decision Engine & Anti-Nagging
  console.log('\nTesting Section 3: Proactive Decision Engine & Anti-Nagging...');
  const decision1 = evaluateProactiveDecision('Website regarding progress report');
  assert(decision1.action === 'MENTION', 'N1: Relevant commitment triggers MENTION action');
  assert(decision1.autonomyLevel === 'SUGGEST', 'S1: Autonomy level is SUGGEST (not EXECUTE)');

  createReminder({ title: 'Buy milk' });
  createReminder({ title: 'Buy milk' }); // duplicate
  assert(listReminders().filter(r => r.title === 'Buy milk').length === 1, 'O1: Duplicate reminder suppressed');

  const commToComplete = createCommitment({ title: 'Complete project docs' });
  createReminder({ title: 'Project docs reminder', relatedCommitmentId: commToComplete.id });
  completeCommitment(commToComplete.id);
  assert(listReminders().find(r => r.title === 'Project docs reminder')?.status === 'COMPLETED', 'P1: Completed item stops reminders');

  createRoutine({ title: 'Nightly review', schedulePattern: 'NIGHTLY_8PM' });
  const loadedStore = loadProactiveStore();
  assert(loadedStore.routines.length === 1, 'R1: Routine persisted to disk');

  const diag = getProactiveDiagnostics();
  assert(diag.activeRoutinesCount === 1, 'Q1: Diagnostics reflects active routine');
  assert(diag.voiceTextStateParity === true, 'Q2: Voice/text state parity is true');

  const decisionCasual = evaluateProactiveDecision('Kaisi ho baby?');
  assert(decisionCasual.action === 'IGNORE', 'U1: Casual conversation does NOT trigger productivity behavior');

  console.log(`\n======================================================`);
  console.log(`PHASE 6 VERIFICATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED!`);
  console.log(`======================================================\n`);
}

runPhase6Tests().catch((err) => {
  console.error('[Phase 6 Test Runner Error]', err);
  process.exit(1);
});
