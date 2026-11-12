import { useEffect, useState } from "react";

// Whether a media query holds, kept up to date.
export function useMedia(query: string): boolean {
  const [holds, setHolds] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setHolds(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return holds;
}
