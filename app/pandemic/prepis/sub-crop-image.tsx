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
const FLOOR_SCALE = 0.02;
const REST_PAN = { x: 0, y: 0 };

export type CropBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Pan = { x: number; y: number };
type CropView = { scale: number; pan: Pan; key: string | null };

type CropViewApi = {
  scale: number;
  pan: Pan;
  zoomBy: (delta: number) => void;
  movePan: (pan: Pan) => void;
  reset: () => void;
};

const CropViewContext = createContext<CropViewApi | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
  const scale = view.key === resetKey ? view.scale : 1;
  const pan = view.key === resetKey ? view.pan : REST_PAN;

  const zoomBy = useCallback(
    (delta: number) => {
      setView((current) => {
        const baseScale = current.key === resetKey ? current.scale : 1;
        const basePan = current.key === resetKey ? current.pan : REST_PAN;
        const nextScale = clamp(
          Number((delta < 0 ? baseScale * 0.8 : baseScale + delta).toFixed(2)),
          FLOOR_SCALE,
          MAX_SCALE,
        );
        if (current.key === resetKey && nextScale === current.scale && samePan(basePan, current.pan)) {
          return current;
        }
        return { scale: nextScale, pan: basePan, key: resetKey };
      });
    },
    [resetKey],
  );

  const movePan = useCallback(
    (next: Pan) => {
      setView((current) => {
        const baseScale = current.key === resetKey ? current.scale : 1;
        if (current.key === resetKey && samePan(next, current.pan)) return current;
        return { scale: baseScale, pan: next, key: resetKey };
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

  const api = useMemo<CropViewApi>(
    () => ({ scale, pan, zoomBy, movePan, reset }),
    [scale, pan, zoomBy, movePan, reset],
  );

  return <CropViewContext.Provider value={api}>{children}</CropViewContext.Provider>;
}

export function useCropViewReset() {
  const view = useContext(CropViewContext);
  return view?.reset ?? noopReset;
}

function noopReset() {}

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

  useEffect(() => {
    const node = frameRef.current;
    if (!node || !zoomBy || !interactive) return;
    const zoom = zoomBy;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      if (event.deltaY === 0) return;
      zoom(event.deltaY < 0 ? 0.2 : -0.2);
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
      className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black select-none ${
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
