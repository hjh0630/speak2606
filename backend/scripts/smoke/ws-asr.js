// Smoke test: ASR audio chunk flow (mock mode -> empty transcript)
const WS = require('ws');
const http = require('node:http');

function httpJson(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host: '127.0.0.1', port: 3001, method, path, headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => resolve({ status: res.statusCode, body: buf }));
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const create = await httpJson('POST', '/api/sessions', {
    scenario_id: 'phone_meeting',
    difficulty: 'beginner',
    mode: 'free',
  });
  const sessionId = JSON.parse(create.body).session_id;
  console.log('session', sessionId);

  const ws = new WS(`ws://127.0.0.1:3001/ws/session/${sessionId}`);
  const events = [];
  ws.on('open', () => {
    console.log('WS open');
    // Push two audio chunks (just random bytes — we are in mock mode)
    const fakeChunk1 = Buffer.from('fake audio 1').toString('base64');
    const fakeChunk2 = Buffer.from('fake audio 2').toString('base64');
    ws.send(JSON.stringify({ type: 'audio_chunk', payload: { audio_base64: fakeChunk1 } }));
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'audio_chunk', payload: { audio_base64: fakeChunk2 } }));
    }, 200);
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'audio_end' }));
    }, 600);
    setTimeout(() => {
      ws.close();
    }, 2000);
  });
  ws.on('message', (raw) => {
    const env = JSON.parse(raw.toString('utf-8'));
    events.push(env);
    console.log('WS <--', env.type, env.payload ? JSON.stringify(env.payload).slice(0, 200) : '');
  });
  ws.on('error', (e) => console.error('err', e.message));
  ws.on('close', () => {
    console.log('event types:', events.map((e) => e.type));
    process.exit(0);
  });
})();
