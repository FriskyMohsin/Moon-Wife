import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const runner = require('../local-runner/runner.cjs');
const runnerSource = fs.readFileSync(path.join(process.cwd(), 'local-runner', 'runner.cjs'), 'utf8');
let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`PASS ${passed}: ${name}`);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maryam-browser-profiles-'));
try {
  const localStatePath = path.join(tempDir, 'Local State');
  fs.mkdirSync(path.join(tempDir, 'Profile 1'));
  fs.mkdirSync(path.join(tempDir, 'Profile 9'));
  fs.writeFileSync(localStatePath, JSON.stringify({
    profile: { info_cache: {
      'Profile 1': { user_name: 'friskymohsin31@gmail.com' },
      'Profile 9': { user_name: 'undefine275@gmail.com' },
      'Profile 7': { user_name: 'unapproved@example.com' },
    } },
  }));

  test('only the two authorized Gmail identities are declared', () => {
    assert.deepEqual(Object.values(runner.AUTHORIZED_BROWSER_ACCOUNTS).sort(), [
      'friskymohsin31@gmail.com', 'undefine275@gmail.com',
    ].sort());
  });

  test('metadata maps the primary profile deterministically', () => {
    const profiles = runner.readAuthorizedChromeProfiles(localStatePath, tempDir);
    assert.equal(profiles.primary.directory, 'Profile 1');
    assert.equal(profiles.primary.email, 'friskymohsin31@gmail.com');
  });

  test('metadata maps the secondary profile deterministically', () => {
    const profiles = runner.readAuthorizedChromeProfiles(localStatePath, tempDir);
    assert.equal(profiles.secondary.directory, 'Profile 9');
    assert.equal(profiles.secondary.email, 'undefine275@gmail.com');
  });

  test('an unapproved profile is never returned by the allowlist', () => {
    const profiles = runner.readAuthorizedChromeProfiles(localStatePath, tempDir);
    assert.equal(Object.values(profiles).some((p: any) => p.email === 'unapproved@example.com'), false);
  });

  test('the old temporary automation profile is absent', () => {
    assert.equal(runnerSource.includes('MaryamAutomationProfile'), false);
  });

  test('the browser engine contains no global Chrome kill command', () => {
    const browserEngine = runnerSource.slice(runnerSource.indexOf('BROWSER AUTOMATION ENGINE'), runnerSource.indexOf('Deep DOM & Context Security Inspector'));
    assert.equal(/taskkill|stop-process|process\.kill|child\.kill/i.test(browserEngine), false);
  });

  test('port 9222 refuses unknown CDP ownership', () => {
    assert.match(runnerSource, /belongs to an unknown browser/);
    assert.match(runnerSource, /will not attach to or terminate it/);
  });

  test('browser.close_tab requires a Maryam-owned explicit target', () => {
    assert.match(runnerSource, /requires the explicit targetId of a Maryam-created tab/);
    assert.match(runnerSource, /Refusing to close a tab that Maryam did not create/);
  });

  test('browser switching is restricted to owned tabs', () => {
    assert.match(runnerSource, /const ownedTabs = tabs\.filter/);
    assert.match(runnerSource, /Refusing to switch to an unowned or unspecified tab/);
  });

  test('foreground selection targets only the managed process', () => {
    assert.match(runnerSource, /Get-Process -Id \$pid/);
    assert.doesNotMatch(runnerSource, /Get-Process -Name chrome, msedge/);
  });

  test('payment, MFA, and credential safety guards remain present', () => {
    assert.match(runnerSource, /CAPTCHA_MFA_DETECTED/);
    assert.match(runnerSource, /Payment or card credential field detected/);
    assert.match(runnerSource, /Password or security credential field detected/);
  });

  test('page reading does not remove live page nodes', () => {
    const readPage = runnerSource.slice(runnerSource.indexOf('async function executeBrowserReadPage'), runnerSource.indexOf('// 14. browser.get_url'));
    assert.doesNotMatch(readPage, /\.remove\(\)/);
  });

  test('global isAnyChromeProcessRunning block is removed from runner', () => {
    assert.equal(runnerSource.includes('isAnyChromeProcessRunning'), false);
    assert.doesNotMatch(runnerSource, /Chrome is already running without a Maryam-owned debugging session/);
  });

  test('isProfileLocked correctly detects unlocked profile', () => {
    const unlockedDir = path.join(tempDir, 'Profile 1');
    assert.equal(runner.isProfileLocked('Profile 1', tempDir), false);
  });

  test('isProfileLocked does not mistake a writable marker file for an OS lock', () => {
    const lockedDir = path.join(tempDir, 'Profile 9');
    const lockFile = path.join(lockedDir, 'SingletonLock');
    fs.writeFileSync(lockFile, 'lock');
    assert.equal(runner.isProfileLocked('Profile 9', tempDir), false);
    fs.unlinkSync(lockFile);
  });

  // --- Phase 1: Native Messaging Bridge & Extension Safety Tests ---

  test('extension manifest declares minimal permissions without sensitive cookie access', () => {
    const manifestPath = path.join(process.cwd(), 'local-runner', 'extension', 'manifest.json');
    assert.equal(fs.existsSync(manifestPath), true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.permissions.includes('nativeMessaging'), true);
    assert.equal(manifest.permissions.includes('tabs'), true);
    assert.equal(manifest.permissions.includes('cookies'), false);
    assert.equal(manifest.permissions.includes('webRequest'), false);
  });

  test('native host manifest specifies com.maryam.browser.bridge and stdio type', () => {
    const hostManifestPath = path.join(process.cwd(), 'local-runner', 'native-host', 'com.maryam.browser.bridge.json');
    assert.equal(fs.existsSync(hostManifestPath), true);
    const hostManifest = JSON.parse(fs.readFileSync(hostManifestPath, 'utf8'));
    assert.equal(hostManifest.name, 'com.maryam.browser.bridge');
    assert.equal(hostManifest.type, 'stdio');
  });

  test('profile pairing fails closed for unauthorized profile roles or invalid secrets', () => {
    // 1. Random / unapproved role
    const bogusRole = runner.verifyProfilePairing('guest', 'any_secret');
    assert.equal(bogusRole.success, false);
    assert.match(bogusRole.error, /PROFILE_DENIED/);

    // 2. Legitimate role with wrong secret
    const badSecret = runner.verifyProfilePairing('primary', 'wrong_token');
    assert.equal(badSecret.success, false);
    assert.match(badSecret.error, /PAIRING_DENIED/);

    // 3. Legitimate role with correct secret
    const correctSecret = runner.pairingSecrets.primary.pairingSecret;
    const good = runner.verifyProfilePairing('primary', correctSecret);
    assert.equal(good.success, true);
    assert.equal(good.profileEmail, 'friskymohsin31@gmail.com');
  });

  test('extension background service enforces strict tab ownership invariant', () => {
    const bgSource = fs.readFileSync(path.join(process.cwd(), 'local-runner', 'extension', 'background.js'), 'utf8');
    // Invariant: Must check ownedTabIds before executing tab close or action
    assert.match(bgSource, /ownedTabIds\.has\(targetId\)/);
    assert.match(bgSource, /SECURITY_VIOLATION: Refusing to close unowned tab/);
    assert.match(bgSource, /SECURITY_REJECTION: Extension is not paired with a verified authorized profile/);
  });

  test('all Phase 2 browser actions route through the active extension bridge', () => {
    const actions = [
      'browser.open', 'browser.navigate', 'browser.search', 'browser.read_page',
      'browser.scroll', 'browser.click', 'browser.fill', 'browser.type',
      'browser.press_key', 'browser.back', 'browser.forward', 'browser.refresh',
      'browser.new_tab', 'browser.switch_tab', 'browser.close_tab',
      'browser.get_tabs', 'browser.get_page_state', 'browser.wait_for',
      'browser.media_play', 'browser.media_pause', 'browser.media_toggle',
      'browser.media_seek', 'browser.media_restart', 'browser.media_get_state',
    ];
    const actionSetStart = runnerSource.indexOf('const EXTENSION_BROWSER_ACTIONS');
    const actionSetEnd = runnerSource.indexOf(']);', actionSetStart) + 3;
    const actionSetSource = runnerSource.slice(actionSetStart, actionSetEnd);
    const routeStart = runnerSource.indexOf('async function routeTool');
    const routeEnd = runnerSource.indexOf('const ALL_ALLOWED_TOOLS');
    const routeSource = runnerSource.slice(routeStart, routeEnd);
    for (const action of actions) {
      assert.match(actionSetSource, new RegExp(`['\"]${action.replace('.', '\\.')}['\"]`));
    }
    assert.match(routeSource, /dispatchBrowserViaActiveExtension\(toolName, params\)/);
    assert.match(runnerSource, /Do not degrade to CDP if dispatch fails/);
  });

  test('extension maintains sequential owned-tab state and rejects unowned targets', () => {
    const bgSource = fs.readFileSync(path.join(process.cwd(), 'local-runner', 'extension', 'background.js'), 'utf8');
    assert.match(bgSource, /persistedOwnedTabIds/);
    assert.match(bgSource, /persistedCurrentTabId/);
    assert.match(bgSource, /resolveTargetTab/);
    assert.match(bgSource, /Refusing to interact with unowned tab/);
    assert.match(bgSource, /executeScriptInTab/);
  });

  test('native host retains one specific extension ID and forbids wildcards', () => {
    const hostManifestPath = path.join(process.cwd(), 'local-runner', 'native-host', 'com.maryam.browser.bridge.json');
    const hostManifest = JSON.parse(fs.readFileSync(hostManifestPath, 'utf8'));
    assert.equal(hostManifest.allowed_origins.length, 1);
    assert.match(hostManifest.allowed_origins[0], /^chrome-extension:\/\/[a-z]{32}\/$/);
    assert.equal(hostManifest.allowed_origins[0].includes('*'), false);
    assert.match(hostManifest.path, /^[A-Za-z]:\\/);
  });

  test('extension path preserves runner relay/auth and does not require CDP', () => {
    assert.match(runnerSource, /MARYAM_RUNNER_SECRET/);
    assert.match(runnerSource, /activeCodingTasks/);
    assert.match(runnerSource, /nativeHostTaskQueue/);
    assert.match(runnerSource, /NO CDP 9222/);
    assert.doesNotMatch(runnerSource, /Auth Token:\s*\$\{RUNNER_TOKEN\}/);
  });

  test('extension interaction guard preserves MFA, credential, and payment protections', () => {
    const bgSource = fs.readFileSync(path.join(process.cwd(), 'local-runner', 'extension', 'background.js'), 'utf8');
    assert.match(bgSource, /CAPTCHA_MFA_DETECTED/);
    assert.match(bgSource, /Payment or card credential field detected/);
    assert.match(bgSource, /SECURITY_CONFIRMATION_REQUIRED/);
  });

  test('SPA navigation completes from usable document state instead of a late onUpdated event', () => {
    const bgSource = fs.readFileSync(path.join(process.cwd(), 'local-runner', 'extension', 'background.js'), 'utf8');
    assert.match(bgSource, /waitForUsableNavigation/);
    assert.match(bgSource, /documentState\.readyState === 'interactive'/);
    assert.match(bgSource, /state: 'navigation_observed'/);
    assert.doesNotMatch(bgSource, /waitForTabComplete/);
  });

  test('dynamic YouTube search, click, scroll, and wait paths have bounded SPA completion', () => {
    const bgSource = fs.readFileSync(path.join(process.cwd(), 'local-runner', 'extension', 'background.js'), 'utf8');
    assert.match(bgSource, /youtube\.com\/results\?search_query/);
    assert.match(bgSource, /waitForTarget\(tab\.id, selector, textTarget\)/);
    assert.match(bgSource, /CLICK_TARGET_TIMEOUT/);
    assert.match(bgSource, /completion: \{ state: 'scroll_applied' \}/);
    assert.match(bgSource, /Math\.min\(Math\.max\(requestedTimeoutMs, 500\), 12000\)/);
    assert.match(runnerSource, /EXTENSION_ACTION_TIMEOUT_MS/);
    assert.match(runnerSource, /'browser\.search': 20000/);
  });

  test('YouTube result clicks require semantic match, verified watch route, media, and playback', () => {
    const bgSource = fs.readFileSync(path.join(process.cwd(), 'local-runner', 'extension', 'background.js'), 'utf8');
    assert.match(bgSource, /waitForYouTubeVideoResult/);
    assert.match(bgSource, /ytd-video-renderer a#video-title/);
    assert.match(bgSource, /matchedTerms/);
    assert.match(bgSource, /openVerifiedYouTubeVideo\(tab, textTarget\)/);
    assert.match(bgSource, /chrome\.tabs\.update\(tab\.id, \{ url: match\.href, active: true \}\)/);
    assert.match(bgSource, /YOUTUBE_MEDIA_NOT_READY/);
    assert.match(bgSource, /YOUTUBE_PLAY_UNCONFIRMED/);
  });

  test('media controls are owned-tab-only, direct HTMLMediaElement operations with verified state', () => {
    const bgSource = fs.readFileSync(path.join(process.cwd(), 'local-runner', 'extension', 'background.js'), 'utf8');
    for (const action of ['media_play', 'media_pause', 'media_toggle', 'media_seek', 'media_restart', 'media_get_state']) {
      assert.match(bgSource, new RegExp(`browser\\.${action}`));
      assert.match(runnerSource, new RegExp(`browser\\.${action}`));
    }
    assert.match(bgSource, /controlOwnedMedia\(tab\.id, operation, params\)/);
    assert.match(bgSource, /document\.querySelectorAll\('video, audio'\)/);
    assert.match(bgSource, /await playResult/);
    assert.match(bgSource, /MEDIA_PAUSE_UNCONFIRMED/);
    assert.match(bgSource, /MEDIA_SEEK_UNCONFIRMED/);
    assert.match(bgSource, /Math\.min\(Math\.max\(target, 0\), media\.duration\)/);
    assert.match(bgSource, /media: snapshot\(\)/);
    assert.match(bgSource, /playing: !media\.paused && !media\.ended/);
    assert.match(bgSource, /muted: Boolean\(media\.muted\)/);
    assert.match(bgSource, /volume: Number\.isFinite\(media\.volume\)/);
    const mediaHandler = bgSource.slice(bgSource.indexOf("case 'browser.media_play'"), bgSource.indexOf('\n      default:'));
    assert.match(mediaHandler, /resolveTargetTab\(params\.tabId \|\| params\.targetId\)/);
  });

  test('persisted pairing re-verifies from runner success without deleting secrets on transient failure', () => {
    const bgSource = fs.readFileSync(path.join(process.cwd(), 'local-runner', 'extension', 'background.js'), 'utf8');
    assert.match(bgSource, /msg\.success && \(msg\.profileRole === 'primary'/);
    assert.match(bgSource, /reverifyPersistedPairing/);
    assert.match(bgSource, /isPermanentPairingFailure/);
    assert.match(bgSource, /pairingState = 'VERIFYING'/);
  });

  test('pairing recovery preserves the enrolled identity and never returns a host secret to Chrome', () => {
    const bgSource = fs.readFileSync(path.join(process.cwd(), 'local-runner', 'extension', 'background.js'), 'utf8');
    const hostSource = fs.readFileSync(path.join(process.cwd(), 'local-runner', 'native-host', 'native_host.cjs'), 'utf8');
    assert.match(bgSource, /type: 'RECOVER_PAIRING'/);
    assert.doesNotMatch(bgSource, /storage\.local\.remove\(\['enrolledProfile', 'pairingSecret'\]\)/);
    assert.match(hostSource, /buildRecoveryHandshake/);
    assert.match(hostSource, /TRUSTED_EXTENSION_ORIGIN/);
    assert.match(hostSource, /PAIRING_RECOVERY_UNAVAILABLE/);
    assert.match(hostSource, /runnerRequest = msg\.type === 'RECOVER_PAIRING'/);
  });

  test('runner registration self-healing validates only the canonical host manifest and origin', () => {
    const config = runner.getCanonicalNativeHostConfiguration();
    assert.match(config.manifestPath, /local-runner[\\/]native-host[\\/]com\.maryam\.browser\.bridge\.json$/);
    assert.match(config.hostPath, /local-runner[\\/]native-host[\\/]native_host\.bat$/);
    assert.equal(config.allowedOrigin, 'chrome-extension://ooalidlihcoemfijgdagllfkpbnhegjd/');
    assert.match(runnerSource, /ensureNativeHostRegistration/);
    assert.match(runnerSource, /PAIRING_STORE_CORRUPT/);
  });

  test('native handshake contract has defined success and failure responses', () => {
    const valid = runner.createNativeBridgeHandshakeResponse({
      profileRole: 'primary', pairingSecret: runner.pairingSecrets.primary.pairingSecret,
    });
    assert.deepEqual(valid, {
      type: 'HANDSHAKE_RESPONSE', success: true,
      profileRole: 'primary', profileEmail: 'friskymohsin31@gmail.com',
    });
    const invalid = runner.createNativeBridgeHandshakeResponse({ profileRole: 'primary', pairingSecret: 'invalid' });
    assert.equal(invalid.type, 'HANDSHAKE_RESPONSE');
    assert.equal(invalid.success, false);
    assert.equal(typeof invalid.error, 'string');
    assert.ok(invalid.error.length > 0);
  });

  const runtimeActions = [
    'browser.open', 'browser.navigate', 'browser.search', 'browser.read_page',
    'browser.scroll', 'browser.click', 'browser.fill', 'browser.type',
    'browser.press_key', 'browser.back', 'browser.forward', 'browser.refresh',
    'browser.new_tab', 'browser.switch_tab', 'browser.close_tab',
    'browser.get_tabs', 'browser.get_page_state', 'browser.wait_for',
    'browser.media_play', 'browser.media_pause', 'browser.media_toggle',
    'browser.media_seek', 'browser.media_restart', 'browser.media_get_state',
  ];
  const dispatched: string[] = [];
  runner.setExtensionBridgeTestHooks({
    role: 'primary',
    dispatch(action: string, _params: unknown, correlationId: string) {
      dispatched.push(action);
      return { tool: action, tabId: 777, closedId: 777, correlationId, via: 'extension' };
    },
  });
  for (const action of runtimeActions) {
    const result = await runner.executeIncomingRelayTask({ id: `relay-${action}`, tool: action, params: {} });
    assert.equal(result.via, 'extension');
  }
  for (const mediaAction of ['browser.media_play', 'browser.media_pause', 'browser.media_toggle', 'browser.media_seek']) {
    assert.equal(dispatched.includes(mediaAction), true, `${mediaAction} must traverse the real relay handler to the extension`);
  }
  runner.setExtensionBridgeTestHooks(null);
  passed++;
  console.log(`PASS ${passed}: real relay handler routes all Phase 2 actions to extension without CDP`);

  runner.setExtensionBridgeTestHooks({ forceUnavailable: true });
  await assert.rejects(
    () => runner.executeIncomingRelayTask({ id: 'relay-no-bridge', tool: 'browser.search', params: { query: 'Maryam' } }),
    /CDP fallback is disabled for Phase 2 actions/
  );
  runner.setExtensionBridgeTestHooks(null);
  passed++;
  console.log(`PASS ${passed}: real relay handler fails closed when extension bridge is unavailable`);

  console.log(`ALL BROWSER SAFETY TESTS PASSED: ${passed}/${passed}`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
