export { query, unreadable, useStudy } from "../../shell/link";

const views = [
  { id: "body", href: "#/flat", label: "A body falls" },
  { id: "painting", href: "#/flat/painting", label: "A painting" },
  { id: "sky", href: "#/flat/sky", label: "The whole sky" },
] as const;

export function Tabs({ current }: { current: (typeof views)[number]["id"] }) {
  return (
    <nav className="flat-tabs" aria-label="Views">
      {views.map((v) => (
        <a
          key={v.id}
          href={v.href}
          aria-current={v.id === current ? "page" : undefined}
        >
          {v.label}
        </a>
      ))}
    </nav>
  );
}

// Shown on every view: nothing here has a published basis.
export function Caveat() {
  return (
    <p className="caveat" data-testid="speculative">
      <strong className="spec">Speculative.</strong> The novel gives a few
      numbers and no mechanism. The rules that flatten things here were invented
      for this site. <a href="#/flat/science">The scene and what is invented</a>
    </p>
  );
}
