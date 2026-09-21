/**
 * Comprehensive Automated Verification Suite for Maryam Phase 5
 * Maryam Autonomous Software Development Workflow
 *
 * Tests:
 * 1. dev.create_project (Scaffolding, Stack Detection, Baseline Snapshot, Overwrite Prevention)
 * 2. dev.inspect_project (Existing Workspace Inspection, Framework/Test Detection, Pre-mod Snapshot)
 * 3. dev.plan (Structured Phased Engineering Plan, Constraints, State: READY)
 * 4. dev.execute_plan (OmniRoute Coding Delegation, Duplicate Task Guard, State: CODING)
 * 5. dev.test (Automated Test Execution, Failure Detection, State: FIXING)
 * 6. dev.fix_failures (Bounded Autonomous Repair Loop, Attempt Counter, Max Retries Limit)
 * 7. Quality Gates Engine (6 Mandatory Quality Gates, Secret Leak Prevention, File Integrity)
 * 8. dev.review (Diff Inspection, Quality Gate Audit, State: REVIEWING)
 * 9. dev.finalize (Quality Gate Enforcement, Localhost-Only Preview 127.0.0.1, State: COMPLETED)
 * 10. dev.rollback (Confirmation Challenge, Snapshot Restoration, State: READY)
 * 11. dev.cancel (Workflow Abort, OmniRoute Cleanup, State: CANCELLED)
 * 12. Strict Router Allowlist Verification (All 11 dev.* Tools)
 */

