// Generates the showreel voice-over line-by-line with ElevenLabs (with character timestamps),
// trims each line to the spoken region, and writes per-word timings for kinetic-type sync.
// Usage: node showreel/v2/vo.mjs [voiceName]
// Output: vo/<id>.wav, vo/words.json  ({ id: { text, dur, words: [{w, s, e}] } })
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { xi } from './eleven.mjs';

const DIR = path.join(import.meta.dirname, 'vo');
fs.mkdirSync(DIR, { recursive: true });

const VOICES = {
  quentin: 'Aa6nEBJJMKJwJkCx8VU2', // library voice — needs a paid plan
  brian: 'nPczCjzI2devNBz1zQrb',   // premade: deep, resonant
  liam: 'TX3LPaxmHKxFdv7VOQHJ',    // premade: energetic
};
const voice = VOICES[process.argv[2] || 'brian'];

export const LINES = [
  { id: 'l1', text: 'Every room has a stage.' },
  { id: 'l2', text: 'Put OKEKARAOKE on the big screen…' },
  { id: 'l3', text: 'and every phone becomes the remote.' },
  { id: 'l4', text: 'Search any song. Reserve your turn.' },
  { id: 'l5', text: 'Watch the queue line up, live.' },
  { id: 'l6', text: 'Chat, react, and hype each other up.' },
  { id: 'l7', text: 'No TV? Go solo, on one device.' },
  { id: 'l8', text: 'OKEKARAOKE. Your night. Your stage.' },
];
// Phonetic spelling so the brand name is spoken as "oh-kay karaoke"; on-screen text stays the same.
const SPOKEN = s => s.replace(/OKEKARAOKE/g, 'Oh-kay karaoke');

const PAD_IN = 0.03, PAD_OUT = 0.12;
const out = {};
for (const [i, line] of LINES.entries()) {
  const spoken = SPOKEN(line.text);
  const r = await xi(`/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: spoken,
      model_id: 'eleven_multilingual_v2',
      previous_text: LINES[i - 1] && SPOKEN(LINES[i - 1].text),
      next_text: LINES[i + 1] && SPOKEN(LINES[i + 1].text),
      voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true, speed: 1.05 },
    }),
  });
  const json = await r.json();
  const mp3 = path.join(DIR, `${line.id}.mp3`);
  fs.writeFileSync(mp3, Buffer.from(json.audio_base64, 'base64'));

  const al = json.alignment;
  const chars = al.characters, cs = al.character_start_times_seconds, ce = al.character_end_times_seconds;
  // Words from character alignment
  const words = [];
  let cur = null;
  chars.forEach((ch, k) => {
    if (/\s/.test(ch)) { if (cur) { words.push(cur); cur = null; } return; }
    if (!cur) cur = { w: '', s: cs[k], e: ce[k] };
    cur.w += ch; cur.e = ce[k];
  });
  if (cur) words.push(cur);
  const t0 = Math.max(0, words[0].s - PAD_IN);
  const t1 = words.at(-1).e + PAD_OUT;
  const wav = path.join(DIR, `${line.id}.wav`);
  execSync(`ffmpeg -y -v error -i "${mp3}" -af "atrim=${t0}:${t1},asetpts=PTS-STARTPTS,afade=t=out:st=${(t1 - t0 - 0.06).toFixed(3)}:d=0.06" -ar 44100 -ac 1 "${wav}"`);
  const dur = Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${wav}"`).toString());
  out[line.id] = {
    text: line.text,
    dur: +dur.toFixed(3),
    words: words.map(w => ({ w: w.w, s: +(w.s - t0).toFixed(3), e: +(w.e - t0).toFixed(3) })),
  };
  console.log(line.id, dur.toFixed(2) + 's', '—', words.map(w => `${w.w}@${(w.s - t0).toFixed(2)}`).join(' '));
}
fs.writeFileSync(path.join(DIR, 'words.json'), JSON.stringify(out, null, 2));
console.log('total speech:', Object.values(out).reduce((a, b) => a + b.dur, 0).toFixed(2) + 's');
