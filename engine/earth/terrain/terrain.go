// Package terrain evolves a patch of the Earth's surface under rain,
// creep and uplift, with vegetation holding the ground. It is the zoomed-in
// companion to the planet-scale run in package earth.
//
// The laws are those of Schmid et al. (2018), Earth Surf. Dynam. 6, 859,
// who follow Istanbulluoglu & Bras (2005): detachment-limited stream power
// with a vegetation-dependent erodibility (their eqs. 6 to 10) and linear
// creep with a vegetation-dependent diffusivity (eq. 4). The implicit
// solution of the stream power law is Braun & Willett's (2013), as set out
// by Barnes (2018, arXiv:1803.02977, Algorithm 6). docs/models.md records
// what is simplified.
package terrain

import (
	"fmt"
	"math"

	"threebody/engine/core"
)

// Schmid et al. (2018), Table 1.
const (
	manningBare      = 0.01
	manningVegetated = 0.6
	creepAlpha       = 0.3
	mExp             = 0.6
	nExp             = 0.7
)

// erodibility is the fluvial erodibility under vegetation cover v (0 to 1)
// relative to bare ground. From their eqs. 7 to 9 with w = 1,
// K_v ∝ (n_s + n_v)^0.6 (n_s / (n_s + n_v))^1.5, n_v = n_vr v, which
// relative to v = 0 is (n_s / (n_s + n_v))^0.9.
func erodibility(v float64) float64 {
	return math.Pow(manningBare/(manningBare+manningVegetated*v), 0.9)
}

// creep is their eq. 4 relative to the base diffusivity: exp(-alpha v).
func creep(v float64) float64 { return math.Exp(-creepAlpha * v) }

type grid struct {
	n        int
	dx       float64
	z, cover []float64
	receiver []int
	area     []float64
	order    []int
	load     []float64
	// Scratch for route, and values that depend only on the cover, which
	// is fixed for a run: computing them once keeps powers and
	// exponentials out of the inner loops.
	first, next, stack []int
	kCover, cx, cy     []float64
	prepared           bool
}

func newGrid(n int, dx float64) *grid {
	g := &grid{n: n, dx: dx, z: make([]float64, n*n), cover: make([]float64, n*n),
		receiver: make([]int, n*n), area: make([]float64, n*n), order: make([]int, 0, n*n), load: make([]float64, n*n),
		first: make([]int, n*n), next: make([]int, n*n), stack: make([]int, 0, n*n),
		kCover: make([]float64, n*n), cx: make([]float64, n*n), cy: make([]float64, n*n)}
	return g
}

func (g *grid) edge(i int) bool {
	x, y := i%g.n, i/g.n
	return x == 0 || y == 0 || x == g.n-1 || y == g.n-1
}

func (g *grid) dist(i, j int) float64 {
	if i%g.n != j%g.n && i/g.n != j/g.n {
		return g.dx * math.Sqrt2
	}
	return g.dx
}

// route sends each cell's water to its steepest downhill neighbor of
// eight, and sums the area draining through every cell. Edge cells are the
// base level: they drain off the patch. A cell with no lower neighbor is a
// closed basin and keeps its water.
func (g *grid) route() {
	n := g.n
	for i := range g.z {
		g.receiver[i] = -1
		g.area[i] = g.dx * g.dx
		if g.edge(i) {
			continue
		}
		best := 0.0
		for dy := -1; dy <= 1; dy++ {
			for dx := -1; dx <= 1; dx++ {
				if dx == 0 && dy == 0 {
					continue
				}
				j := i + dy*n + dx
				if s := (g.z[i] - g.z[j]) / g.dist(i, j); s > best {
					best, g.receiver[i] = s, j
				}
			}
		}
	}
	// Order the cells so each comes after the cell it drains to: walk up
	// every drainage tree from its outlet (Braun & Willett's stack). This
	// takes time proportional to the number of cells, where sorting by
	// height would not.
	for i := range g.first {
		g.first[i] = -1
	}
	for i := len(g.z) - 1; i >= 0; i-- {
		if r := g.receiver[i]; r >= 0 {
			g.next[i] = g.first[r]
			g.first[r] = i
		}
	}
	g.order = g.order[:0]
	for i := range g.z {
		if g.receiver[i] >= 0 {
			continue
		}
		g.stack = append(g.stack[:0], i)
		for len(g.stack) > 0 {
			c := g.stack[len(g.stack)-1]
			g.stack = g.stack[:len(g.stack)-1]
			g.order = append(g.order, c)
			for d := g.first[c]; d >= 0; d = g.next[d] {
				g.stack = append(g.stack, d)
			}
		}
	}
	for k := len(g.order) - 1; k >= 0; k-- {
		i := g.order[k]
		if r := g.receiver[i]; r >= 0 {
			g.area[r] += g.area[i]
		}
	}
}

