// ElevenLabs helper — loads ELEVENLABS_API_KEY from .env.local without ever printing it.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');

export function apiKey() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, 'utf8').match(/^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/m);
    if (m) return m[1].trim();
  }
  throw new Error('ELEVENLABS_API_KEY not found');
}

export async function xi(pathname, opts = {}) {
  const res = await fetch(`https://api.elevenlabs.io${pathname}`, {
    ...opts,
    headers: { 'xi-api-key': apiKey(), ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

// CLI: `node eleven.mjs voices` → list voice ids/names (no secrets)
if (process.argv[2] === 'voices') {
  const r = await xi('/v1/voices');
  const { voices } = await r.json();
  for (const v of voices) console.log(v.voice_id, '|', v.name, '|', v.category, '|', JSON.stringify(v.labels || {}));
  try {
    const u = await (await xi('/v1/user/subscription')).json();
    console.log('chars used/limit:', u.character_count, '/', u.character_limit, '| tier:', u.tier);
  } catch { console.log('(subscription info unavailable — key lacks user_read)'); }
}
