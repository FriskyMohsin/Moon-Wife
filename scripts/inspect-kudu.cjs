const { execSync } = require('child_process');
const https = require('https');

const azPath = 'C:\\Users\\HP\\azure-cli\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd';
const armToken = execSync(`"${azPath}" account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv`).toString().trim();

function fetchVfs(vfsPath) {
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
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, data });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('--- Inspecting /home/site/wwwroot/data/hoorvia_platform/ ---');
  const resPlatform = await fetchVfs('site/wwwroot/data/hoorvia_platform/');
  console.log('Status:', resPlatform.statusCode);
  try {
    const items = JSON.parse(resPlatform.data);
    if (Array.isArray(items)) {
      items.forEach(item => {
        console.log(`- ${item.name} (${item.size} bytes, mtime: ${item.mtime})`);
      });
    } else {
      console.log('Response:', items);
    }
  } catch (e) {
    console.log('Raw data preview:', resPlatform.data.slice(0, 300));
  }
}

run().catch(console.error);
