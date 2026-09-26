const { execSync } = require('child_process');
const https = require('https');
const azPath = 'C:\\Users\\HP\\azure-cli\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd';
const armToken = execSync(`"${azPath}" account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv`).toString().trim();

function fetchVfs(vfsPath) {
  return new Promise((resolve, reject) => {
    https.request({
      hostname: 'app-maryam-production.scm.azurewebsites.net',
      path: '/api/vfs/' + vfsPath,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + armToken }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).end();
  });
}

async function run() {
  const logFiles = await fetchVfs('LogFiles/');
  console.log('LogFiles:', logFiles.data);
  try {
    const parsed = JSON.parse(logFiles.data);
    const dockerLogs = parsed.filter(f => f.name.includes('docker') || f.name.endsWith('.log')).sort((a,b) => b.mtime.localeCompare(a.mtime));
    console.log('Recent logs:', dockerLogs.slice(0, 5));
    if (dockerLogs.length > 0) {
      const latest = await fetchVfs('LogFiles/' + dockerLogs[0].name);
      console.log('Latest log snippet (' + dockerLogs[0].name + '):');
      console.log(latest.data.slice(-2000));
    }
  } catch(e) {
    console.log('Error parsing:', e);
  }
}

run();
