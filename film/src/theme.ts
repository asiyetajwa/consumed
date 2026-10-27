import { continueRender, delayRender, staticFile } from 'remotion';

// Consumed's look: cream paper, heavy black type, green, sun and tomato; Inter Tight (SIL Open Font License).
export const theme = {
  bg: '#efe9d6',
  paper: '#fcf9ec',
  paper2: '#f4efdc',
  ink: '#160b06',
  ink2: '#4b4038',
  muted: '#8b8174',
  green: '#2f6b2a',
  greenDeep: '#1f4a1d',
  sun: '#f6b52a',
  tomato: '#e8432e',
  pink: '#f3a0b5',
  purple: '#8b5fbf',
  blue: '#3c6fd8',
  night: '#140b06',
  font: "'Inter Tight', system-ui, sans-serif",
} as const;

let fontsRequested = false;

/** Loads the font before the first frame renders. */
export function ensureFonts(): void {
  if (fontsRequested || typeof document === 'undefined') return;
  fontsRequested = true;
  const handle = delayRender('Loading fonts');
  new FontFace('Inter Tight', `url(${staticFile('fonts/inter-tight-variable.woff2')}) format('woff2')`, { weight: '100 900' })
    .load()
    .then((f) => {
      document.fonts.add(f);
    })
    .catch((err: unknown) => {
      console.error(err);
    })
    .finally(() => {
      continueRender(handle);
    });
}
