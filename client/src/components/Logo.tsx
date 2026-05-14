export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-label="Texas Archery Calendar logo"
      role="img"
    >
      {/* Bullseye */}
      <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <circle cx="20" cy="20" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {/* Arrow */}
      <line x1="6" y1="34" x2="28" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <polygon points="28,12 22,12 28,12 28,18" fill="currentColor" />
      <polygon points="6,34 4,30 8,32" fill="currentColor" />
    </svg>
  );
}
