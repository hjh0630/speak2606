const fs = require('fs');
const path = process.argv[2];
const body = process.argv[3];
const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
const fn = new Function('d', body);
fn(data);