// step advances the patch by dt years. uplift is in m/yr, rain in m/yr,
// kBare is the bare-ground erodibility and kCreep the base diffusivity in
// m2/yr.
func (g *grid) step(dt, uplift, rain, kBare, kCreep float64) {
	if !g.prepared {
		g.prepared = true
		n := g.n
		for i, v := range g.cover {
			g.kCover[i] = erodibility(v)
			if i%n+1 < n {
				g.cx[i] = (creep(v) + creep(g.cover[i+1])) / 2
			}
			if i/n+1 < n {
				g.cy[i] = (creep(v) + creep(g.cover[i+n])) / 2
			}
		}
	}
	if uplift != 0 {
		for i := range g.z {
			if !g.edge(i) {
				g.z[i] += uplift * dt
			}
		}
	}
	if rain > 0 && kBare > 0 {
		g.route()
		for i := range g.load {
			g.load[i] = 0
		}
		// Outlets first, so each cell's receiver is already at its new
		// height: h - h0 + F (h - hr)^n = 0, solved by a Newton
		// iteration kept inside (hr, h0].
		straight, diagonal := math.Pow(g.dx, nExp), math.Pow(g.dx*math.Sqrt2, nExp)
		for _, i := range g.order {
			r := g.receiver[i]
			if r < 0 {
				continue
			}
			h0, hr := g.z[i], g.z[r]
			if h0 <= hr {
				continue
			}
			reach := straight
			if i%g.n != r%g.n && i/g.n != r/g.n {
				reach = diagonal
			}
			f := kBare * g.kCover[i] * dt * math.Pow(g.area[i]*rain, mExp) / reach
			lo, hi, h := hr, h0, h0
			for it := 0; it < 40; it++ {
				d := h - hr
				pow := f * math.Pow(d, nExp)
				v := h - h0 + pow
				if v > 0 {
					hi = h
				} else {
					lo = h
				}
				next := h - v/(1+nExp*pow/d)
				if !(next > lo && next < hi) {
					next = (lo + hi) / 2
				}
				if math.Abs(next-h) < 1e-4 {
					h = next
					break
				}
				h = next
			}
			g.load[i] += h0 - h
			g.z[i] = h
		}
		// Rock worn off the slopes is carried downstream. What reaches
		// a closed basin settles there, up to its brim; what reaches
		// the edge leaves the patch.
		for k := len(g.order) - 1; k >= 0; k-- {
			i := g.order[k]
			if r := g.receiver[i]; r >= 0 {
				g.load[r] += g.load[i]
			} else if !g.edge(i) && g.load[i] > 0 {
				brim := math.Inf(1)
				for dy := -1; dy <= 1; dy++ {
					for dx := -1; dx <= 1; dx++ {
						if dx != 0 || dy != 0 {
							brim = math.Min(brim, g.z[i+dy*g.n+dx])
						}
					}
				}
				g.z[i] += math.Min(g.load[i], math.Max(0, brim-g.z[i])+0.01)
			}
		}
	}
	if kCreep > 0 {
		// Explicit diffusion, substepped to stay stable.
		sub := int(math.Ceil(kCreep * dt / (g.dx * g.dx) / 0.2))
		if sub < 1 {
			sub = 1
		}
		c := kCreep * dt / float64(sub) / (g.dx * g.dx)
		n := g.n
		for s := 0; s < sub; s++ {
			for i := range g.load {
				g.load[i] = 0
			}
			for y := 0; y < n; y++ {
				for x := 0; x < n; x++ {
					i := y*n + x
					if x+1 < n {
						q := c * g.cx[i] * (g.z[i] - g.z[i+1])
						g.load[i] -= q
						g.load[i+1] += q
					}
					if y+1 < n {
						q := c * g.cy[i] * (g.z[i] - g.z[i+n])
						g.load[i] -= q
						g.load[i+n] += q
					}
				}
			}
			for i := range g.z {
				if !g.edge(i) {
					g.z[i] += g.load[i]
				}
			}
		}
	}
}

// Scene is a starting landscape and the question it poses.
type Scene struct {
	ID       string             `json:"id"`
	Label    string             `json:"label"`
	Summary  string             `json:"summary"`
	Defaults map[string]float64 `json:"defaults"`
}

// Descriptor lists the scenes and the adjustable parameters.
type Descriptor struct {
	Scenes   []Scene      `json:"scenes"`
	Params   []core.Param `json:"params"`
	Citation string       `json:"citation"`
}