import fs from 'fs';
import path from 'path';
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
  console.log('MARYAM PHASE 5: AUTONOMOUS SOFTWARE DEVELOPMENT WORKFLOW SUITE');
  console.log('===================================================================\n');

  const baseTestDir = path.join(process.cwd(), 'workspace', 'phase5_tests_' + Date.now());
  if (!fs.existsSync(baseTestDir)) {
    fs.mkdirSync(baseTestDir, { recursive: true });
  }

  try {
    // ------------------------------------------------------------------
    // SECTION 1: PROJECT SCAFFOLDING & CREATION (dev.create_project)
    // ------------------------------------------------------------------
    console.log('--- Section 1: Project Scaffolding & Creation ---');

    const htmlProjectDir = path.join(baseTestDir, 'html_app');
    const createHtmlRes = await runner.routeTool('dev.create_project', {
      projectName: 'html_app',
      projectType: 'html',
      requirements: 'Build a modern responsive portfolio for Mohsin',
      workspacePath: htmlProjectDir,
    });

    assert(createHtmlRes && createHtmlRes.success === true, '1.1: dev.create_project succeeds');
    assert(createHtmlRes.state === 'READY', '1.2: Initial project state is READY');
    assert(createHtmlRes.projectType === 'html', '1.3: Project type correctly identified as html');
    assert(fs.existsSync(path.join(htmlProjectDir, 'index.html')), '1.4: Scaffolds index.html');
    assert(fs.existsSync(path.join(htmlProjectDir, 'styles.css')), '1.5: Scaffolds styles.css');
    assert(fs.existsSync(path.join(htmlProjectDir, 'app.js')), '1.6: Scaffolds app.js');
    assert(fs.existsSync(path.join(htmlProjectDir, 'README.md')), '1.7: Scaffolds README.md');
    assert(!!createHtmlRes.baselineSnapshotId, '1.8: Creates baseline snapshot ID');

    // Overwrite prevention guard
    let overwriteBlocked = false;
    try {
      await runner.routeTool('dev.create_project', {
        projectName: 'html_app',
        projectType: 'html',
        requirements: 'Overwrite attempt',
        workspacePath: htmlProjectDir,
        preventOverwrite: true,
      });
    } catch (e: any) {
      overwriteBlocked = true;
    }
    assert(overwriteBlocked, '1.9: dev.create_project prevents accidental overwrite of existing directory');

    // React scaffolding
    const reactProjectDir = path.join(baseTestDir, 'react_app');
    const createReactRes = await runner.routeTool('dev.create_project', {
      projectName: 'react_app',
      projectType: 'react',
      requirements: 'Interactive dashboard for Mohsin',
      workspacePath: reactProjectDir,
    });
    assert(createReactRes.success === true, '1.10: React scaffolding succeeds');
    assert(fs.existsSync(path.join(reactProjectDir, 'package.json')), '1.11: React package.json created');
    assert(fs.existsSync(path.join(reactProjectDir, 'src', 'App.jsx')), '1.12: React App.jsx created');

    // ------------------------------------------------------------------
    // SECTION 2: PROJECT INSPECTION & STACK DETECTION (dev.inspect_project)
    // ------------------------------------------------------------------
    console.log('\n--- Section 2: Project Inspection & Stack Detection ---');

    const inspectRes = await runner.routeTool('dev.inspect_project', {
      workspacePath: reactProjectDir,
    });

    assert(inspectRes && inspectRes.success === true, '2.1: dev.inspect_project succeeds');
    assert(inspectRes.stack && inspectRes.stack.type === 'react', '2.2: Detects react stack');
    assert(inspectRes.stack.framework === 'React (Vite)', '2.3: Identifies React Vite framework');
    assert(inspectRes.stack.testRunner === 'vitest', '2.4: Identifies vitest test runner');
    assert(inspectRes.state === 'READY', '2.5: Project state is READY');
    assert(!!inspectRes.baselineSnapshotId, '2.6: Pre-modification snapshot captured');

    // ------------------------------------------------------------------
    // SECTION 3: ENGINEERING PLAN CREATION (dev.plan)
    // ------------------------------------------------------------------
    console.log('\n--- Section 3: Engineering Plan Creation ---');

    const planRes = await runner.routeTool('dev.plan', {
      projectId: inspectRes.projectId,
      goals: ['Implement real-time analytics chart', 'Add export to CSV button'],
      constraints: ['No unapproved paid third-party APIs', 'Must pass all automated tests'],
    });

    assert(planRes && planRes.success === true, '3.1: dev.plan succeeds');
    assert(planRes.state === 'READY', '3.2: Project transitions to READY state');
    assert(Array.isArray(planRes.phases) && planRes.phases.length >= 4, '3.3: Plan contains multi-phase steps');
    assert(planRes.goals.length === 2, '3.4: Plan registers requested goals');
    assert(planRes.constraints.length >= 2, '3.5: Plan registers security and testing constraints');

    // ------------------------------------------------------------------
    // SECTION 4: PLAN EXECUTION & DELEGATION (dev.execute_plan)
    // ------------------------------------------------------------------
    console.log('\n--- Section 4: Plan Execution & Coding Delegation ---');

    const execRes = await runner.routeTool('dev.execute_plan', {
      projectId: inspectRes.projectId,
      simulateForTest: true,
      simulateFileChanges: [
        { path: 'src/components/AnalyticsChart.jsx', content: '// Real-time analytics chart component\nexport function AnalyticsChart() { return <div>Chart</div>; }' }
      ],
      mockOutput: 'OmniRoute: Real-time analytics chart successfully generated.',
    });

    assert(execRes && execRes.success === true, '4.1: dev.execute_plan succeeds');
    assert(execRes.state === 'CODING', '4.2: Project state transitions to CODING');
    assert(!!execRes.taskId, '4.3: Dispatches OmniRoute task with valid taskId');

    // Duplicate execution guard
    let duplicateBlocked = false;
    try {
      await runner.routeTool('dev.execute_plan', {
        projectId: inspectRes.projectId,
        simulateForTest: true,
      });
    } catch (e: any) {
      duplicateBlocked = true;
    }
    assert(duplicateBlocked, '4.4: dev.execute_plan blocks concurrent execution on same project');

    // ------------------------------------------------------------------
    // SECTION 5: AUTOMATED TESTING & FAILURE DETECTION (dev.test)
    // ------------------------------------------------------------------
    console.log('\n--- Section 5: Automated Testing & Failure Detection ---');

    // Simulate test failure
    const failTestRes = await runner.routeTool('dev.test', {
      projectId: inspectRes.projectId,
      simulateFailure: 'AssertionError: AnalyticsChart render test failed on missing container',
    });

    assert(failTestRes && failTestRes.passed === false, '5.1: dev.test detects test failure');
    assert(failTestRes.state === 'FIXING', '5.2: Project automatically transitions to FIXING state on failure');
    assert(failTestRes.errors.length > 0, '5.3: Error details isolated in test output');

    // ------------------------------------------------------------------
    // SECTION 6: BOUNDED AUTONOMOUS REPAIR LOOP (dev.fix_failures)
    // ------------------------------------------------------------------
    console.log('\n--- Section 6: Bounded Autonomous Repair Loop ---');

    // Attempt 1
    const fixRes1 = await runner.routeTool('dev.fix_failures', {
      projectId: inspectRes.projectId,
      simulateForTest: true,
      simulateFixed: true,
      maxRetries: 3,
    });

    assert(fixRes1 && fixRes1.success === true, '6.1: dev.fix_failures dispatches repair attempt');
    assert(fixRes1.attempt === 1, '6.2: Repair attempt counter is 1');
    assert(fixRes1.maxRetries === 3, '6.3: Max retries set to 3');
    assert(fixRes1.state === 'FIXING', '6.4: State is FIXING during repair');

    // Re-test to pass
    const passTestRes = await runner.routeTool('dev.test', {
      projectId: inspectRes.projectId,
      simulatePassed: true,
    });

    assert(passTestRes && passTestRes.passed === true, '6.5: Re-testing after repair passes');
    assert(passTestRes.state === 'REVIEWING', '6.6: Project transitions to REVIEWING state upon passing test');

    // Bounded retry limit guard test
    const maxRetryDir = path.join(baseTestDir, 'retry_test_app');
    const maxRetryProj = await runner.routeTool('dev.create_project', {
      projectName: 'retry_test_app',
      projectType: 'html',
      requirements: 'Retry test',
      workspacePath: maxRetryDir,
    });

    // Manually force 3 failed attempts
    await runner.routeTool('dev.test', { projectId: maxRetryProj.projectId, simulateFailure: 'Persistent error' });
    await runner.routeTool('dev.fix_failures', { projectId: maxRetryProj.projectId, simulateForTest: true, maxRetries: 3 });
    await runner.routeTool('dev.test', { projectId: maxRetryProj.projectId, simulateFailure: 'Persistent error' });
    await runner.routeTool('dev.fix_failures', { projectId: maxRetryProj.projectId, simulateForTest: true, maxRetries: 3 });
    await runner.routeTool('dev.test', { projectId: maxRetryProj.projectId, simulateFailure: 'Persistent error' });
    await runner.routeTool('dev.fix_failures', { projectId: maxRetryProj.projectId, simulateForTest: true, maxRetries: 3 });

    let retryExceededBlocked = false;
    try {
      await runner.routeTool('dev.fix_failures', { projectId: maxRetryProj.projectId, simulateForTest: true, maxRetries: 3 });
    } catch (e: any) {
      retryExceededBlocked = e.message.includes('Maximum repair retries') || e.message.includes('exceeded');
    }
    assert(retryExceededBlocked, '6.7: Bounded repair strictly halts and refuses to exceed maxRetries (3 attempts)');

    // ------------------------------------------------------------------
    // SECTION 7: QUALITY GATES ENGINE (runProjectQualityGates)
    // ------------------------------------------------------------------
    console.log('\n--- Section 7: Quality Gates Engine ---');

    // Test with pristine project
    const qgPassRes = runner.runProjectQualityGates(inspectRes.projectId, reactProjectDir);
    assert(qgPassRes && qgPassRes.passed === true, '7.1: Quality gates pass on valid clean project');
    assert(qgPassRes.gates.workspaceBounds === true, '7.2: Gate 1 (Workspace Bounds) passed');
    assert(qgPassRes.gates.filesIntegrity === true, '7.3: Gate 2 (Files Integrity) passed');
    assert(qgPassRes.gates.sensitiveFilesProtection === true, '7.4: Gate 3 (Sensitive Files Protection) passed');
    assert(qgPassRes.gates.testSuiteStatus === true, '7.5: Gate 4 (Test Suite Status) passed');
    assert(qgPassRes.gates.unresolvedErrorsScan === true, '7.6: Gate 5 (Unresolved Errors Scan) passed');
    assert(qgPassRes.gates.previewReadiness === true, '7.7: Gate 6 (Preview Readiness) passed');

    // Test secret leak detection: place a fake .env with SECRET_KEY
    fs.writeFileSync(path.join(reactProjectDir, '.env'), 'STRIPE_SECRET_KEY=sk_live_1234567890abcdef\n', 'utf8');
    const qgLeakRes = runner.runProjectQualityGates(inspectRes.projectId, reactProjectDir);
    assert(qgLeakRes.passed === false, '7.8: Quality gates detect sensitive file (.env) with secret keys');
    assert(qgLeakRes.gates.sensitiveFilesProtection === false, '7.9: Gate 3 fails when sensitive secrets are detected');
    fs.unlinkSync(path.join(reactProjectDir, '.env')); // cleanup secret

    // ------------------------------------------------------------------
    // SECTION 8: CODE REVIEW & DIFF INSPECTION (dev.review)
    // ------------------------------------------------------------------
    console.log('\n--- Section 8: Code Review & Diff Inspection ---');

    const reviewRes = await runner.routeTool('dev.review', {
      projectId: inspectRes.projectId,
    });

    assert(reviewRes && reviewRes.success === true, '8.1: dev.review succeeds');
    assert(reviewRes.state === 'REVIEWING', '8.2: State remains REVIEWING');
    assert(reviewRes.qualityGates && reviewRes.qualityGates.passed === true, '8.3: Quality gates verified in review');
    assert(Array.isArray(reviewRes.changes.created), '8.4: Created files diff list returned');

    // ------------------------------------------------------------------
    // SECTION 9: TELEMETRY & STATUS (dev.status)
    // ------------------------------------------------------------------
    console.log('\n--- Section 9: Telemetry & Status ---');

    const statusRes = await runner.routeTool('dev.status', {
      projectId: inspectRes.projectId,
    });

    assert(statusRes && statusRes.success === true, '9.1: dev.status succeeds');
    assert(statusRes.currentPhase === 'REVIEWING', '9.2: Accurate currentPhase reported');
    assert(statusRes.repairAttempts >= 1, '9.3: Repair attempts tracked');
    assert(statusRes.qualityGates.passed === true, '9.4: Quality gates status included');

    // ------------------------------------------------------------------
    // SECTION 10: PROJECT FINALIZATION & LOCALHOST PREVIEW (dev.finalize)
    // ------------------------------------------------------------------
    console.log('\n--- Section 10: Project Finalization & Localhost Preview ---');

    const finalRes = await runner.routeTool('dev.finalize', {
      projectId: inspectRes.projectId,
      startPreview: true,
      previewPort: 5173,
    });

    assert(finalRes && finalRes.success === true, '10.1: dev.finalize succeeds');
    assert(finalRes.state === 'COMPLETED', '10.2: State transitions to COMPLETED');
    assert(finalRes.preview && finalRes.preview.url.includes('127.0.0.1:5173'), '10.3: Localhost preview strictly bound to 127.0.0.1');
    assert(!finalRes.preview.url.includes('0.0.0.0'), '10.4: Preview never binds to 0.0.0.0');

    // ------------------------------------------------------------------
    // SECTION 11: SAFE ROLLBACK WITH CONFIRMATION (dev.rollback)
    // ------------------------------------------------------------------
    console.log('\n--- Section 11: Safe Rollback with Confirmation ---');

    // Unconfirmed attempt triggers challenge
    const rollbackChallenge = await runner.routeTool('dev.rollback', {
      projectId: inspectRes.projectId,
    });

    assert(rollbackChallenge && rollbackChallenge.requiresOwnerConfirmation === true, '11.1: dev.rollback issues confirmation challenge');
    assert(!!rollbackChallenge.confirmationId, '11.2: Challenge contains confirmationId');

    // Confirmed attempt executes restoration
    const rollbackExec = await runner.routeTool('dev.rollback', {
      projectId: inspectRes.projectId,
      confirmedByMohsin: true,
      confirmationId: rollbackChallenge.confirmationId,
    });

    assert(rollbackExec && rollbackExec.status === 'ROLLED_BACK', '11.3: Rollback completes successfully');
    assert(rollbackExec.state === 'READY', '11.4: State returns to READY');
    // Verify newly added file was removed by rollback
    assert(!fs.existsSync(path.join(reactProjectDir, 'src/components/AnalyticsChart.jsx')), '11.5: Newly generated files removed by rollback');

    // ------------------------------------------------------------------
    // SECTION 12: WORKFLOW CANCELLATION (dev.cancel)
    // ------------------------------------------------------------------
    console.log('\n--- Section 12: Workflow Cancellation ---');

    const cancelRes = await runner.routeTool('dev.cancel', {
      projectId: inspectRes.projectId,
      reason: 'User requested task termination',
    });

    assert(cancelRes && cancelRes.success === true, '12.1: dev.cancel succeeds');
    assert(cancelRes.state === 'CANCELLED', '12.2: State transitions to CANCELLED');

    // ------------------------------------------------------------------
    // SECTION 13: STRICT TOOL ROUTER ALLOWLIST (11 dev.* Tools)
    // ------------------------------------------------------------------
    console.log('\n--- Section 13: Strict Router Allowlist Verification ---');

    const phase5Tools = [
      'dev.create_project', 'dev.inspect_project', 'dev.plan', 'dev.execute_plan',
      'dev.test', 'dev.fix_failures', 'dev.review', 'dev.status',
      'dev.cancel', 'dev.rollback', 'dev.finalize',
    ];

    for (const tool of phase5Tools) {
      assert(runner.ALL_ALLOWED_TOOLS.includes(tool), `13.x: ${tool} present in ALL_ALLOWED_TOOLS`);
    }

    // Attempting unlisted tool
    let unlistedBlocked = false;
    try {
      await runner.routeTool('dev.deploy_production', { projectId: 'test' });
    } catch (e: any) {
      unlistedBlocked = true;
    }
    assert(unlistedBlocked, '13.12: Unlisted tool (dev.deploy_production) strictly blocked by router');

    console.log('\n===================================================================');
    console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests}`);
    console.log('Maryam Phase 5 Autonomous Software Development Workflow is fully verified!');
    console.log('===================================================================\n');
  } finally {
    // Cleanup scratch workspace
    try {
      if (fs.existsSync(baseTestDir)) {
        fs.rmSync(baseTestDir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
}

runTestSuite().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('\nTest Suite Failed with error:', err);
  process.exit(1);
});
