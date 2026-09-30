// Relecture temps reel dans un navigateur (pas pour le rendu final) :
//   node scripts/serve.mjs [--port 4173]  puis ouvrir l'URL affichee.
// Espace = lecture/pause, fleches = +/- 2 s (Maj : +/- 0,1 s). ?audio=../audio/x.wav pour ecouter en meme temps.
import { startServer, parseArgs } from './lib.mjs';

const args = parseArgs();
const { port } = await startServer(Number(args.port || 4173));
const base = `http://127.0.0.1:${port}/stage/index.html`;
console.log(`Scene       : ${base}?w=1280&hud=2&play=1`);
console.log(`Version 30 s : ${base}?w=1280&hud=2&play=1&timeline=../timeline-30s.json`);
console.log(`Image fixe  : ${base}?w=1920&t=17.5`);
console.log('Ctrl+C pour arreter.');
