// Package chance asks how often a planet stays habitable by luck. It is
// the model of Tyrrell (2020), Communications Earth & Environment 1, 61:
// planets with randomly drawn climate feedbacks, each run many times
// against random accidents, to see which keep a habitable temperature for
// three billion years. docs/models.md records what is simplified.
package chance

import (
	"fmt"
	"math"
	"math/rand/v2"

	"threebody/engine/core"
)

// The habitable range of the paper, in Celsius.
const coldest, hottest = -10.0, 60.0

// The paper's three classes of accident: mean and spread of the
// temperature jump, in Celsius (its eq. 6).
var jumps = [3][2]float64{{2, 1}, {8, 4}, {32, 16}}

// The span the paper's expected accident counts refer to, in billions of
// years.
const paperSpan = 3.0

// planet is what stays the same every time a planet is rerun: its
// feedbacks, its long-term forcing and how accident-prone its
// neighborhood is.
type planet struct {
	// f is the warming rate in C per thousand years at each of temps;
	// between them it is interpolated (eqs. 2 to 4).
	temps, f []float64
	// forcing drifts the warming rate, in C per thousand years per
	// billion years (eq. 5).
	forcing float64
	// rate is the expected number of small, medium and large accidents
	// in three billion years (eq. 7).
	rate [3]float64
}

func drawPlanet(seed int64, number int, p map[string]float64) planet {
	rng := rand.New(rand.NewPCG(uint64(seed), 2*uint64(number)))
	nodes := 2 + rng.IntN(int(p["nodes"])-1)
	pl := planet{temps: make([]float64, nodes), f: make([]float64, nodes)}
	for i := range pl.f {
		pl.temps[i] = coldest + float64(i)*(hottest-coldest)/float64(nodes-1)
		pl.f[i] = rng.NormFloat64() * p["feedback"]
	}
	pl.temps[nodes-1] = hottest
	pl.forcing = rng.NormFloat64() * p["forcing"]
	pl.rate = [3]float64{4000 + 16000*rng.Float64(), 40 + 360*rng.Float64(), 5 * rng.Float64()}
	return pl
}

// world is a planet at one moment, with or without life's thermostat:
// the net warming rate is f(T) + forcing t - life (T - comfort).
type world struct {
	*planet
	drift, life, comfort float64
}

// rate is the warming rate at T, read on segment s (between temps[s] and
// temps[s+1]). Naming the segment matters where two nodes share a
// temperature and the rate jumps.
func (w *world) rate(s int, T float64) float64 {
	a, b := w.temps[s], w.temps[s+1]
	f := w.f[s]
	if b > a {
		f += (w.f[s+1] - w.f[s]) * (T - a) / (b - a)
	}
	return f + w.drift - w.life*(T-w.comfort)
}

// settle lets the temperature run to rest. The feedbacks move the planet
// tens of degrees in a thousand years, while accidents come hundreds of
// thousands of years apart and the forcing changes over millions, so the
// planet is taken to reach its resting temperature at once: it slides the
// way its warming rate points until that rate passes through zero, or it
// leaves the habitable range.
func (w *world) settle(T float64) (float64, bool) {
	last := len(w.temps) - 2
	s := 0
	for s < last && T >= w.temps[s+1] {
		s++
	}
	g := w.rate(s, T)
	if g == 0 {
		return T, true
	}
	up := g > 0
	for {
		end := w.temps[s]
		if up {
			end = w.temps[s+1]
		}
		ge := w.rate(s, end)
		if ge == 0 || (ge > 0) != up {
			// The rate changes sign inside this segment, on a line.
			if g == ge {
				return T, true
			}
			return T + (end-T)*g/(g-ge), true
		}
		T, g = end, ge
		if up {
			s++
		} else {
			s--
		}
		if s < 0 || s > last {
			return T, false
		}
		// Across a jump the rate may reverse: the planet rests there.
		g = w.rate(s, T)
		if g == 0 || (g > 0) != up {
			return T, true
		}
	}
}

