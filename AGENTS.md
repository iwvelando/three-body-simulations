# Three-Body Simulations

A strictly static site of simulations inspired by scenes in Liu Cixin's *Remembrance of Earth's Past* trilogy, each built from published science. The first is **Earth without life**, from a scene in *Death's End*: uncheck Life and rerun the planet's history. The intent is a simulation *based on* a scene's premise, with real models a visitor can swap and tune. It is not a test of whether the premise is true, and not a research tool.

## Boundaries

- Book text is copyrighted. Paraphrase; quote at most a brief attributed phrase. The owner's listening transcripts (`book-passage.txt`, `.local/`) stay out of version control.
- The site is an unofficial fan project. Keep the attribution to Liu Cixin and the "unofficial" statement on the science page and in the footer.
- Everything runs in the browser. No server, database, telemetry, analytics or remote requests at run time. Fonts and assets are bundled. Only the theme preference is stored locally (`three-body-theme`); handle denied storage.
- `engine/` is pure Go with no UI or transport dependency. `engine/core` holds what simulations share; each simulation has its own package (`engine/earth`). `engine/api.go` is the JSON front door and stays testable natively. `cmd/wasm` is transport only. `public/worker.js` runs the engine in a classic worker.
- React/TypeScript/Vite lives in `web/`. `web/shell` is the site (routing, registry, engine client, theme); each simulation lives under `web/sims/<id>` and loads lazily.
- **Descriptor-driven controls.** Go's catalog (`engine/earth/catalog.go`) names every aspect, model, parameter, range, default, help line and citation. The interface renders from it and never branches on a model's name. Adding a model is a Go change plus, for a new paper, a reference entry.
- **Sourcing.** Every model's equations and constants come from its primary source, read at implementation time, never from memory. Record the source, what is verbatim and what is simplified in `docs/models.md`. Test each model against a value printed in its paper where one exists. A model with no published quantitative basis must set `Speculative`, and the interface must say so wherever it is in use.
- **Report outcomes as they come out.** Do not tune a preset to an outcome by leaving published ranges without marking the departure speculative. `TestGreenGlassesLifelessEarthDriesOut` records the current calibration result; if a change alters it, update the test, `docs/models.md` and the science page's "How it came out" together.
- Every paper cited anywhere must appear in `web/sims/earth/references.ts` with a link verified to resolve to that paper (check the DOI's title, do not guess DOIs).
- Hosting is live at `https://three-body.isaacvelando.com/`. Infrastructure (S3, CloudFront, ACM, DNS, the deploy role) belongs in `iwvelando/cloud-accounts` (`sites/three-body.isaacvelando.com`), never here. Never deploy locally.

## Adding a simulation

1. Write `engine/<id>` with its own catalog and tests; register it in `engine/api.go` (`simulations` and the dispatch).
2. Add `web/sims/<id>` with a default-exported page taking `SimulationProps`, and an entry in `web/shell/registry.ts`.
3. Give it a science-and-sources page with the scene's attribution and its references.
4. Document it in `docs/`.

Large numeric results (grids, meshes) must not travel as JSON number arrays; return typed arrays from `cmd/wasm`, as the terrain does (`engine.Terrain`, `threeBodyTerrain`). The Earth run's time series and an ensemble chunk's counts are small enough for JSON.

The engine worker cannot abandon a run. Send requests that follow a control through `useLatest` (`web/shell/useLatest.ts`) or guard them with a token, so a dragged slider never queues a run per position, and describe what is on screen from the run that produced it, never from a setting not yet run. Long computations go in chunks with progress and a way to stop (`Chance.tsx`).

## Discovery

Read `README.md`, `docs/architecture.md` and `docs/models.md` before changing model behavior.

## Development

Plan new features and changes affecting more than two modules. Use strict red-green-refactor: write the test, run it and see the expected failure, implement, run to green, then refactor. Native Go tests come before WASM bridge tests; failing Playwright tests come before interface behavior. Keep tests meaningful: independent expected values, not a second copy of the formula.

Invariants the tests hold: identical requests give identical results; coarse and fine resolutions agree; every preset returns the living Earth to today's temperature, CO2 and oxygen; the ocean only shrinks; the Life switch never changes the Sun; errors name the offending field; links are untrusted input validated against the catalog; stale engine replies are dropped.

Use American English. User-facing text is plain and short: say what a control does, no jargon where a common word exists.

## Verification

`npm ci`, `npm test` (Go, WASM bridge), `go test -race ./...`, `npm run build`, `npm run test:browser`, `npm run format:check`; `make check` runs all of them. Browser tests run against `dist/` under the policy in `deploy/content-security-policy.txt` and own port 4197; rebuild before a targeted run. `node scripts/screenshots.mjs <dir>` captures desktop and phone pages in both themes; look at them after layout or globe changes.

The readiness marker is `html[data-engine="ready"]`. Respect reduced motion. On custom radio or checkbox overlays set width and height to 100% explicitly; iOS sizes them differently from desktop WebKit. Anything only a phone can show is reported as needing an on-device check over HTTPS (`make preview-lan`), never as passing.

## Git and deployment

Work on a branch and open a PR; never push to `main` or force-push, and do not commit, push or publish unless asked. The `main` ruleset allows squash merges only and requires the `verify` check, which passes only when `check` (format, vet, Go, WASM bridge, build, Chromium desktop and phone) and `webkit` (iPhone-profile WebKit on macOS) both pass. Merging to `main` verifies again, then the `deploy` job publishes that run's `dist/` through the main-only `production` environment, invalidates CloudFront and checks live headers; `smoke` then runs the `@smoke` tests against the live site (`BASE_URL`). A failure on `main` opens an issue. Keep `@smoke` tests fast and read-only.

The CSP lives in three places and must match exactly: `deploy/content-security-policy.txt` (preview and browser tests send it), `content_security_policy` in cloud-accounts' `sites/three-body.isaacvelando.com/site.tf` (CloudFront sends it), and the deploy job's live-header comparison. Change cloud-accounts first, then this file.

Link previews reuse the page's `<title>` and description word for word; `tests/share.spec.ts` guards the tags and image sizes. `make share-card` re-renders the committed `public/og.png` and `public/apple-touch-icon.png` from a build; do it only when the look changes, and look at both. The canonical URL is `https://three-body.isaacvelando.com/`; the simulations are hash views and share the root sitemap entry.

Dependabot opens weekly grouped updates. Patch and minor updates merge automatically once `Verify` passes and then deploy; majors wait for a review and a manual merge.

Keep generated files (`dist/`, `public/engine.wasm`, `public/wasm_exec.js`, notices) out of version control. Commit the npm lockfile. Update `scripts/build-notices.mjs` when adding a runtime dependency. Leave no machine-specific paths in source or docs.
