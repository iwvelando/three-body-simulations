package earth

import (
	"math"
	"sort"

	"threebody/engine/core"
)

// Request asks for one history of the Earth.
type Request struct {
	// Life is the checkbox: with it off, nothing living acts on the planet.
	Life   bool               `json:"life"`
	Preset string             `json:"preset,omitempty"`
	Models map[string]string  `json:"models,omitempty"`
	Params map[string]float64 `json:"params,omitempty"`
	// Resolution is "coarse" (the default) or "fine".
	Resolution string `json:"resolution,omitempty"`
}

// Event marks a moment worth naming on the timeline.
type Event struct {
	ID   string  `json:"id"`
	Time float64 `json:"time"`
}

// Summary describes the planet at the end of the run.
type Summary struct {
	// State is "temperate", "hot", "frozen" or "dry".
	State string `json:"state"`
	// OceansLost is when the last water went, or 0 if it never did.
	OceansLost float64 `json:"oceansLost"`
	// Extrapolated reports that the climate left the range its model was
	// fitted over at some point after the planet cooled.
	Extrapolated bool `json:"extrapolated"`
}

// Resolved echoes the models and parameters a run used.
type Resolved struct {
	Models map[string]string  `json:"models"`
	Params map[string]float64 `json:"params"`
}

// Result is one history: samples of each quantity at the times in Time
// (Gyr since formation, denser near the start).
type Result struct {
	Life    bool                 `json:"life"`
	Time    []float64            `json:"time"`
	Series  map[string][]float64 `json:"series"`
	Events  []Event              `json:"events"`
	Summary Summary              `json:"summary"`
	Choice  Resolved             `json:"choice"`
}

const (
	samples     = 481
	magmaKelvin = 1800.0
	// One bar of CO2 over the whole Earth, in Tmol.
	tmolPerBar = 1.18e8
	// Present-day seafloor weathering (mod_sea of Krissansen-Totton et
	// al.) and the pore-water temperature it happens at.
	seafloorNow = 0.45 // Tmol C/yr
	poreNow     = 285.0
	gasConstant = 8.314
)

// sampleTime spaces the samples so the first moments are visible: the
// first earlySamples cover earlySpan quadratically, the rest are even.
func sampleTime(i int) float64 {
	const earlySamples, earlySpan = 40, 0.02
	if i >= samples-1 {
		return ageNow
	}
	if i <= earlySamples {
		x := float64(i) / earlySamples
		return earlySpan * x * x
	}
	return earlySpan + (ageNow-earlySpan)*float64(i-earlySamples)/float64(samples-1-earlySamples)
}

// world is a resolved request: every model choice turned into numbers and
// functions of the planet's state.
type world struct {
	life bool
	m    map[string]string
	p    map[string]float64
	// Productivity today, for the productivity-feedback model.
	productivityNow float64
}

func (w *world) sun(age float64) float64 {
	s := 1.0
	if w.m["sun"] == "gough" {
		s = luminosityGough(age)
	}
	d := w.p["sun.distance"]
	return s / (d * d)
}

func (w *world) temperature(pco2, sun float64) float64 {
	if w.m["climate"] == "simple" {
		return climateSimple(pco2, sun, w.p["climate.sensitivity"], w.p["climate.solar"])
	}
	return climateKT(pco2, sun)
}

func (w *world) heat(age float64) float64 {
	if w.m["outgassing"] == "constant" {
		return 1
	}
	return heatFlow(ago(age), w.p["outgassing.heat"])
}

// outgassing in Tmol C per year.
func (w *world) outgassing(age float64) float64 {
	f := w.p["outgassing.modern"] * w.p["outgassing.scale"]
	if w.m["outgassing"] == "declining" {
		f *= math.Pow(w.heat(age), w.p["outgassing.exponent"])
	}
	return f
}

func (w *world) alive(age float64) bool {
	return w.life && age >= w.p["biosphere.origin"]
}

// productivityAt is relative to today's.
func (w *world) productivityAt(age, T, pco2 float64) float64 {
	if !w.alive(age) {
		return 0
	}
	return productivity(T, pco2, w.p["biosphere.tmin"], w.p["biosphere.tmax"]) / w.productivityNow
}

// biology is the weathering rate relative to today's living Earth, from
// life alone.
func (w *world) biology(age, T, pco2 float64) float64 {
	switch w.m["biosphere"] {
	case "none":
		return 1
	case "productivity":
		return bioticFeedback(w.productivityAt(age, T, pco2), 1, w.p["biosphere.alpha"])
	}
	if !w.alive(age) {
		return 1 / w.p["biosphere.enhancement"]
	}
	return math.Max(bioKT(ago(age), w.p["biosphere.early"]), 1/w.p["biosphere.enhancement"])
}

// land is the weatherable land area relative to today.
func (w *world) land(age float64) float64 {
	grown := landKT(ago(age), w.p["land.archean"], w.p["land.timing"])
	if w.m["continents"] == "hoening" && !w.life {
		a := w.p["land.abiotic"]
		return a + (w.p["land.archean"]-a)*math.Exp(-age/w.p["land.relax"])
	}
	return grown
}

