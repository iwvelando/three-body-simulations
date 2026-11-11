package flat

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

func sphere(r float64) float64 { return 4 * math.Pi * r * r * r / 3 }

func TestCatalogsAreConsistentAndAllSpeculative(t *testing.T) {
	for name, c := range map[string]*core.Catalog{"bodies": Catalog().Catalog, "painting": PaintingCatalog()} {
		if err := c.Check(); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		for _, s := range c.Slots {
			for _, m := range s.Models {
				if !m.Speculative {
					t.Errorf("%s: %s.%s has no published basis and must say so", name, s.ID, m.ID)
				}
			}
		}
	}
	if len(Catalog().Bodies) != 10 || Catalog().Bodies[0].ID != "sun" {
		t.Fatalf("bodies: %v", Catalog().Bodies)
	}
}

// Every body says how it looks from outside, and every starting point
// that is about a body names one that exists.
func TestBodiesHaveALookAndPresetsAFocus(t *testing.T) {
	for _, b := range Catalog().Bodies {
		if b.Surface.Kind == "" || len(b.Surface.Colors) < 2 {
			t.Errorf("%s has no look: %+v", b.ID, b.Surface)
		}
	}
	focus := Catalog().Focus
	if focus["sun30"] != "sun" || focus["snow"] != "earth" || focus["starry"] != "jupiter" {
		t.Errorf("focus: %v", focus)
	}
	for preset, id := range focus {
		if body(id) == nil {
			t.Errorf("%s points at %q", preset, id)
		}
		if _, err := Catalog().Resolve(preset, nil, nil); err != nil {
			t.Errorf("%s is not a preset", preset)
		}
	}
}

// The paper prints the Earth's mass its density polynomials were fitted
// to: 5.974e24 kg.
func TestEarthLayersCarryThePublishedMass(t *testing.T) {
	near(t, "PREM mass", body("earth").mass(), 5.974e24, 0.001)
	near(t, "Sun mass", body("sun").mass(), 1.9884e30, 0.001)
	near(t, "Mercury mass", body("mercury").mass(), 0.330e24, 0.03)
	for _, b := range bodies {
		last := 0.0
		for _, l := range b.Layers {
			if l.Outer <= last || l.Density <= 0 || l.Color == "" || l.Label == "" {
				t.Errorf("%s: layer %s is malformed", b.ID, l.ID)
			}
			last = l.Outer
		}
		if last != b.Radius {
			t.Errorf("%s: layers end at %g, radius %g", b.ID, last, b.Radius)
		}
	}
}

// Nothing overlaps, so the flat area times the thickness is the volume,
// whichever way the matter is laid out.
func TestAreaIsVolumeOverThickness(t *testing.T) {
	for _, landing := range []string{"shells", "spread"} {
		r := mustRun(t, Request{Body: "earth", Models: map[string]string{"landing": landing}})
		h := r.Choice.Params["sheet.thickness"] / 1000
		near(t, landing+" area", r.Area*h, sphere(6371), 1e-9)
		near(t, landing+" radius", r.Radius, math.Sqrt(sphere(6371)/(math.Pi*h)), 1e-9)
		last := r.Frames.Rim[len(r.Frames.Rim)-1]
		near(t, landing+" last rim", last, r.Radius, 1e-9)
	}
}

// The novel: the flat Sun is wider than the Sun after thirty seconds of
// a fall that takes an hour. The default thickness is the one that says
// so; everything else here follows from it.
func TestTheSunsThirtySeconds(t *testing.T) {
	r := mustRun(t, Request{Body: "sun"})
	near(t, "fall", r.Duration, 3600, 1e-9)
	near(t, "crossing", r.Crossing, 30, 0.01)
	near(t, "rim speed", r.RimSpeed, 695700.0/30, 0.01)
	if r.FasterThanLight {
		t.Error("23,000 km/s is not faster than light")
	}
	// 69 times the Sun's radius: a third of the way to the Earth.
	near(t, "flat Sun", r.Radius/149.6e6, 0.322, 0.01)
}

