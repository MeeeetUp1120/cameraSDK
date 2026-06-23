import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { useMeeeetUpCam } from "../context/useMeeeetUpCam";

export interface FaceGridProps {
  className?: string;
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const STYLE_ID = "mfc-styles";
function injectStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes mfc-materialize {
      0%   { opacity: 0; transform: scale(0.5); filter: blur(4px); }
      60%  { opacity: 1; transform: scale(1.06); filter: blur(0); }
      100% { opacity: 1; transform: scale(1); filter: blur(0); }
    }
    @keyframes mfc-dissolve {
      0%   { opacity: 1; transform: scale(1); filter: blur(0); }
      100% { opacity: 0; transform: scale(0.8); filter: blur(3px); }
    }
    @keyframes mfc-land {
      0%   { box-shadow: 0 0 0 0 rgba(52,211,153,0.5); }
      50%  { box-shadow: 0 0 12px 2px rgba(52,211,153,0.4); }
      100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
    }
    .mfc-card {
      will-change: transform;
      transition: border-color 350ms ease;
    }
    .mfc-enter  { animation: mfc-materialize 300ms cubic-bezier(0.34,1.56,0.64,1) both; }
    .mfc-exit   { animation: mfc-dissolve 220ms ease-in both; pointer-events: none; }
    .mfc-landed { animation: mfc-land 500ms ease-out both; }
    .mfc-moving { z-index: 10; box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
    .mfc-label  { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.4; user-select: none; padding: 0 2px; }
    .mfc-empty  { font-size: 11px; color: #666; font-style: italic; padding: 4px 0; }
    .mfc-row    { display: flex; gap: 6px; flex-wrap: wrap; min-height: 64px; align-items: flex-start; padding: 4px 0; }
  `;
  document.head.appendChild(s);
}

// ── Timer for ready calculation ─────────────────────────────────────────────────

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// ── FLIP ────────────────────────────────────────────────────────────────────────

function useFLIP(ref: React.RefObject<HTMLElement | null>) {
  const prev = useRef(new Map<string, DOMRect>());

  const snapshot = () => {
    if (!ref.current) return;
    const m = new Map<string, DOMRect>();
    ref.current.querySelectorAll<HTMLElement>("[data-tid]").forEach((c) =>
      m.set(c.dataset.tid!, c.getBoundingClientRect()),
    );
    prev.current = m;
  };

  const play = () => {
    if (!ref.current) return;
    ref.current.querySelectorAll<HTMLElement>("[data-tid]").forEach((c) => {
      const id = c.dataset.tid!;
      const oldR = prev.current.get(id);
      if (!oldR) return;
      const newR = c.getBoundingClientRect();
      const dx = oldR.left - newR.left;
      const dy = oldR.top - newR.top;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

      c.classList.add("mfc-moving");
      c.style.transition = "none";
      c.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;

      requestAnimationFrame(() => requestAnimationFrame(() => {
        c.style.transition = "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)";
        c.style.transform = "";
        const done = () => {
          c.removeEventListener("transitionend", done);
          c.classList.remove("mfc-moving");
          c.classList.add("mfc-landed");
          setTimeout(() => c.classList.remove("mfc-landed"), 500);
        };
        c.addEventListener("transitionend", done, { once: true });
      }));
    });

    const m = new Map<string, DOMRect>();
    ref.current.querySelectorAll<HTMLElement>("[data-tid]").forEach((c) =>
      m.set(c.dataset.tid!, c.getBoundingClientRect()),
    );
    prev.current = m;
  };

  return { snapshot, play };
}

// ── Ghost list (exit animation) ─────────────────────────────────────────────────

interface CardItem {
  trackId: string;
  dataUrl: string;
  frontalness: number;
  section: "live" | "committed" | "ready";
  exiting?: boolean;
}

function useGhosts(items: CardItem[], onBefore: () => void) {
  const [list, setList] = useState<CardItem[]>([]);
  const prevKeys = useRef(new Set<string>());

  useEffect(() => {
    const keys = new Set(items.map((i) => i.section + ":" + i.trackId));
    const ghosts: CardItem[] = list
      .filter((i) => !i.exiting && prevKeys.current.has(i.section + ":" + i.trackId) && !keys.has(i.section + ":" + i.trackId))
      .filter((i) => !items.some((n) => n.trackId === i.trackId))
      .map((i) => ({ ...i, exiting: true }));

    onBefore();
    setList([...items, ...ghosts]);
    prevKeys.current = keys;

    if (ghosts.length > 0) {
      const t = setTimeout(() => setList((p) => p.filter((x) => !x.exiting)), 250);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return list;
}

// ── Card ────────────────────────────────────────────────────────────────────────

const COLORS = {
  live:      { border: "rgba(96,165,250,0.5)",  text: "#60a5fa" },
  committed: { border: "rgba(250,204,21,0.5)",  text: "#facc15" },
  ready:     { border: "rgba(52,211,153,0.6)",  text: "#34d399" },
};

function Card({ item }: { item: CardItem }) {
  const c = COLORS[item.section];
  return (
    <div
      data-tid={item.trackId}
      className={`mfc-card ${item.exiting ? "mfc-exit" : "mfc-enter"}`}
      style={{
        position: "relative", width: 64, height: 64, borderRadius: 8,
        overflow: "hidden", background: "#1a1a1a",
        border: `2px solid ${c.border}`, flexShrink: 0,
      }}
    >
      <img src={item.dataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      <span style={{ position: "absolute", bottom: 2, left: 3, fontSize: 9, lineHeight: 1, color: "#fff", background: "rgba(0,0,0,0.7)", borderRadius: 3, padding: "1px 4px", fontVariantNumeric: "tabular-nums" }}>
        {item.trackId}
      </span>
      <span style={{ position: "absolute", top: 2, right: 3, fontSize: 9, lineHeight: 1, color: c.text, background: "rgba(0,0,0,0.7)", borderRadius: 3, padding: "1px 4px", fontVariantNumeric: "tabular-nums" }}>
        {Math.round(item.frontalness)}%
      </span>
    </div>
  );
}

// ── Section ─────────────────────────────────────────────────────────────────────

function Section({ label, items, emptyText }: { label: string; items: CardItem[]; emptyText: string }) {
  const count = items.filter((i) => !i.exiting).length;
  return (
    <div>
      <div className="mfc-label">{label} ({count})</div>
      <div className="mfc-row">
        {items.length === 0 && <span className="mfc-empty">{emptyText}</span>}
        {items.map((i) => <Card key={i.trackId} item={i} />)}
      </div>
    </div>
  );
}

// ── FaceGrid ────────────────────────────────────────────────────────────────────

export function FaceGrid({ className }: FaceGridProps) {
  const cam = useMeeeetUpCam();
  if (cam.mode !== "passive") return null;

  injectStyles();

  const now = useNow();
  const containerRef = useRef<HTMLDivElement>(null);
  const flip = useFLIP(containerRef);

  const bufferedIds = useMemo(
    () => new Set(cam.selectedFaces.map((f) => f.trackId)),
    [cam.selectedFaces],
  );

  const items: CardItem[] = useMemo(() => {
    const cutoff = now - 5_000;
    return [
      ...cam.livePreviews
        .filter((f) => !bufferedIds.has(f.trackId))
        .map((f) => ({ trackId: f.trackId, dataUrl: f.dataUrl, frontalness: f.frontalness, section: "live" as const })),
      ...cam.selectedFaces
        .filter((f) => f.createdAt >= cutoff)
        .map((f) => ({ trackId: f.trackId, dataUrl: f.dataUrl, frontalness: f.frontalness, section: "committed" as const })),
      ...cam.selectedFaces
        .filter((f) => f.createdAt < cutoff)
        .map((f) => ({ trackId: f.trackId, dataUrl: f.dataUrl, frontalness: f.frontalness, section: "ready" as const })),
    ];
  }, [cam.livePreviews, cam.selectedFaces, bufferedIds, now]);

  const visible = useGhosts(items, flip.snapshot);
  useLayoutEffect(() => { flip.play(); });

  const live      = visible.filter((i) => i.section === "live");
  const committed = visible.filter((i) => i.section === "committed");
  const ready     = visible.filter((i) => i.section === "ready");

  return (
    <div ref={containerRef} className={className} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Section label="Live"      items={live}      emptyText="No faces detected" />
      <Section label="Committed" items={committed} emptyText="No faces committed" />
      <Section label="Ready"     items={ready}     emptyText="No faces ready" />
    </div>
  );
}
