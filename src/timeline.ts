/** Çift tutamaçlı yıl zaman çizelgesi: sol = önce, sağ = sonra. */
export interface Timeline {
  set(before: number, after: number): void;
  setRange(min: number, max: number): void;
  onChange(cb: (before: number, after: number, side: "l" | "r") => void): void;
  highlight(year: number | null): void; // zaman akışı sırasında parlayan yıl
  /** Görüntüsü bulunmayan yıllar çizelgede kırmızı işaretlenir */
  setEmptyYears(years: Set<number>): void;
}

export function createTimeline(root: HTMLElement, minYear: number, maxYear: number): Timeline {
  let min = minYear, max = maxYear;
  let before = minYear, after = maxYear;
  let cb: ((b: number, a: number, side: "l" | "r") => void) | null = null;

  root.classList.add("tl");
  root.innerHTML = `
    <div class="tl-track">
      <div class="tl-ticks"></div>
      <div class="tl-range"></div>
      <div class="tl-glow"></div>
      <button class="tl-handle l" aria-label="before year"><span></span></button>
      <button class="tl-handle r" aria-label="after year"><span></span></button>
    </div>`;
  const track = root.querySelector<HTMLElement>(".tl-track")!;
  const ticks = root.querySelector<HTMLElement>(".tl-ticks")!;
  const range = root.querySelector<HTMLElement>(".tl-range")!;
  const glow = root.querySelector<HTMLElement>(".tl-glow")!;
  const hl = root.querySelector<HTMLButtonElement>(".tl-handle.l")!;
  const hr = root.querySelector<HTMLButtonElement>(".tl-handle.r")!;

  const pct = (y: number) => ((y - min) / Math.max(1, max - min)) * 100;

  function renderTicks() {
    const parts: string[] = [];
    const lastFive = max - (max % 5);
    for (let y = min; y <= max; y++) {
      // uç etiketler komşu 5'lik etiketle çakışmasın
      const edge = (y === min && min % 5 !== 0 && (min % 5 >= 4 || min % 5 <= 1 ? false : true)) || (y === max && max - lastFive >= 2);
      const major = y % 5 === 0 || edge;
      parts.push(`<i class="${major ? "major" : ""}" data-y="${y}" style="left:${pct(y)}%">${major ? `<b>${y}</b>` : ""}</i>`);
    }
    ticks.innerHTML = parts.join("");
  }

  let lastB = -1, lastA = -1;
  function render() {
    if (before !== lastB) { lastB = before; pop(hl); }
    if (after !== lastA) { lastA = after; pop(hr); }
    hl.style.left = `${pct(before)}%`;
    hr.style.left = `${pct(after)}%`;
    hl.querySelector("span")!.textContent = String(before);
    hr.querySelector("span")!.textContent = String(after);
    range.style.left = `${pct(Math.min(before, after))}%`;
    range.style.width = `${Math.abs(pct(after) - pct(before))}%`;
  }

  /** Yıl değişince tutamaç ve etiketi kısa bir zıplamayla vurgular. */
  function pop(h: HTMLElement) {
    h.classList.remove('pop');
    void h.offsetWidth;
    h.classList.add('pop');
  }

  function yearFromX(clientX: number) {
    const r = track.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round(min + f * (max - min));
  }

  function drag(handle: HTMLElement, side: "l" | "r") {
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      handle.classList.add("active");
      const move = (ev: PointerEvent) => {
        const y = yearFromX(ev.clientX);
        if (side === "l") before = Math.min(y, after);
        else after = Math.max(y, before);
        render();
        cb?.(before, after, side);
      };
      const up = () => {
        handle.classList.remove("active");
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
    // klavye: ok tuşları
    handle.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      if (side === "l") before = Math.max(min, Math.min(after, before + d));
      else after = Math.min(max, Math.max(before, after + d));
      render();
      cb?.(before, after, side);
    });
  }
  drag(hl, "l");
  drag(hr, "r");

  // şeride tıklama: en yakın tutamacı taşı
  track.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest(".tl-handle")) return;
    const y = yearFromX(e.clientX);
    const side: "l" | "r" = Math.abs(y - before) <= Math.abs(y - after) ? "l" : "r";
    if (side === "l") before = Math.min(y, after);
    else after = Math.max(y, before);
    render();
    cb?.(before, after, side);
  });

  renderTicks();
  render();

  return {
    set(b, a) {
      before = Math.max(min, Math.min(max, b));
      after = Math.max(min, Math.min(max, a));
      render();
    },
    setRange(a, b) {
      min = a; max = b;
      before = Math.max(min, Math.min(max, before));
      after = Math.max(min, Math.min(max, after));
      renderTicks();
      render();
    },
    onChange(f) { cb = f; },
    highlight(y) {
      if (y === null) { glow.style.opacity = "0"; return; }
      glow.style.opacity = "1";
      glow.style.left = `${pct(y)}%`;
    },
    setEmptyYears(years) {
      ticks.querySelectorAll<HTMLElement>("i").forEach((t) =>
        t.classList.toggle("empty", years.has(Number(t.dataset.y))));
    },
  };
}
