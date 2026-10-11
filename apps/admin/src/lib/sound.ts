/**
 * Звуковой сигнал о новом заказе через Web Audio API (без файлов).
 * Браузеры разрешают звук только после действия пользователя — поэтому кнопка «Включить звук».
 */
let ctx: AudioContext | null = null;

export async function unlockAudio(): Promise<boolean> {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx ?? new AC();
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

export function isAudioReady(): boolean {
  return ctx?.state === 'running';
}

/** Трёхнотный колокольчик, повторяется дважды */
export function playNewOrderChime() {
  if (!ctx || ctx.state !== 'running') return;
  const notes = [880, 1174.66, 1567.98];
  const start = ctx.currentTime + 0.05;
  for (let round = 0; round < 2; round++) {
    notes.forEach((freq, i) => {
      const t = start + round * 0.9 + i * 0.16;
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
  }
}