// Shell by shell, each layer is a ring in the order it lay in the body,
// and a thin outer shell is a thin ring: width = volume / (2π·radius·h).
func TestShellsLayEachLayerAsARing(t *testing.T) {
	r := mustRun(t, Request{Body: "earth"})
	if len(r.Rings) != 5 || r.Rings[4].Layer != "ocean" || r.Rings[0].Inner != 0 {
		t.Fatalf("rings: %+v", r.Rings)
	}
	for i := 1; i < len(r.Rings); i++ {
		if r.Rings[i].Inner != r.Rings[i-1].Outer || r.Rings[i].Outer <= r.Rings[i].Inner {
			t.Fatalf("rings overlap or leave a gap: %+v", r.Rings)
		}
	}
	ocean := sphere(6371) - sphere(6368)
	h := 192.0
	want := ocean / (2 * math.Sqrt(math.Pi*h*sphere(6371)))
	near(t, "ocean ring", r.Rings[4].Outer-r.Rings[4].Inner, want, 0.01)
}

// Spreading: what went in first lies furthest out, the bands never
// cross, and the pool holds exactly what has gone in.
func TestSpreadingPutsFirstInFurthestOut(t *testing.T) {
	r := mustRun(t, Request{Body: "earth", Models: map[string]string{"landing": "spread"}})
	f := r.Frames
	h := r.Choice.Params["sheet.thickness"] / 1000
	mid := len(f.Time) / 2
	near(t, "half way", f.Sink[mid], 0, 1e-9)
	near(t, "footprint", f.Foot[mid], 6371, 1e-9)
	near(t, "half the Earth", math.Pi*f.Rim[mid]*f.Rim[mid]*h, sphere(6371)/2, 1e-9)
	for i := range f.Time {
		edge := 0.0
		for k, b := range f.Bands[i] {
			if b < edge-1e-9 {
				t.Fatalf("frame %d band %d at %g crosses %g", i, k, b, edge)
			}
			edge = b
		}
		if i > 0 && f.Rim[i] < f.Rim[i-1] {
			t.Fatalf("the rim came back in at frame %d", i)
		}
	}
	// The outermost band is the first slice in: the far pole, crust and
	// mantle only. A middle band has core in it.
	share := func(band Band, layer string) float64 {
		for i, l := range r.Body.Layers {
			if l.ID == layer {
				return band.Mix[i]
			}
		}
		return math.NaN()
	}
	out, middle := r.Bands[len(r.Bands)-1], r.Bands[len(r.Bands)/2]
	if share(out, "outer-core") != 0 || share(middle, "outer-core") < 0.2 {
		t.Errorf("core share: rim %g, middle %g", share(out, "outer-core"), share(middle, "outer-core"))
	}
	for _, b := range r.Bands {
		sum := 0.0
		for _, m := range b.Mix {
			sum += m
		}
		near(t, "mix", sum, 1, 1e-9)
	}
}

// Keeping mass instead of volume: area = mass / (1000 kg/m³ · h), and
// the dense core takes a larger share of the disc.
func TestKeepingMassSpreadsDenseMatterWider(t *testing.T) {
	v := mustRun(t, Request{Body: "earth"})
	m := mustRun(t, Request{Body: "earth", Models: map[string]string{"kept": "mass"}})
	near(t, "area", m.Area*1e6*192000*1000, 5.974e24, 0.001)
	if m.Rings[1].Outer/m.Radius <= v.Rings[1].Outer/v.Radius {
		t.Error("the core should take a larger share of the disc by mass")
	}
}

