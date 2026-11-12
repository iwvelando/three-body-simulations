import { useCallback, useEffect, useState } from "react";
import { setAddress } from "../../shell/address";
import type { Catalog } from "../../shell/catalog";
import {
  decode,
  defaultStudy,
  encode,
  isDefault,
  type Study,
} from "../../shell/study";

// The part of the address after "?", as the page was opened.
export const query = (rest: string) =>
  new URLSearchParams(rest.includes("?") ? rest.slice(rest.indexOf("?")) : "");

export const unreadable =
  "That link could not be read, so this is the default instead.";

// A view's settings, kept in step with the address: `extra` holds the
// view's own keys (already checked by the view), and the study travels
// as "c". A link is untrusted and is validated against the catalog.
export function useStudy(
  catalog: Catalog,
  path: string,
  rest: string,
  extra: Record<string, string>,
  doubt = false,
) {
  const [arrival] = useState(() => {
    const text = query(rest).get("c");
    if (text === null)
      return { study: defaultStudy(catalog), notice: doubt ? unreadable : "" };
    const study = decode(text, catalog);
    return study && !doubt
      ? { study, notice: "" }
      : { study: study ?? defaultStudy(catalog), notice: unreadable };
  });
  const [study, setStudy] = useState<Study>(arrival.study);
  const [notice, setNotice] = useState(arrival.notice);
  const [copied, setCopied] = useState(false);
  const extras = new URLSearchParams(
    Object.entries(extra).filter(([, v]) => v !== ""),
  );
  if (!isDefault(study, catalog)) extras.set("c", encode(study));
  const tail = extras.toString();
  // Keep the address in step, without adding history entries.
  useEffect(() => {
    const hash = tail ? `${path}?${tail}` : path;
    setAddress(hash);
    setCopied(false);
  }, [path, tail]);
  const change = useCallback((update: (s: Study) => Study) => {
    setNotice("");
    setStudy(update);
  }, []);
  const reset = useCallback(
    () => change(() => defaultStudy(catalog)),
    [change, catalog],
  );
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
    } catch {
      setNotice("Copying was blocked. Copy the address from the address bar.");
    }
  }, []);
  return { study, change, reset, notice, setNotice, copied, copy };
}

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
