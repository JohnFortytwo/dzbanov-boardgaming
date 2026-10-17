import Image from "next/image";

const LOGO = {
  src: "/Images/LOGO_03.jpg",
  width: 4128,
  height: 1024,
} as const;

export function BrandLogo({
  variant,
  priority = false,
}: {
  variant: "hero" | "header";
  priority?: boolean;
}) {
  const className =
    variant === "hero"
      ? "h-auto w-full max-w-2xl rounded-2xl"
      : "h-10 w-auto max-w-[70vw] rounded-md";
  const style =
    variant === "hero"
      ? { width: "100%", height: "auto" }
      : { width: "auto", height: "2.5rem" };

  return (
    <Image
      src={LOGO.src}
      alt="Džbánov Boardgaming"
      width={LOGO.width}
      height={LOGO.height}
      priority={priority}
      className={className}
      style={style}
    />
  );
}
