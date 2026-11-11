# Models and sources: Into two dimensions

From the last part of *Death's End*: space loses a dimension, and everything that touches the plane is laid out flat on it, nothing overlapping and nothing hidden. The novel gives a few numbers and no mechanism. **Every model in `engine/flat` is `Speculative`**, and each view says so at all times. What is not invented is the bodies' sizes and layers, the snow-crystal model and the mathematics of the flow.

Lengths are kilometers and times seconds unless a parameter says otherwise.

## The rules

| Part | What it does | Status |
|---|---|---|
| The law | Flat area = volume ÷ `sheet.thickness` h. With `kept: mass`, area = mass ÷ (1000 kg/m³ · h), so a layer counts for its density over water's. | **Invented.** |
| The plane's advance | Rises through a body at `2 R☉ / plane.hour`, so the Sun takes the novel's hour. | **Invented**; the hour is the novel's. |
| Landing: shell by shell | Each spherical shell becomes a ring, core in the middle. During the fall only the part of each shell already under the plane is laid out: of the shell at radius s with the plane at height z, the cap `2πs(z + s)`. | **Invented**, after the novel's ringed planets. |
| Landing: spreading pool | Matter spreads from where it touches and pushes earlier matter outward without squeezing it. In the limit of a sheet much thinner than the body, a slice is pushed out by everything that went in after it: `πρ² = (volume entered after) / h`. First in ends at the rim; each ring is a whole slice, about one ring per h of depth. | **Invented**, after the novel's melting ship. The time matter takes to get out from under the body is taken as none. |
| The flow a picture rides | The pool as an incompressible, irrotational flow fed over the footprint. A line feeding each side: `u = (1/π)·conj(ln((ζ+1)/(ζ−1)))`. A rectangle of half-sides a, b: `u = (1/2π)∬(r − r′)/|r − r′|²`, in closed form. Paths are followed by fourth-order Runge-Kutta with steps scaled to the distance from the line's ends or the rectangle's corners. The footprint is steady, so paths are fixed and the strip between two paths gains equal area in equal time. | Standard potential flow; **applying it here is invented.** |
| A picture, edge first | The picture stands on the plane. Each row is fed out at `depth/2h` times its height to each side: the front half of the depth to one side, the back half to the other. | **Invented.** |
| A picture, face down | Every sheet of the depth is fed in over the same rectangle. All the picture along one path out arrives at one point of the edge, so each of 192 places around the edge carries that path's average; the bands outside ride the same flow for `depth/h` rectangles of area. If the sheet is thicker than the picture it cannot cover its own footprint and stays, at a cover of `depth/h`. | **Invented.** |
| A picture buried in Pluto | It stands upright in the crust at the equator while Pluto spreads. Its slice becomes the ring at `ρ = √(⅔R³/h)`. It is drawn out `ρ/s` times around the ring (s its distance from the axis) and `R²/2ρh` times across it, and is `2·s·depth/R²` of the matter there: everything on its line to the axis lands with it. | **Invented**; follows from the pool. |
| The reader | The flat picture is recorded as `reader` dots a side, each the mean of four samples and stored in 8 bits. Restoring looks up where each dot of the original went and reads the record there. Score = 1 − (mean error) / (mean error of guessing the picture's mean color). | **Invented.** |
| The sky | Each body flattened where it stands on a circular orbit. Seed 0 is an arrangement chosen to give the novel's order of falling (Neptune, Saturn, the Earth, Mercury, the Sun, Venus and Mars, with Uranus on the far side); other seeds shuffle. The plane spreads evenly from a point on Neptune's orbit, so order is distance from there. | **Invented**; the order is the novel's. |

## Bodies

Radii, masses and distances are NASA's Planetary Fact Sheets. A layer marked schematic says why on the page.

| Body | Layers | Source |
|---|---|---|
| Earth | Inner core 1221.5 km, outer core 3480, mantle 6346.6, crust 6368, ocean 6371; densities by integrating the density polynomials. | Dziewonski & Anderson 1981, Table I. Verbatim. |
| Sun | Core to 0.25 R (convention, schematic), radiation zone to 0.713 R, convection zone. Mass inside each (48.17%, 97.56%) by integrating Model S's density table. | Christensen-Dalsgaard et al. 1991 (depth 0.287 R); Model S, Christensen-Dalsgaard et al. 1996. |
| Mercury | Core to 2020 km at 6980 kg/m³; 3380 kg/m³ above. | Hauck et al. 2013. |
| Mars | Core to 1830 km at 6000 kg/m³ (the middle of the paper's 5.7 to 6.3); the rest of the mass above. | Stähler et al. 2021. |
| Jupiter | Metallic hydrogen to 0.80 R holding 0.85 of the mass; no separate core. | Guillot 1999, sections 5.1 and 5.3. |
| Saturn | Transition at 0.50 R holding 0.5 of the mass; core a tenth of the mass, its radius schematic (assumes 10 g/cm³). | Guillot 1999. |
| Uranus | Model U1: envelopes meet at 0.772 R (0.913 of the mass); core 0.61 Earth masses at 0.176 R, from its Table 3. | Nettelmann et al. 2013. |
| Neptune | Model N1: envelopes meet at 0.927 R (0.953 of the mass); core 3.15 Earth masses. The paper gives the core no size; schematic, set so the mantle is the 20,000 km the novel gives. | Nettelmann et al. 2013; the novel. |
| Venus | The Earth's core proportions, scaled. Schematic. | none |
| Pluto | Rock at 3.5 g/cm³ under ice at 0.95, sized to its mean density. Schematic. | none |

Each body also carries a `surface`: a manner of drawing (star, rock, earth, cloud, bands), colors, and whether it has a spot, rings or white poles. Where NASA has published a map of the body, the page wraps that map around the ball instead (`public/planets`, below); the description is what shows until the map loads, and for the Sun and Uranus, which have none here. Nothing is worked out from either. Saturn's rings are drawn until the planet's middle goes under and are not flattened.

| Map | From |
|---|---|
| Venus, Mars, Jupiter, Saturn, Neptune, Pluto | NASA 3D Resources, "Images and Textures" (github.com/nasa/NASA-3D-Resources), which NASA publishes as free and without copyright. Venus is Magellan's radar map of the surface, not the clouds a camera sees. |
| Earth | NASA's Blue Marble (Visible Earth, image 57730: land, ocean and ice, no cloud), NASA Goddard Space Flight Center. Taken from the copy on Wikimedia Commons, because NASA's own server did not answer at the time. Commons labels its copy CC BY-SA 3.0, which the credit above also satisfies. |
| Mercury | MESSENGER's global mosaic (NASA Photojournal PIA17230), NASA/Johns Hopkins APL/Carnegie Institution, public domain; from the copy on Wikimedia Commons. |

All are reduced to at most 1,024 by 512 pixels.

Each preset may name the body its statement is about (`focus`): the Sun for the clock, the Earth for the snowflakes, Jupiter for the sky. The page turns to it when the preset is chosen.

## Snow crystals

Reiter 2005, as the paper states it: a hexagonal lattice of real values; a cell is receptive if it is ice (≥ 1) or touches ice; receptive cells keep their value and gain γ; the rest diffuses with weight 1/2 on the cell and 1/12 on each neighbor (α = 1) and is added everywhere; one seed of ice in a background β held fixed beyond a round boundary. Verbatim. Crystals are grown at β from 0.30 to 0.65 and γ from 10⁻⁴ to 10⁻²·³, in the paper's dendrite corner. How large they are drawn is the width of the ocean's ring, which is the model's; that the ocean freezes this way is the novel's.

## Checks

`engine/flat/*_test.go`. Expected values are independent of the engine's formulas:

- PREM's layers add up to the 5.974 × 10²⁴ kg the paper prints; the Sun's and Mercury's to NASA's masses.
- Area × thickness is the sphere's volume under both landings; by mass, the Earth's area is its mass over 1000 kg/m³ · h.
- The Sun crosses its own width at 30 s, its rim at R/30; a thin outer shell's ring is `volume / 2√(π h V)` wide.
- Spreading: half the Earth is in the pool at half time; bands never cross; the rim never retreats; the rim band has no core in it.
- Reiter: nothing grows from nothing; with γ = 1 and β = 0 the plate after k steps has 1 + 3k(k+1) cells; a dendrite is six-fold and mostly gaps.
- The rectangle's field against a direct sum over its area; the line's field near and far; a strip between two paths gains its width in area per unit fed, out to a million units.
- A picture's area is its volume over h; edge first it spans 2√(area/π); the buried stretch and dilution against hand-worked values.
- Identical requests give identical replies; coarse and fine frames agree; errors name the field.

## How it came out

Recorded by `TestFlatPresets`, `TestStarryNightSky` and the painting tests. Each preset is the thickness one statement in the novel asks for.

| Preset | Thickness | From | Then |
|---|---|---|---|
| The Sun's thirty seconds | 192 km | Flat Sun wider than the Sun 30 s into an hour's fall. | Rim 23,200 km/s (the novel: twenty thousand). Flat Sun 0.65 AU across, flat Earth 85,000 km, its ocean ring 30 km wide. A person 0.7 mm. Planets cover 0.00002% of the space inside Neptune's orbit. A painting cannot spread. |
| Snowflake sea | 8.5 m | The Earth's ocean ring 4,500 km wide. | Flat Earth 12.7 million km across; flat Sun 97 AU across, crossing its own width in 0.2 s at 3.5 million km/s. |
| Starry Night | 3.3 m | Flat Jupiter and Saturn as wide as the gap between them. | Planets cover 1.1% of the space inside Neptune's orbit; the flat Sun, 156 AU across, lies over all of them. Ocean ring 7,200 km. |
| Every atom side by side | 1 Å | Nothing hidden, down to particles. | A person 30 km across, a 92 cm painting 2.9 km. Flat Sun about 450 light-years across. |

The snowflakes and the sky nearly agree with each other; neither agrees with the clock or with the detail. Shell by shell gives the planets' rings and somewhere for snow; the spreading pool gives the melting ship and no ocean ring.

Under the pool, with the 64 × 48 test picture on a sheet one atom thick and a reader of 512 dots: alone and edge first, 98% comes back; face down, 51%; buried in Pluto, none (one part in 590 million, spread over 82,000 km). The bundled sample painting, with finer detail, comes back 82% edge first.

## Not built

Shapes that are neither round nor a thin slab (a person, a ship, the space city); what overlapping flat bodies do to each other; anything that happens on the plane afterwards (the flat Sun's zones and its dying, gravity in the plane, the lit edges, the ocean's vapor); the time matter spends under a body. The light, sparks, flames and brush strokes on the pages are drawn from the novel's description, not computed.

## The sample picture

`public/starry-night.jpg` is Vincent van Gogh, *The Starry Night* (1889), from the Google Art Project scan on Wikimedia Commons, reduced to 640 pixels. The painting is in the public domain.
