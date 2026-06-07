import https from 'node:https';
import fs from 'node:fs';
import http from 'node:http';

const candidates = [
  'https://cdn.jsdelivr.net/gh/cloudflare/cloudflared@latest/cloudflared-linux-amd64',  // may not have file
  'https://gh-proxy.com/https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64',
  'https://ghproxy.com/https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64',
  'https://mirror.ghproxy.com/https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64',
];
const out = '/usr/local/bin/cloudflared';

function fetch(target, redirectsLeft = 10) {
  return new Promise((resolve, reject) => {
    const client = target.startsWith('https') ? https : http;
    const req = client.get(target, { timeout: 300000, headers: { 'User-Agent': 'curl/8.0' } }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
        if (redirectsLeft <= 0) return reject(new Error('too many redirects'));
        return resolve(fetch(res.headers.location, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' for ' + target));
      const chunks = [];
      let total = 0;
      res.on('data', (c) => { chunks.push(c); total += c.length; if (total % 1000000 < c.length) console.log('  got', total, 'bytes'); });
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        fs.writeFileSync(out, buf);
        fs.chmodSync(out, 0o755);
        console.log('OK from', target, 'size:', buf.length);
        resolve(buf.length);
      });
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

(async () => {
  for (const url of candidates) {
    try {
      console.log('Try', url);
      await fetch(url);
      process.exit(0);
    } catch (e) {
      console.log('  fail:', e.message);
    }
  }
  process.exit(1);
})();