// basin finds how far the temperature can be knocked from rest at T, down
// and up, and still come back: to the nearest point where the warming rate
// turns to push it away, or to the edge of the habitable range.
func (w *world) basin(T float64) (lo, hi float64) {
	last := len(w.temps) - 2
	at := 0
	for at < last && T >= w.temps[at+1] {
		at++
	}
	lo, hi = coldest, hottest
	// Below rest the rate should be positive; find where it stops being.
	x, g := T, 1.0
	for s := at; s >= 0; s-- {
		end := w.temps[s]
		ge := w.rate(s, end)
		if ge <= 0 {
			if s == at {
				g = w.rate(s, x)
			} else {
				g = w.rate(s, w.temps[s+1])
			}
			if g <= 0 {
				lo = x
			} else {
				lo = x + (end-x)*g/(g-ge)
			}
			break
		}
		x = end
	}
	x = T
	for s := at; s <= last; s++ {
		end := w.temps[s+1]
		ge := w.rate(s, end)
		if ge >= 0 {
			if s == at {
				g = w.rate(s, x)
			} else {
				g = w.rate(s, w.temps[s])
			}
			if g >= 0 {
				hi = x
			} else {
				hi = x + (end-x)*g/(g-ge)
			}
			break
		}
		x = end
	}
	return lo, hi
}

// shortcut lets a run skip the small accidents while they cannot matter.
// Tests turn it off to check that it changes nothing but the time taken.
var shortcut = true

// Accidents no larger than these cannot matter: seven deviations beyond
// the mean of a small accident (2 ± 1 C) and six beyond a medium one
// (8 ± 4 C).
var harmless = [2]float64{9, 32}

// survives runs the planet once against one draw of accidents and reports
// whether it stayed habitable throughout.
func (w *world) survives(rng *rand.Rand, years float64) bool {
	T, ok := w.settle(coldest + (hottest-coldest)*rng.Float64())
	if !ok {
		return false
	}
	total := w.planet.rate[0] + w.planet.rate[1] + w.planet.rate[2]
	forcing := w.forcing
	for t := 0.0; ; {
		// Small accidents make up nearly all of them. While the planet
		// rests more than a harmless distance inside its basin they
		// cannot dislodge it, so only the rarer, larger ones are drawn;
		// with more room still, only the largest. Accidents arrive
		// without memory, so this is the same process. The basin is
		// looked at again whenever the forcing has moved the warming
		// rate by half a degree per thousand years.
		all, skipped := total, 0.0
		if shortcut {
			lo, hi := w.basin(T)
			room := math.Min(T-lo, hi-T)
			if room > harmless[1] {
				skipped = w.planet.rate[0] + w.planet.rate[1]
			} else if room > harmless[0] {
				skipped = w.planet.rate[0]
			}
			all -= skipped
		}
		wait := math.Inf(1)
		if all > 0 {
			wait = rng.ExpFloat64() * paperSpan / all
		}
		if skipped > 0 && forcing != 0 {
			if look := 0.5 / math.Abs(forcing); look < wait {
				t += look
				if t >= years {
					break
				}
				w.drift = forcing * t
				if T, ok = w.settle(T); !ok {
					return false
				}
				continue
			}
		}
		t += wait
		if t >= years {
			break
		}
		// Rest again under the forcing as it now stands, then the jolt.
		w.drift = forcing * t
		if T, ok = w.settle(T); !ok {
			return false
		}
		class, pick := 0, skipped+rng.Float64()*all
		if pick > w.planet.rate[0] {
			class = 1
			if pick > w.planet.rate[0]+w.planet.rate[1] {
				class = 2
			}
		}
		size := jumps[class][0] + jumps[class][1]*rng.NormFloat64()
		if rng.IntN(2) == 0 {
			size = -size
		}
		T += size
		if T < coldest || T > hottest {
			return false
		}
		if T, ok = w.settle(T); !ok {
			return false
		}
	}
	w.drift = forcing * years
	_, ok = w.settle(T)
	return ok
}

// successes reruns a planet and counts the runs it survives. The accidents
// of run r depend only on the seed, the planet's number and r, so the same
// planet meets the same accidents with and without life.
func (pl *planet) successes(seed int64, number, runs int, p map[string]float64, life float64) int {
	won := 0
	for r := 0; r < runs; r++ {
		rng := rand.New(rand.NewPCG(uint64(seed)^0x9e3779b97f4a7c15*uint64(r+1), 2*uint64(number)+1))
		w := world{planet: pl, life: life, comfort: p["comfort"]}
		if w.survives(rng, p["years"]) {
			won++
		}
	}
	return won
}

// Descriptor lists the adjustable parameters. Speculative names those
// with no published basis.
type Descriptor struct {
	Params      []core.Param `json:"params"`
	Speculative []string     `json:"speculative"`
	Citation    string       `json:"citation"`
}

