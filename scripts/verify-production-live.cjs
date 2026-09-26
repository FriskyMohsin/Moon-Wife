const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          url,
          statusCode: res.statusCode,
          headers: res.headers,
          data,
        });
      });
    }).on('error', reject);
  });
}

async function verifyLive() {
  console.log('--- Phase 7: Live Build Verification ---');

  const targets = [
    'https://hoorvia.net/',
    'https://www.hoorvia.net/',
    'https://hoorvia.net/api/health',
    'https://www.hoorvia.net/api/health',
    'https://hoorvia.net/favicon.svg',
    'https://hoorvia.net/api/diagnostics',
  ];

  for (const t of targets) {
    try {
      const res = await fetchUrl(t);
      console.log(`[${res.statusCode}] ${t} (${res.data.length} bytes)`);
      if (t.includes('/api/health')) {
        console.log('   Health Data:', res.data);
      } else if (t.includes('favicon.svg')) {
        console.log('   Favicon is SVG:', res.data.includes('<svg') && res.data.includes('Hoorvia'));
      } else if (t.endsWith('/') || t.endsWith('index.html')) {
        console.log('   Title in HTML:', res.data.match(/<title>(.*?)<\/title>/)?.[1]);
        console.log('   Favicon in HTML:', res.data.includes('rel="icon" href="/favicon.svg"'));
        console.log('   Assets in HTML:', res.data.match(/src="(\/assets\/index-[^"]+)"/)?.[1]);
      } else if (t.includes('/api/diagnostics')) {
        try {
          const parsed = JSON.parse(res.data);
          console.log('   Diagnostics:', {
            status: parsed.status,
            runtimeDataDir: parsed.runtimeDataDir || parsed.dataDir,
            memoryLoaded: parsed.memoryLoaded || parsed.memoryStatus,
            nodeEnv: parsed.environment || parsed.nodeEnv,
          });
        } catch (e) {
          console.log('   Diagnostics preview:', res.data.slice(0, 200));
        }
      }
    } catch (err) {
      console.error(`[ERROR] ${t}:`, err.message);
    }
  }
}

verifyLive();
