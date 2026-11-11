# Models and sources: Mozi's machine

From the scene in *The Three-Body Problem* where Mozi shows Wang a copper model of the universe: two nested shells in a sea of fire, a clerk at the center recording the sun. The novel describes the machine in words and gives no numbers, and no published science stands behind it. **Every model in `engine/mozi` is `Speculative`**, and the page says so at all times. Only the geometry is not invented: rotations, a horizon, and where a patch of light falls.

The simulation builds the machine alone. It is not compared with a real sky.

Time is in days; one day is one turn of the main gear. The clerk's frame has z up and the floor as the horizon. The inner shell at rest has radius 1.

| Part | What it does | Status |
|---|---|---|
| Outer shell | Attitude `Rz(swing) · Rx(lean) · Rz(spin)`: the main axle's spin, the axle's lean from upright, the swing of the ring that holds it. The large hole is fixed on the shell `outer.lamp` degrees above its equator. | Geometry. With one gear this is an ordinary sun at latitude `90° − outer.tilt`. |
| Three gear trains | Train k adds `S·rate_k·P_k·sin(2πt/P_k + φ_k)` to the spin (so it changes the rate of turning by up to `S·rate_k` of a day per day), `S·lean_k·sin(…+1.3)` to the lean and `S·swing_k·sin(…+2.6)` to the swing. Rates 0.12, 0.12, 0.10; leans 6°, 6°, 6°; swing 25° on the third; periods 17, 18.1 and 21.7 days. | **Invented.** Chosen so the trains cancel and reinforce on a scale of tens to hundreds of days. |
| Inner shell | Turns steadily on the same lean at `1 − 1/inner.drift` turns a day, so it falls one turn behind every 360 days. With one sphere it is the outer shell. | **Invented.** |
| Breathing | Gap `= gap₀ (1 + B (0.65 sin a + 0.35 sin(a/0.38 + 1)))`, inner radius `1 + 0.12 B sin(a + 0.7)`, `a = 2πt/breath.period`. | **Invented.** |
| The sun the clerk sees | The hole stretches with its shell. Its light fans out by `hole.spread` on each side crossing the gap: patch width `w = hole + 2·gap·tan(spread)`, angular width `2 atan(w / 2R_inner)`, surface brightness ∝ `(hole/w)²`, light at the center ∝ `hole²/R_inner²`. With one sphere the sun is the hole itself and its angular width cannot change. | **Invented** optics, plain geometry. |
| Dark cloud | Dims the light by `exp(−x⁴)` around a passage every `cloud.every` days. Never moves a sunrise. | **Invented.** |
| Flying stars | Specks on fixed circles around the center. They affect nothing. | **Invented**, after Mozi's dismissal of them. |
| Calendar | Sunrises and sunsets are sign changes of the sun's height, sampled 96 (coarse) or 480 (fine) times a day and closed in on by bisection. Each sunrise-to-sunrise cycle records its length, daylight, the sun's widest and the light received (Simpson's rule on height × light), the last against a standard day. | Numerical method. |
| Standard day | The same machine with one steady gear, rigid shells and no cloud. | Definition. |
| The clerk's rule | A day is regular when its length and daylight are within `clerk.tolerance` (10%) of a day and its light within `clerk.mild` (30%) of the standard day's. At least `clerk.run` (20) regular days in a row are a Stable Era; everything else is a Chaotic Era. | **Invented**, after the novel's sense of the words: a Stable Era is when the sun rises and sets on a regular rhythm and the climate is mild. |

## Checks

`engine/mozi/mozi_test.go`. Expected values are independent of the engine's formulas:

- With one gear every day lasts one day and daylight matches the sunrise equation, `acos(−tan(latitude) tan(declination))/π`.
- One sphere: the angle between the sun and a star never changes. Two shells: it changes by more than 20° in 60 days.
- Rigid shells: the sun is 9.219° wide for a hand-worked case. One breathing sphere: the width still never changes.
- The cloud dims days and moves no sunrise. Identical requests give identical replies. Coarse and fine sampling agree. The sky frames cross the horizon at the recorded sunrise.

## How it came out

Recorded by `TestMozisMachineCalendar`. Nothing is calibrated to the novel, which gives nothing to calibrate to.

| Preset | 2,000 days |
|---|---|
| Mozi's machine | 11 Stable Eras and 12 Chaotic; longest Stable Era 79 days; stable 22% of the time; days 18 to 36 hours long. Opens in a Chaotic Era that ends on day 166. |
| Rough seas (currents × 2) | 2 Stable Eras of about 21 days; stable 2% of the time. |
| Perfect clockwork | One Stable Era, all 2,000 days. |

## Not built

A real three-sun sky to test the forecast against; scattered light filling the gap (the cutaway draws one beam); any climate beyond one number for a day's sunlight.
