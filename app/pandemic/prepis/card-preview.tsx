"use client";

import { useEffect, useRef, useState } from "react";
import { resolveScanImageUrl } from "@/lib/pandemic/scan-image";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function CardPreview({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const scaleRef = useRef(1);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const url = resolveScanImageUrl(src);
  const [open, setOpen] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const broken = Boolean(url) && failedUrl === url;

  function markBroken() {
    console.error("Výstřižek se nepodařilo načíst:", url);
    if (url) setFailedUrl(url);
    setOpen(false);
  }

  function setZoom(next: number) {
    const clamped = clamp(Number(next.toFixed(2)), MIN_SCALE, MAX_SCALE);
    scaleRef.current = clamped;
    setScale(clamped);
    if (clamped === 1) setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.2 : -0.2;
      setZoom(scaleRef.current + delta);
    }

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [url, broken]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function zoomBy(delta: number) {
    setZoom(scaleRef.current + delta);
  }

  function resetZoom() {
    setZoom(1);
  }

  return (
    <>
      <div className="flex h-full min-h-[420px] flex-col rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] backdrop-blur-xl sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/85">
            Náhled karty
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => zoomBy(-0.25)}
              disabled={!url || broken || scale <= MIN_SCALE}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Zmenšit
            </button>
            <span className="min-w-12 text-center text-xs tabular-nums text-zinc-400">
              {Math.round(scale * 100)} %
            </span>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => zoomBy(0.25)}
              disabled={!url || broken || scale >= MAX_SCALE}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Zvětšit
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={resetZoom}
              disabled={!url || broken || (scale === 1 && pan.x === 0 && pan.y === 0)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              100 %
            </button>
          </div>
        </div>

        <div
          ref={frameRef}
          className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70"
          onPointerDown={(event) => {
            if (!url || broken || event.button !== 0) return;
            dragRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              originX: pan.x,
              originY: pan.y,
              moved: false,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId || scale === 1) return;
            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            if (Math.hypot(dx, dy) > 4) drag.moved = true;
            setPan({ x: drag.originX + dx, y: drag.originY + dy });
          }}
          onPointerUp={() => {
            const drag = dragRef.current;
            dragRef.current = null;
            if (!drag || drag.moved || !url || broken) return;
            setOpen(true);
          }}
        >
          {url && !broken ? (
            // Full-resolution scan: CSS zoom needs the original bitmap, not a resized optimizer output.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={alt}
              draggable={false}
              onError={markBroken}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
              className={`max-h-full max-w-full select-none object-contain ${
                scale > 1 ? "cursor-grab" : "cursor-zoom-in"
              }`}
            />
          ) : (
            <p className="px-6 text-center text-sm text-zinc-500">
              {broken ? "Obrázek karty se nepodařilo načíst." : "K této hře není uložený náhled."}
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Kolečkem myši zvětšíte, tažením posunete, klepnutím otevřete celou obrazovku.
        </p>
      </div>

      {open && url && !broken ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute top-6 right-6 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-white/20 hover:text-white"
          >
            Zavřít
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)]"
            onClick={(event) => event.stopPropagation()}
            onError={markBroken}
          />
        </div>
      ) : null}
    </>
  );
}
