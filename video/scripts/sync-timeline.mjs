// Recale timeline.json sur l'audio reel, a partir de audio/analysis.json (voir analyze-audio.mjs).
//
//   node scripts/sync-timeline.mjs --mode grid      musique : la grille de conception (music.bpm/offset) est etiree
//                                                    sur le tempo et le premier temps fort detectes
//   node scripts/sync-timeline.mjs --mode phrases   voix off : chaque plan qui porte une voix off demarre sur la
//                                                    phrase detectee la plus proche de sa position prevue
//   node scripts/sync-timeline.mjs --mode fit       etirement uniforme a la duree de l'audio
//   node scripts/sync-timeline.mjs --markers audio/markers.json
//                                                    reperes manuels { "A2": 4.1, "C1": 16.25, ... } (debuts de plans)
// Options : --analysis audio/analysis.json --timeline timeline.json --snap (aligne les debuts de plans sur le temps
//           le plus proche, tolerance 0,15 s) --beats audio/analysis-musique.json (grille prise sur une autre analyse,
//           ex. voix + musique separees) --audio <fichier> (renseigne audio.file) --dry (n'ecrit rien)
//
// Dans tous les modes, les cues d'un plan sont etirees au prorata de sa nouvelle duree : l'animation garde son
// phrasé interne. Une sauvegarde de la timeline precedente est ecrite dans out/backups/.
import fs from 'node:fs';
import path from 'node:path';
import { VIDEO_DIR, parseArgs, readJSON } from './lib.mjs';

const args = parseArgs();
const tlFile = path.join(VIDEO_DIR, args.timeline || 'timeline.json');
const tl = readJSON(tlFile);
const anaFile = path.resolve(VIDEO_DIR, args.analysis || 'audio/analysis.json');
const ana = fs.existsSync(anaFile) ? readJSON(anaFile) : null;
const mode = args.markers ? 'markers' : (args.mode || 'grid');
// --beats : analyse de la musique utilisee pour --snap et pour la grille des pulsations (cas voix + musique separees)
const beatsAna = args.beats ? readJSON(path.resolve(VIDEO_DIR, args.beats)) : ana;
if (!ana && mode !== 'markers') { console.error(`Analyse introuvable : ${anaFile}\nLancer d'abord : npm run analyze -- <fichier audio>`); process.exit(1); }

const plans = tl.sequences.flatMap((s) => s.plans).sort((a, b) => a.start - b.start);
const old = plans.map((p) => ({ id: p.id, start: p.start, end: p.end }));
const oldDuration = tl.duration;
let newStart = new Map();
let newDuration = oldDuration;
const r3 = (x) => Math.round(x * 1000) / 1000;

if (mode === 'grid') {
  const bpm0 = tl.music.bpm, off0 = tl.music.offset || 0;
  const ratio = bpm0 / ana.bpm;
  const map = (t) => ana.offset + (t - off0) * ratio;
  plans.forEach((p) => newStart.set(p.id, map(p.start)));
  newDuration = Math.max(map(oldDuration), 0);
  // Si l'audio est plus long (queue musicale), le dernier plan tient jusqu'a la fin du fichier
  if (ana.duration > newDuration) newDuration = ana.duration;
  tl.music.bpm = ana.bpm;
  tl.music.offset = r3(ana.offset);
  console.log(`Grille : ${bpm0} -> ${ana.bpm} BPM (x${ratio.toFixed(4)}), premier temps fort ${off0} -> ${ana.offset} s`);
} else if (mode === 'fit') {
  const k = ana.duration / oldDuration;
  plans.forEach((p) => newStart.set(p.id, p.start * k));
  newDuration = ana.duration;
  tl.music.bpm = r3(tl.music.bpm / k);
  console.log(`Etirement uniforme x${k.toFixed(4)} -> ${ana.duration} s`);
} else if (mode === 'phrases') {
  const ph = ana.phrases;
  let j = 0;
  for (const p of plans) {
    if (!p.vo) continue;
    const expected = p.start + (p.voAt || 0);
    // Phrase suivante la plus proche de la position prevue (ordre conserve)
    let bestK = -1, bestD = Infinity;
    for (let k = j; k < ph.length; k++) {
      const d = Math.abs(ph[k].start - expected);
      if (d < bestD) { bestD = d; bestK = k; }
      if (ph[k].start > expected + 6) break;
    }
    if (bestK < 0) continue;
    newStart.set(p.id, Math.max(0, ph[bestK].start - (p.voAt || 0)));
    j = bestK + 1;
  }
  newDuration = Math.max(ana.duration, oldDuration);
  console.log(`Phrases : ${newStart.size} plans recales sur ${ph.length} phrases detectees`);
} else if (mode === 'markers') {
  const m = readJSON(path.resolve(VIDEO_DIR, args.markers));
  for (const [id, t] of Object.entries(m)) if (id !== 'duration') newStart.set(id, Number(t));
  if (m.duration) newDuration = Number(m.duration);
  else if (ana) newDuration = ana.duration;
  console.log(`Reperes manuels : ${newStart.size} plans`);
} else {
  console.error(`Mode inconnu : ${mode}`); process.exit(1);
}

