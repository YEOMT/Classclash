export function hash32(text: string): number {
  let h = 2166136261;
  for (const b of new TextEncoder().encode(text)) h = Math.imul(h ^ b, 16777619) >>> 0;
  return h || 0x6d2b79f5;
}
export function nextRandom(state: { value: number }): number {
  let x = state.value >>> 0;
  x = (x ^ (x << 13)) >>> 0; x = (x ^ (x >>> 17)) >>> 0; x = (x ^ (x << 5)) >>> 0;
  state.value = x; return (x + 0.5) / 4294967296;
}
export function shuffle<T>(values: T[], random: () => number): T[] {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
