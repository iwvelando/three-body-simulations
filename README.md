# Three-Body Simulations

Simulations inspired by scenes in Liu Cixin's *Remembrance of Earth's Past* trilogy, built from published science and run entirely in the browser. An unofficial fan project.

## Earth without life

In *Death's End* a researcher unchecks a box marked "life" in a simulation's configuration panel and reruns the Earth's history; the planet comes back dry and orange. This site rebuilds that panel. A Life checkbox, a few sliders and a menu of interchangeable published models drive a 4.5-billion-year history of temperature, carbon dioxide, oxygen and water, shown on a globe, a timeline and four charts that compare the living and lifeless Earth.

A second view zooms in to a patch of land and lets rain, creep and vegetation work on it: three mountains, one of them bare, and a crater.

A third asks the question the scene opens with, whether a habitable planet is luck: thousands of random planets, each run against random accidents, after Tyrrell (2020).

It is a simulation based on the scene's premise, not a test of it. With published models alone, set where life matters most, the lifeless Earth here ends scalding but wet; the book's dry planet also needs the character's own guess about unshielded water loss, which the site marks speculative. See [the models](docs/models.md).

## Run it

Node 22.12+ and Go 1.25+.

```sh
npm ci
npm run dev        # builds the engine, serves on 127.0.0.1
make check         # format, vet, Go and bridge tests, build, browser tests
make preview-lan   # HTTPS on the local network, for a phone
```

## Layout

| Path | What |
|---|---|
| `engine/core` | Model and parameter descriptors, request validation |
| `engine/earth` | The Earth models, catalog, presets and coupled run |
| `engine/earth/terrain` | The surface patch: erosion, creep and vegetation |
| `engine/earth/chance` | The ensemble of random planets |
| `engine/api.go` | JSON front door for every simulation |
| `cmd/wasm` | WebAssembly transport only |
| `web/shell` | Site shell, simulation registry, engine client |
| `web/sims/earth` | The Earth page: globe, timeline, panel, charts, sources |
| `docs/` | [Architecture](docs/architecture.md), [models and sources](docs/models.md) |

More simulations from the trilogy are meant to follow; [AGENTS.md](AGENTS.md) says how to add one.

## Hosting

Live at <https://three-body.isaacvelando.com/>. Merging to `main` verifies, deploys the built `dist/` to S3 behind CloudFront, and smoke-tests the live site; the infrastructure is in `iwvelando/cloud-accounts`. Links shared in chat apps show a card: `public/og.png`, referenced by absolute URL because scrapers need one, re-rendered with `make share-card`.

## License

MIT. Third-party notices are generated into the build. The trilogy and its scenes belong to Liu Cixin and his publishers.
