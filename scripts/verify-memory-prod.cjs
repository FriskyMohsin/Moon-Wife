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
      res.on('end', () => resolve(data));
    }).end();
  });
}

fetchVfs('data/maryam_owner_conversation.json').then(d => {
  try {
    const data = JSON.parse(d);
    console.log('Conversation Active Topic:', data.active.currentTopic);
    console.log('Total turns recorded:', data.turns.length);
    console.log('Last turn content:', data.turns[data.turns.length - 1].content.slice(0, 70));
    console.log('All turns:', data.turns.map(t => `${t.role} (${t.modality}): ${t.content.slice(0,30)}`));
  } catch(e) { console.log('Error parsing:', e.message, d) }
});
