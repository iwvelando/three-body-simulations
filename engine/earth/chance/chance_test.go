package chance

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

func defaults() map[string]float64 {
	p := map[string]float64{}
	for _, s := range Catalog().Params {
		p[s.ID] = s.Default
	}
	return p
}

// Tyrrell (2020), Methods: 2 to 20 nodes with equal chance, spread evenly
// from -10 to 60 C, feedbacks drawn from N(0, 100) C per thousand years,
// forcing from N(0, 50) per billion years, and expected perturbation counts
// from U(4000, 20000), U(40, 400) and U(0, 5).
func TestPlanetsAreDrawnAsPublished(t *testing.T) {
	p := defaults()
	counts := map[int]int{}
	var sum, sq, n, forcing, forcingSq float64
	for k := 0; k < 4000; k++ {
		pl := drawPlanet(7, k, p)
		counts[len(pl.f)]++
		for _, v := range pl.f {
			sum, sq, n = sum+v, sq+v*v, n+1
		}
		forcing, forcingSq = forcing+pl.forcing, forcingSq+pl.forcing*pl.forcing
		if pl.rate[0] < 4000 || pl.rate[0] > 20000 || pl.rate[1] < 40 || pl.rate[1] > 400 || pl.rate[2] < 0 || pl.rate[2] > 5 {
			t.Fatalf("perturbation rates %v", pl.rate)
		}
	}
	for nodes := 2; nodes <= 20; nodes++ {
		if c := counts[nodes]; c < 140 || c > 290 {
			t.Errorf("%d planets with %d nodes, want about 210", c, nodes)
		}
	}
	if len(counts) != 19 {
		t.Errorf("node counts %v", counts)
	}
	if sd := math.Sqrt(sq/n - (sum/n)*(sum/n)); math.Abs(sd-100) > 3 || math.Abs(sum/n) > 3 {
		t.Errorf("feedbacks: mean %g, sd %g", sum/n, sd)
	}
	if sd := math.Sqrt(forcingSq / 4000); math.Abs(sd-50) > 3 {
		t.Errorf("forcing sd %g", sd)
	}
	if !reflect.DeepEqual(drawPlanet(7, 5, p), drawPlanet(7, 5, p)) || reflect.DeepEqual(drawPlanet(7, 5, p), drawPlanet(8, 5, p)) {
		t.Error("a planet must depend on the seed and its number, and on nothing else")
	}
}

// The paper's designed planets: one that always pushes toward the middle
// of the range stayed habitable in all of 1,000 runs; one with no
// feedbacks at all, in none.
func TestDesignedPlanets(t *testing.T) {
	// "Perturbations were at the lower end of severity" and no forcing.
	p := defaults()
	optimal := planet{f: []float64{300, 300, -300, -300}, temps: []float64{-10, 25, 25, 60}, rate: [3]float64{4000, 40, 0}}
	inert := planet{f: []float64{0, 0}, temps: []float64{-10, 60}, rate: [3]float64{4000, 40, 0}}
	runaway := planet{f: []float64{-300, -300, 300, 300}, temps: []float64{-10, 25, 25, 60}, rate: [3]float64{4000, 40, 0}}
	if got := optimal.successes(1, 0, 300, p, 0); got != 300 {
		t.Errorf("optimal planet: %d of 300", got)
	}
	if got := inert.successes(1, 1, 300, p, 0); got != 0 {
		t.Errorf("planet without feedbacks: %d of 300", got)
	}
	if got := runaway.successes(1, 2, 300, p, 0); got != 0 {
		t.Errorf("planet that pushes outward: %d of 300", got)
	}
}

// The paper's headline: of 100,000 random planets each run 100 times,
// about 9% (8,710) stayed habitable at least once, only one every time,
// and success rates in between spanned the whole range.
func TestPopulationMatchesThePaper(t *testing.T) {
	if testing.Short() {
		t.Skip("large ensemble")
	}
	r := mustRun(t, Request{Seed: 2020, Count: 4000, Runs: 100, Params: map[string]float64{"life": 0}})
	once, always, middling := 0, 0, 0
	for _, s := range r.Chance {
		if s > 0 {
			once++
		}
		if s == 100 {
			always++
		}
		if s > 20 && s < 80 {
			middling++
		}
	}
	share := float64(once) / 4000
	if share < 0.07 || share > 0.105 {
		t.Errorf("%.1f%% of planets succeeded at least once; the paper found 8.7%%", 100*share)
	}
	if always > 3 {
		t.Errorf("%d of 4000 planets succeeded every time; the paper found 1 in 100,000", always)
	}
	if middling == 0 {
		t.Error("no planet with a middling success rate")
	}
}

