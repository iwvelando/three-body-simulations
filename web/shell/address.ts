// The address bar, kept in step with what a view shows. Rewriting it adds
// no history entry and keeps what the shell has noted on the entry.
export function setAddress(hash: string) {
  if (location.hash !== hash) history.replaceState(history.state, "", hash);
}