// sink is the carbon removed by weathering, in Tmol C per year.
func (w *world) sink(age, pco2, sun float64) float64 {
	T := w.temperature(pco2, sun)
	silicateNow := w.p["outgassing.modern"]
	sea := 0.0
	if w.m["carbon"] == "seafloor" {
		silicateNow -= seafloorNow
		pore := poreNow + w.p["seafloor.gradient"]*(T-tempNow)
		sea = seafloorNow * math.Pow(w.heat(age), w.p["seafloor.spreading"]) *
			math.Exp(-w.p["seafloor.energy"]*1e3/gasConstant*(1/pore-1/poreNow))
	}
	land := silicateNow * w.biology(age, T, pco2) * w.land(age) *
		math.Pow(pco2/co2Now, w.p["weathering.co2"]) * math.Exp((T-tempNow)/w.p["weathering.te"])
	return land + sea
}

// balance finds the CO2 pressure at which weathering matches outgassing.
// With the productivity feedback there can be several; the one nearest the
// previous step's is kept, so the planet stays on its branch until that
// branch ends.
func (w *world) balance(age, sun, previous float64) float64 {
	source := w.outgassing(age)
	g := func(lp float64) float64 { return w.sink(age, math.Pow(10, lp), sun) - source }
	const lo, hi, step = -7.0, 3.0, 0.05
	best, found := 0.0, false
	a, ga := lo, g(lo)
	for b := lo + step; b <= hi+1e-9; b += step {
		gb := g(b)
		if (ga <= 0) != (gb <= 0) {
			x0, x1, g0 := a, b, ga
			for i := 0; i < 40; i++ {
				mid := (x0 + x1) / 2
				gm := g(mid)
				if (gm <= 0) == (g0 <= 0) {
					x0, g0 = mid, gm
				} else {
					x1 = mid
				}
			}
			root := (x0 + x1) / 2
			if !found || math.Abs(root-previous) < math.Abs(best-previous) {
				best, found = root, true
			}
		}
		a, ga = b, gb
	}
	if !found {
		// Weathering cannot keep up anywhere in range (or outruns
		// outgassing everywhere): rest at the matching end.
		if ga < 0 {
			return math.Pow(10, hi)
		}
		return math.Pow(10, lo)
	}
	return math.Pow(10, best)
}

// oxygen in units of today's level.
func (w *world) oxygen(age float64) float64 {
	if !w.life {
		return 1e-12
	}
	step := func(center float64) float64 { return 1 / (1 + math.Exp(-(center-ago(age))/0.03)) }
	mid := math.Log10(w.p["oxygen.middle"])
	lg := -7 + (mid+7)*step(w.p["oxygen.first"]) + (0-mid)*step(w.p["oxygen.second"])
	if !w.alive(age) {
		return 1e-12
	}
	return math.Pow(10, lg)
}

// ozone is the ozone layer's strength, 0 to 1. Goldblatt, Lenton & Watson
// (2006) put the onset of shielding near 1e-5 of today's oxygen; it is
// taken as complete by 1e-2.
func ozone(oxygenPAL float64) float64 {
	x := (math.Log10(oxygenPAL) + 5) / 3
	x = math.Min(math.Max(x, 0), 1)
	return x * x * (3 - 2*x)
}

// shield is the planet's ultraviolet shield, 0 to 1: ozone once there is
// oxygen and, before that on a living Earth, the organic haze its methane
// makes (Arney et al. 2016). A lifeless Earth has neither. It is used for
// display and by the speculative stripping term only.
func (w *world) shield(age, oxygenPAL float64) float64 {
	if w.alive(age) {
		return 1
	}
	return ozone(oxygenPAL)
}

type state struct {
	T, pco2, sun, fWater, loss, o2, land, bio, prod float64
}

// at evaluates the planet at one time, given its water and, once the
// oceans are gone, the CO2 that has piled up.
func (w *world) at(age, water, dryCO2, previous float64) state {
	s := state{sun: w.sun(age), land: w.land(age), o2: w.oxygen(age)}
	if water > 0 {
		s.pco2 = w.balance(age, s.sun, previous)
	} else {
		s.pco2 = dryCO2
	}
	s.T = w.temperature(s.pco2, s.sun)
	s.bio = w.biology(age, s.T, s.pco2)
	s.prod = w.productivityAt(age, s.T, s.pco2)
	if water > 0 {
		if w.m["water"] == "diffusion" {
			air := w.p["nitrogen.pressure"] + 0.21*s.o2 + s.pco2
			s.fWater = coldTrapWater(s.T, air, w.p["water.trap"])
			s.loss = oceanLossRate(s.fWater)
		}
		if w.m["stripping"] == "unshielded" {
			s.loss += w.p["stripping.rate"] * (1 - w.shield(age, s.o2))
		}
	}
	return s
}

