"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { resolveScanImageUrl } from "@/lib/pandemic/scan-image";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const REST_PAN = { x: 0, y: 0 };

export type CropBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Pan = { x: number; y: number };
type FrameSize = { w: number; h: number };
type CropView = { scale: number; pan: Pan; key: string | null };

type CropViewApi = {
  scale: number;
  pan: Pan;
  zoomBy: (delta: number) => void;
  movePan: (pan: Pan) => void;
  reset: () => void;
  rememberFrame: (id: string, size: FrameSize | null) => void;
  reclamp: () => void;
};

const CropViewContext = createContext<CropViewApi | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Shared pan has to stay inside every frame, so the limit is the strictest one.
function panLimit(frames: Map<string, FrameSize>, scale: number): Pan {
  if (scale <= 1) return REST_PAN;
  let maxX = Number.POSITIVE_INFINITY;
  let maxY = Number.POSITIVE_INFINITY;
  for (const frame of frames.values()) {
    maxX = Math.min(maxX, ((scale - 1) * frame.w) / 2);
    maxY = Math.min(maxY, ((scale - 1) * frame.h) / 2);
  }
  if (!Number.isFinite(maxX) || !Number.isFinite(maxY)) return REST_PAN;
  return { x: maxX, y: maxY };
}

function clampPan(frames: Map<string, FrameSize>, pan: Pan, scale: number): Pan {
  const limit = panLimit(frames, scale);
  return {
    x: clamp(pan.x, -limit.x, limit.x),
    y: clamp(pan.y, -limit.y, limit.y),
  };
}

function samePan(left: Pan, right: Pan) {
  return left.x === right.x && left.y === right.y;
}

export function CropViewProvider({
  resetKey,
  children,
}: {
  resetKey: string | null;
  children: ReactNode;
}) {
  const [view, setView] = useState<CropView>({ scale: 1, pan: REST_PAN, key: resetKey });
  const frames = useRef(new Map<string, FrameSize>());
  const scale = view.key === resetKey ? view.scale : 1;
  const pan = view.key === resetKey ? view.pan : REST_PAN;

  const zoomBy = useCallback(
    (delta: number) => {
      setView((current) => {
        const baseScale = current.key === resetKey ? current.scale : 1;
        const basePan = current.key === resetKey ? current.pan : REST_PAN;
        const nextScale = clamp(Number((baseScale + delta).toFixed(2)), MIN_SCALE, MAX_SCALE);
        const nextPan = nextScale === 1 ? REST_PAN : clampPan(frames.current, basePan, nextScale);
        if (current.key === resetKey && nextScale === current.scale && samePan(nextPan, current.pan)) {
          return current;
        }
        return { scale: nextScale, pan: nextPan, key: resetKey };
      });
    },
    [resetKey],
  );

  const movePan = useCallback(
    (next: Pan) => {
      setView((current) => {
        const baseScale = current.key === resetKey ? current.scale : 1;
        const basePan = current.key === resetKey ? current.pan : REST_PAN;
        if (baseScale <= 1) {
          if (current.key === resetKey && current.scale === 1 && samePan(current.pan, REST_PAN)) return current;
          return { scale: 1, pan: REST_PAN, key: resetKey };
        }
        const nextPan = clampPan(frames.current, next, baseScale);
        if (current.key === resetKey && samePan(nextPan, basePan)) return current;
        return { scale: baseScale, pan: nextPan, key: resetKey };
      });
    },
    [resetKey],
  );

  const reset = useCallback(() => {
    setView((current) => {
      if (current.key === resetKey && current.scale === 1 && samePan(current.pan, REST_PAN)) return current;
      return { scale: 1, pan: REST_PAN, key: resetKey };
    });
  }, [resetKey]);

  const rememberFrame = useCallback((id: string, size: FrameSize | null) => {
    if (!size || size.w < 2 || size.h < 2) frames.current.delete(id);
    else frames.current.set(id, size);
  }, []);

  const reclamp = useCallback(() => {
    setView((current) => {
      if (current.key !== resetKey || current.scale <= 1) return current;
      const nextPan = clampPan(frames.current, current.pan, current.scale);
      if (samePan(nextPan, current.pan)) return current;
      return { ...current, pan: nextPan };
    });
  }, [resetKey]);

  const api = useMemo<CropViewApi>(
    () => ({ scale, pan, zoomBy, movePan, reset, rememberFrame, reclamp }),
    [scale, pan, zoomBy, movePan, reset, rememberFrame, reclamp],
  );

  return <CropViewContext.Provider value={api}>{children}</CropViewContext.Provider>;
}

