import React from 'react';
import { AbsoluteFill, Audio, Freeze, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FPS } from '../components/Film';
import { clamp, easeOut, popAt } from '../components/motion';
import { theme } from '../theme';
import marks from '../../public/clips/marks.json';
import { CLIP_SECONDS, type SceneId } from './script';

type Mark = { sound: string; at: number; volume: number };
const MARKS = marks as Record<string, Mark[]>;

// The phone: the recording is 780 by 1688, shown at 434 by 940 inside a black bezel.
const SCREEN_W = 434;
const SCREEN_H = 940;
const BEZEL = 14;

const Phone: React.FC<{ id: SceneId; x: number; enterAt?: number }> = ({ id, x, enterAt = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clipFrames = Math.round((CLIP_SECONDS[id] ?? 0) * FPS);
  const rise = popAt(frame, fps, enterAt, 18);
  const video = <OffthreadVideo src={staticFile(`clips/${id}.mp4`)} muted style={{ width: SCREEN_W, height: SCREEN_H, display: 'block' }} />;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - (SCREEN_W + BEZEL * 2) / 2,
        top: (1080 - SCREEN_H - BEZEL * 2) / 2,
        width: SCREEN_W + BEZEL * 2,
        height: SCREEN_H + BEZEL * 2,
        borderRadius: 70,
        background: '#0f0a07',
        padding: BEZEL,
        boxShadow: '0 50px 90px -40px rgba(40, 25, 10, .6), 0 0 0 2px #2a211b inset',
        transform: `translateY(${String((1 - rise) * 60)}px)`,
        opacity: rise,
      }}
    >
      <div style={{ width: SCREEN_W, height: SCREEN_H, borderRadius: 56, overflow: 'hidden', position: 'relative', background: theme.paper }}>
        {/* After the recording ends, the last frame holds while the line finishes. */}
        <Freeze frame={Math.max(0, clipFrames - 2)} active={(f) => f >= clipFrames - 2}>
          {video}
        </Freeze>
      </div>
    </div>
  );
};

/** The app's own sounds, at the moments the recording noted. */
const Sounds: React.FC<{ id: SceneId }> = ({ id }) => (
  <>
    {(MARKS[id] ?? []).map((m, i) => (
      <Sequence key={i} from={Math.round(m.at * FPS)}>
        <Audio src={staticFile(`sfx/${m.sound}.mp3`)} volume={0.55 * m.volume} />
      </Sequence>
    ))}
  </>
);

const Words: React.FC<{ step: string; title: string; sub: string; accent: string }> = ({ step, title, sub, accent }) => {
  const frame = useCurrentFrame();
  const t = (at: number) => interpolate(frame, [at, at + 22], [0, 1], { ...clamp, easing: easeOut });
  const row = (at: number): React.CSSProperties => ({ opacity: t(at), transform: `translateY(${String((1 - t(at)) * 24)}px)` });
  return (
    <div style={{ position: 'absolute', left: 150, top: 0, bottom: 0, width: 760, display: 'flex', flexDirection: 'column', justifyContent: 'center', fontFamily: theme.font, color: theme.ink }}>
      <div style={{ ...row(4), display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 12, padding: '10px 20px 10px 10px', borderRadius: 999, background: theme.paper, boxShadow: '0 10px 24px -14px rgba(40,25,10,.4)', fontSize: 24, fontWeight: 800 }}>
        <span style={{ width: 22, height: 22, borderRadius: '50%', background: accent }} />
        {step}
      </div>
      <div style={{ ...row(10), marginTop: 26, fontSize: 96, fontWeight: 900, letterSpacing: -4, lineHeight: 0.98 }}>{title}</div>
      <div style={{ ...row(18), marginTop: 24, fontSize: 34, fontWeight: 500, lineHeight: 1.35, color: theme.ink2, maxWidth: 680 }}>{sub}</div>
    </div>
  );
};

const Glow: React.FC<{ color: string; x: number }> = ({ color, x }) => (
  <div style={{ position: 'absolute', left: x - 470, top: 540 - 470, width: 940, height: 940, borderRadius: '50%', background: color, opacity: 0.22 }} />
);

const app = (id: SceneId, step: string, title: string, sub: string, accent: string): React.FC => {
  const Scene: React.FC = () => (
    <AbsoluteFill>
      <Glow color={accent} x={1340} />
      <Words step={step} title={title} sub={sub} accent={accent} />
      <Phone id={id} x={1340} />
      <Sounds id={id} />
    </AbsoluteFill>
  );
  return Scene;
};

export const WelcomeScene = app('welcome', 'Getting Started', 'Four quick questions', 'Your name, what you love, and who is in your circle.', theme.sun);
export const FriendsScene = app('friends', 'Friends first', 'Every friend’s day is one card', 'Tap it and it turns to the next thing they enjoyed.', theme.pink);
export const SongScene = app('song', 'Log a song', 'Type it. Muse Spark finds it.', 'Muse Image paints the real cover onto your day.', theme.sun);
export const BookScene = app('book', 'Log a book', 'Same book? It’s a match.', 'Maya is reading it too.', theme.blue);
export const MealScene = app('meal', 'Log a meal', 'Snap it. Muse Image paints it.', 'Muse Spark names it and SAM 3.1 lifts it off the table.', theme.tomato);
export const DareScene = app('dare', 'Taste dare', 'Something purple', 'Leo’s dare, done with an ube latte.', theme.purple);
export const TodayScene = app('today', 'Your page', 'Today, hand-painted', 'Drag anything loose. Tidy it back in one tap.', theme.green);
export const TonightScene = app('tonight', 'Tonight', 'Crack open your day', 'Your day as one poster, and Muse Image’s painting of it on the back.', theme.sun);
export const ShareScene = app('share', 'Share', 'Made for your Instagram story', 'Or straight to your WhatsApp group chat.', theme.green);