var descriptor = &Descriptor{
	Scenes: []Scene{
		{ID: "mountains", Label: "Three mountains", Summary: "Three like mountains, two under vegetation and one bare, as in the passage.",
			Defaults: map[string]float64{"cover": 1, "rain": 1, "duration": 2}},
		{ID: "crater", Label: "A crater's fate", Summary: "A range and a fresh impact crater, left to the weather of the planet you choose.",
			Defaults: map[string]float64{"cover": 0, "rain": 0, "duration": 5}},
	},
	Params: []core.Param{
		{ID: "cover", Label: "Vegetation cover", Unit: "", Min: 0, Max: 1, Default: 1, Help: "Share of the ground under plants. In Three mountains it covers two of the three.", When: core.Always, Basic: true},
		{ID: "rain", Label: "Rain", Unit: "m per year", Min: 0, Max: 2, Default: 1, Help: "Rain that runs off and cuts channels. None on a planet without oceans.", When: core.Always, Basic: true},
		{ID: "duration", Label: "Time", Unit: "million years", Min: 0.1, Max: 20, Default: 2, Log: true, Help: "How long the weather works on the land.", When: core.Always, Basic: true},
		{ID: "uplift", Label: "Uplift", Unit: "mm per year", Min: 0, Max: 1, Default: 0, Help: "How fast the crust rises under the patch.", When: core.Always},
		{ID: "erodibility", Label: "Bare-ground erodibility", Unit: "×1e-6", Min: 0.2, Max: 30, Default: 1, Log: true, Help: "How easily running water cuts unprotected rock.", When: core.Always},
		{ID: "creep", Label: "Soil creep", Unit: "m² per year", Min: 0.001, Max: 0.1, Default: 0.02, Log: true, Help: "How fast slopes smooth themselves without running water.", When: core.Always},
		{ID: "detail", Label: "Time-step detail", Unit: "×", Min: 1, Max: 4, Default: 1, Help: "Divides the time step. For checking that results do not hinge on it.", When: core.Always},
	},
	Citation: "Schmid et al. 2018, Earth Surf. Dynam. 6, 859, after Istanbulluoglu & Bras 2005; solved as in Braun & Willett 2013",
}

// Catalog describes what a terrain request may ask for.
func Catalog() *Descriptor { return descriptor }

// Request asks for one landscape history.
type Request struct {
	Scene  string             `json:"scene"`
	Params map[string]float64 `json:"params,omitempty"`
}

// Result is the landscape at each of Times (million years). Heights holds
// one Size by Size field per time, row by row, in meters; Cover the
// vegetation on each cell. The transport moves both out of the JSON.
type Result struct {
	Scene string    `json:"scene"`
	Size  int       `json:"size"`
	Cell  float64   `json:"cell"`
	Times []float64 `json:"times"`
	// Peaks is each mountain's summit height at each time (Three
	// mountains only; the last is the bare one).
	Peaks [][]float64 `json:"peaks,omitempty"`
	// Relief is, for the crater, its rim's height above its floor; for
	// the mountains, the patch's highest point above its lowest.
	Relief  []float64          `json:"relief"`
	Params  map[string]float64 `json:"params"`
	Heights []float32          `json:"-"`
	Cover   []float32          `json:"-"`
}

const (
	size   = 96
	cell   = 100.0
	frames = 25
)

// A fixed, reproducible roughness: value noise from an integer hash.
func hash(x, y, seed int) float64 {
	h := uint32(x)*374761393 + uint32(y)*668265263 + uint32(seed)*2246822519
	h = (h ^ (h >> 13)) * 1274126177
	return float64((h^(h>>16))&0xffff) / 65535
}

func smooth(x, y float64, seed int) float64 {
	x0, y0 := math.Floor(x), math.Floor(y)
	fx, fy := x-x0, y-y0
	fx, fy = fx*fx*(3-2*fx), fy*fy*(3-2*fy)
	a, b := hash(int(x0), int(y0), seed), hash(int(x0)+1, int(y0), seed)
	c, d := hash(int(x0), int(y0)+1, seed), hash(int(x0)+1, int(y0)+1, seed)
	return a + (b-a)*fx + (c-a)*fy + (a-b-c+d)*fx*fy
}

func fbm(x, y float64, seed int) float64 {
	sum, amp := 0.0, 0.5
	for o := 0; o < 4; o++ {
		sum += amp * smooth(x, y, seed+o)
		x, y, amp = x*2, y*2, amp/2
	}
	return sum / 0.9375
}

var summits = [3][2]float64{{28, 30}, {68, 30}, {48, 66}}

const craterX, craterY, craterR = 62.0, 58.0, 13.0