export function SubCropImage({
  src,
  box,
  alt,
  viewId,
}: {
  src: string | null;
  box: CropBox;
  alt: string;
  viewId: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const view = useContext(CropViewContext);
  const url = resolveScanImageUrl(src);
  const [natural, setNatural] = useState<{ url: string; width: number; height: number } | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const broken = Boolean(url) && failedUrl === url;
  const size = natural?.url === url ? natural : null;
  const width = box.w > 0 ? box.w : 1;
  const height = box.h > 0 ? box.h : 1;
  const aspectRatio = size ? (size.width * width) / (size.height * height) : width / height;
  const scale = view?.scale ?? 1;
  const pan = view?.pan ?? REST_PAN;
  const interactive = Boolean(view && url && !broken);
  const zoomBy = view?.zoomBy;
  const rememberFrame = view?.rememberFrame;
  const reclamp = view?.reclamp;

  useEffect(() => {
    const node = frameRef.current;
    if (!node || !rememberFrame || !reclamp) return;
    const measure = () => {
      rememberFrame(viewId, { w: node.clientWidth, h: node.clientHeight });
    };
    measure();
    const observer = new ResizeObserver(() => {
      measure();
      reclamp();
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      rememberFrame(viewId, null);
    };
  }, [rememberFrame, reclamp, viewId]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node || !zoomBy || !interactive) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      if (event.deltaY === 0) return;
      zoomBy(event.deltaY < 0 ? 0.2 : -0.2);
    }

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [zoomBy, interactive]);

  return (
    <div
      ref={frameRef}
      data-crop-view={viewId}
      title={interactive ? "Kolečko zvětší všechny výřezy, tažení je posune. Dvojklik vrátí 100 %." : undefined}
      className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70 select-none ${
        !interactive ? "" : scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
      }`}
      style={{ aspectRatio, touchAction: scale > 1 ? "none" : "pan-y" }}
      onDoubleClick={() => {
        if (!interactive || !view) return;
        dragRef.current = null;
        view.reset();
      }}
      onPointerDown={(event) => {
        if (!interactive || !view || event.button !== 0 || scale <= 1) return;
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: pan.x,
          originY: pan.y,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!view || !drag || drag.pointerId !== event.pointerId) return;
        view.movePan({
          x: drag.originX + event.clientX - drag.startX,
          y: drag.originY + event.clientY - drag.startY,
        });
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
    >
      {url && !broken ? (
        <div
          className="absolute inset-0"
          style={
            scale === 1 && pan.x === 0 && pan.y === 0
              ? undefined
              : {
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                  transformOrigin: "center center",
                }
          }
        >
          {/* The crop is a CSS transform of the original scan, so the bitmap must stay unresized. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            draggable={false}
            onLoad={(event) => {
              const image = event.currentTarget;
              setNatural({ url, width: image.naturalWidth, height: image.naturalHeight });
            }}
            onError={() => {
              console.error("Výstřižek se nepodařilo načíst:", url);
              setFailedUrl(url);
            }}
            className="absolute top-0 left-0 h-full w-full max-w-none origin-top-left"
            style={{
              transform: `scale(${100 / width}, ${100 / height}) translate(${-box.x}%, ${-box.y}%)`,
            }}
          />
        </div>
      ) : (
        <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-zinc-500">
          {broken ? "Výstřižek se nepodařilo načíst." : "K této sekci není náhled."}
        </p>
      )}
    </div>
  );
}
