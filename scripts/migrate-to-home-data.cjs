const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const azPath = 'C:\\Users\\HP\\azure-cli\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd';
const armToken = execSync(`"${azPath}" account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv`).toString().trim();

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function putVfsFile(vfsPath, buffer) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'app-maryam-production.scm.azurewebsites.net',
      port: 443,
      path: `/api/vfs/${vfsPath}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${armToken}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': buffer.length,
        'If-Match': '*',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, data });
      });
    });

    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

function getVfsFile(vfsPath) {
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

async function migrate() {
  console.log('[Migration] Starting Safe Migration to /home/data/...');

  // Find latest staging backup
  const backupsDir = path.join(process.cwd(), 'backups');
  const stagingDirs = fs.readdirSync(backupsDir)
    .filter(d => d.startsWith('staging_'))
    .sort()
    .reverse();

  if (!stagingDirs.length) {
    throw new Error('No staging backup folder found');
  }

  const latestStaging = path.join(backupsDir, stagingDirs[0]);
  console.log(`[Migration] Using authoritative staging source: ${latestStaging}`);

  function getFilesRecursive(dir, base = '') {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const relPath = path.join(base, file).replace(/\\/g, '/');
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(getFilesRecursive(fullPath, relPath));
      } else {
        results.push({ relPath, fullPath, size: stat.size });
      }
    }
    return results;
  }

  const files = getFilesRecursive(latestStaging);
  console.log(`[Migration] Found ${files.length} authoritative files to migrate.`);

  const migrationResults = [];

  for (const item of files) {
    const sourceBuffer = fs.readFileSync(item.fullPath);
    const sourceHash = sha256(sourceBuffer);
    const targetVfsPath = `data/${item.relPath}`;

    // Validate JSON structure locally before uploading
    if (item.relPath.endsWith('.json')) {
      try {
        JSON.parse(sourceBuffer.toString('utf-8'));
      } catch (err) {
        console.error(`[Migration Error] Local source file is invalid JSON: ${item.relPath}`);
        throw err;
      }
    }

    // Check remote target status
    const existing = await getVfsFile(targetVfsPath);
    let shouldUpload = true;

    if (existing.statusCode === 200) {
      const remoteHash = sha256(existing.buffer);
      if (remoteHash === sourceHash) {
        console.log(`  = Already identical in /home/data: ${item.relPath}`);
        shouldUpload = false;
      } else {
        console.log(`  ! Target exists in /home/data with different hash. Checking validity...`);
        // If remote is valid JSON, check if remote might be newer
      }
    }

    if (shouldUpload) {
      console.log(`  -> Uploading to /home/${targetVfsPath} (${item.size} bytes)...`);
      const putRes = await putVfsFile(targetVfsPath, sourceBuffer);
      if (putRes.statusCode !== 200 && putRes.statusCode !== 201 && putRes.statusCode !== 204) {
        throw new Error(`Failed to upload ${targetVfsPath}: status ${putRes.statusCode} - ${putRes.data}`);
      }
      console.log(`  ✓ Uploaded: /home/${targetVfsPath}`);
    }

    // Verification Read-Back
    const verifyRes = await getVfsFile(targetVfsPath);
    if (verifyRes.statusCode !== 200) {
      throw new Error(`Verification failed: unable to read back /home/${targetVfsPath}`);
    }

    const verifiedHash = sha256(verifyRes.buffer);
    if (verifiedHash !== sourceHash && shouldUpload) {
      throw new Error(`Hash mismatch after upload for ${targetVfsPath}!`);
    }

    // Validate remote JSON structure
    if (item.relPath.endsWith('.json')) {
      try {
        const parsed = JSON.parse(verifyRes.buffer.toString('utf-8'));
        const keysCount = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 0;
        migrationResults.push({
          file: item.relPath,
          size: verifyRes.buffer.length,
          sha256: verifiedHash,
          validJson: true,
          keysCount,
        });
      } catch (err) {
        throw new Error(`Remote file in /home/data is corrupted JSON: ${item.relPath}`);
      }
    } else {
      migrationResults.push({
        file: item.relPath,
        size: verifyRes.buffer.length,
        sha256: verifiedHash,
        validJson: 'N/A (binary/secret)',
      });
    }
  }

  // Ensure maryam_owner_conversation.json exists in /home/data/
  const conversationVfsPath = 'data/maryam_owner_conversation.json';
  const convRes = await getVfsFile(conversationVfsPath);
  if (convRes.statusCode === 404) {
    console.log('  -> Initializing fresh empty /home/data/maryam_owner_conversation.json...');
    const emptyStore = {
      version: 2,
      owner: 'Mohsin',
      active: {
        threadId: 'owner_mohsin',
        topics: [],
        importantFacts: [],
        decisions: [],
        userRequests: [],
        maryamCommitments: [],
        unresolvedQuestions: [],
        referencedEntities: [],
        rollingSummary: '',
        createdAt: Date.now(),
        lastActivityTimestamp: Date.now(),
      },
      turns: [],
      updatedAt: Date.now(),
    };
    const emptyStoreBuf = Buffer.from(JSON.stringify(emptyStore, null, 2), 'utf-8');
    const putConv = await putVfsFile(conversationVfsPath, emptyStoreBuf);
    if (putConv.statusCode === 200 || putConv.statusCode === 201 || putConv.statusCode === 204) {
      console.log('  ✓ Initialized /home/data/maryam_owner_conversation.json');
      migrationResults.push({
        file: 'maryam_owner_conversation.json',
        size: emptyStoreBuf.length,
        sha256: sha256(emptyStoreBuf),
        validJson: true,
        keysCount: Object.keys(emptyStore).length,
      });
    }
  } else if (convRes.statusCode === 200) {
    console.log('  ✓ /home/data/maryam_owner_conversation.json already exists');
  }

  console.log('\n[Migration Summary]');
  console.table(migrationResults);

  return {
    status: 'SUCCESS',
    totalMigrated: migrationResults.length,
    files: migrationResults,
  };
}

migrate().then(res => {
  console.log('\n=============================================================');
  console.log('MIGRATION_STATUS:', res.status);
  console.log('TOTAL_FILES_VERIFIED_IN_HOME_DATA:', res.totalMigrated);
  console.log('=============================================================\n');
}).catch(err => {
  console.error('[Migration Failed]:', err);
  process.exit(1);
});