// Skipping harmless accidents must change the time taken, not the odds.
func TestShortcutChangesNothingButTheTime(t *testing.T) {
	total := func(on bool) (wins, planets int) {
		shortcut = on
		defer func() { shortcut = true }()
		r := mustRun(t, Request{Seed: 11, Count: 1500, Runs: 20, Params: map[string]float64{"life": 0}})
		for _, s := range r.Chance {
			wins += s
			if s > 0 {
				planets++
			}
		}
		return
	}
	fastWins, fastPlanets := total(true)
	slowWins, slowPlanets := total(false)
	// Different draws of the same process: agree within sampling noise.
	if math.Abs(float64(fastPlanets-slowPlanets)) > 4*math.Sqrt(float64(slowPlanets)) {
		t.Errorf("planets surviving at least once: %d with the shortcut, %d without", fastPlanets, slowPlanets)
	}
	if math.Abs(float64(fastWins-slowWins)) > 0.2*float64(slowWins) {
		t.Errorf("surviving runs: %d with the shortcut, %d without", fastWins, slowWins)
	}
}

func TestChunksAndRepeatsAgree(t *testing.T) {
	whole := mustRun(t, Request{Seed: 3, Count: 120, Runs: 20})
	a := mustRun(t, Request{Seed: 3, Count: 50, Runs: 20})
	b := mustRun(t, Request{Seed: 3, From: 50, Count: 70, Runs: 20})
	if !reflect.DeepEqual(whole.Chance, append(a.Chance, b.Chance...)) || !reflect.DeepEqual(whole.Life, append(a.Life, b.Life...)) {
		t.Error("splitting the planets into chunks changed the results")
	}
	if other := mustRun(t, Request{Seed: 4, Count: 120, Runs: 20}); reflect.DeepEqual(whole.Chance, other.Chance) {
		t.Error("the seed changed nothing")
	}
}

// Life's thermostat is this site's addition: the same planets, the same
// accidents, plus a pull toward a comfortable temperature.
func TestLifeThermostat(t *testing.T) {
	none := mustRun(t, Request{Seed: 5, Count: 600, Runs: 30, Params: map[string]float64{"life": 0}})
	if !reflect.DeepEqual(none.Chance, none.Life) {
		t.Error("with no thermostat, life should change nothing")
	}
	some := mustRun(t, Request{Seed: 5, Count: 600, Runs: 30, Params: map[string]float64{"life": 20}})
	if !reflect.DeepEqual(some.Chance, none.Chance) {
		t.Error("the thermostat must not disturb the lifeless planets")
	}
	total := func(v []int) (s int) {
		for _, x := range v {
			s += x
		}
		return
	}
	if total(some.Life) <= 2*total(some.Chance) {
		t.Errorf("a strong thermostat helped little: %d against %d", total(some.Life), total(some.Chance))
	}
}

func TestRequestErrorsNameTheField(t *testing.T) {
	for _, k := range []struct {
		q     Request
		field string
	}{
		{Request{Count: 0, Runs: 10}, "count"},
		{Request{Count: 100000, Runs: 10}, "count"},
		{Request{Count: 10, Runs: 0}, "runs"},
		{Request{Count: 10, Runs: 10, From: -1}, "from"},
		{Request{Count: 10, Runs: 10, Params: map[string]float64{"nodes": 1}}, "params.nodes"},
		{Request{Count: 10, Runs: 10, Params: map[string]float64{"x": 1}}, "params.x"},
	} {
		_, err := Run(k.q)
		var fe *core.FieldError
		if !errors.As(err, &fe) || fe.Field != k.field {
			t.Errorf("want %s, got %v", k.field, err)
		}
	}
}

func TestSamplesDescribeThePlanets(t *testing.T) {
	r := mustRun(t, Request{Seed: 9, Count: 30, Runs: 5, Samples: 6})
	if len(r.Samples) != 6 {
		t.Fatalf("%d samples", len(r.Samples))
	}
	for _, s := range r.Samples {
		if len(s.Temps) != len(s.Feedback) || len(s.Temps) < 2 || s.Temps[0] != -10 || s.Temps[len(s.Temps)-1] != 60 {
			t.Errorf("sample %+v", s)
		}
	}
}

// The number of feedback points is a count, and the catalog says so, so
// its control never shows a fraction the engine would round away.
func TestFeedbackPointsAreAWholeNumber(t *testing.T) {
	for _, p := range Catalog().Params {
		if p.ID == "nodes" && !p.Whole {
			t.Fatal("nodes is not marked whole")
		}
	}
}
