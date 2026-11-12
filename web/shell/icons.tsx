import type { ReactNode } from "react";

// The pictures beside the simulations in the home page's list. They are
// decoration: the link beside each already says what it is, so they are
// hidden from a screen reader. Colors come from the theme (style.css).
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="sim-icon"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

// One planet, two histories: living on the left, lifeless on the right.
export function EarthIcon() {
  return (
    <Icon>
      <path className="i-living" d="M31 6a26 26 0 0 0 0 52z" />
      <path className="i-lifeless" d="M33 6a26 26 0 0 1 0 52z" />
      <path
        className="i-land"
        d="M14 22c4-3 9-3 11 0s-2 5-1 8 5 3 4 7-6 5-9 3-3-5-6-7-2-9 1-11zM20 46c3-1 6 0 6 2s-3 3-5 2-2-3-1-4z"
      />
      <path
        className="i-dune"
        d="M38 20c5 2 10 2 14 0M37 32c7 3 14 3 20 0M38 44c5 2 10 2 14 0"
      />
    </Icon>
  );
}

// Two shells in a sea of fire. The small holes are the stars, the large
// one on the inner shell is the sun, and the clerk stands at the center.
export function MoziIcon() {
  return (
    <Icon>
      <circle className="i-lifeless" cx="32" cy="32" r="30" />
      <circle className="i-shell" cx="32" cy="32" r="24" />
      <circle className="i-shell" cx="32" cy="32" r="13" />
      <g className="i-lifeless">
        <circle cx="32" cy="8" r="1.8" />
        <circle cx="52.8" cy="20" r="1.8" />
        <circle cx="54.6" cy="40.2" r="1.8" />
        <circle cx="40.2" cy="54.6" r="1.8" />
        <circle cx="20" cy="52.8" r="1.8" />
        <circle cx="8.4" cy="36.2" r="1.8" />
        <circle cx="15" cy="15" r="1.8" />
        <circle cx="41.2" cy="22.8" r="4.5" />
      </g>
      <circle className="i-ink" cx="32" cy="32" r="2.5" />
    </Icon>
  );
}

// A ball above, and the wide banded disc it leaves in the plane.
export function FlatIcon() {
  return (
    <Icon>
      <path className="i-fall" d="M22.5 17 6 45M41.5 17 58 45" />
      <circle className="i-living" cx="32" cy="15" r="10" />
      <ellipse className="i-living i-faint" cx="32" cy="47" rx="28" ry="10" />
      <ellipse className="i-living i-mid" cx="32" cy="47" rx="19" ry="6.8" />
      <ellipse className="i-living" cx="32" cy="47" rx="9" ry="3.2" />
    </Icon>
  );
}

// A sun, the spiral unwinding from it, and a small planet on its way in.
export function DiazIcon() {
  return (
    <Icon>
      <path
        className="i-fall"
        d="M32 32c0-5 7-6 9-1s-2 12-9 12-14-6-13-15 10-16 20-14 17 11 15 21-12 19-24 18"
      />
      <circle className="i-lifeless" cx="32" cy="32" r="8" />
      <circle className="i-ink" cx="13" cy="12" r="3.5" />
      <path className="i-dune" d="M16 15 24 24" />
    </Icon>
  );
}
