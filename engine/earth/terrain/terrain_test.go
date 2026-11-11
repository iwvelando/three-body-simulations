package terrain

import (
	"errors"
	"math"
	"reflect"
	"sort"
	"testing"

	"threebody/engine/core"
)

func near(t *testing.T, name string, got, want, tol float64) {
	t.Helper()
	if math.IsNaN(got) || math.Abs(got-want) > tol {
		t.Errorf("%s = %g, want %g ± %g", name, got, want, tol)
	}
}

func mustRun(t *testing.T, q Request) *Result {
	t.Helper()
	r, err := Run(q)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

// Schmid et al. (2018) eqs. 4 and 7 to 9 with their Table 1: Manning
// numbers 0.01 bare and 0.6 fully vegetated, w = 1, alpha = 0.3. Full
// cover cuts fluvial erodibility to (0.01/0.61)^0.9 of bare ground and
// creep to e^-0.3.
func TestVegetationLaws(t *testing.T) {
	near(t, "bare erodibility", erodibility(0), 1, 1e-12)
	near(t, "vegetated erodibility", erodibility(1), math.Pow(0.01/0.61, 0.9), 1e-12)
	near(t, "half cover", erodibility(0.5), math.Pow(0.01/0.31, 0.9), 1e-12)
	near(t, "creep", creep(1)/creep(0), math.Exp(-0.3), 1e-12)
}

func TestCatalogIsConsistent(t *testing.T) {
	c := Catalog()
	if len(c.Scenes) != 2 {
		t.Fatalf("scenes: %d", len(c.Scenes))
	}
	seen := map[string]bool{}
	for _, p := range c.Params {
		if seen[p.ID] || !(p.Min < p.Max) || p.Default < p.Min || p.Default > p.Max || p.Label == "" || p.Help == "" {
			t.Errorf("parameter %+v", p)
		}
		seen[p.ID] = true
	}
}

// The passage's experiment: three like mountains, two under vegetation.
// The bare one goes first.
func TestBareMountainErodesFirst(t *testing.T) {
	r := mustRun(t, Request{Scene: "mountains"})
	last := len(r.Times) - 1
	a, b, bare := r.Peaks[0][last], r.Peaks[1][last], r.Peaks[2][last]
	start := r.Peaks[2][0]
	if bare > 0.6*start {
		t.Errorf("bare peak still %g of %g m", bare, start)
	}
	if a < 0.85*start || b < 0.85*start {
		t.Errorf("vegetated peaks fell to %g and %g of %g m", a, b, start)
	}
	// With the same cover on all three, they fare alike.
	same := mustRun(t, Request{Scene: "mountains", Params: map[string]float64{"cover": 0}})
	s := same.Peaks
	if math.Abs(s[0][last]-s[2][last]) > 0.08*start || math.Abs(s[1][last]-s[2][last]) > 0.08*start {
		t.Errorf("equal cover, unequal fates: %g %g %g", s[0][last], s[1][last], s[2][last])
	}
}

func TestInvariants(t *testing.T) {
	for _, scene := range []string{"mountains", "crater"} {
		r := mustRun(t, Request{Scene: scene})
		n := r.Size * r.Size
		if len(r.Heights) != len(r.Times)*n || len(r.Cover) != n || r.Times[0] != 0 {
			t.Fatalf("%s: %d heights for %d frames of %d cells", scene, len(r.Heights), len(r.Times), n)
		}
		prevMax, prevSum := math.Inf(1), math.Inf(1)
		for f := range r.Times {
			max, sum := 0.0, 0.0
			for _, h := range r.Heights[f*n : (f+1)*n] {
				v := float64(h)
				if math.IsNaN(v) || math.IsInf(v, 0) {
					t.Fatalf("%s: frame %d not finite", scene, f)
				}
				max = math.Max(max, v)
				sum += v
			}
			// No uplift by default: nothing rises and no rock appears.
			if max > prevMax+1e-3 || sum > prevSum*(1+1e-6)+1 {
				t.Fatalf("%s: frame %d gained height (max %g after %g)", scene, f, max, prevMax)
			}
			prevMax, prevSum = max, sum
		}
	}
	a, b := mustRun(t, Request{Scene: "crater"}), mustRun(t, Request{Scene: "crater"})
	if !reflect.DeepEqual(a, b) {
		t.Error("identical requests gave different terrain")
	}
}

// With uplift and rain held steady, channels settle where incision
// matches uplift: U = K (A P)^m S^n, the stream power law itself.
func TestChannelsReachTheStreamPowerSteadyState(t *testing.T) {
	g := newGrid(40, 100)
	for i := range g.z {
		g.z[i] = float64((i*7919)%97) / 97
	}
	const uplift, rain, k = 2e-4, 0.5, 2e-6
	for i := range g.cover {
		g.cover[i] = 0
	}
	for step := 0; step < 1500; step++ {
		g.step(20000, uplift, rain, k, 0)
	}
	g.route()
	var ratios []float64
	for i := range g.z {
		r := g.receiver[i]
		if r < 0 || g.area[i] < 30*g.dx*g.dx {
			continue
		}
		slope := (g.z[i] - g.z[r]) / g.dist(i, r)
		ratios = append(ratios, k*math.Pow(g.area[i]*rain, mExp)*math.Pow(slope, nExp)/uplift)
	}
	if len(ratios) < 20 {
		t.Fatalf("only %d channel cells", len(ratios))
	}
	sort.Float64s(ratios)
	near(t, "median incision over uplift", ratios[len(ratios)/2], 1, 0.05)
}

// Creep alone moves rock downhill without making or destroying any.
func TestCreepConservesRock(t *testing.T) {
	g := newGrid(48, 100)
	for i := range g.z {
		x, y := float64(i%48)-24, float64(i/48)-24
		g.z[i] = 500 * math.Exp(-(x*x+y*y)/20)
	}
	sum := func() (s float64) {
		for _, v := range g.z {
			s += v
		}
		return
	}
	before, peak := sum(), g.z[24*48+24]
	for step := 0; step < 200; step++ {
		g.step(10000, 0, 0, 0, 0.02)
	}
	near(t, "rock kept", sum()/before, 1, 1e-3)
	if g.z[24*48+24] > 0.9*peak {
		t.Error("the hill did not spread")
	}
}

// The long runs take the longest steps; they must still agree with
// steps a quarter the size.
func TestLongRunsSurviveLongSteps(t *testing.T) {
	q := Request{Scene: "mountains", Params: map[string]float64{"duration": 20, "uplift": 0.3}}
	coarse := mustRun(t, q)
	q.Params["detail"] = 4
	fine := mustRun(t, q)
	l := len(coarse.Times) - 1
	for k := range coarse.Peaks {
		near(t, "summit", coarse.Peaks[k][l], fine.Peaks[k][l], 0.05*fine.Peaks[k][l]+20)
	}
	near(t, "relief", coarse.Relief[l], fine.Relief[l], 0.05*fine.Relief[l]+20)
}

func TestStepSizeDoesNotDecideTheOutcome(t *testing.T) {
	coarse := mustRun(t, Request{Scene: "mountains"})
	fine := mustRun(t, Request{Scene: "mountains", Params: map[string]float64{"detail": 2}})
	lc, lf := len(coarse.Times)-1, len(fine.Times)-1
	near(t, "bare peak", coarse.Peaks[2][lc], fine.Peaks[2][lf], 0.06*coarse.Peaks[2][0])
}

// The passage's dry planet keeps its crater; rain on bare ground wears
// it away.
func TestCraterOutlastsADryWorld(t *testing.T) {
	depth := func(r *Result) (first, last float64) {
		return r.Relief[0], r.Relief[len(r.Relief)-1]
	}
	dry := mustRun(t, Request{Scene: "crater", Params: map[string]float64{"cover": 0, "rain": 0}})
	wet := mustRun(t, Request{Scene: "crater", Params: map[string]float64{"cover": 0, "rain": 1}})
	d0, d1 := depth(dry)
	_, w1 := depth(wet)
	// Creep alone still softens it: about four tenths in 5 million years.
	if d1 < 0.5*d0 {
		t.Errorf("dry crater relief fell from %g to %g m", d0, d1)
	}
	if w1 > 0.8*d1 {
		t.Errorf("rain left the crater at %g m against %g m dry", w1, d1)
	}
}

func TestRequestErrorsNameTheField(t *testing.T) {
	for _, k := range []struct {
		q     Request
		field string
	}{
		{Request{Scene: "volcano"}, "scene"},
		{Request{Scene: "crater", Params: map[string]float64{"rain": -1}}, "params.rain"},
		{Request{Scene: "crater", Params: map[string]float64{"rian": 1}}, "params.rian"},
		{Request{Scene: "crater", Params: map[string]float64{"cover": math.NaN()}}, "params.cover"},
	} {
		_, err := Run(k.q)
		var fe *core.FieldError
		if !errors.As(err, &fe) || fe.Field != k.field {
			t.Errorf("want %s, got %v", k.field, err)
		}
	}
}
