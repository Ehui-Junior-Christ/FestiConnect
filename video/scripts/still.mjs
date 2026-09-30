// Exporte des images fixes pour relecture : node scripts/still.mjs 1.2 17.5 30 --width 1920 --out out/stills
import fs from 'node:fs';
import path from 'node:path';
import { VIDEO_DIR, startServer, launchBrowser, openStage, capture, parseArgs } from './lib.mjs';

const args = parseArgs();
const times = args._.map(Number).filter((n) => !Number.isNaN(n));
if (!times.length) { console.error('Usage : node scripts/still.mjs <t1> [t2 ...] [--width 1920] [--timeline timeline.json] [--hud 1] [--out out/stills]'); process.exit(1); }
const width = Number(args.width || 1920);
const height = Math.round(width * 9 / 16);
const outDir = path.resolve(VIDEO_DIR, args.out || 'out/stills');
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await startServer();
const browser = await launchBrowser();
try {
  const stage = await openStage(browser, port, { width, height, timeline: args.timeline || 'timeline.json', hud: Number(args.hud || 0) });
  for (const t of times) {
    const png = await capture(stage, t);
    const file = path.join(outDir, `still_${t.toFixed(2).replace('.', '_')}.png`);
    fs.writeFileSync(file, png);
    console.log(file);
  }
} finally {
  await browser.close();
  server.close();
}
