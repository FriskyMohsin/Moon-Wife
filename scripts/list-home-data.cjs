const { execSync } = require('child_process');
const https = require('https');
const azPath = 'C:\\Users\\HP\\azure-cli\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd';
const armToken = execSync(`"${azPath}" account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv`).toString().trim();

https.request({
  hostname: 'app-maryam-production.scm.azurewebsites.net',
  path: '/api/vfs/data/',
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + armToken }
}, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log(data));
}).end();
