// Controle qualite : verifie que le QR code du billet se decode bien dans une image rendue.
//   node scripts/check-qr.mjs out/stills/still_46_60.png [texte attendu]
// Sans image : rend l'image a 46,6 s (plan D4), la recadre sur le QR (comme le ferait un telephone) puis la decode.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { VIDEO_DIR, startServer, launchBrowser, openStage, capture, parseArgs, readJSON } from './lib.mjs';

const args = parseArgs();
const expected = args._[1] || readJSON(path.join(VIDEO_DIR, 'content.json')).ticket.code;
let buf, box = null;
if (args._[0]) buf = fs.readFileSync(path.resolve(process.cwd(), args._[0]));
else {
  const { server, port } = await startServer();
  const browser = await launchBrowser();
  const stage = await openStage(browser, port, { width: 1920, height: 1080, grain: 1 });
  buf = await capture(stage, Number(args.t || 46.6));
  box = await stage.page.evaluate(() => { const r = document.querySelector('.scene-parcours [data-k=qr]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await browser.close(); server.close();
}
let png = PNG.sync.read(buf);
if (box) {
  const m = 60, x0 = Math.max(0, Math.floor(box.x - m)), y0 = Math.max(0, Math.floor(box.y - m));
  const w = Math.min(png.width - x0, Math.ceil(box.w + 2 * m)), h = Math.min(png.height - y0, Math.ceil(box.h + 2 * m));
  const crop = new PNG({ width: w, height: h });
  PNG.bitblt(png, crop, x0, y0, w, h, 0, 0);
  png = crop;
  if (args.dump) fs.writeFileSync(path.resolve(process.cwd(), args.dump), PNG.sync.write(crop));
}
const res = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
if (!res) { console.error('QR introuvable ou illisible'); process.exit(1); }
console.log(`QR decode : "${res.data}" (version ${res.version})`);
if (res.data !== expected) { console.error(`Attendu : "${expected}"`); process.exit(1); }
console.log('OK');
