# Models and sources: Earth without life

Each aspect of the planet is a slot; each slot offers the models below. The first is the default (the Green Glasses preset). Full citations with links are in `web/sims/earth/references.ts` and on the site's science page.

"Verbatim" means the equation and constants are the source's. Tests in `engine/earth/models_test.go` check each against a value from its paper where one is printed.

| Slot | Model | Source | Status |
|---|---|---|---|
| Sun | Brightening | Gough 1981: `L = 1/(1 + 0.4(1 − t/4.57))` | Verbatim. Planet taken to form 0.07 Gyr after the Sun. |
| Sun | Constant | none | Control. |
| Climate | Radiative-convective fit | Krissansen-Totton, Arney & Catling 2018, SI eq. S28; 25 coefficients as published with the paper's code | Verbatim inside 1e-4 to 10 bar CO2 and 0.7 to 1.1 of today's sunlight. Outside, extended along the edge slope, never downward; runs that go there are flagged `extrapolated`. |
| Climate | Fixed sensitivity | Logarithmic CO2 forcing | Generic; passes through the same present state. |
| Volcanoes | Cooling interior | K-T 2018 SI eqs. S8, S9: `Q = (1 − t/4.5)^−n`, outgassing ∝ `Q^m`; ranges n 0 to 0.73, m 1 to 2, modern 6 to 10 Tmol/yr | Verbatim. Their runs start 4.0 Ga; earlier times hold the 4.0 Ga value. |
| Rock weathering | Continents only | K-T 2018 eq. 1: `F = f_bio f_land F_mod (pCO2/pCO2_mod)^α exp(ΔT/Te)`; α 0.1 to 0.5, Te 10 to 40 K. Feedback of Walker, Hays & Kasting 1981 | Verbatim form. |
| Rock weathering | Continents and seafloor | K-T 2018 SI eq. S3, modern seafloor flux 0.45 Tmol/yr, spreading exponent 0 to 2, activation energy 60 to 100 kJ/mol, deep-ocean gradient 0.8 to 1.4 | **Simplified**: pH dependence dropped (their exponent's range includes 0), no ocean chemistry, pore temperature 285 K today (assumed) warming with the surface. |
| Life and weathering | Stepwise | Lifeless factor `1/B` with B 10 to 1000 from Schwartzman & Volk 1989; living history K-T 2018 SI eq. S7 | B is their enhancement factor, used inside the K-T weathering law, which has the same form as their eq. 1 (their α 0.3 to 0.4; β + γ = 0.073 per K, an e-fold per 13.7 K). `TestSchwartzmanVolkWarming` reproduces their roughly 15, 30 and 45 °C of warming for factors 10, 100 and 1,000 with those settings. Their runoff cap is not applied. |
| Life and weathering | Productivity feedback | Lenton & von Bloh 2001 eq. 1; productivity from Franck, Bounama & von Bloh 2006 eqs. 12 to 14 and Table 1 | **Simplified**: the soil-CO2 (H⁺ activity) factor is omitted. Franck's printed parabola has a leading "1 −" that contradicts its text; the form that vanishes at the window's ends is used. |
| Life and weathering | No effect | Null case; compare Gilbert-Janizek et al. 2026 | |
| Continents | Same either way | K-T 2018 SI eq. S6; Archean land 0.1 to 0.75 of today, growth 2 to 3 Ga | Verbatim. |
| Continents | Life grows continents | Höning et al. 2014: stable states at 40% and 3% continental cover | **Parameterized**: the lifeless Earth relaxes toward the dry state's area on a set timescale; their box model is not implemented. |
| Oxygen | Two-step rise | Lyons, Reinhard & Planavsky 2014 | Illustrative staging, not a model. Affects air pressure and the shield only. |
| Nitrogen | Fixed | Stüeken et al. 2016 find large swings need life | Parameter only. |
| Water loss | Cold trap and diffusion | Cold-trap water from the moist adiabat as Wordsworth & Pierrehumbert 2014 prescribe; escape `2.5e13 f_T` atoms/cm²/s, Catling & Kasting 2017 eq. 5.57 | The adiabat is the textbook pseudoadiabat (W&P cite but do not print it), checked against W&P's printed thresholds (340 K at 1 bar, 295 K at 0.1 bar, 255 K at 0.01 bar) and the classic 3e-3 benchmark. CO2 counts as non-condensing air. No energy limit on escape. |
| Unshielded loss | Steady stripping | The novel | **Speculative.** A set loss while nothing shields the air: ozone above 1e-5 of today's oxygen (Goldblatt, Lenton & Watson 2006) or, on a living Earth before oxygen, organic haze (Arney et al. 2016). Gunell et al. 2018 argue against magnetic shielding mattering. |
| Molten start | Exponential cooling | Timescale after Zahnle et al. 2007 | Display only. |

## Calibration result

Recorded by `TestGreenGlassesLifelessEarthDriesOut`. Values at the present day:

| Run | Lifeless Earth |
|---|---|
| Skeptic | temperate, 28 °C, oceans kept |
| Middle of the road | temperate, 37 °C, oceans kept |
| Green Glasses without stripping (B = 300, continents only) | hot, 88 °C, 2.4 bar CO2, oceans kept |
| Same, B = 1000, weakest published thermostat | 160 to 240 °C; at most 0.5 oceans lost |
| Green Glasses (adds 0.3 oceans/Gyr of speculative stripping) | dry 0.9 billion years ago; CO2 then accumulates |

Published models inside their published ranges did not dry the lifeless Earth: the bars of CO2 that make it hot also dilute water vapor at the cold trap. The default preset therefore includes the speculative term, labeled as such. Every preset returns the living Earth to 14 °C, 280 ppm CO2 and 0.21 bar O2. Under Green Glasses the planet starts with 1.1 oceans, because the stripping also acts for the 0.3 Gyr before life begins.

## The surface up close (`engine/earth/terrain`)

A 96 by 96 grid of 100 m cells, edges held at base level.

| Part | Source | Status |
|---|---|---|
| Fluvial erosion `∂z/∂t = −K_v (A P)^m S^n`, m 0.6, n 0.7 | Schmid et al. 2018 eqs. 5 to 10, Table 1 | Verbatim form. Their critical shear stress is omitted, and the absolute bare-ground erodibility is a free scale here (default 1e-6), since their `k_e` carries shear-stress units. |
| Vegetation and erodibility: `n_v = n_vr V`, `F_t = (n_s/(n_s+n_v))^1.5`, `K_v ∝ (n_s+n_v)^0.6 F_t`; n_s 0.01, n_vr 0.6 | Schmid et al. 2018 eqs. 7 to 9, after Istanbulluoglu & Bras 2005 | Verbatim; relative to bare ground this is `(n_s/(n_s+n_v))^0.9`, about 1/40 at full cover. |
| Creep `K_d = K_b exp(−0.3 V)`, K_b 0.02 m²/yr | Schmid et al. 2018 eq. 4 | Verbatim. Not reduced on a dry world, which probably overstates how fast a dry crater softens. |
| Implicit solution, low cells first, Newton iteration | Braun & Willett 2013, as given by Barnes 2018, Algorithm 6 | The iteration is kept inside its bracket, because n < 1 makes plain Newton overshoot. Steepest-descent (D8) routing. |
| Closed basins | none | **Added here**: rock eroded upstream settles in a basin up to its brim. Without it nothing could fill a crater. The rest of the model has no deposition. |
| Rain from the planet | Schwartzman & Volk 1989: runoff ∝ `exp(0.017 ΔT)`, capped at 2 | Used by the link from the planet view; none once the oceans are gone. |

`TestChannelsReachTheStreamPowerSteadyState` checks that channels settle where incision equals uplift. Outcomes with the defaults: over 2 million years the bare mountain falls from 1,502 m to about 650 m while the two under vegetation stay near 1,390 m; a crater on a rainless world keeps about 290 m of its 500 m rim-to-floor relief after 5 million years, while rain on bare ground erases it.

## Was it luck? (`engine/earth/chance`)

The model of Tyrrell (2020), from the paper's Methods.

| Part | Source | Status |
|---|---|---|
| Planet: 2 to 20 feedback nodes evenly spaced over −10 to 60 °C, each `N(0, 100)` °C per thousand years, linear between; forcing `N(0, 50)` per billion years; expected accidents `U(4000, 20000)`, `U(40, 400)`, `U(0, 5)` per 3 billion years | eqs. 2 to 5, 7 | Verbatim. |
| Accidents: sizes `±N(2, 1)`, `±N(8, 4)`, `±N(32, 16)` °C at random times; start anywhere in range; failure on leaving the range | eqs. 6, 8, 9 | Verbatim, drawn as a Poisson process in time, which is the same thing as Poisson counts at uniform times. |
| Temperature between accidents, `dT/dt = f(T) + φt` | eq. 1, integrated in the paper with a stiff solver | **Simplified**: the planet is taken to reach rest at once. Feedbacks act in thousands of years; accidents come hundreds of thousands of years apart. |
| Skipping harmless accidents | none | A speed-up only: while the planet rests more than 9 °C (32 °C) inside its basin, small (and medium) accidents are not drawn. `TestShortcutChangesNothingButTheTime` compares with it off. |
| Life's thermostat, `−k (T − T_comfort)` added to the warming rate | none | **Speculative**, this site's addition; off at k = 0. The same planets meet the same accidents with and without it. |

Checks against the paper: its designed planets (always restoring: every run survives; no feedbacks: none; outward-pushing: none), and its headline. The paper found 8,710 of 100,000 planets (8.7%) habitable at least once in 100 runs and one every time; this engine finds 8.6% of 10,000 and none every time. `TestPopulationMatchesThePaper` holds the share between 7% and 10.5% for 4,000 planets. With the default thermostat of 10, about 86% of those planets last at least once.

## Not yet implemented

Sourced or identified but not built: an oxygen model (Goldblatt et al. 2006), a nitrogen model (Stüeken et al. 2016), Höning et al.'s box model, a steam-atmosphere climate, energy-limited escape; sediment transport and deposition on the surface patch.
