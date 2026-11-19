// Neon Bay: hands the game in to make.fun.
// Copies game/ and screenshots/ from beside this file into the output directory
// (MAKEFUN_OUTPUT_DIR, or /output inside the grader) and writes dossier.json
// there with the vendored make.fun library. Every destination is cleared first:
// the grader mounts outputs read-only, so a second run must remove-then-write.
// Run locally: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function freshDir(path) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

freshDir(outDir);
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
freshDir(join(outDir, 'screenshots'));
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log('Neon Bay dossier written: ' + join(outDir, 'dossier.json') + ' (' + dossier.length + ' bytes)');
