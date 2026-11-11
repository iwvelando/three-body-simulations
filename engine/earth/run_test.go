package earth

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

func last(r *Result, name string) float64 {
	s := r.Series[name]
	return s[len(s)-1]
}

func hasEvent(r *Result, id string) bool {
	for _, e := range r.Events {
		if e.ID == id {
			return true
		}
	}
	return false
}

func TestCatalogIsConsistent(t *testing.T) {
	if err := Catalog().Check(); err != nil {
		t.Fatal(err)
	}
}

// Every preset must return the living Earth to its present state: that is
// what "calibrated to today" means for each of them.
func TestLivingEarthArrivesAtThePresent(t *testing.T) {
	for _, p := range Catalog().Presets {
		r := mustRun(t, Request{Life: true, Preset: p.ID})
		near(t, p.ID+" temperature", last(r, "temperature"), 286.8, 1.5)
		near(t, p.ID+" CO2", last(r, "co2"), 2.8e-4, 0.5e-4)
		near(t, p.ID+" O2", last(r, "o2"), 0.21, 0.02)
		// Under Green Glasses the newborn Earth is stripped until life
		// begins, so the living Earth starts its record a little short.
		if w := last(r, "ocean"); w < 0.85 {
			t.Errorf("%s: living Earth kept only %g of its ocean", p.ID, w)
		}
		if hasEvent(r, "oceans-lost") {
			t.Errorf("%s: living Earth lost its oceans", p.ID)
		}
		// Not frozen solid and not boiling under the faint young Sun,
		// once the planet has cooled.
		for i, tt := range r.Time {
			if tt < 0.3 {
				continue
			}
			if T := r.Series["temperature"][i]; T < 265 || T > 345 {
				t.Fatalf("%s: living Earth at %g K, %.2f Gyr", p.ID, T, tt)
			}
		}
	}
}

func TestSkepticLifelessEarthKeepsItsOcean(t *testing.T) {
	r := mustRun(t, Request{Life: false, Preset: "skeptic"})
	if w := last(r, "ocean"); w < 0.9 {
		t.Errorf("ocean left: %g", w)
	}
	if T := last(r, "temperature"); T > 330 {
		t.Errorf("lifeless Earth at %g K under the skeptic preset", T)
	}
}

// The calibration result, recorded as it came out. Published models at
// the strong-life end of their published ranges give a lifeless Earth that
// is scalding but still wet: bars of CO2 keep the cold trap working. The
// book's dry planet needs the passage's own unshielded stripping as well,
// which has no published basis and is marked speculative.
func TestGreenGlassesLifelessEarthDriesOut(t *testing.T) {
	r := mustRun(t, Request{Life: false, Preset: "green-glasses"})
	if w := last(r, "ocean"); w != 0 {
		t.Errorf("ocean left: %g", w)
	}
	if !hasEvent(r, "oceans-lost") || !hasEvent(r, "half-ocean") {
		t.Errorf("events: %+v", r.Events)
	}
	if p := last(r, "co2"); p < 10 {
		t.Errorf("after the oceans go, CO2 should pile up; got %g bar", p)
	}
	if r.Summary.State != "dry" || r.Summary.OceansLost < 2 || r.Summary.OceansLost > 4.2 {
		t.Errorf("summary %+v: want dry after several billion years", r.Summary)
	}
	if r.Choice.Models["stripping"] != "unshielded" {
		t.Fatalf("stripping model %q", r.Choice.Models["stripping"])
	}
	for _, s := range Catalog().Slots {
		for _, m := range s.Models {
			if (s.ID == "stripping" && m.ID == "unshielded") != m.Speculative {
				t.Errorf("%s.%s speculative=%v", s.ID, m.ID, m.Speculative)
			}
		}
	}
	published := mustRun(t, Request{Life: false, Preset: "green-glasses", Models: map[string]string{"stripping": "none"}})
	if published.Summary.State != "hot" || last(published, "ocean") < 0.8 || last(published, "temperature") < 340 {
		t.Errorf("published models alone: %+v, ocean %g, %g K", published.Summary, last(published, "ocean"), last(published, "temperature"))
	}
}

func TestLifelessEarthIsWarmerTheMoreLifeMattered(t *testing.T) {
	var prev float64
	for _, b := range []float64{10, 100, 1000} {
		r := mustRun(t, Request{Life: false, Preset: "skeptic", Models: map[string]string{"carbon": "continental", "water": "off"},
			Params: map[string]float64{"biosphere.enhancement": b}})
		T := last(r, "temperature")
		if T <= prev+5 {
			t.Errorf("enhancement %g: %g K after %g K", b, T, prev)
		}
		prev = T
	}
}

// Schwartzman & Volk (1989) balance today's outgassing against weathering
// that scales as (pCO2)^0.4 exp(0.073 dT), their beta + gamma, an e-fold
// per 13.7 K. Their abstract gives a lifeless Earth about 15, 30 and 45 C
// warmer for enhancement factors of 10, 100 and 1,000; their Fig. 1b
// spans about 13, 30 to 35 and 37 to 58 C across three greenhouse models.
// The climate fit here is a fourth, so the bands are theirs, widened.
func TestSchwartzmanVolkWarming(t *testing.T) {
	living := mustRun(t, Request{Life: true, Preset: "skeptic"})
	for _, k := range []struct{ factor, low, high float64 }{{10, 10, 19}, {100, 24, 38}, {1000, 37, 60}} {
		r := mustRun(t, Request{Life: false, Preset: "skeptic",
			Models: map[string]string{"carbon": "continental", "outgassing": "constant", "water": "off"},
			Params: map[string]float64{"biosphere.enhancement": k.factor, "weathering.co2": 0.4, "weathering.te": 13.7}})
		warming := last(r, "temperature") - last(living, "temperature")
		if warming < k.low || warming > k.high {
			t.Errorf("factor %g: lifeless Earth %.1f K warmer, want %g to %g", k.factor, warming, k.low, k.high)
		}
	}
}

