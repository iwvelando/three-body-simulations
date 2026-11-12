// The address bar, kept in step with what a view shows. Rewriting it adds
// no history entry and keeps what the shell has noted on the entry.
export function setAddress(hash: string) {
  if (location.hash !== hash) history.replaceState(history.state, "", hash);
}

// Where each simulation was last left, for this visit only, so a way back
// from one of its side pages returns to the settings the visitor had and
// not to the defaults. Nothing is stored.
const places = new Map<string, string>();
export function setPlace(id: string, hash: string) {
  places.set(id, hash);
  setAddress(hash);
}
export const placeOf = (id: string) => places.get(id) ?? `#/${id}`;