// Each preset is a thickness worked out from one statement in the novel.
// This records how the others then come out; see docs/models-flat.md.
func TestFlatPresets(t *testing.T) {
	const au = 149.6e6
	// Snowflake sea: the ocean ring is as wide as the novel's snowflakes.
	snow := mustRun(t, Request{Body: "earth", Preset: "snow"})
	near(t, "ocean ring", snow.Rings[4].Outer-snow.Rings[4].Inner, 4500, 0.02)
	near(t, "flat Earth under snow", snow.Radius/au, 0.0426, 0.02)
	sun := mustRun(t, Request{Body: "sun", Preset: "snow"})
	near(t, "flat Sun under snow", sun.Radius/au, 48.6, 0.02)
	if !sun.FasterThanLight || sun.Crossing > 1 {
		t.Errorf("under snow the Sun's rim outruns light: %g km/s, crossing %g s", sun.RimSpeed, sun.Crossing)
	}
	// Starry Night: flat Jupiter and flat Saturn just touch when they
	// are on the same side of the Sun.
	j := mustRun(t, Request{Body: "jupiter", Preset: "starry"})
	s := mustRun(t, Request{Body: "saturn", Preset: "starry"})
	near(t, "Jupiter and Saturn touch", j.Radius+s.Radius, 1432.0e6-778.5e6, 0.02)
	e := mustRun(t, Request{Body: "earth", Preset: "starry"})
	near(t, "ocean ring under starry", e.Rings[4].Outer-e.Rings[4].Inner, 7200, 0.03)
	// The Sun's thirty seconds: the same ring is 30 km wide.
	e = mustRun(t, Request{Body: "earth", Preset: "sun30"})
	near(t, "ocean ring under sun30", e.Rings[4].Outer-e.Rings[4].Inner, 29.9, 0.01)
	near(t, "flat Earth under sun30", e.Radius, 42360, 0.01)
	// A person, 0.07 m³: 0.7 mm across under the Sun's clock, 30 km with
	// every atom side by side.
	near(t, "a person under sun30", e.Person, 6.8e-7, 0.02)
	a := mustRun(t, Request{Body: "earth", Preset: "atoms"})
	near(t, "a person under atoms", a.Person, 29.85, 0.01)
	near(t, "flat Sun under atoms, light-years", mustRun(t, Request{Body: "sun", Preset: "atoms"}).Radius/9.4607e12, 224, 0.02)
}

// No moment of any body's fall, under any choice, is without a number.
func TestEveryBodyFallsCleanly(t *testing.T) {
	for _, b := range Catalog().Bodies {
		for _, landing := range []string{"shells", "spread"} {
			for _, kept := range []string{"volume", "mass"} {
				r := mustRun(t, Request{Body: b.ID, Models: map[string]string{"landing": landing, "kept": kept}})
				for i, edges := range r.Frames.Bands {
					for _, e := range edges {
						if math.IsNaN(e) || e < 0 || e > r.Radius*(1+1e-9) {
							t.Fatalf("%s %s %s: frame %d has an edge at %g", b.ID, landing, kept, i, e)
						}
					}
				}
			}
		}
	}
}

func TestIdenticalRequestsAndBothResolutionsAgree(t *testing.T) {
	q := Request{Body: "neptune", Models: map[string]string{"landing": "spread"}}
	a, b := mustRun(t, q), mustRun(t, q)
	if !reflect.DeepEqual(a, b) {
		t.Fatal("identical requests gave different replies")
	}
	q.Resolution = "fine"
	fine := mustRun(t, q)
	step := (len(fine.Frames.Time) - 1) / (len(a.Frames.Time) - 1)
	if step < 2 {
		t.Fatalf("fine has %d frames, coarse %d", len(fine.Frames.Time), len(a.Frames.Time))
	}
	for i := range a.Frames.Time {
		near(t, "time", fine.Frames.Time[i*step], a.Frames.Time[i], 1e-12)
		near(t, "rim", fine.Frames.Rim[i*step]+1, a.Frames.Rim[i]+1, 1e-9)
	}
	near(t, "radius", fine.Radius, a.Radius, 1e-12)
}

func TestErrorsNameTheField(t *testing.T) {
	for field, q := range map[string]Request{
		"body":                   {Body: "vulcan"},
		"preset":                 {Body: "sun", Preset: "x"},
		"models.landing":         {Body: "sun", Models: map[string]string{"landing": "x"}},
		"params.sheet.thickness": {Body: "sun", Params: map[string]float64{"sheet.thickness": 0}},
		"resolution":             {Body: "sun", Resolution: "x"},
	} {
		_, err := Run(q)
		var fe *core.FieldError
		if !errors.As(err, &fe) || fe.Field != field {
			t.Errorf("%s: got %v", field, err)
		}
	}
}