// Plans non repositionnes : interpolation lineaire entre voisins repositionnes (conserve l'ordre)
const starts = plans.map((p) => (newStart.has(p.id) ? newStart.get(p.id) : null));
for (let i = 0; i < plans.length; i++) {
  if (starts[i] !== null) continue;
  let a = i - 1; while (a >= 0 && starts[a] === null) a--;
  let b = i + 1; while (b < plans.length && starts[b] === null) b++;
  const oa = a >= 0 ? old[a].start : 0, na = a >= 0 ? starts[a] : 0;
  const ob = b < plans.length ? old[b].start : oldDuration, nb = b < plans.length ? starts[b] : newDuration;
  starts[i] = na + (old[i].start - oa) * ((nb - na) / ((ob - oa) || 1));
}
// Alignement optionnel sur la grille des temps detectee
if (args.snap && beatsAna && beatsAna.beats?.length) {
  for (let i = 0; i < starts.length; i++) {
    const nearest = beatsAna.beats.reduce((a, b) => (Math.abs(b - starts[i]) < Math.abs(a - starts[i]) ? b : a));
    if (Math.abs(nearest - starts[i]) <= 0.15) starts[i] = nearest;
  }
}
// Le film commence a 0 : le premier plan absorbe une eventuelle intro (ses cues gardent leur temps absolu)
const lead = starts[0];
starts[0] = 0;
for (let i = 1; i < starts.length; i++) if (starts[i] <= starts[i - 1] + 0.5) starts[i] = starts[i - 1] + 0.5;

plans.forEach((p, i) => {
  const s = starts[i];
  const e = i + 1 < plans.length ? starts[i + 1] : newDuration;
  const k = (e - s - (i === 0 ? lead : 0)) / (old[i].end - old[i].start);
  const shift = i === 0 ? lead : 0;
  if (p.cues) for (const c in p.cues) p.cues[c] = r3(shift + p.cues[c] * k);
  if (p.voAt !== undefined) p.voAt = r3(shift + p.voAt * k);
  p.start = r3(s); p.end = r3(e);
});
tl.duration = r3(newDuration);
if (args.beats && mode !== 'grid') { tl.music.bpm = beatsAna.bpm; tl.music.offset = r3(beatsAna.offset); }
if (args.audio) tl.audio.file = path.relative(VIDEO_DIR, path.resolve(process.cwd(), args.audio));
else if (ana && !tl.audio.file && !tl.audio.stems?.length) tl.audio.file = ana.file;

console.log('\nPlan   avant              apres');
plans.forEach((p, i) => console.log(`${p.id.padEnd(5)}  ${old[i].start.toFixed(2).padStart(6)} -> ${old[i].end.toFixed(2).padStart(6)}   ${p.start.toFixed(2).padStart(6)} -> ${p.end.toFixed(2).padStart(6)}`));
console.log(`Duree : ${oldDuration} -> ${tl.duration} s   audio : ${tl.audio.stems?.length ? tl.audio.stems.map((x) => x.file).join(" + ") : tl.audio.file}   grille : ${tl.music.bpm} BPM, offset ${tl.music.offset} s`);

if (args.dry) { console.log('\n(--dry : rien ecrit)'); process.exit(0); }
const bk = path.join(VIDEO_DIR, 'out', 'backups');
fs.mkdirSync(bk, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(tlFile, path.join(bk, `${path.basename(tlFile, '.json')}.${stamp}.json`));
fs.writeFileSync(tlFile, `${JSON.stringify(tl, null, 2)}\n`);
console.log(`\nEcrit : ${path.relative(process.cwd(), tlFile)} (sauvegarde dans out/backups/)`);
