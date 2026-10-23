export function Stamp({ caption, animate = true, size = 148 }: { caption: string; animate?: boolean; size?: number }) {
  const text = `VERIFIED · ACCREDITED VERIFIER · ${caption} · `;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      role="img"
      aria-label={`Verified stamp, ${caption}`}
      className={animate ? "animate-stamp" : "-rotate-[8deg]"}
      style={{ color: "var(--color-verified)" }}
    >
      <defs>
        <path id="stamp-ring" d="M80,80 m-58,0 a58,58 0 1,1 116,0 a58,58 0 1,1 -116,0" />
      </defs>
      <circle cx="80" cy="80" r="76" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="80" cy="80" r="44" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text fill="currentColor" fontFamily="var(--font-sans)" fontSize="11.5" fontWeight="600" letterSpacing="1.6">
        <textPath href="#stamp-ring">{text}</textPath>
      </text>
      <path d="M62 81 l12 12 l26 -28" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