// Run computes one history.
func Run(q Request) (*Result, error) {
	choice, err := catalog.Resolve(q.Preset, q.Models, q.Params)
	if err != nil {
		return nil, err
	}
	substeps := 2
	switch q.Resolution {
	case "", "coarse":
	case "fine":
		substeps = 12
	default:
		return nil, &core.FieldError{Field: "resolution", Message: `Resolution must be "coarse" or "fine".`}
	}
	w := &world{life: q.Life, m: choice.Models, p: choice.Params}
	w.productivityNow = productivity(tempNow, co2Now, w.p["biosphere.tmin"], w.p["biosphere.tmax"])
	if w.productivityNow <= 0 {
		return nil, &core.FieldError{Field: "params.biosphere.tmax", Message: "Today's temperature must fall inside the growth window."}
	}

	names := []string{"luminosity", "temperature", "equilibrium", "co2", "o2", "n2", "ocean", "stratosphere", "loss",
		"land", "biology", "productivity", "shield", "melt", "ice", "vegetation"}
	r := &Result{Life: q.Life, Time: make([]float64, samples), Series: map[string][]float64{},
		Choice: Resolved{choice.Models, choice.Params}}
	for _, n := range names {
		r.Series[n] = make([]float64, samples)
	}
	event := func(id string, t float64) { r.Events = append(r.Events, Event{id, t}) }

	water := w.p["water.initial"]
	dryCO2, previous := 0.0, 1.0
	seen := map[string]bool{}
	once := func(id string, t float64, when bool) {
		if when && !seen[id] {
			seen[id] = true
			event(id, t)
		}
	}
	var s state
	record := func(i int, age float64) {
		melt := math.Exp(-age / w.p["early.magma"])
		T := s.T + (magmaKelvin-s.T)*melt
		wet := 0.0
		if water > 0 {
			wet = 1
		}
		plants := 0.0
		if w.alive(age) {
			c := s.T - 273.15
			grows := math.Min(math.Max(math.Min(c+5, 60-c)/15, 0), 1)
			plants = grows / (1 + math.Exp(-(0.42-ago(age))/0.02))
		}
		set := func(n string, v float64) { r.Series[n][i] = v }
		r.Time[i] = age
		set("luminosity", s.sun)
		set("temperature", T)
		set("equilibrium", s.T)
		set("co2", s.pco2)
		set("o2", 0.21*s.o2)
		set("n2", w.p["nitrogen.pressure"])
		set("ocean", water)
		set("stratosphere", s.fWater)
		set("loss", s.loss)
		set("land", s.land)
		set("biology", s.bio)
		set("productivity", s.prod)
		set("shield", w.shield(age, s.o2))
		set("melt", melt)
		set("ice", wet*(1-melt)*math.Min(math.Max((290-s.T)/30, 0), 1))
		set("vegetation", plants)
	}

	age := 0.0
	s = w.at(age, water, dryCO2, previous)
	record(0, age)
	for i := 1; i < samples; i++ {
		target := sampleTime(i)
		for k := 0; k < substeps; k++ {
			end := age + (target-age)/float64(substeps-k)
			for age < end {
				dt := end - age
				// Never let one step take more than 1% of an ocean.
				if s.loss*dt > 0.01 {
					dt = 0.01 / s.loss
				}
				if water > 0 {
					previous = math.Log10(s.pco2)
					water -= s.loss * dt
					if water <= 1e-9 {
						water, dryCO2 = 0, s.pco2
						r.Summary.OceansLost = age + dt
						event("oceans-lost", age+dt)
					}
				} else {
					// No water, no weathering: volcanic CO2 piles up.
					dryCO2 = math.Min(dryCO2+w.outgassing(age)*1e9/tmolPerBar*dt, 150)
				}
				age += dt
				if end-age < 1e-12 {
					age = end
				}
				s = w.at(age, water, dryCO2, previous)
				cooled := age > 5*w.p["early.magma"]
				once("surface-solid", age, age >= w.p["early.magma"]*math.Ln2)
				once("life-begins", age, w.alive(age))
				once("oxygen-rises", age, w.alive(age) && s.o2 > 1e-4)
				once("land-plants", age, w.alive(age) && ago(age) <= 0.42)
				once("moist-greenhouse", age, cooled && water > 0 && s.fWater > 1e-3)
				once("half-ocean", age, water < 0.5*w.p["water.initial"])
				if cooled {
					x := math.Log10(s.pco2)
					outside := x < ktLogMin || x > ktLogMax || s.sun < ktSunMin || s.sun > ktSunMax
					if outside && w.m["climate"] == "kt2018" {
						r.Summary.Extrapolated = true
					}
				}
			}
		}
		record(i, age)
	}
	sort.SliceStable(r.Events, func(a, b int) bool { return r.Events[a].Time < r.Events[b].Time })
	switch {
	case water == 0:
		r.Summary.State = "dry"
	case s.T > 320:
		r.Summary.State = "hot"
	case s.T < 268:
		r.Summary.State = "frozen"
	default:
		r.Summary.State = "temperate"
	}
	return r, nil
}