var descriptor = &Descriptor{
	Params: []core.Param{
		{ID: "life", Label: "Life's thermostat", Unit: "°C per thousand years, per °C", Min: 0, Max: 50, Default: 10, Help: "How hard life pulls a planet back toward a comfortable temperature. Speculative.", When: core.Always, Basic: true},
		{ID: "comfort", Label: "Comfortable temperature", Unit: "°C", Min: 0, Max: 50, Default: 25, Help: "The temperature life pulls toward. Speculative.", When: core.Always},
		{ID: "years", Label: "Time to last", Unit: "billion years", Min: 0.5, Max: 4, Default: 3, Help: "How long a planet must stay habitable to count.", When: core.Always, Basic: true},
		{ID: "feedback", Label: "Feedback strength", Unit: "°C per thousand years", Min: 10, Max: 300, Default: 100, Log: true, Help: "Typical size of a planet's random warming and cooling tendencies.", When: core.Always},
		{ID: "forcing", Label: "Long-term drift", Unit: "°C per thousand years, per billion years", Min: 0, Max: 150, Default: 50, Help: "Typical size of the slow push from a brightening star and the like.", When: core.Always},
		{ID: "nodes", Label: "Most feedback points", Unit: "", Min: 2, Max: 40, Default: 20, Help: "The most points at which a planet's tendencies are drawn. More makes for a more intricate climate.", When: core.Always},
	},
	Speculative: []string{"life", "comfort"},
	Citation:    "Tyrrell 2020, Communications Earth & Environment 1, 61",
}

// Catalog describes what a chance request may ask for.
func Catalog() *Descriptor { return descriptor }

// Request asks for the fates of planets From to From+Count-1 of the
// population the seed defines, each rerun Runs times. Any split of the
// population into requests gives the same planets the same fates.
type Request struct {
	Seed    int64              `json:"seed"`
	From    int                `json:"from"`
	Count   int                `json:"count"`
	Runs    int                `json:"runs"`
	Samples int                `json:"samples,omitempty"`
	Params  map[string]float64 `json:"params,omitempty"`
}

// Sample is one planet's feedback curve, for drawing.
type Sample struct {
	Temps    []float64 `json:"temps"`
	Feedback []float64 `json:"feedback"`
	Forcing  float64   `json:"forcing"`
	Chance   int       `json:"chance"`
	Life     int       `json:"life"`
}

// Result is how many of its runs each planet survived: by chance alone,
// and with life's thermostat added.
type Result struct {
	From    int                `json:"from"`
	Runs    int                `json:"runs"`
	Chance  []int              `json:"chance"`
	Life    []int              `json:"life"`
	Samples []Sample           `json:"samples,omitempty"`
	Params  map[string]float64 `json:"params"`
}

// Run computes one chunk of the ensemble.
func Run(q Request) (*Result, error) {
	switch {
	case q.Count < 1 || q.Count > 5000:
		return nil, &core.FieldError{Field: "count", Message: "Ask for between 1 and 5000 planets at a time."}
	case q.Runs < 1 || q.Runs > 200:
		return nil, &core.FieldError{Field: "runs", Message: "Each planet can be rerun between 1 and 200 times."}
	case q.From < 0 || q.From > 10_000_000:
		return nil, &core.FieldError{Field: "from", Message: "The first planet's number is out of range."}
	case q.Samples < 0 || q.Samples > 100:
		return nil, &core.FieldError{Field: "samples", Message: "Ask for at most 100 sample planets."}
	}
	p := map[string]float64{}
	specs := map[string]core.Param{}
	for _, s := range descriptor.Params {
		specs[s.ID] = s
		p[s.ID] = s.Default
	}
	for k, v := range q.Params {
		s, ok := specs[k]
		if !ok {
			return nil, &core.FieldError{Field: "params." + k, Message: fmt.Sprintf("Unknown parameter %q.", k)}
		}
		if math.IsNaN(v) || v < s.Min || v > s.Max {
			return nil, &core.FieldError{Field: "params." + k, Message: fmt.Sprintf("%s must be between %g and %g.", s.Label, s.Min, s.Max)}
		}
		p[k] = v
	}
	p["nodes"] = math.Round(p["nodes"])
	r := &Result{From: q.From, Runs: q.Runs, Chance: make([]int, q.Count), Life: make([]int, q.Count), Params: p}
	for i := 0; i < q.Count; i++ {
		number := q.From + i
		pl := drawPlanet(q.Seed, number, p)
		r.Chance[i] = pl.successes(q.Seed, number, q.Runs, p, 0)
		r.Life[i] = r.Chance[i]
		if p["life"] > 0 {
			r.Life[i] = pl.successes(q.Seed, number, q.Runs, p, p["life"])
		}
		if i < q.Samples {
			r.Samples = append(r.Samples, Sample{pl.temps, pl.f, pl.forcing, r.Chance[i], r.Life[i]})
		}
	}
	return r, nil
}
