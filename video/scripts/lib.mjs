// Outils partages : serveur statique local, lancement de Chromium, chemin ffmpeg, arguments CLI.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

export const VIDEO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
};

// Sert video/ en HTTP (les polices et modules ES ne se chargent pas proprement en file://)
export function startServer(port = 0) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const file = path.normalize(path.join(VIDEO_DIR, decodeURIComponent(url.pathname)));
    if (!file.startsWith(VIDEO_DIR)) { res.writeHead(403).end(); return; }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-store' });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

// Trouve Chromium : PLAYWRIGHT_BROWSERS_PATH (defaut /opt/pw-browsers) ou CHROMIUM_PATH.
export function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base).sort().reverse();
  const candidates = [
    ...dirs.filter((d) => d.startsWith('chromium_headless_shell-')).map((d) => path.join(base, d, 'chrome-linux', 'headless_shell')),
    ...dirs.filter((d) => /^chromium-\d+$/.test(d)).map((d) => path.join(base, d, 'chrome-linux', 'chrome')),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

export async function launchBrowser() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
  const { chromium } = await import('playwright-core');
  const executablePath = findChromium();
  return chromium.launch({
    executablePath,
    args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text', '--hide-scrollbars', '--mute-audio'],
  });
}

// Ouvre la scene et attend que polices + modules soient prets.
export async function openStage(browser, port, { width, height, timeline = 'timeline.json', hud = 0, grain = 1 }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Les 404 sont attendus : le moteur sonde les modules de scene pas encore ecrits (repli sur l'animatic).
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
  const q = new URLSearchParams({ w: String(width), h: String(height), timeline: `../${timeline}`, hud: String(hud), grain: String(grain) });
  await page.goto(`http://127.0.0.1:${port}/stage/index.html?${q}`);
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error(`Erreur dans la scene :\n${err}`);
  if (errors.length) console.warn('[stage]', errors.join('\n'));
  const cdp = await context.newCDPSession(page);
  const info = await page.evaluate(() => window.__timeline);
  return { page, context, cdp, info, errors };
}

// Capture PNG rapide via CDP (optimizeForSpeed : compression PNG legere, sans perte).
export async function capture(stage, t) {
  await stage.page.evaluate((tt) => window.__seek(tt), t);
  const { data } = await stage.cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false });
  return Buffer.from(data, 'base64');
}

export async function ffmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const mod = await import('ffmpeg-static');
  return mod.default;
}

export function run(bin, args, { quiet = false, input = null } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; if (!quiet) process.stderr.write(d); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve({ out, err }) : reject(new Error(`${path.basename(bin)} a echoue (code ${code})\n${err.slice(-2000)}`))));
    if (input) { p.stdin.end(input); }
  });
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) args[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) args[k] = argv[++i];
      else args[k] = true;
    } else args._.push(a);
  }
  return args;
}

export function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