// A painting from the app's catalog for the title scenes, lifted off its paper with its own soft shadow.
const Sticker: React.FC<{ src: string; size: number; x: number; y: number; rot: number; at: number }> = ({ src, size, x, y, rot, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = popAt(frame, fps, at, 11);
  return (
    <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, transform: `rotate(${String(rot)}deg) scale(${String(p)})`, display: 'grid', placeItems: 'center' }}>
      <Img src={staticFile(`stickers/${src}`)} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: src.endsWith('.jpg') ? '50%' : 0 }} />
    </div>
  );
};

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const t = (at: number) => interpolate(frame, [at, at + 24], [0, 1], { ...clamp, easing: easeOut });
  return (
    <AbsoluteFill style={{ fontFamily: theme.font, color: theme.ink }}>
      <Sticker src="ube-latte.png" size={250} x={1450} y={270} rot={8} at={18} />
      <Sticker src="smash-burger.png" size={270} x={1680} y={560} rot={-6} at={28} />
      <Sticker src="tonkotsu-ramen.png" size={280} x={1380} y={800} rot={5} at={38} />
      <Sticker src="maya.jpg" size={150} x={1170} y={540} rot={-8} at={48} />
      <Sticker src="leo.jpg" size={130} x={1720} y={890} rot={7} at={56} />
      <div style={{ position: 'absolute', left: 150, top: 330, opacity: t(4), transform: `translateY(${String((1 - t(4)) * 30)}px)` }}>
        <div style={{ fontSize: 210, fontWeight: 900, letterSpacing: -10, lineHeight: 0.9 }}>Consumed</div>
        <div style={{ marginTop: 34, fontSize: 44, fontWeight: 600, color: theme.ink2, maxWidth: 820, lineHeight: 1.3, opacity: t(16) }}>One page a day for everything you listen to, read and eat.</div>
      </div>
    </AbsoluteFill>
  );
};

const Tile: React.FC<{ at: number; name: string; does: string; color: string; x: number }> = ({ at, name, does, color, x }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = popAt(frame, fps, at, 13);
  return (
    <div style={{ position: 'absolute', left: x, top: 330, width: 500, height: 330, borderRadius: 40, background: theme.paper, boxShadow: `inset 0 0 0 3px ${color}, 0 30px 60px -30px rgba(60, 35, 10, .35)`, padding: 44, transform: `scale(${String(p)}) rotate(${String((1 - p) * -6)}deg)`, fontFamily: theme.font, color: theme.ink }}>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color }}>Meta Model API</div>
      <div style={{ marginTop: 18, fontSize: 64, fontWeight: 900, letterSpacing: -2.5 }}>{name}</div>
      <div style={{ marginTop: 14, fontSize: 32, fontWeight: 500, color: theme.ink2, lineHeight: 1.3 }}>{does}</div>
    </div>
  );
};

export const HowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [150, 176], [0, 1], { ...clamp, easing: easeOut });
  return (
    <AbsoluteFill style={{ fontFamily: theme.font, color: theme.ink }}>
      <Tile at={10} name="Muse Spark" does="Reads your photos and searches" color={theme.green} x={150} />
      <Tile at={40} name="SAM 3.1" does="Lifts each dish off the table" color={theme.tomato} x={710} />
      <Tile at={70} name="Muse Image" does="Paints every item and your day" color={theme.purple} x={1270} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 790, textAlign: 'center', fontSize: 64, fontWeight: 900, letterSpacing: -2, opacity: t, transform: `translateY(${String((1 - t) * 20)}px)` }}>
        Three Meta models, <span style={{ color: theme.green }}>one hand-painted day</span>
      </div>
    </AbsoluteFill>
  );
};

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const t = (at: number) => interpolate(frame, [at, at + 24], [0, 1], { ...clamp, easing: easeOut });
  return (
    <AbsoluteFill style={{ background: theme.green, fontFamily: theme.font, color: theme.paper, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ position: 'absolute', left: 960 - 420, top: 540 - 420, width: 840, height: 840, borderRadius: '50%', background: theme.greenDeep }} />
      <Sticker src="glazed-donut.png" size={200} x={430} y={300} rot={-10} at={30} />
      <Sticker src="iced-matcha-latte.png" size={210} x={1500} y={780} rot={8} at={40} />
      <Sticker src="pepperoni-pizza.png" size={200} x={1520} y={290} rot={12} at={50} />
      <Sticker src="priya.jpg" size={140} x={420} y={790} rot={-6} at={60} />
      <div style={{ position: 'relative', opacity: t(4), transform: `scale(${String(0.9 + t(4) * 0.1)})` }}>
        <div style={{ fontSize: 200, fontWeight: 900, letterSpacing: -9, lineHeight: 0.9 }}>Consumed</div>
        <div style={{ marginTop: 26, fontSize: 52, fontWeight: 800, color: theme.sun, opacity: t(26) }}>Your day, worth sharing.</div>
        <div style={{ marginTop: 34, fontSize: 28, fontWeight: 600, opacity: t(40) * 0.8 }}>Built on the Meta Model API: Muse Spark, SAM 3.1 and Muse Image</div>
      </div>
    </AbsoluteFill>
  );
};
