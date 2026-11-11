import { useEffect, useState } from "react";

type Preference = "system" | "light" | "dark";
const key = "three-body-theme";
const valid = (value: string | null): Preference =>
  value === "dark" || value === "light" ? value : "system";

// Follows the system until a choice is made; the choice stays in this
// browser. Denied storage keeps the choice for the visit.
export function Theme() {
  const [preference, setPreference] = useState<Preference>(() => {
    try {
      return valid(localStorage.getItem(key));
    } catch {
      return "system";
    }
  });
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const dark = preference === "system" ? systemDark : preference === "dark";
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  const choose = (next: Preference) => {
    setPreference(next);
    try {
      if (next === "system") localStorage.removeItem(key);
      else localStorage.setItem(key, next);
    } catch {
      /* Keep the choice in memory if storage is denied. */
    }
  };
  return (
    <div className="theme" role="group" aria-label="Color theme">
      <button type="button" onClick={() => choose(dark ? "light" : "dark")}>
        {dark ? "Light" : "Dark"}
      </button>
      <button
        type="button"
        aria-pressed={preference === "system"}
        onClick={() => choose("system")}
      >
        Auto
      </button>
    </div>
  );
}

export function useDark(): boolean {
  const read = () => document.documentElement.dataset.theme === "dark";
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    setDark(read());
    return () => observer.disconnect();
  }, []);
  return dark;
}
