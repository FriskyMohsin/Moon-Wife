const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const azPath = 'C:\\Users\\HP\\azure-cli\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd';
const armToken = execSync(`"${azPath}" account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv`).toString().trim();

function fetchVfsFile(vfsPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'app-maryam-production.scm.azurewebsites.net',
      port: 443,
      path: `/api/vfs/${vfsPath}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${armToken}`,
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ statusCode: res.statusCode, headers: res.headers, buffer });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const stagingDir = path.join(backupDir, `staging_${timestamp}`);
  if (!fs.existsSync(stagingDir)) fs.mkdirSync(stagingDir, { recursive: true });

  console.log(`[Backup] Starting Pre-Deploy Production Backup at ${timestamp}...`);

  const filesToBackup = [
    'site/wwwroot/data/maryam_memory.json',
    'site/wwwroot/data/maryam_owner_conversation.json',
    'site/wwwroot/data/maryam_proactive.json',
    'site/wwwroot/data/maryam_social.json',
    'site/wwwroot/data/hoorvia_platform/.master_secret',
    'site/wwwroot/data/hoorvia_platform/admin_audit_logs.json',
    'site/wwwroot/data/hoorvia_platform/audit_logs.json',
    'site/wwwroot/data/hoorvia_platform/companions.json',
    'site/wwwroot/data/hoorvia_platform/credentials.json',
    'site/wwwroot/data/hoorvia_platform/memories.json',
    'site/wwwroot/data/hoorvia_platform/policy.json',
    'site/wwwroot/data/hoorvia_platform/scheduled_tasks.json',
    'site/wwwroot/data/hoorvia_platform/sessions.json',
    'site/wwwroot/data/hoorvia_platform/usage.json',
    'site/wwwroot/data/hoorvia_platform/users.json',
  ];

  const backedUpFiles = [];
  const fileHashes = {};

  for (const filePath of filesToBackup) {
    try {
      const res = await fetchVfsFile(filePath);
      if (res.statusCode === 200) {
        // Compute relative path inside staging
        const relPath = filePath.replace('site/wwwroot/data/', '');
        const destPath = path.join(stagingDir, relPath);
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

        fs.writeFileSync(destPath, res.buffer);
        const hash = sha256(res.buffer);
        fileHashes[relPath] = hash;
        backedUpFiles.push({
          relPath,
          size: res.buffer.length,
          sha256: hash,
        });
        console.log(`  ✓ Saved: ${relPath} (${res.buffer.length} bytes, sha256: ${hash.slice(0, 12)}...)`);
      } else if (res.statusCode === 404) {
        console.log(`  - Not present in remote (404): ${filePath}`);
      } else {
        console.warn(`  ! Warning: ${filePath} returned status ${res.statusCode}`);
      }
    } catch (err) {
      console.error(`  ! Error fetching ${filePath}:`, err.message);
    }
  }

  // Create ZSTD archive using Python script
  const archivePath = path.join(backupDir, `maryam_prod_backup_${timestamp}.tar.zst`);
  const pyScript = `
import tarfile
import zstandard as zstd
import os

staging_dir = r"${stagingDir}"
archive_path = r"${archivePath}"

cctx = zstd.ZstdCompressor(level=19)
with open(archive_path, 'wb') as f_out:
    with cctx.stream_writer(f_out) as compressor:
        with tarfile.open(mode='w|', fileobj=compressor) as tar:
            for root, dirs, files in os.walk(staging_dir):
                for file in files:
                    full_path = os.path.join(root, file)
                    arc_name = os.path.relpath(full_path, staging_dir)
                    tar.add(full_path, arcname=arc_name)
print("ARCHIVE_SUCCESS")
`;

  fs.writeFileSync(path.join(backupDir, 'compress.py'), pyScript);
  const compRes = execSync('python backups/compress.py').toString().trim();
  fs.unlinkSync(path.join(backupDir, 'compress.py'));

  if (!compRes.includes('ARCHIVE_SUCCESS')) {
    throw new Error('ZSTD compression failed');
  }

  const archiveBuffer = fs.readFileSync(archivePath);
  const archiveSha256 = sha256(archiveBuffer);
  const archiveSize = archiveBuffer.length;

  console.log(`\n[Backup] Archive created successfully: ${archivePath}`);
  console.log(`[Backup] Archive Size: ${archiveSize} bytes`);
  console.log(`[Backup] Archive SHA-256: ${archiveSha256}`);

  // Test extraction in isolated restore directory
  const restoreTestDir = path.join(backupDir, `test_restore_${timestamp}`);
  if (!fs.existsSync(restoreTestDir)) fs.mkdirSync(restoreTestDir, { recursive: true });

  const pyRestoreScript = `
import tarfile
import zstandard as zstd
import os

archive_path = r"${archivePath}"
restore_dir = r"${restoreTestDir}"

dctx = zstd.ZstdDecompressor()
with open(archive_path, 'rb') as f_in:
    with dctx.stream_reader(f_in) as decompressor:
        with tarfile.open(mode='r|', fileobj=decompressor) as tar:
            tar.extractall(path=restore_dir)
print("RESTORE_SUCCESS")
`;

  fs.writeFileSync(path.join(backupDir, 'restore.py'), pyRestoreScript);
  const restoreRes = execSync('python backups/restore.py').toString().trim();
  fs.unlinkSync(path.join(backupDir, 'restore.py'));

  if (!restoreRes.includes('RESTORE_SUCCESS')) {
    throw new Error('ZSTD restore test failed');
  }

  // Verify every restored file's SHA-256 matches the original
  let restoreVerified = true;
  for (const item of backedUpFiles) {
    const restoredFilePath = path.join(restoreTestDir, item.relPath);
    if (!fs.existsSync(restoredFilePath)) {
      console.error(`[Restore Verify] Missing restored file: ${item.relPath}`);
      restoreVerified = false;
      continue;
    }
    const restoredBuffer = fs.readFileSync(restoredFilePath);
    const restoredHash = sha256(restoredBuffer);
    if (restoredHash !== item.sha256) {
      console.error(`[Restore Verify] Hash mismatch for ${item.relPath}: ${restoredHash} vs ${item.sha256}`);
      restoreVerified = false;
    }
  }

  if (!restoreVerified) {
    throw new Error('Restored file verification failed!');
  }

  console.log(`[Restore Verify] 100% of ${backedUpFiles.length} files successfully extracted and verified with SHA-256 match!`);

  // Clean up temporary restore test folder
  fs.rmSync(restoreTestDir, { recursive: true, force: true });

  return {
    backupPath: archivePath,
    backupSize: archiveSize,
    filesBackedUp: backedUpFiles.map(f => f.relPath),
    zstdVerify: 'PASS',
    restoreTest: 'PASS',
    sha256Verify: archiveSha256,
  };
}

backup().then(res => {
  console.log('\n=============================================================');
  console.log('BACKUP_PATH:', res.backupPath);
  console.log('BACKUP_SIZE:', res.backupSize);
  console.log('FILES_BACKED_UP:', JSON.stringify(res.filesBackedUp));
  console.log('ZSTD_VERIFY:', res.zstdVerify);
  console.log('RESTORE_TEST:', res.restoreTest);
  console.log('SHA256_VERIFY:', res.sha256Verify);
  console.log('=============================================================\n');
}).catch(err => {
  console.error('[Backup Failed]:', err);
  process.exit(1);
});
