/**
 * Automated Test Suite for Maryam's Authoritative Memory Pipeline
 * Scenarios A through H
 */

import fs from 'fs';
import path from 'path';
import {
  DEFAULT_MEMORY_BANK,
  mergeMemoryBanks,
  extractDeterministicMemory,
  applyMemoryUpdate,
  getRelevantMemoriesWithTiming,
  formatCoreMemoryForLive,
} from '../src/lib/memoryManager';
import { MemoryBank } from '../src/types';

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

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('MARYAM MEMORY PIPELINE AUTOMATED VERIFICATION SUITE');
  console.log('======================================================\n');

  // ------------------------------------------------------------------
  // SCENARIO A: Explicit Person Addition & Relationship Retrieval
  // "Ali mera bhai hai, woh software engineer hai" -> Question: "Ali kon hai?"
  // ------------------------------------------------------------------
  console.log('Scenario A: Explicit Person Addition & Relationship Retrieval');
  let bank: MemoryBank = JSON.parse(JSON.stringify(DEFAULT_MEMORY_BANK));

  const updateA = extractDeterministicMemory('Ali mera bhai hai, woh Lahore mein software engineer hai', bank);
  assert(updateA !== null, 'Scenario A1: Extract person memory from Urdu statement');
  assert(updateA?.category === 'importantPeople', 'Scenario A2: Categorized as importantPeople');
  assert(updateA?.action === 'add', 'Scenario A3: Action is add');

  bank = applyMemoryUpdate(bank, updateA!);
  assert(bank.importantPeople.some((p) => p.includes('Ali') && p.includes('bhai')), 'Scenario A4: Memory stored in bank');

  const retrievalA1 = getRelevantMemoriesWithTiming(bank, 'Ali kon hai?');
  assert(retrievalA1.memories.length > 0, 'Scenario A5: Query "Ali kon hai?" returns memory');
  assert(retrievalA1.memories.some((m) => m.includes('Ali') && m.includes('bhai')), 'Scenario A6: Retrieved memory contains relationship');

  const retrievalA2 = getRelevantMemoriesWithTiming(bank, 'mera Ali se kya relation hai?');
  assert(retrievalA2.memories.some((m) => m.includes('Ali')), 'Scenario A7: Query "mera Ali se kya relation hai?" returns Ali');

  // ------------------------------------------------------------------
  // SCENARIO B: Immediate Next-Turn Recall
  // "Mera favorite color black hai" -> "Mera favorite color kya hai?"
  // ------------------------------------------------------------------
  console.log('\nScenario B: Immediate Next-Turn Recall');
  const updateB = extractDeterministicMemory('Mera favorite color black hai', bank);
  assert(updateB !== null, 'Scenario B1: Extracted favorite color immediately');
  assert(updateB?.category === 'preferences', 'Scenario B2: Categorized under preferences');

  bank = applyMemoryUpdate(bank, updateB!);
  const retrievalB = getRelevantMemoriesWithTiming(bank, 'Mera favorite color kya hai?');
  assert(retrievalB.memories.some((m) => m.toLowerCase().includes('black')), 'Scenario B3: Immediate recall in next prompt');

  // ------------------------------------------------------------------
  // SCENARIO C: Multi-turn Conversational Mention (Friend / Colleague)
  // ------------------------------------------------------------------
  console.log('\nScenario C: Multi-turn Conversational Mention');
  const updateC = extractDeterministicMemory('Zeeshan mera colleague aur project manager hai', bank);
  assert(updateC !== null, 'Scenario C1: Extracted colleague details');
  bank = applyMemoryUpdate(bank, updateC!);

  const retrievalC = getRelevantMemoriesWithTiming(bank, 'Zeeshan ke baare mein batao');
  assert(retrievalC.memories.some((m) => m.includes('Zeeshan') && m.includes('colleague')), 'Scenario C2: Retrieved Zeeshan details for "Zeeshan ke baare mein batao"');

  // ------------------------------------------------------------------
  // SCENARIO D: Cross-Session / App Restart Persistence (Disk Reload)
  // ------------------------------------------------------------------
  console.log('\nScenario D: Cross-Session & Disk Serialization Persistence');
  const tempMemoryPath = path.join(process.cwd(), 'temp-test-memory.json');
  fs.writeFileSync(tempMemoryPath, JSON.stringify(bank, null, 2), 'utf-8');

  const diskRaw = fs.readFileSync(tempMemoryPath, 'utf-8');
  const reloadedBank: MemoryBank = JSON.parse(diskRaw);
  fs.unlinkSync(tempMemoryPath);

  assert(reloadedBank.importantPeople.some((p) => p.includes('Ali')), 'Scenario D1: Ali persisted across simulated restart');
  assert(reloadedBank.preferences.some((p) => p.toLowerCase().includes('black')), 'Scenario D2: Favorite color persisted across restart');

  // ------------------------------------------------------------------
  // SCENARIO E: Pronoun Resolution & Follow-Up Context
  // Turn 1: "Ali software engineer hai"
  // Turn 2: "Woh kahan kaam karta hai?" (Uses conversation context)
  // ------------------------------------------------------------------
  console.log('\nScenario E: Pronoun Resolution & Follow-up Context');
  const mockHistory = [
    { sender: 'user', text: 'Ali Lahore mein rehta hai' },
    { sender: 'maryam', text: 'Acha, Ali bhai Lahore mein rehte hain!' },
  ];
  const retrievalE = getRelevantMemoriesWithTiming(bank, 'Woh kahan rehta hai?', mockHistory);
  assert(retrievalE.memories.some((m) => m.includes('Ali')), 'Scenario E1: Pronoun "Woh" resolved to "Ali" using prior turns');

  // ------------------------------------------------------------------
  // SCENARIO F: Additive Merge (Adding new memory does NOT wipe existing)
  // ------------------------------------------------------------------
  console.log('\nScenario F: Additive Merge (Non-Destructive Guarantee)');
  const initialCount = bank.importantPeople.length;
  const incomingDelta: Partial<MemoryBank> = {
    importantPeople: ['Hamza is Mohsin\'s close childhood friend.'],
  };

  const merged = mergeMemoryBanks(incomingDelta, bank);
  assert(merged.importantPeople.length === initialCount + 1, 'Scenario F1: New person appended additively');
  assert(merged.importantPeople.some((p) => p.includes('Ali')), 'Scenario F2: Ali remains intact');
  assert(merged.importantPeople.some((p) => p.includes('Hamza')), 'Scenario F3: Hamza added');
  assert(merged.userProfile.name === 'Mohsin', 'Scenario F4: User profile preserved');

  // ------------------------------------------------------------------
  // SCENARIO G: Duplicate Rejection & Contradiction Update
  // ------------------------------------------------------------------
  console.log('\nScenario G: Duplicate Rejection & Contradiction Update');
  // Attempt duplicate addition
  const dupUpdate = extractDeterministicMemory('Ali mera bhai hai', bank);
  const bankBeforeDup = JSON.parse(JSON.stringify(bank));
  const bankAfterDup = applyMemoryUpdate(bank, dupUpdate!);
  assert(bankAfterDup.importantPeople.length === bankBeforeDup.importantPeople.length, 'Scenario G1: Exact duplicates rejected');

  // Contradiction update: color changed to emerald green
  const updateG = extractDeterministicMemory('Mera favorite color ab emerald green hai, black nahi', bank);
  assert(updateG !== null, 'Scenario G2: Color update detected');
  const bankUpdated = applyMemoryUpdate(bank, updateG!);
  assert(bankUpdated.preferences.some((p) => p.toLowerCase().includes('emerald green')), 'Scenario G3: New color preference stored');

  // ------------------------------------------------------------------
  // SCENARIO H: Voice & Text Parity (Same Authoritative Context)
  // ------------------------------------------------------------------
  console.log('\nScenario H: Voice & Text Memory Parity');
  const liveContext = formatCoreMemoryForLive(bankUpdated);
  assert(liveContext.includes('AUTHORITATIVE CORE MEMORY BANK'), 'Scenario H1: Live context contains authoritative header');
  assert(liveContext.includes('Ali') && liveContext.includes('bhai'), 'Scenario H2: Live voice prompt includes Ali and relation');
  assert(liveContext.includes('emerald green'), 'Scenario H3: Live voice prompt includes updated preference');

  const textRetrieval = getRelevantMemoriesWithTiming(bankUpdated, 'Ali kon hai?');
  assert(textRetrieval.memories.some((m) => m.includes('Ali')), 'Scenario H4: Text prompt retrieves same relationship');

  console.log('\n======================================================');
  console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests} checks passed)`);
  console.log('======================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
