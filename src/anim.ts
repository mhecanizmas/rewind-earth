/** Küçük animasyon yardımcıları — bağımlılık yok. */

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

let splitAnimToken = 0;
/** Bir değeri from→to arasında süreyle anime eder; önceki split animasyonunu iptal eder. */
export function tween(from: number, to: number, ms: number, onFrame: (v: number) => void, ease = easeInOut): Promise<void> {
  const token = ++splitAnimToken;
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now: number) => {
      if (token !== splitAnimToken) return resolve(); // iptal edildi
      const k = Math.min(1, (now - t0) / ms);
      onFrame(from + (to - from) * ease(k));
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}
export const cancelTween = () => void ++splitAnimToken;

/** Sayıyı 0'dan değere saydırır. */
export function countUp(el: HTMLElement, value: number, ms: number, fmt: (v: number) => string) {
  const t0 = performance.now();
  const step = (now: number) => {
    const k = easeOut(Math.min(1, (now - t0) / ms));
    el.textContent = fmt(value * k);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** CSS animasyon sınıfını yeniden tetikler. */
export function retrigger(el: HTMLElement, cls: string) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
