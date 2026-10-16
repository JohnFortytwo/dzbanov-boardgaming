"use client";

import { useState } from "react";

export type CropBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function SubCropImage({
  src,
  box,
  alt,
}: {
  src: string | null;
  box: CropBox;
  alt: string;
}) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [broken, setBroken] = useState(false);
  const width = box.w > 0 ? box.w : 1;
  const height = box.h > 0 ? box.h : 1;
  const aspectRatio = natural
    ? (natural.width * width) / (natural.height * height)
    : width / height;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70"
      style={{ aspectRatio }}
    >
      {src && !broken ? (
        // The crop is a CSS transform of the original scan, so the bitmap must stay unresized.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={(event) => {
            const image = event.currentTarget;
            setNatural({ width: image.naturalWidth, height: image.naturalHeight });
          }}
          onError={() => setBroken(true)}
          className="absolute top-0 left-0 h-full w-full max-w-none origin-top-left"
          style={{
            transform: `scale(${100 / width}, ${100 / height}) translate(${-box.x}%, ${-box.y}%)`,
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
