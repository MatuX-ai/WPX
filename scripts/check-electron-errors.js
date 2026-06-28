// 连接到 9222，启用 Runtime/Console 域，复现 Vite 客户端加载并抓取控制台异常
const WebSocket = require('ws');
const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

(async () => {
  const list = await fetchJson('http://127.0.0.1:9222/json/list');
  const page = list.find((t) => t.type === 'page' && t.url && t.url.startsWith('http://localhost:5173/'));
  if (!page) {
    console.log('NO_PAGE', list.map((t) => `${t.type}:${t.url}`));
    process.exit(1);
  }
  console.log('PAGE_URL:', page.url);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const errors = [];
  const pending = new Map();

  function send(method, params) {
    return new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    });
  }

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push({
        source: 'console.error',
        text: msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' '),
      });
    }
  });

  await new Promise((r) => ws.once('open', r));
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 6000));

  if (errors.length === 0) {
    console.log('NO_ERRORS');
  } else {
    errors.forEach((e, i) => {
      console.log('---ERROR---', i);
      console.log(JSON.stringify(e, null, 2).slice(0, 1500));
    });
  }
  ws.close();
  process.exit(0);
})().catch((e) => { console.error('SCRIPT_ERR', e); process.exit(2); });
