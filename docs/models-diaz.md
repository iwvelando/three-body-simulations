# Models and sources: Mercury into the Sun

From the scene in *The Dark Forest* where Rey Diaz's plan is laid bare: bombs slow Mercury until it falls into the Sun, the Sun throws out a spiral of its own matter, and the spiral drags the other planets in one after another. Each step has a model from published physics. Three steps are not allowed by it, and each of those also has a model invented for this site and marked `Speculative`. The page shows the caveat whenever one is in use; a run with none says so instead.

Units are SI inside the engine. Replies give distances in AU, times in seconds after the push, speeds in m/s and masses in kg.

## Bodies and orbits

| What | Source |
|---|---|
| Masses and radii of the Sun and planets; the Sun's GM, radius, sidereal rotation (609.12 hours) and tilt (7.25°); the Earth's atmosphere (5.1 × 10¹⁸ kg) and hydrosphere (1.4 × 10²¹ kg) | NASA Planetary Fact Sheets. Verbatim. |
| Orbits: a, e, I, L, the longitudes of perihelion and node at J2000 and their rates, and the steps from elements to a place in the J2000 ecliptic frame | JPL, *Approximate Positions of the Planets*, Table 1 (1800 to 2050), after Standish & Williams. Verbatim; the Earth-Moon barycenter stands for the Earth. Kepler's equation is solved by halving the interval instead of the page's Newton steps, so that a path with e = 1 also works. |
| The Sun's density from 1.0007 to 0.05 of its radius, 33 rows | Model S, Christensen-Dalsgaard et al. 1996, the published table `cptrho.l5bi.d.15c`. Rows copied verbatim; between rows the density is taken to change by equal ratios over equal heights. |
| Base of the convection zone, 0.713 R | Christensen-Dalsgaard et al. 1991. |

The spiral lies in the Sun's equator, which leans 7.25° from the ecliptic. Which way it leans is not modeled.

## The models

| Aspect | Model | What it does | Status |
|---|---|---|---|
| The bombs | Buried charges | Slowing = `coupling · count · yield / (v_esc · M)`, with a megaton at the 4 × 10⁶ J/kg of TNT the report uses. | Ahrens & Harris 1992 for the principle (only ejecta faster than escape speed moves the body) and for the coupling range (0.2% to 1.8% at the surface, most of the energy when buried). The formula is **a ceiling derived here**, not theirs: ejecta thrown at v keeps `√(v² − v_esc²)`, so momentum per joule is greatest at `v = √2·v_esc`, where it is `1/v_esc`. Their cratering laws are fitted to weak bodies a few kilometers across and are not stretched to a planet. |
| | As strong as the plan needs | Mercury loses exactly the speed that brings its path within `bombs.target` solar radii of the Sun's center. | **Invented.** |
| Mercury's path | (no choice) | One push at aphelion, the cheapest place. Before and after it Mercury follows a two-body orbit: vis-viva for the speeds, Kepler's equation for the times. | Newtonian mechanics. Simplified: the push is one moment. |
| What the Sun throws out | No more than the fall pays for | Ejected mass = `share · E / (½ v_esc² · ⟨f²⟩)`, E the impact's energy of motion and ⟨f²⟩ the mean square of the launch speeds as shares of escape speed, so the gas carries exactly `share · E`. | Energy bookkeeping. The stopping depth beside it uses Brown, Carlson & Toner 2015: a body takes up a share C_D = 0.5 of the momentum of the gas it meets, so its speed falls by e once `C_D · column / cos(angle)` equals its own mass per unit area. Simplified: no ablation, flattening or bursting, which that paper finds decide the fate of the comet-sized bodies it treats. |
| | The wound erupts | Ejected mass = `gain · E / ½ v_esc²`, never more than the Sun has left. | **Invented.** |
| What the gas does | Falls back or leaves | 1,500 parcels leave within a day at speeds spread evenly over `speed · (1 ± spread)` of escape speed, inside a cone of half-angle 30° around the impact site (the cone is a choice, not a published value). Each then follows a radial Kepler path in closed form. A planet's "nudge" is the momentum of all the gas that reaches its orbit, spread over the cone there and caught over the planet's disc with gravitational focusing: the most a jet aimed square at it could do. | Kepler's laws. |
| | A standing spiral | Parcels leave the turning site one after another, move out at `cloud.speed` and stop when the last has left. The edge is `cloud.reach · (ΣE / E₀)^⅓`, E₀ the energy of a planet of 4% of the Earth's mass arriving at escape speed. Density `M / (4π · flare · edge · r²)`. The gas does not orbit. | **Invented.** The reach is the novel's example; the cube root holds the density at the edge fixed. |
| Drag on a planet | Friction and wake | Force = `½ C ρ πR² u² + 4π(GM)² ρ / u² · ln(flare · a / R)`, u the planet's orbital speed, since the gas stands still. The orbit shrinks at `da/dt = −2aF / (m u)`. | Adachi, Hayashi & Nakazawa 1976, equation 3.5 and C = 2 far above the speed of sound; Ostriker 1999, equation 1, her steady supersonic limit, with the body's radius as r_min and the gas's half-thickness as r_max. The decay rate is the energy balance of a circular orbit. Simplified: orbits are treated as circles while they decay, the gas's temperature (and so the Mach number) is not modeled, and the planets do not pull on one another. |

