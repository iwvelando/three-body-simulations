import type { Catalog } from "./types";

// A study is everything a visitor has set: the Life checkbox, a preset to
// start from, and whatever they changed after choosing it.
export type Study = {
  life: boolean;
  preset: string;
  models: Record<string, string>;
  params: Record<string, number>;
  fine: boolean;
};

export const defaultStudy = (catalog: Catalog): Study => ({
  // The scene opens with the box already unchecked.
  life: false,
  preset: catalog.presets[0].id,
  models: {},
  params: {},
  fine: false,
});

export const isDefault = (s: Study, catalog: Catalog) =>
  !s.life &&
  !s.fine &&
  s.preset === catalog.presets[0].id &&
  !Object.keys(s.models).length &&
  !Object.keys(s.params).length;

export const edited = (s: Study) =>
  Object.keys(s.models).length + Object.keys(s.params).length > 0;

// The models and values in effect: defaults, then the preset, then edits.
export function resolve(s: Study, catalog: Catalog) {
  const models: Record<string, string> = {};
  const params: Record<string, number> = {};
  for (const slot of catalog.slots) models[slot.id] = slot.models[0].id;
  for (const p of catalog.params) params[p.id] = p.default;
  const preset = catalog.presets.find((p) => p.id === s.preset);
  Object.assign(models, preset?.models, s.models);
  Object.assign(params, preset?.params, s.params);
  return { models, params };
}

export const request = (s: Study, life: boolean) => ({
  sim: "earth",
  action: "run",
  life,
  preset: s.preset,
  models: s.models,
  params: s.params,
  resolution: s.fine ? "fine" : "coarse",
});

// Links. A study travels in the address after "#/earth?c=" as base64url
// JSON. A link is untrusted: every key is checked against the catalog and
// every value against its range before it becomes a study.
const maxLink = 8192;

export function encode(s: Study): string {
  const body = {
    v: 1,
    l: s.life ? 1 : 0,
    b: s.preset,
    m: s.models,
    p: s.params,
    f: s.fine ? 1 : 0,
  };
  return btoa(JSON.stringify(body))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

const plain = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Returns null for anything that is not a study this catalog can run.
export function decode(text: string, catalog: Catalog): Study | null {
  if (!text || text.length > maxLink) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(atob(text.replaceAll("-", "+").replaceAll("_", "/")));
  } catch {
    return null;
  }
  if (!plain(raw) || raw.v !== 1) return null;
  const study = defaultStudy(catalog);
  study.life = raw.l === 1;
  study.fine = raw.f === 1;
  if (raw.b !== undefined) {
    if (!catalog.presets.some((p) => p.id === raw.b)) return null;
    study.preset = raw.b as string;
  }
  if (raw.m !== undefined) {
    if (!plain(raw.m)) return null;
    for (const [slot, model] of Object.entries(raw.m)) {
      const known = catalog.slots.find((s) => s.id === slot);
      if (!known || !known.models.some((m) => m.id === model)) return null;
      study.models[slot] = model as string;
    }
  }
  if (raw.p !== undefined) {
    if (!plain(raw.p)) return null;
    for (const [id, value] of Object.entries(raw.p)) {
      const spec = catalog.params.find((p) => p.id === id);
      if (
        !spec ||
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < spec.min ||
        value > spec.max
      )
        return null;
      study.params[id] = value;
    }
  }
  return study;
}
