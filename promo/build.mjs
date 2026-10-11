// Builds a single self-contained HTML file with all images inlined as data URIs.
// Usage: node promo/build.mjs  ->  promo/okekaraoke-promo.html
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mp3' };
const html = readFileSync(join(dir, 'index.html'), 'utf8').replace(/assets\/[\w.-]+\.(?:jpe?g|png|mp3)/g, (p) => {
  const b64 = readFileSync(join(dir, p)).toString('base64');
  return `data:${mime[extname(p)]};base64,${b64}`;
});
writeFileSync(join(dir, 'okekaraoke-promo.html'), html);
console.log('Wrote promo/okekaraoke-promo.html', (html.length / 1024).toFixed(0) + ' KB');
