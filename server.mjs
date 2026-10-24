import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const dataDir = process.env.WORDLOOP_DATA_DIR || path.join(os.homedir(), 'Library', 'Application Support', 'WordLoop');
const dataFile = path.join(dataDir, 'study.json');
const port = 38917;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

const emptyState = () => ({ words: [], plan: null, records: [], active: null, schema: 1 });
async function readState() {
  try { return JSON.parse(await fs.readFile(dataFile, 'utf8')); } catch { return emptyState(); }
}
async function writeState(state) {
  await fs.mkdir(dataDir, { recursive: true });
  const temp = `${dataFile}.tmp`;
  await fs.writeFile(temp, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(temp, dataFile);
}
function send(res, status, value, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(type.startsWith('application/json') ? JSON.stringify(value) : value);
}
async function body(req) {
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 20_000_000) throw new Error('payload too large'); }
  return raw ? JSON.parse(raw) : {};
}
function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function dayDiff(a, b) {
  const [ay, am, ad] = a.split('-').map(Number); const [by, bm, bd] = b.split('-').map(Number);
  return Math.max(0, Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000));
}
function groupFor(index, count, parts) { return Math.min(parts - 1, Math.floor(index * parts / count)); }
function tasks(state) {
  if (!state.plan) return [];
  const { day, parts } = state.plan; const total = 3 * parts + 3; const result = [];
  if (day <= 3 * parts) {
    const group = (day - 1) % parts;
    for (const word of state.words) if (word.group === group) result.push({ wordId: word.id, source: '当日新词' });
  }
  for (const record of state.records) {
    if (record.planDay <= 3 * parts && (record.planDay === day - 1 || record.planDay === day - 3) && record.completedAt) {
      for (const a of record.answers) if (!a.correct && !result.some(x => x.wordId === a.wordId)) result.push({ wordId: a.wordId, source: '间隔错词复习' });
    }
  }
  return result.filter(x => state.words.some(w => w.id === x.wordId));
}
async function handle(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (req.method === 'GET' && url.pathname === '/api/state') {
    const state = await readState(); const today = localDate();
    state.delayDays = state.plan?.nextDueDate ? dayDiff(state.plan.nextDueDate, today) : 0;
    if (state.active && state.active.date !== today) {
      state.active.delayedDays = state.delayDays;
      state.active.date = today; state.active.index = 0; state.active.answers = [];
      await writeState(state);
    }
    return send(res, 200, { state, todayTasks: tasks(state), today });
  }
  if (req.method === 'PUT' && url.pathname === '/api/state') {
    const value = await body(req); await writeState(value); return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && url.pathname === '/api/dictionary') {
    const word = url.searchParams.get('word') || '';
    if (!/^[\p{L}' -]{1,80}$/u.test(word)) return send(res, 400, { error: 'invalid word' });
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal: AbortSignal.timeout(9000) });
      if (!response.ok) return send(res, response.status, { error: 'not found' });
      const entries = await response.json(); const entry = entries[0] || {};
      const definitions = (entry.meanings || []).flatMap(m => m.definitions || []).map(d => d.definition).filter(Boolean);
      const phonetic = entry.phonetic || (entry.phonetics || []).find(p => p.text)?.text || '';
      return send(res, 200, { phonetic, definition: definitions[0] || '' });
    } catch { return send(res, 502, { error: 'dictionary unavailable' }); }
  }
  if (req.method === 'GET' && url.pathname.startsWith('/')) {
    const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const target = path.resolve(publicDir, relative);
    if (!target.startsWith(publicDir + path.sep)) return send(res, 403, { error: 'forbidden' });
    try { const data = await fs.readFile(target); return send(res, 200, data, mime[path.extname(target)] || 'application/octet-stream'); }
    catch { return send(res, 404, 'Not found', 'text/plain; charset=utf-8'); }
  }
  send(res, 404, { error: 'not found' });
}

await fs.mkdir(dataDir, { recursive: true });
const server = http.createServer((req, res) => {
  if (req.socket.remoteAddress && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return send(res, 403, { error: 'local access only' });
  handle(req, res).catch(() => send(res, 500, { error: 'request failed' }));
});
server.listen(port, '127.0.0.1', () => console.log(`猛猛背单词 running at http://127.0.0.1:${port}`));
