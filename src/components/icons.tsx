/**
 * The two drawn marks the artboards use. Both are stroked with `currentColor`
 * so a single colour rule moves the icon and its label together — which is
 * what lets the sunset warming reach the icon without a second variable.
 */

/** The walking mark: two footprints. Walking, never a car — see CLAUDE.md. */
export function WalkIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <ellipse cx="8" cy="7" rx="2.1" ry="3" transform="rotate(-15 8 7)" />
      <ellipse cx="16" cy="15" rx="2.1" ry="3" transform="rotate(15 16 15)" />
    </svg>
  );
}

export function PinIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