func TestInvariants(t *testing.T) {
	for _, life := range []bool{true, false} {
		for _, p := range Catalog().Presets {
			r := mustRun(t, Request{Life: life, Preset: p.ID})
			n := len(r.Time)
			if n < 200 || r.Time[0] != 0 || r.Time[n-1] != ageNow {
				t.Fatalf("time axis: %d samples from %g to %g", n, r.Time[0], r.Time[n-1])
			}
			for name, s := range r.Series {
				if len(s) != n {
					t.Fatalf("%s has %d samples, want %d", name, len(s), n)
				}
				for i, v := range s {
					if math.IsNaN(v) || math.IsInf(v, 0) {
						t.Fatalf("%s[%d] is not finite", name, i)
					}
				}
			}
			w := r.Series["ocean"]
			for i := 1; i < n; i++ {
				if w[i] > w[i-1]+1e-12 || w[i] < 0 {
					t.Fatalf("ocean must only shrink: %g then %g", w[i-1], w[i])
				}
				if r.Time[i] <= r.Time[i-1] {
					t.Fatal("time must increase")
				}
			}
			for i := 1; i < len(r.Events); i++ {
				if r.Events[i].Time < r.Events[i-1].Time {
					t.Fatal("events must be in time order")
				}
			}
		}
	}
}

func TestLifeDoesNotTouchTheSun(t *testing.T) {
	a := mustRun(t, Request{Life: true})
	b := mustRun(t, Request{Life: false})
	if !reflect.DeepEqual(a.Series["luminosity"], b.Series["luminosity"]) {
		t.Error("luminosity differs with life")
	}
	if reflect.DeepEqual(a.Series["temperature"], b.Series["temperature"]) {
		t.Error("life changed nothing")
	}
	if last(b, "o2") > 1e-6 || last(b, "vegetation") != 0 {
		t.Error("a lifeless Earth has no oxygen or vegetation")
	}
}

func TestDeterministicAndResolutionStable(t *testing.T) {
	q := Request{Life: false, Preset: "skeptic"}
	a, b := mustRun(t, q), mustRun(t, q)
	if !reflect.DeepEqual(a, b) {
		t.Error("identical requests gave different results")
	}
	q.Resolution = "fine"
	f := mustRun(t, q)
	near(t, "final temperature, coarse vs fine", last(a, "temperature"), last(f, "temperature"), 1)
	near(t, "final ocean, coarse vs fine", last(a, "ocean"), last(f, "ocean"), 0.02)
	// The time of ocean loss must not hinge on the step.
	q = Request{Life: false, Preset: "green-glasses"}
	c := mustRun(t, q)
	q.Resolution = "fine"
	f = mustRun(t, q)
	near(t, "ocean loss time, coarse vs fine", c.Summary.OceansLost, f.Summary.OceansLost, 0.08)
}

func TestWaterLossOffKeepsTheOcean(t *testing.T) {
	r := mustRun(t, Request{Life: false, Models: map[string]string{"water": "off", "stripping": "none"}})
	if last(r, "ocean") != r.Choice.Params["water.initial"] {
		t.Error("ocean changed with water loss off")
	}
}

func TestSpeculativeStrippingOnlyActsWithoutAShield(t *testing.T) {
	q := Request{Life: true, Preset: "skeptic", Models: map[string]string{"stripping": "unshielded"},
		Params: map[string]float64{"stripping.rate": 0.5, "biosphere.origin": 0.4}}
	living := mustRun(t, q)
	q.Life = false
	lifeless := mustRun(t, q)
	if last(lifeless, "ocean") != 0 {
		t.Errorf("half an ocean per Gyr should dry a lifeless Earth; left %g", last(lifeless, "ocean"))
	}
	// The living Earth is stripped only until life begins, 0.4 Gyr in.
	near(t, "living ocean", last(living, "ocean"), 0.8, 0.02)
	if last(living, "shield") != 1 || last(lifeless, "shield") != 0 {
		t.Error("shield should follow life")
	}
}

func TestRequestErrorsNameTheField(t *testing.T) {
	for _, k := range []struct {
		q     Request
		field string
	}{
		{Request{Preset: "x"}, "preset"},
		{Request{Resolution: "ultra"}, "resolution"},
		{Request{Models: map[string]string{"climate": "x"}}, "models.climate"},
		{Request{Params: map[string]float64{"weathering.te": 1e9}}, "params.weathering.te"},
	} {
		_, err := Run(k.q)
		var fe *core.FieldError
		if !errors.As(err, &fe) || fe.Field != k.field {
			t.Errorf("want %s, got %v", k.field, err)
		}
	}
}

func TestProductivityFeedbackCollapsesWhenTooHot(t *testing.T) {
	// With the productivity model, life that overheats stops weathering:
	// push the planet sunward and the living Earth should end hotter
	// than the same Earth under the staged model, which never dies.
	q := Request{Life: true, Preset: "skeptic", Models: map[string]string{"biosphere": "productivity", "carbon": "continental"}}
	r := mustRun(t, q)
	near(t, "present temperature", last(r, "temperature"), 286.8, 1.5)
	if last(r, "productivity") < 0.9 {
		t.Errorf("present productivity %g, want about 1", last(r, "productivity"))
	}
}