// Run computes one landscape history.
func Run(q Request) (*Result, error) {
	var scene *Scene
	for i := range descriptor.Scenes {
		if descriptor.Scenes[i].ID == q.Scene {
			scene = &descriptor.Scenes[i]
		}
	}
	if scene == nil {
		return nil, &core.FieldError{Field: "scene", Message: fmt.Sprintf("Unknown scene %q.", q.Scene)}
	}
	p := map[string]float64{}
	specs := map[string]core.Param{}
	for _, s := range descriptor.Params {
		specs[s.ID] = s
		p[s.ID] = s.Default
	}
	for k, v := range scene.Defaults {
		p[k] = v
	}
	for k, v := range q.Params {
		s, ok := specs[k]
		if !ok {
			return nil, &core.FieldError{Field: "params." + k, Message: fmt.Sprintf("Unknown parameter %q.", k)}
		}
		if math.IsNaN(v) || v < s.Min || v > s.Max {
			return nil, &core.FieldError{Field: "params." + k, Message: fmt.Sprintf("%s must be between %g and %g %s.", s.Label, s.Min, s.Max, s.Unit)}
		}
		p[k] = v
	}

	g := newGrid(size, cell)
	for i := range g.z {
		x, y := float64(i%size), float64(i/size)
		switch scene.ID {
		case "mountains":
			nearest, best := 0, math.Inf(1)
			for k, s := range summits {
				d2 := (x-s[0])*(x-s[0]) + (y-s[1])*(y-s[1])
				g.z[i] += 1500 * math.Exp(-d2/(2*9*9))
				if d2 < best {
					nearest, best = k, d2
				}
			}
			g.z[i] += 2 * hash(i%size, i/size, 7)
			if nearest < 2 {
				g.cover[i] = p["cover"]
			}
		case "crater":
			// A range along one side falling to a plain, and the crater.
			ridge := math.Exp(-math.Pow((y-20-6*math.Sin(x/11))/14, 2))
			g.z[i] = 150 + 1900*ridge*math.Pow(fbm(x/14, y/14, 3), 1.3) + 40*fbm(x/6, y/6, 11)
			r := math.Hypot(x-craterX, y-craterY)
			if r < craterR {
				g.z[i] -= 380 * (1 - (r/craterR)*(r/craterR))
			}
			g.z[i] += 130 * math.Exp(-math.Pow((r-craterR)/4, 2))
			g.cover[i] = p["cover"]
		}
		if g.edge(i) {
			g.z[i] = 0
		}
	}

	// Steps of about 20,000 years, but between 4 and 24 per frame: the
	// implicit scheme stays stable with longer steps, and creep substeps
	// itself. TestStepSizeDoesNotDecideTheOutcome guards the accuracy.
	years := p["duration"] * 1e6
	perFrame := int(math.Ceil(years / 20000 / (frames - 1)))
	perFrame = int(math.Min(24, math.Max(4, float64(perFrame))) * p["detail"])
	dt := years / float64(perFrame*(frames-1))

	r := &Result{Scene: scene.ID, Size: size, Cell: cell, Params: p,
		Heights: make([]float32, 0, frames*size*size), Cover: make([]float32, size*size)}
	for i, v := range g.cover {
		r.Cover[i] = float32(v)
	}
	if scene.ID == "mountains" {
		r.Peaks = make([][]float64, 3)
	}
	record := func(f int) {
		r.Times = append(r.Times, p["duration"]*float64(f)/(frames-1))
		lo, hi := math.Inf(1), math.Inf(-1)
		for i, v := range g.z {
			r.Heights = append(r.Heights, float32(v))
			if !g.edge(i) {
				lo, hi = math.Min(lo, v), math.Max(hi, v)
			}
		}
		switch scene.ID {
		case "mountains":
			for k, s := range summits {
				top := 0.0
				for i, v := range g.z {
					if math.Hypot(float64(i%size)-s[0], float64(i/size)-s[1]) <= 6 {
						top = math.Max(top, v)
					}
				}
				r.Peaks[k] = append(r.Peaks[k], top)
			}
			r.Relief = append(r.Relief, hi-lo)
		case "crater":
			rim, count, floor := 0.0, 0.0, math.Inf(1)
			for i, v := range g.z {
				d := math.Hypot(float64(i%size)-craterX, float64(i/size)-craterY)
				if math.Abs(d-craterR) <= 1 {
					rim += v
					count++
				}
				if d < craterR/2 {
					floor = math.Min(floor, v)
				}
			}
			r.Relief = append(r.Relief, rim/count-floor)
		}
	}
	record(0)
	for f := 1; f < frames; f++ {
		for s := 0; s < perFrame; s++ {
			g.step(dt, p["uplift"]/1000, p["rain"], p["erodibility"]*1e-6, p["creep"])
		}
		record(f)
	}
	return r, nil
}
