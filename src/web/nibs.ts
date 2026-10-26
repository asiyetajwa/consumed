// Nibs, the Consumed mascot: one painted dumpling with six expressions. Every Nibs on the page is an <img
// class="nibs">; setting a pose swaps the picture with a little hop, so each action gets a reaction.

export type Pose = 'idle' | 'look' | 'happy' | 'love' | 'wave' | 'sleepy';
const POSES: Pose[] = ['idle', 'look', 'happy', 'love', 'wave', 'sleepy'];

// Load every pose up front so a reaction never waits on the network.
for (const p of POSES) {
  const img = new Image();
  img.src = `mascot/${p}.png`;
}

export function nibsHtml(pose: Pose, cls = ''): string {
  return `<img class="nibs ${cls}" src="mascot/${pose}.png" alt="" data-pose="${pose}" draggable="false">`;
}

/** Sets the pose of a Nibs image, with a hop when it changes. */
export function pose(el: HTMLImageElement | null, p: Pose): void {
  if (!el || el.dataset.pose === p) return;
  el.dataset.pose = p;
  el.src = `mascot/${p}.png`;
  el.classList.remove('hop');
  void el.offsetWidth;
  el.classList.add('hop');
}
