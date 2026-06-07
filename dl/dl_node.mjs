import https from 'node:https';
import fs from 'node:fs';
import http from 'node:http';

const url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64';
const out = '/usr/local/bin/cloudflared';

function fetch(target, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const client = target.startsWith('https') ? https : http;
    const req = client.get(target, { timeout: 300000 }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        if (redirectsLeft <= 0) return reject(new Error('too many redirects'));
        return resolve(fetch(res.headers.location, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const chunks = [];
      let total = 0;
      res.on('data', (c) => { chunks.push(c); total += c.length; });
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        fs.writeFileSync(out, buf);
        console.log('Done, bytes:', buf.length, 'path:', out);
        resolve(buf.length);
      });
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

console.log('Downloading from', url);
fetch(url).then((n) => process.exit(0), (e) => { console.error('Error:', e.message); process.exit(1); });
