// Consumed film: one phone, one day. Scene order, voiceover lines and minimum on-screen time. The phone screens are
// screen recordings of the real app running live on the Meta Model API (scripts/record.mjs); the sounds are the
// app's own, played at the moments recorded in public/clips/marks.json. Voiceover: npm run voiceover consumed
// Written for the ear: model names hyphenated so the voice reads each as one name. <break time="0.4s" /> is an
// ElevenLabs pause tag.

import type { SceneSpec } from '../components/Film';

export type SceneId = 'intro' | 'welcome' | 'friends' | 'song' | 'book' | 'meal' | 'dare' | 'today' | 'tonight' | 'share' | 'how' | 'outro';

/** Length of each screen recording in seconds (from scripts/record.mjs). */
export const CLIP_SECONDS: Partial<Record<SceneId, number>> = {
  welcome: 13.9,
  friends: 7.2,
  song: 11.4,
  book: 10.8,
  meal: 11.3,
  dare: 12.2,
  today: 3.8,
  tonight: 9.2,
  share: 1.8,
};

const clip = (id: SceneId, extra = 0.6) => (CLIP_SECONDS[id] ?? 0) + extra;

export const SCENES: SceneSpec<SceneId>[] = [
  { id: 'intro', voiceover: 'This is Consumed. <break time="0.3s" /> One page a day, for everything you listen to, read and eat, logged in seconds as stickers your friends can see.', minSeconds: 7.5 },
  { id: 'welcome', voiceover: 'Getting in takes four quick questions. Your name, what you love, how much you enjoy in a day, and who is in your circle.', minSeconds: clip('welcome') },
  { id: 'friends', voiceover: 'It opens on your friends. Each friend\'s day is one card. Tap it, and it turns to the next thing they enjoyed.', minSeconds: clip('friends') },
  { id: 'song', voiceover: 'Log a song just by typing it. Muse-Spark, from Meta, finds it in a few seconds, and the real cover drops in as a sticker.', minSeconds: clip('song') },
  { id: 'book', voiceover: 'Then a book. Maya is reading it too, so it\'s a match.', minSeconds: clip('book') },
  { id: 'meal', voiceover: 'Lunch is just a photo. Muse-Spark names it, and SAM-Three-point-One cuts it out along its own edge.', minSeconds: clip('meal') },
  { id: 'dare', voiceover: 'Leo dared me to eat something purple today. <break time="0.2s" /> An ube latte counts.', minSeconds: clip('dare') },
  { id: 'today', voiceover: 'Today is an album page. Drag any sticker loose, and tidy it back in one tap.', minSeconds: clip('today') },
  { id: 'tonight', voiceover: 'At night, your day seals into a capsule. Crack it open, and there\'s your card. Turn it over, and Muse-Image has painted the same day.', minSeconds: clip('tonight') },
  { id: 'share', voiceover: 'Share it to your story, or straight to the group chat.', minSeconds: clip('share', 1.2) },
  { id: 'how', voiceover: 'Muse-Spark reads, SAM cuts, and Muse-Image paints. <break time="0.2s" /> A whole day costs about four cents.', minSeconds: 8.5 },
  { id: 'outro', voiceover: 'Consumed. <break time="0.4s" /> Your day, worth sharing.', minSeconds: 5.6, after: { file: 'sfx/sting.mp3', gap: 0.2, seconds: 1.8, volume: 0.55 } },
];
