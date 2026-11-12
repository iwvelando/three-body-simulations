package diaz

import (
	"errors"
	"math"
	"reflect"
	"testing"

	"threebody/engine/core"
)

func mustRun(t *testing.T, q Request) *Result {
	t.Helper()
	r, err := Run(q)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func near(t *testing.T, what string, got, want, tolerance float64) {
	t.Helper()
	if math.IsNaN(got) || math.Abs(got-want) > tolerance*math.Abs(want) {
		t.Errorf("%s: got %g, want %g within %g%%", what, got, want, 100*tolerance)
	}
}

func TestCatalogIsConsistentAndMarksWhatIsInvented(t *testing.T) {
	c := Catalog()
	if err := c.Check(); err != nil {
		t.Fatal(err)
	}
	// The first model of every aspect is the published one; each aspect
	// the novel needs changed also offers an invented one that says so.
	want := map[string][]bool{"bombs": {false, true}, "impact": {false, true}, "cloud": {false, true}, "drag": {false}}
	for _, s := range c.Slots {
		var got []bool
		for _, m := range s.Models {
			got = append(got, m.Speculative)
		}
		if !reflect.DeepEqual(got, want[s.ID]) {
			t.Errorf("%s: speculative flags %v, want %v", s.ID, got, want[s.ID])
		}
	}
	if len(c.Bodies) != 9 || c.Bodies[0].ID != "sun" || c.Bodies[1].ID != "mercury" {
		t.Fatalf("bodies: %v", c.Bodies)
	}
	for _, b := range c.Bodies {
		if b.Surface.Kind == "" {
			t.Errorf("%s has no look", b.ID)
		}
	}
	if c.Presets[0].ID != "plan" || c.Presets[1].ID != "granted" || c.Presets[2].ID != "published" {
		t.Errorf("presets: %v", c.Presets)
	}
}

// NASA's Mercury fact sheet prints the aphelion distance and the speed
// there; the orbit built from JPL's elements has to give both.
func TestMercuryAtAphelionMatchesNASA(t *testing.T) {
	far, speed := aphelion()
	near(t, "aphelion", far, 69.818e9, 1e-4)
	near(t, "speed at aphelion", speed, 38860, 1e-3)
}

// Worked by hand from vis-viva: an orbit from Mercury's aphelion that
// just touches the Sun moves at 6.12 km/s there, so 32.73 km/s must go.
func TestSpeedMercuryMustLose(t *testing.T) {
	near(t, "to graze the Sun", needed(1), 32734, 2e-3)
	_, speed := aphelion()
	near(t, "to fall straight in", needed(0), speed, 1e-12)
}

// A million 200 megaton bombs hold 8e23 J at the paper's 4e6 J/kg of
// TNT. Thrown rock carries the most momentum per joule at sqrt(2) times
// Mercury's escape speed of 4.25 km/s: energy over escape speed, shared
// among 3.301e23 kg.
func TestAMillionBombsBarelyMoveMercury(t *testing.T) {
	near(t, "ceiling", ceiling(1e6, 200, 1), 5.70e-4, 5e-3)
	near(t, "ceiling scales with coupling", ceiling(1e6, 200, 0.018), 5.70e-4*0.018, 5e-3)
}

// The ceiling is a bound. Ahrens & Harris work out about 1 cm/s for a
// megaton at the surface of a 1 km asteroid of 2 g/cm³; a bound below
// that would be wrong.
func TestCeilingIsNotBelowThePapersAsteroid(t *testing.T) {
	const radius, density = 500.0, 2000.0
	mass := density * 4 * math.Pi * radius * radius * radius / 3
	escape := math.Sqrt(2 * gravity * mass / radius)
	if got := megaton / (escape * mass); got < 0.01 {
		t.Errorf("bound for a megaton on a 1 km asteroid is %g m/s, below the paper's 0.01", got)
	}
}

// The Earth on 1 January 2000 at noon: two days before perihelion,
// 0.9833 AU out, a hundred degrees round from the equinox (the Sun was
// at 280.4 degrees in the Earth's sky), and in the ecliptic.
func TestEarthAtJ2000(t *testing.T) {
	p := body("earth").position(0)
	near(t, "distance", math.Sqrt(p[0]*p[0]+p[1]*p[1]+p[2]*p[2]), 0.98333, 1e-4)
	near(t, "longitude", math.Atan2(p[1], p[0])*180/math.Pi, 100.38, 1e-3)
	if math.Abs(p[2]) > 1e-4 {
		t.Errorf("height above the ecliptic: %g AU", p[2])
	}
}

// Mercury's push comes when it is at aphelion, and its orbit takes
// 87.969 days (NASA).
func TestPushIsAtAphelion(t *testing.T) {
	p := body("mercury").position(pushDay)
	far, _ := aphelion()
	near(t, "distance at the push", au*math.Sqrt(p[0]*p[0]+p[1]*p[1]+p[2]*p[2]), far, 1e-6)
	near(t, "period", period(body("mercury").el[0]*au)/day, 87.969, 1e-4)
}

// Gas thrown straight up at a share f of escape speed turns back at
// R/(1 - f²). At nine tenths that is 5.26 radii, reached half way
// through a flight of 41,100 s (worked by hand from the cycloid).
func TestGasOnAFreePath(t *testing.T) {
	near(t, "apex", apex(0.9), 5.2632, 1e-4)
	const flight = 41128.0
	r, up := radial(0.9, flight/2)
	near(t, "height at half time", r/sunRadius, 5.2632, 2e-3)
	if !up {
		t.Error("the parcel is aloft at half time")
	}
	if _, up := radial(0.9, flight*1.01); up {
		t.Error("the parcel is back in the Sun after its flight")
	}
	if r, _ := radial(0.9, flight*0.2); r <= sunRadius {
		t.Errorf("a fifth of the way through it is above the surface: %g", r)
	}
	// Faster than escape, it leaves at sqrt(f² - 1) of escape speed.
	a, _ := radial(1.1, 100*day)
	b, _ := radial(1.1, 101*day)
	near(t, "speed far out", (b-a)/day, math.Sqrt(0.21)*617.67e3, 5e-3)
	// To turn back at 3 AU, 645 radii out, f must be within 0.08% of 1.
	near(t, "apex just under escape", apex(math.Sqrt(1-1/645.0)), 645, 1e-6)
}

// Model S is in balance: the pressure at a level is the weight of what
// lies above it. At the base of the convection zone the table gives
// 5.68e12 Pa. Gravity there is about 526 m/s² (274 × 0.976 / 0.7126²)
// and 274 at the surface, so the column above is between the pressure
// over the one and over the other.
func TestSunsColumnAgreesWithItsPressure(t *testing.T) {
	got := column(0.7126)
	if got < 5.679e12/526 || got > 5.679e12/274 {
		t.Errorf("column over the convection zone: %g kg/m²", got)
	}
	if column(0.5) <= column(0.7) || column(0.9) >= column(0.8) {
		t.Error("the column must grow inward")
	}
	if column(1.01) != 0 {
		t.Error("nothing lies above the top of the table")
	}
	near(t, "depth of a column", depth(column(0.6)), 0.6, 1e-3)
}

// Hand values: Ostriker's supersonic drag, 4π(GM)²ρ/V² · ln(r_max/r_min),
// for Jupiter at its own orbital speed in gas of 1e-9 kg/m³; and plain
// friction ½·C·ρ·πR²·u² on the Earth with C = 2.
func TestDragForces(t *testing.T) {
	near(t, "gravitational", gravityDrag(1.26687e17, 1e-9, 13060, 1, 100), 5.4455e18, 1e-3)
	near(t, "friction", frictionDrag(2, 1e-9, 6.371e6, 29780), 1.13088e14, 1e-3)
	if gravityDrag(1e17, 1e-9, 1e4, 10, 5) != 0 {
		t.Error("no gravitational drag when the gas is smaller than the body")
	}
}

// An orbit shrinking as da/dt = -k·a^-1.5 reaches zero at a0^2.5 / 2.5k.
func TestDecayAgainstClosedForm(t *testing.T) {
	const a0, k = 1.5e11, 3e20
	want := math.Pow(a0, 2.5) / (2.5 * k)
	for _, tol := range []float64{0.02, 0.005} {
		a, now := a0, 0.0
		for a > sunRadius {
			rate := -k * math.Pow(a, -1.5)
			step := tol * a / -rate
			a, now = advance(a, step, func(a float64) float64 { return -k * math.Pow(a, -1.5) }), now+step
		}
		near(t, "fall time", now, want, 0.01)
	}
}

func TestErrorsNameTheField(t *testing.T) {
	cases := []struct {
		q     Request
		field string
	}{
		{Request{Preset: "nope"}, "preset"},
		{Request{Models: map[string]string{"cloud": "fog"}}, "models.cloud"},
		{Request{Params: map[string]float64{"bombs.count": -1}}, "params.bombs.count"},
		{Request{Resolution: "huge"}, "resolution"},
	}
	for _, c := range cases {
		_, err := Run(c.q)
		var fe *core.FieldError
		if !errors.As(err, &fe) || fe.Field != c.field {
			t.Errorf("%+v: got %v, want field %q", c.q, err, c.field)
		}
	}
}

func TestIdenticalRequestsGiveIdenticalResults(t *testing.T) {
	a, b := mustRun(t, Request{}), mustRun(t, Request{})
	if !reflect.DeepEqual(a, b) {
		t.Error("two runs of the default differ")
	}
}

func fate(r *Result, id string) Fate {
	for _, f := range r.Fates {
		if f.ID == id {
			return f
		}
	}
	return Fate{}
}

func TestCoarseAndFineAgree(t *testing.T) {
	for _, p := range Catalog().Presets {
		coarse := mustRun(t, Request{Preset: p.ID, Resolution: "coarse"})
		fine := mustRun(t, Request{Preset: p.ID, Resolution: "fine"})
		near(t, p.ID+" delivered", coarse.Delivered, fine.Delivered, 1e-12)
		if len(coarse.Fates) != len(fine.Fates) {
			t.Fatalf("%s: fates differ", p.ID)
		}
		for i, f := range coarse.Fates {
			g := fine.Fates[i]
			if f.Fate != g.Fate {
				t.Errorf("%s %s: %s coarse, %s fine", p.ID, f.ID, f.Fate, g.Fate)
			}
			if f.Fate == "falls" {
				near(t, p.ID+" "+f.ID+" fall", f.Time, g.Time, 0.03)
			}
		}
	}
}

// What comes back has the shape the page draws from: every frame has a
// place for every body, chapters tile the frames, and the gas of each
// flow is where the reply says it is.
func TestFramesAndFloatsLineUp(t *testing.T) {
	for _, p := range Catalog().Presets {
		r := mustRun(t, Request{Preset: p.ID})
		frames := len(r.Time)
		if r.Places.Offset != 0 || r.Places.Frames != frames || r.Places.Bodies != 9 {
			t.Fatalf("%s: places %+v for %d frames", p.ID, r.Places, frames)
		}
		end := frames * 9 * 3
		// A ring for each planet's orbit, of unit size, and one for
		// Mercury's path after the push.
		if r.Rings.Offset != end || r.Rings.Points < 32 || r.Rings.Pushed != 9 {
			t.Fatalf("%s: rings %+v, expected at %d", p.ID, r.Rings, end)
		}
		for b := 1; b <= 9; b++ {
			who, i := b, 0
			if b == 9 {
				who, i = 1, len(r.Time)-1
				if r.Gone[1] >= 0 {
					i = r.Gone[1] - 1
				}
			}
			size := r.Orbits[who][i]
			at := r.Floats[(i*9+who)*3 : (i*9+who)*3+3]
			best := math.Inf(1)
			for k := 0; k < r.Rings.Points; k++ {
				ring := r.Floats[r.Rings.Offset+((b-1)*r.Rings.Points+k)*3:]
				best = math.Min(best, math.Hypot(math.Hypot(float64(at[0])-size*float64(ring[0]), float64(at[1])-size*float64(ring[1])), float64(at[2])-size*float64(ring[2])))
			}
			if best > 0.06*size {
				t.Fatalf("%s: body %d at frame %d is %g AU off its ring", p.ID, who, i, best)
			}
		}
		end += 9 * r.Rings.Points * 3
		for _, g := range r.Flows {
			if g.Dirs != end {
				t.Fatalf("%s: flow %s starts at %d, want %d", p.ID, g.Body, g.Dirs, end)
			}
			c := r.Chapters[g.Chapter]
			if g.Radii != g.Dirs+3*g.Count || c.Flow == "" {
				t.Fatalf("%s: flow %+v in chapter %+v", p.ID, g, c)
			}
			end = g.Radii + g.Count*(c.To-c.From+1)
		}
		if end != len(r.Floats) {
			t.Fatalf("%s: %d floats, layout says %d", p.ID, len(r.Floats), end)
		}
		at := 0
		for i, c := range r.Chapters {
			if c.From != at || c.To < c.From || r.Time[c.To] < r.Time[c.From] {
				t.Fatalf("%s: chapter %d is %+v, expected to start at frame %d", p.ID, i, c, at)
			}
			at = c.To + 1
		}
		if at != frames {
			t.Fatalf("%s: chapters cover %d of %d frames", p.ID, at, frames)
		}
		for i := 1; i < frames; i++ {
			if r.Time[i] < r.Time[i-1] {
				t.Fatalf("%s: time runs backwards at frame %d", p.ID, i)
			}
		}
		for _, v := range r.Floats {
			if v != v || math.IsInf(float64(v), 0) {
				t.Fatalf("%s: a place is not a number", p.ID)
			}
		}
		// Before the push every planet is where JPL's elements put it.
		for b, who := range Catalog().Bodies[1:] {
			want := who.position(pushDay + r.Time[0]/day)
			for k := 0; k < 3; k++ {
				got := float64(r.Floats[(b+1)*3+k])
				if math.Abs(got-want[k]) > 1e-5*(1+math.Abs(want[k])) {
					t.Fatalf("%s: %s starts at %v, want %v", p.ID, who.ID, r.Floats[(b+1)*3:(b+1)*3+3], want)
				}
			}
		}
	}
}

// Whatever is chosen, drag only takes: no orbit ever widens, and the
// gas only spreads.
func TestOrbitsOnlyShrinkAndTheEdgeOnlyGrows(t *testing.T) {
	for _, p := range Catalog().Presets {
		r := mustRun(t, Request{Preset: p.ID})
		for b, orbit := range r.Orbits {
			if b == 1 {
				continue // Mercury is pushed, not dragged.
			}
			for i := 1; i < len(orbit); i++ {
				if orbit[i] > orbit[i-1]*(1+1e-12) {
					t.Fatalf("%s: %s widens at frame %d", p.ID, Catalog().Bodies[b].ID, i)
				}
			}
		}
		for i := 1; i < len(r.Edge); i++ {
			if r.Edge[i] < r.Edge[i-1] {
				t.Fatalf("%s: the gas draws back at frame %d", p.ID, i)
			}
		}
	}
}

// Nothing thrown out by the published impact can carry more energy than
// the impact brought: what falls in at escape speed lifts out, at most,
// its own mass.
func TestPublishedEjectaNeverExceedTheEnergyOfTheFall(t *testing.T) {
	for _, target := range []float64{0, 0.5, 1} {
		r := mustRun(t, Request{Preset: "granted", Params: map[string]float64{"bombs.target": target}})
		if !r.Falls || r.Impact == nil {
			t.Fatalf("target %g: Mercury is granted its fall", target)
		}
		mercury := body("mercury").Mass
		if r.Impact.Ejecta > mercury*(1+1e-9) || r.Impact.Ejecta <= 0 {
			t.Errorf("target %g: %g kg thrown out by %g kg", target, r.Impact.Ejecta, mercury)
		}
		// It arrives a shade under the Sun's escape speed of 617.6 km/s.
		near(t, "impact speed", r.Impact.Speed, 615.6e3, 3e-3)
		near(t, "impact energy", r.Impact.Energy, 0.5*mercury*r.Impact.Speed*r.Impact.Speed, 1e-9)
	}
}

// The novel's arithmetic, against NASA's masses.
func TestTheNovelsRatios(t *testing.T) {
	r := mustRun(t, Request{})
	near(t, "Venus, Earth and Mars over Mercury (the novel: forty)", r.Ratios.Three, 34.8, 0.01)
	near(t, "Jupiter over the four (the novel: six hundred)", r.Ratios.Jupiter, 161, 0.01)
}

// How the starting points come out. If a change moves any of this,
// update docs/models-diaz.md and the science page's "How it came out".
func TestDiazPresets(t *testing.T) {
	year := 365.25 * day

	// Published physics only: a million bombs. Mercury stays where it is.
	p := mustRun(t, Request{Preset: "published"})
	if p.Falls || p.Speculative || p.Impact != nil {
		t.Fatalf("published: falls=%v speculative=%v", p.Falls, p.Speculative)
	}
	near(t, "published: delivered", p.Delivered, 5.70e-4, 5e-3)
	near(t, "published: needed", p.Needed, 32734, 2e-3)
	near(t, "published: bombs needed", p.BombsNeeded, 5.74e13, 0.01)
	near(t, "published: perihelion", p.Perihelion, 66.1, 0.01)
	for _, f := range p.Fates {
		if f.Fate != "untouched" {
			t.Errorf("published: %s %s", f.ID, f.Fate)
		}
	}

	// Grant the fall: Mercury goes in, and nothing follows.
	g := mustRun(t, Request{Preset: "granted"})
	if !g.Falls || !g.Speculative {
		t.Fatalf("granted: falls=%v speculative=%v", g.Falls, g.Speculative)
	}
	// Half an orbit from aphelion to a point half a radius from the
	// Sun's center: 0.235 AU across, 41.5 days round, 20.7 down.
	near(t, "granted: days to fall", g.FallDays, 20.73, 0.005)
	near(t, "granted: angle", g.Impact.Angle, 45.1, 0.01)
	if !g.Impact.Deep {
		t.Errorf("granted: Mercury stops at %g of the radius", g.Impact.Depth)
	}
	near(t, "granted: depth", g.Impact.Depth, 0.644, 0.01)
	near(t, "granted: ejecta over Mercury", g.Impact.Ejecta/body("mercury").Mass, 0.987, 0.002)
	near(t, "granted: escaping", g.Impact.Escaping, 0.5, 0.02)
	for _, f := range g.Fates {
		if f.Fate != "nudged" {
			t.Errorf("granted: %s %s", f.ID, f.Fate)
		}
	}
	near(t, "granted: the Earth's nudge", fate(g, "earth").Nudge, 3.6e-5, 0.05)
	near(t, "granted: Venus's nudge", fate(g, "venus").Nudge, 7.8e-5, 0.05)
	if len(g.Flows) != 1 || g.Flows[0].Stays {
		t.Errorf("granted: flows %+v", g.Flows)
	}

	// The Wallbreaker's telling.
	w := mustRun(t, Request{Preset: "plan"})
	if !w.Falls || !w.Speculative {
		t.Fatal("plan: Mercury must fall")
	}
	near(t, "plan: first edge, AU", w.Flows[0].Edge, 3.33, 0.01)
	var order []string
	for _, f := range w.Flows {
		order = append(order, f.Body)
	}
	// Jupiter's own wake drags it in ahead of the Earth.
	if !reflect.DeepEqual(order, []string{"mercury", "venus", "jupiter", "earth", "mars", "saturn", "uranus", "neptune"}) {
		t.Errorf("plan: order of falling %v", order)
	}
	near(t, "plan: Venus falls, years", fate(w, "venus").Time/year, 1.667e5, 0.03)
	near(t, "plan: Jupiter falls, years", fate(w, "jupiter").Time/year, 1.946e5, 0.03)
	near(t, "plan: Earth falls, years", fate(w, "earth").Time/year, 1.952e5, 0.03)
	near(t, "plan: Neptune falls, years", fate(w, "neptune").Time/year, 2.092e5, 0.03)
	near(t, "plan: edge after Venus, AU", w.Flows[1].Edge, 6.78, 0.01)
	near(t, "plan: edge after Jupiter, AU", w.Flows[2].Edge, 47.6, 0.01)
	near(t, "plan: the Earth's air is met, years", w.AirGone/year, 2.20, 0.05)
	near(t, "plan: the heat to boil the sea, years", w.SeaGone/year, 1.65, 0.05)
	// Two thirds of the Sun ends up outside it.
	near(t, "plan: gas over the Sun's mass", w.CloudMass/sunMass, 0.671, 0.01)
	if w.Exhausted {
		t.Error("plan: the Sun has enough for the default eruption")
	}
	// A thousand times stronger still, and it does not.
	if x := mustRun(t, Request{Preset: "plan", Params: map[string]float64{"eruption.gain": 1e6}}); !x.Exhausted {
		t.Error("an eruption a million strong asks for more than the Sun holds")
	}
}

// However long a chapter is, the planets are carried round in steps
// small enough to follow: where the true motion would be many orbits a
// frame, it is drawn slowed and the chapter says so.
func TestNoPlanetJumpsBetweenFrames(t *testing.T) {
	r := mustRun(t, Request{Preset: "plan"})
	for c, chapter := range r.Chapters {
		if c < 3 {
			continue
		}
		capped := false
		for i := chapter.From + 1; i <= chapter.To; i++ {
			for b := 2; b < 9; b++ {
				if r.Gone[b] >= 0 && i >= r.Gone[b] {
					continue
				}
				p, q := r.Floats[((i-1)*9+b)*3:], r.Floats[(i*9+b)*3:]
				dot, pp, qq := 0.0, 0.0, 0.0
				for k := 0; k < 3; k++ {
					dot += float64(p[k]) * float64(q[k])
					pp += float64(p[k]) * float64(p[k])
					qq += float64(q[k]) * float64(q[k])
				}
				angle := math.Acos(math.Max(-1, math.Min(1, dot/math.Sqrt(pp*qq))))
				if angle > 0.75 {
					t.Fatalf("chapter %d (%s %s): %s turns %.2f rad between frames %d and %d", c, chapter.ID, chapter.Body, Catalog().Bodies[b].ID, angle, i-1, i)
				}
				capped = capped || angle > 0.3
			}
		}
		if capped && !chapter.Slowed && chapter.End-chapter.Start > year {
			t.Errorf("chapter %d (%s %s) is drawn slowed and does not say so", c, chapter.ID, chapter.Body)
		}
	}
}
