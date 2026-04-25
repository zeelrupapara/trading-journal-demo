import { cn } from "@/lib/utils";

type Props = {
  name?: string | null;
  email?: string | null;
  size?: number;
  online?: boolean;
  ringColor?: string;
  className?: string;
};

// Google-style default avatar palette: vivid, high-contrast on dark.
// Order locked so the same name always maps to the same color.
const PALETTE = [
  "#4285F4", // blue
  "#DB4437", // red
  "#F4B400", // yellow
  "#0F9D58", // green
  "#AB47BC", // purple
  "#EC407A", // pink
  "#00ACC1", // cyan
  "#FF7043", // deep orange
  "#5C6BC0", // indigo
  "#26A69A", // teal
];

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pickColor(seed: string): string {
  return PALETTE[hashStr(seed) % PALETTE.length];
}

function initial(name?: string | null, email?: string | null): string {
  const base = (name?.trim() || email?.trim() || "?").replace(/[._-]/g, " ").trim();
  return (base[0] || "?").toUpperCase();
}

export function UserAvatar({
  name,
  email,
  size = 36,
  online = false,
  ringColor,
  className,
}: Props) {
  const seed = (email || name || "user").toLowerCase();
  const bg = pickColor(seed);
  const letter = initial(name, email);
  // Letter scales with avatar size. Google uses ~45% of diameter.
  const fontSize = Math.round(size * 0.44);
  const dotSize = Math.max(8, Math.round(size * 0.22));

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <div
        className="rounded-full flex items-center justify-center font-medium text-white select-none"
        style={{
          width: size,
          height: size,
          backgroundColor: bg,
          fontSize,
          letterSpacing: "0.01em",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
        aria-label={name || email || "User avatar"}
      >
        {letter}
      </div>
      {online && (
        <span
          aria-hidden
          className="absolute bottom-0 right-0 rounded-full bg-profit"
          style={{
            width: dotSize,
            height: dotSize,
            boxShadow: `0 0 0 2px ${ringColor ?? "var(--background)"}`,
          }}
        />
      )}
    </div>
  );
}
