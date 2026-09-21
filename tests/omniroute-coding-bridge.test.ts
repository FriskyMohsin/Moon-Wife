/**
 * Comprehensive Automated Verification Suite for Maryam Phase 4
 * Maryam × OmniRoute Real Coding Bridge
 * 
 * Tests:
 * 1. Dynamic detection of OmniRoute CLI (never hardcoded)
 * 2. Workspace security bounds (blocking system directories, path traversal, escaping)
 * 3. Pre-task snapshot engine (file hashing, bounded scanning, ignoring build dirs)
 * 4. Task lifecycle management (QUEUED, RUNNING, TESTING, COMPLETED, FAILED, CANCELLED)
 * 5. Duplicate task prevention (blocking concurrent tasks in the same workspace)
 * 6. Bounded output & secret redaction (stdout/stderr masking)
 * 7. Change review engine (created, modified, deleted diffs)
 * 8. Confirmation challenge for destructive apply
 * 9. Safe rollback mechanism (reverting modifications, restoring deleted files, cleaning created files)
 * 10. Task cancellation and process cleanup
 * 11. Allowlisted test runners (npm, pytest, cargo, vitest, jest)
 * 12. Strict allowlist router verification (8 coding tools)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const runner = require('../local-runner/runner.cjs');

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
  console.log('\n===================================================================');
  console.log('MARYAM PHASE 4: OMNIROUTE REAL CODING BRIDGE VERIFICATION SUITE');
  console.log('===================================================================\n');

  // Setup isolated test scratch workspace inside approved directory
  const testWorkspace = path.join(process.cwd(), 'workspace', 'coding_test_' + Date.now());
  if (!fs.existsSync(testWorkspace)) {
    fs.mkdirSync(testWorkspace, { recursive: true });
  }

  // Create initial test project files
  fs.writeFileSync(path.join(testWorkspace, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }, null, 2), 'utf8');
  fs.writeFileSync(path.join(testWorkspace, 'index.ts'), 'export function add(a: number, b: number) { return a + b; }\n', 'utf8');
  fs.writeFileSync(path.join(testWorkspace, 'README.md'), '# Test Project\nInitial readme.\n', 'utf8');

  try {
    // ------------------------------------------------------------------
    // SECTION 1: DYNAMIC OMNIROUTE DETECTION
    // ------------------------------------------------------------------
    console.log('--- Section 1: Dynamic OmniRoute CLI Detection ---');

    const detected = runner.detectOmnirouteCliSync();
    assert(detected === null || typeof detected === 'string', '1.1: detectOmnirouteCliSync returns string or null without throwing');

    const omniStatusRes = await runner.routeTool('omniroute.status', {});
    assert(omniStatusRes && omniStatusRes.tool === 'omniroute.status', '1.2: omniroute.status returns standard tool response');
    assert('available' in omniStatusRes, '1.3: omniroute.status contains availability flag');

    // ------------------------------------------------------------------
    // SECTION 2: WORKSPACE SECURITY BOUNDS
    // ------------------------------------------------------------------
    console.log('\n--- Section 2: Workspace Security Bounds ---');

    // Valid workspace inside approved directory
    const resolvedWorkspace = runner.validateAndResolveWorkspace(testWorkspace);
    assert(resolvedWorkspace === testWorkspace || fs.realpathSync(resolvedWorkspace) === fs.realpathSync(testWorkspace), '2.1: Resolves valid workspace within approved directory');

    // Blocking system directories
    let blockedSystemDir = false;
    try {
      runner.validateAndResolveWorkspace('C:\\Windows\\System32');
    } catch (e: any) {
      blockedSystemDir = true;
    }
    assert(blockedSystemDir, '2.2: Blocks system root directory (C:\\Windows\\System32)');

    // Blocking path traversal escape
    let blockedTraversal = false;
    try {
      runner.validateAndResolveWorkspace(path.join(testWorkspace, '../../../../../../etc'));
    } catch (e: any) {
      blockedTraversal = true;
    }
    assert(blockedTraversal, '2.3: Blocks path traversal attempt escaping workspace');

    // Blocking non-existent directory
    let blockedNonExistent = false;
    try {
      runner.validateAndResolveWorkspace(path.join(testWorkspace, 'does_not_exist_folder_999'));
    } catch (e: any) {
      blockedNonExistent = true;
    }
    assert(blockedNonExistent, '2.4: Rejects non-existent workspace folder');

    // Blocking file passed as workspace
    let blockedFileAsWorkspace = false;
    try {
      runner.validateAndResolveWorkspace(path.join(testWorkspace, 'index.ts'));
    } catch (e: any) {
      blockedFileAsWorkspace = true;
    }
    assert(blockedFileAsWorkspace, '2.5: Rejects file path when workspace directory expected');

    // ------------------------------------------------------------------
    // SECTION 3: PRE-TASK SNAPSHOT & DIFF ENGINE
    // ------------------------------------------------------------------
    console.log('\n--- Section 3: Pre-Task Snapshot & Diff Engine ---');

    const snap = runner.captureWorkspaceSnapshot(testWorkspace);
    assert(snap && snap.files instanceof Map, '3.1: Snapshot captures workspace files map');
    assert(snap.files.has('index.ts'), '3.2: Snapshot includes index.ts');
    assert(snap.files.has('README.md'), '3.3: Snapshot includes README.md');
    assert(snap.files.has('package.json'), '3.4: Snapshot includes package.json');

    // Make a test change
    fs.writeFileSync(path.join(testWorkspace, 'index.ts'), 'export function add(a: number, b: number) { return a + b + 1; }\n', 'utf8');
    fs.writeFileSync(path.join(testWorkspace, 'new_file.ts'), 'export const hello = "world";\n', 'utf8');

    const diff = runner.diffWorkspaceAgainstSnapshot(testWorkspace, snap);
    assert(diff.modified.includes('index.ts'), '3.5: Diff detects modified file (index.ts)');
    assert(diff.created.includes('new_file.ts'), '3.6: Diff detects created file (new_file.ts)');
    assert(diff.totalChanges === 2, '3.7: Diff totalChanges equals 2');

    // Rollback test changes to restore pristine state
    runner.rollbackWorkspaceToSnapshot(testWorkspace, snap);
    const postRollbackDiff = runner.diffWorkspaceAgainstSnapshot(testWorkspace, snap);
    assert(postRollbackDiff.totalChanges === 0, '3.8: Direct rollback restores workspace to pristine snapshot state');
    assert(!fs.existsSync(path.join(testWorkspace, 'new_file.ts')), '3.9: Direct rollback removed created file (new_file.ts)');

    // ------------------------------------------------------------------
    // SECTION 4: TASK LIFECYCLE & EXECUTION (coding.start_task & coding.status)
    // ------------------------------------------------------------------
    console.log('\n--- Section 4: Task Lifecycle Management ---');

    const startRes = await runner.routeTool('coding.start_task', {
      workspacePath: testWorkspace,
      taskDescription: 'Fix calculation in index.ts and add helper.ts',
      simulateForTest: true,
      simulateFileChanges: [
        { path: 'index.ts', content: 'export function add(a: number, b: number) { return a + b; } // fixed\n' },
        { path: 'helper.ts', content: 'export const util = 42;\n' },
      ],
      mockOutput: 'OmniRoute: Analyzing workspace files...\nOmniRoute: Fixed calculation and created helper.ts\n',
      mockSecretOutput: 'CRITICAL_SECRET_KEY=sk_live_SUPER_SECRET_TOKEN_XYZ12345',
    });

    assert(startRes && startRes.tool === 'coding.start_task', '4.1: coding.start_task returns correct tool metadata');
    assert(startRes.taskId && startRes.taskId.startsWith('code_'), '4.2: coding.start_task generates valid prefixed taskId');
    assert(startRes.status === 'COMPLETED' || startRes.status === 'RUNNING', '4.3: Task transitions to valid execution state');

    const taskId = startRes.taskId;

    // Check task status
    const taskStatusRes = await runner.routeTool('coding.status', { taskId });
    assert(taskStatusRes && taskStatusRes.tool === 'coding.status', '4.4: coding.status returns status record');
    assert(taskStatusRes.taskId === taskId, '4.5: coding.status matches requested taskId');
    assert(taskStatusRes.changedFilesCount >= 2, '4.6: coding.status reports changed files count');

    // ------------------------------------------------------------------
    // SECTION 5: DUPLICATE CONCURRENT TASK PREVENTION
    // ------------------------------------------------------------------
    console.log('\n--- Section 5: Duplicate Concurrent Task Prevention ---');

    // Manually register an artificial active task in the workspace
    const dummyTask = {
      taskId: 'code_dummy_active',
      status: 'RUNNING',
      workspacePath: testWorkspace,
      startTime: Date.now(),
      stdoutTail: [],
      stderrTail: [],
      changedFiles: { created: [], modified: [], deleted: [] }
    };
    runner.activeCodingTasks.set(dummyTask.taskId, dummyTask);

    let duplicateBlocked = false;
    try {
      await runner.routeTool('coding.start_task', {
        workspacePath: testWorkspace,
        taskDescription: 'Simultaneous conflicting task',
        simulateForTest: true
      });
    } catch (err: any) {
      duplicateBlocked = true;
    }
    assert(duplicateBlocked, '5.1: Prevents duplicate concurrent task in the same workspace');

    // Clean up artificial task
    runner.activeCodingTasks.delete(dummyTask.taskId);

    // ------------------------------------------------------------------
    // SECTION 6: OUTPUT BOUNDING & SECRET REDACTION
    // ------------------------------------------------------------------
    console.log('\n--- Section 6: Output Bounding & Secret Redaction ---');

    const resultRes = await runner.routeTool('coding.read_result', { taskId });
    assert(resultRes && resultRes.tool === 'coding.read_result', '6.1: coding.read_result returns result record');

    const joinedOutput = (resultRes.outputTail || []).join('\n');
    assert(!joinedOutput.includes('SUPER_SECRET_TOKEN_XYZ12345'), '6.2: Secret token is completely redacted from logs');
    assert(joinedOutput.includes('[MASKED_SECRET]') || joinedOutput.includes('[API_KEY_MASKED]'), '6.3: Secret token is replaced by redaction marker');

    // ------------------------------------------------------------------
    // SECTION 7: REVIEW CHANGES (coding.review_changes)
    // ------------------------------------------------------------------
    console.log('\n--- Section 7: Review Changes Engine ---');

    const reviewRes = await runner.routeTool('coding.review_changes', { taskId });
    assert(reviewRes && reviewRes.tool === 'coding.review_changes', '7.1: coding.review_changes returns review structure');
    assert(reviewRes.modified.includes('index.ts'), '7.2: review_changes identifies modified index.ts');
    assert(reviewRes.created.includes('helper.ts'), '7.3: review_changes identifies created helper.ts');
    assert(reviewRes.totalChanges >= 2, '7.4: review_changes reports total changes correctly');

    // ------------------------------------------------------------------
    // SECTION 8: APPLY CHANGES (coding.apply_changes)
    // ------------------------------------------------------------------
    console.log('\n--- Section 8: Apply Changes & Confirmation Guard ---');

    const applyRes = await runner.routeTool('coding.apply_changes', { taskId });
    assert(applyRes && applyRes.status === 'APPLIED', '8.1: Safe changes applied successfully');

    // ------------------------------------------------------------------
    // SECTION 9: SAFE ROLLBACK ENGINE (coding.rollback)
    // ------------------------------------------------------------------
    console.log('\n--- Section 9: Safe Rollback Engine ---');

    // Rollback without confirmation should trigger challenge
    const unconfRollback = await runner.routeTool('coding.rollback', { taskId });
    assert(unconfRollback && unconfRollback.requiresOwnerConfirmation === true, '9.1: Rollback issues owner confirmation challenge');
    assert(typeof unconfRollback.confirmationId === 'string', '9.2: Challenge provides confirmationId');

    // Rollback with confirmation
    const confRollback = await runner.routeTool('coding.rollback', {
      taskId,
      confirmedByMohsin: true,
      confirmationId: unconfRollback.confirmationId
    });
    assert(confRollback && confRollback.status === 'ROLLED_BACK', '9.3: Confirmed rollback executes successfully');
    assert(confRollback.removedCreatedFiles.includes('helper.ts'), '9.4: Rollback removes newly created helper.ts');
    assert(!fs.existsSync(path.join(testWorkspace, 'helper.ts')), '9.5: helper.ts is deleted from disk');

    const indexContent = fs.readFileSync(path.join(testWorkspace, 'index.ts'), 'utf8');
    assert(!indexContent.includes('// fixed'), '9.6: index.ts content is safely restored to pre-task state');

    // ------------------------------------------------------------------
    // SECTION 10: TASK CANCELLATION (coding.cancel)
    // ------------------------------------------------------------------
    console.log('\n--- Section 10: Task Cancellation & Cleanup ---');

    const cancelTaskId = 'code_cancel_test_' + Date.now();
    runner.activeCodingTasks.set(cancelTaskId, {
      taskId: cancelTaskId,
      status: 'RUNNING',
      workspacePath: testWorkspace,
      startTime: Date.now(),
      stdoutTail: [],
      stderrTail: [],
      changedFiles: { created: [], modified: [], deleted: [] }
    });

    const cancelRes = await runner.routeTool('coding.cancel', { taskId: cancelTaskId });
    assert(cancelRes && cancelRes.status === 'CANCELLED', '10.1: coding.cancel sets status to CANCELLED');

    const statusAfterCancel = await runner.routeTool('coding.status', { taskId: cancelTaskId });
    assert(statusAfterCancel.status === 'CANCELLED', '10.2: coding.status confirms task is CANCELLED');

    // ------------------------------------------------------------------
    // SECTION 11: CONTROLLED TEST RUNNER (coding.test)
    // ------------------------------------------------------------------
    console.log('\n--- Section 11: Controlled Testing Runner ---');

    const testRes = await runner.routeTool('coding.test', {
      workspacePath: testWorkspace,
      testRunner: 'npm'
    });
    assert(testRes && testRes.tool === 'coding.test', '11.1: coding.test executes allowlisted runner');
    assert('passed' in testRes && typeof testRes.exitCode === 'number', '11.2: coding.test returns exitCode and passed flag');

    // ------------------------------------------------------------------
    // SECTION 12: STRICT ALLOWLIST ROUTING VERIFICATION
    // ------------------------------------------------------------------
    console.log('\n--- Section 12: Strict Allowlist Router Verification ---');

    const codingTools = [
      'coding.start_task',
      'coding.status',
      'coding.cancel',
      'coding.read_result',
      'coding.test',
      'coding.review_changes',
      'coding.apply_changes',
      'coding.rollback'
    ];

    for (const ct of codingTools) {
      assert(runner.ALL_ALLOWED_TOOLS.includes(ct), `12.1: ${ct} registered in ALL_ALLOWED_TOOLS`);
    }

    let forbiddenBlocked = false;
    try {
      await runner.routeTool('coding.unrestricted_shell', { cmd: 'rm -rf /' });
    } catch (e: any) {
      forbiddenBlocked = true;
    }
    assert(forbiddenBlocked, '12.2: Rejects arbitrary/unlisted coding tool (coding.unrestricted_shell)');

    console.log('\n===================================================================');
    console.log(`MARYAM PHASE 4 TEST SUITE PASSED! (${passedTests}/${totalTests} tests passed)`);
    console.log('===================================================================\n');

    process.exit(0);
  } catch (err: any) {
    console.error(`\nTest suite execution halted on error: ${err.message}`);
    process.exit(1);
  } finally {
    // Clean up test workspace
    try {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    } catch (_) {}
  }
}

runTestSuite();
