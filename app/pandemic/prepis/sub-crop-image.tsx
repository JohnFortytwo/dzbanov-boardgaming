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

const MAX_SCALE = 4;
const FLOOR_SCALE = 0.05;
const REST_PAN = { x: 0, y: 0 };

export type CropBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Pan = { x: number; y: number };
type FrameMetrics = { w: number; h: number; box: CropBox };
type CropView = { scale: number; pan: Pan; key: string | null };

type CropViewApi = {
  scale: number;
  pan: Pan;
  zoomBy: (delta: number) => void;
  movePan: (pan: Pan) => void;
  reset: () => void;
  rememberFrame: (id: string, size: FrameMetrics | null) => void;
  reclamp: () => void;
};

const CropViewContext = createContext<CropViewApi | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Scale 1 fills the frame with the crop. Smaller scales reveal the rest of the scan.
function minimumScale(frames: Map<string, FrameMetrics>) {
  let min = 1;
  let found = false;
  for (const frame of frames.values()) {
    if (frame.box.w <= 0 || frame.box.h <= 0) continue;
    found = true;
    min = Math.min(min, frame.box.w / 100, frame.box.h / 100);
  }
  if (!found) return FLOOR_SCALE;
  return clamp(min, FLOOR_SCALE, 1);
}

function imageSpan(frameSize: number, origin: number, length: number, scale: number) {
  const start = frameSize * (0.5 - ((origin + length / 2) * scale) / length);
  const size = frameSize * scale * (100 / length);
  return { start, end: start + size };
}

function axisLimit(start: number, end: number, frameSize: number) {
  const size = end - start;
  let min = size >= frameSize ? frameSize - end : -start;
  let max = size >= frameSize ? -start : frameSize - end;
  if (min > max) {
    const swap = min;
    min = max;
    max = swap;
  }
  // The crop-centered view stays reachable even when a frame would rather recenter.
  return { min: Math.min(min, 0), max: Math.max(max, 0) };
}

// One pan is shared, so each frame can still reach its own scan without a gap the others cannot follow.
function clampPan(frames: Map<string, FrameMetrics>, pan: Pan, scale: number): Pan {
  let minX = Number.NEGATIVE_INFINITY;
  let maxX = Number.POSITIVE_INFINITY;
  let minY = Number.NEGATIVE_INFINITY;
  let maxY = Number.POSITIVE_INFINITY;
  let count = 0;
  for (const frame of frames.values()) {
    if (frame.w < 2 || frame.h < 2 || frame.box.w <= 0 || frame.box.h <= 0) continue;
    count += 1;
    const x = imageSpan(frame.w, frame.box.x, frame.box.w, scale);
    const y = imageSpan(frame.h, frame.box.y, frame.box.h, scale);
    const limitX = axisLimit(x.start, x.end, frame.w);
    const limitY = axisLimit(y.start, y.end, frame.h);
    minX = Math.max(minX, limitX.min);
    maxX = Math.min(maxX, limitX.max);
    minY = Math.max(minY, limitY.min);
    maxY = Math.min(maxY, limitY.max);
  }
  if (count === 0 || minX > maxX || minY > maxY) return { ...pan, x: 0, y: 0 };
  return {
    x: clamp(pan.x, minX, maxX),
    y: clamp(pan.y, minY, maxY),
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
  const frames = useRef(new Map<string, FrameMetrics>());
  const scale = view.key === resetKey ? view.scale : 1;
  const pan = view.key === resetKey ? view.pan : REST_PAN;

  const zoomBy = useCallback(
    (delta: number) => {
      setView((current) => {
        const baseScale = current.key === resetKey ? current.scale : 1;
        const basePan = current.key === resetKey ? current.pan : REST_PAN;
        const nextScale = clamp(
          Number((baseScale + delta).toFixed(2)),
          minimumScale(frames.current),
          MAX_SCALE,
        );
        const nextPan = clampPan(frames.current, basePan, nextScale);
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

  const rememberFrame = useCallback((id: string, size: FrameMetrics | null) => {
    if (!size || size.w < 2 || size.h < 2) frames.current.delete(id);
    else frames.current.set(id, size);
  }, []);

  const reclamp = useCallback(() => {
    setView((current) => {
      if (current.key !== resetKey) return current;
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
      rememberFrame(viewId, {
        w: node.clientWidth,
        h: node.clientHeight,
        box: { x: box.x, y: box.y, w: box.w, h: box.h },
      });
    };
    measure();
    reclamp();
    const observer = new ResizeObserver(() => {
      measure();
      reclamp();
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      rememberFrame(viewId, null);
    };
  }, [rememberFrame, reclamp, viewId, box.x, box.y, box.w, box.h]);

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
      title={
        interactive
          ? "Kolečko zvětší i zmenší všechny výřezy, tažení ukáže zbytek karty. Dvojklik vrátí výřez."
          : undefined
      }
      className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70 select-none ${
        interactive ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      style={{ aspectRatio, touchAction: interactive ? "none" : "pan-y" }}
      onDoubleClick={() => {
        if (!interactive || !view) return;
        dragRef.current = null;
        view.reset();
      }}
      onPointerDown={(event) => {
        if (!interactive || !view || event.button !== 0) return;
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
        // Full scan, sized so scale 1 fills this frame with the crop. The bitmap stays unresized.
        // eslint-disable-next-line @next/next/no-img-element
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
          className="absolute max-w-none"
          style={{
            width: `${(scale * 10000) / width}%`,
            height: `${(scale * 10000) / height}%`,
            left: `${50 - ((box.x + width / 2) * scale * 100) / width}%`,
            top: `${50 - ((box.y + height / 2) * scale * 100) / height}%`,
            transform: pan.x === 0 && pan.y === 0 ? undefined : `translate(${pan.x}px, ${pan.y}px)`,
          }}
        />
      ) : (
        <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-zinc-500">
          {broken ? "Výstřižek se nepodařilo načíst." : "K této sekci není náhled."}
        </p>
      )}
    </div>
  );
}
