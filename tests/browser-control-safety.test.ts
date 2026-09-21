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

  console.log(`ALL BROWSER SAFETY TESTS PASSED: ${passed}/${passed}`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
