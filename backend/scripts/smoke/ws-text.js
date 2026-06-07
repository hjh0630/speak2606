// Quick WebSocket smoke test
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
  try {
    console.log('--- creating session ---');
    const create = await httpJson('POST', '/api/sessions', {
      scenario_id: 'phone_meeting',
      difficulty: 'beginner',
      mode: 'free',
    });
    console.log('HTTP', create.status, create.body);
    const sessionId = JSON.parse(create.body).session_id;

    console.log('--- opening WebSocket ---');
    const ws = new WS(`ws://127.0.0.1:3001/ws/session/${sessionId}`);

    const events = [];
    ws.on('open', () => {
      console.log('WS open');
      ws.send(JSON.stringify({ type: 'ping' }));
      setTimeout(() => {
        ws.send(JSON.stringify({ type: 'text', payload: { content: 'Hello, this is a websocket text test.' } }));
      }, 200);
      setTimeout(() => {
        ws.send(JSON.stringify({ type: 'request_tts', payload: { text: 'Hello, this is a TTS test.' } }));
      }, 600);
      setTimeout(() => {
        ws.close();
      }, 3000);
    });
    ws.on('message', (raw) => {
      const env = JSON.parse(raw.toString('utf-8'));
      events.push(env);
      const payloadStr = env.payload ? JSON.stringify(env.payload) : '';
      console.log('WS <--', env.type, payloadStr.slice(0, 200));
    });
    ws.on('error', (err) => console.error('WS error', err.message));
    ws.on('close', () => {
      console.log('--- summary ---');
      const types = events.map((e) => e.type);
      console.log('event types:', types);
      process.exit(0);
    });
  } catch (err) {
    console.error('FAILED', err);
    process.exit(1);
  }
})();
