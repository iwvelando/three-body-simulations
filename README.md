# Three-Body Simulations

Simulations inspired by scenes in Liu Cixin's *Remembrance of Earth's Past* trilogy, built from published science where there is any, and run entirely in the browser. An unofficial fan project.

## Earth without life

In *Death's End* a researcher unchecks a box marked "life" in a simulation's configuration panel and reruns the Earth's history; the planet comes back dry and orange. This site rebuilds that panel. A Life checkbox, a few sliders and a menu of interchangeable published models drive a 4.5-billion-year history of temperature, carbon dioxide, oxygen and water, shown on a globe, a timeline and four charts that compare the living and lifeless Earth.

A second view zooms in to a patch of land and lets rain, creep and vegetation work on it: three mountains, one of them bare, and a crater.

A third asks the question the scene opens with, whether a habitable planet is luck: thousands of random planets, each run against random accidents, after Tyrrell (2020).

It is a simulation based on the scene's premise, not a test of it. With published models alone, set where life matters most, the lifeless Earth here ends scalding but wet; the book's dry planet also needs the character's own guess about unshielded water loss, which the site marks speculative. See [the models](docs/models.md).

## Mozi's machine

In *The Three-Body Problem* a player who goes by Mozi explains an unreliable sun with a machine: the universe is two copper shells in a sea of fire, the sun a hole in the outer shell cast onto the inner one, and a clerk at the center records it to make a calendar of Stable and Chaotic Eras. This page builds that machine. One view is the clerk's whole sky; the other is the machine cut open, with layers you can peel away. Each of Mozi's answers to Wang's objections is a switch you can take back.

The novel gives no numbers, so everything about this machine is invented and marked speculative. It is the machine alone, not a test of it against a real sky. See [its models](docs/models-mozi.md).

## Into two dimensions

At the end of *Death's End* a slip of flat space arrives and the Solar System falls into it. This page drops things into that plane: the Sun and each planet, a picture of your own, and the whole system at once. One number, how thin flat matter is spread, sets every size; two rules for how matter lands can be swapped. A picture can be let fall alone or left buried in Pluto, then restored by running the rule backwards.

Everything about the fall is invented and marked speculative; the bodies' layers and the snow crystals are from published work. The novel's own numbers ask for four different thicknesses, and the page says so. See [its models](docs/models-flat.md).

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
| `engine/mozi` | Mozi's machine: shells, gears, the clerk's calendar |
| `engine/flat` | The fall into two dimensions: bodies, the sky, snow crystals, a picture's flow |
| `engine/api.go` | JSON front door for every simulation |
| `cmd/wasm` | WebAssembly transport only |
| `web/shell` | Site shell, simulation registry, engine client |
| `web/sims/earth` | The Earth page: globe, timeline, panel, charts, sources |
| `web/sims/mozi` | Mozi's machine: the clerk's sky, the cutaway, the calendar |
| `web/sims/flat` | Into two dimensions: a body falls, a painting, the whole sky |
| `docs/` | [Architecture](docs/architecture.md), models and sources for [Earth](docs/models.md), [Mozi's machine](docs/models-mozi.md) and [the fall into two dimensions](docs/models-flat.md) |

More simulations from the trilogy are meant to follow; [AGENTS.md](AGENTS.md) says how to add one.

## Hosting

Live at <https://three-body.isaacvelando.com/>. Merging to `main` verifies, deploys the built `dist/` to S3 behind CloudFront, and smoke-tests the live site; the infrastructure is in `iwvelando/cloud-accounts`. Links shared in chat apps show a card: `public/og.png`, referenced by absolute URL because scrapers need one, re-rendered with `make share-card`.

## License

MIT. Third-party notices are generated into the build. The trilogy and its scenes belong to Liu Cixin and his publishers.