A planet that spirals in arrives on a circle at the speed of an orbit skimming the Sun, so its impact carries `½ m · GM/R`, half of what a straight fall would.

The Earth's two readouts are bounds, not models. Its air is "met" when the gas it has swept equals the mass of its atmosphere. Its sea is "boiled" when the work done by drag equals the heat to take 1.4 × 10²¹ kg of water from 15 °C to the boil and vaporize it (4186 J/kg·K and 2.257 × 10⁶ J/kg, textbook values), as if all of that heat went into the sea.

## Checks

`engine/diaz/diaz_test.go`. Expected values are independent of the engine's formulas:

- Mercury's aphelion distance and speed there against NASA's printed 69.818 × 10⁶ km and 38.86 km/s; its period against 87.969 days.
- The speed to lose, 32.73 km/s, by hand from vis-viva. A million bombs at the ceiling, 0.570 mm/s, by hand. The ceiling is not below Ahrens & Harris's own megaton on a 1 km asteroid.
- The Earth at J2000: 0.9833 AU out, at longitude 100.38°, in the ecliptic.
- Gas at 0.9 of escape speed turns back at 5.263 radii, half way through a flight of 41,128 s; at 1.1 it leaves at √0.21 of escape speed; turning back at 3 AU needs a launch within 0.08% of escape.
- The Sun's column above the base of the convection zone lies between the table's pressure there over gravity at that depth and over gravity at the surface.
- Ostriker's and Adachi's forces against hand values; the decay integrator against `a₀^2.5 / 2.5k`.
- Published ejecta never exceed the impactor's own mass. No orbit ever widens; the gas never draws back. Identical requests give identical replies; coarse and fine agree; errors name the field.
- Every body lies on its orbit's outline, and every number beside the reply is where the reply says.

## How it came out

Recorded by `TestDiazPresets`.

| Preset | What is invented | How it comes out |
|---|---|---|
| Published physics only | Nothing | Mercury must lose 32.7 km/s. A million 200 Mt bombs take off 0.57 mm/s at the very most; the fall needs 5.7 × 10¹³ of them. Perihelion stays 66 solar radii out. Nothing else happens. |
| Grant only the fall | The bombs | Mercury reaches the Sun in 20.7 days at 615 km/s, 45° from straight down. Drag alone would stop it at 0.64 R, under the convection zone. Its energy lifts 0.99 of its own mass; half leaves the Solar System and half is back within days. No spiral. The most the jet could slow the Earth is 0.036 mm/s. |
| The Wallbreaker's telling | The bombs, the eruption (gain 1,000), the standing spiral | Spiral to 3.33 AU. The Earth has met its own air's mass in gas 2.2 years after the push. Venus falls after 167,000 years and its impact takes the edge to 6.8 AU. Jupiter falls next, after 195,000 years, ahead of the Earth and Mars: its wake drag outweighs friction. Edge then 48 AU. Saturn, Uranus and Neptune follow, the last after 209,000 years. Gas outside the Sun: 67% of the Sun's mass. At a gain of a million the eruptions ask for more than the Sun holds. |

The novel's sums, against NASA's masses: Venus, the Earth and Mars are 34.8 times Mercury (the novel: forty); Jupiter is 161 times the four inner planets (the novel: six hundred). The novel has later planets hit harder because they fall from higher; a planet that spirals in hits more softly than Mercury's plunge.

Nothing in the novel fixes the eruption's strength. It sets only how long things take: the planets' fall times scale as one over it.

## Not built

The Earth as a comet and Jupiter's moons; the Sun's own change as it loses mass, and the loosening of every orbit that would follow; the planets' pull on one another; Mercury breaking up; the time the bombs take; orbits rounding as they shrink (each keeps its shape and tilt). De et al. 2023 observed a star swallowing a planet; it is cited on the science page for context and no number is taken from it. The sizes of the bodies, the Sun's glow and the pace of the planets in chapters that cover many orbits are drawn, not computed.
