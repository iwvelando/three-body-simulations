package flat

import (
	"math"
	"sort"

	"threebody/engine/core"
)

// SkyRequest asks for the whole flattened Solar System. Seed 0 is the
// arrangement the novel implies; any other seed shuffles the planets
// around their orbits.
type SkyRequest struct {
	Preset string             `json:"preset,omitempty"`
	Models map[string]string  `json:"models,omitempty"`
	Params map[string]float64 `json:"params,omitempty"`
	Seed   int                `json:"seed,omitempty"`
}

// SkyBody is one flattened body: where it is, how wide, and when it fell.
type SkyBody struct {
	Body *Body `json:"body"`
	// X and Y are its place in kilometers, the Sun at the origin.
	X float64 `json:"x"`
	Y float64 `json:"y"`
	// Radius of its flat picture, km.
	Radius float64 `json:"radius"`
	// Order is its turn to fall, counting from 1.
	Order int `json:"order"`
	// Edges are the bands' outer edges as shares of Radius.
	Edges []float64 `json:"edges"`
	Bands []Band    `json:"bands"`
}

// SkyResult is the flattened Solar System.
type SkyResult struct {
	Bodies []SkyBody `json:"bodies"`
	// Origin is where the plane began to spread.
	Origin [2]float64 `json:"origin"`
	// Covered is the planets' flat area as a share of the disc inside
	// Neptune's orbit. The Sun is left out.
	Covered float64 `json:"covered"`
	// Touching lists pairs whose flat pictures would overlap.
	Touching [][2]string `json:"touching"`
	Choice   Resolved    `json:"choice"`
}

// Where each body is in the novel's telling, in degrees around the Sun
// from the side the plane arrives on. The passages fix only the order:
// Neptune and Saturn fall first, then the Earth and Mercury, then the
// Sun, then Venus and Mars; Uranus is on the far side. Pluto is where
// the story is watched from.
var novelPhase = map[string]float64{
	"neptune": 0, "saturn": 10, "earth": 0, "mercury": 20, "venus": 180,
	"mars": 170, "jupiter": 150, "uranus": 180, "pluto": 90,
}

// splitmix64, so a seed gives the same sky everywhere.
type rng uint64

func (r *rng) next() float64 {
	*r += 0x9e3779b97f4a7c15
	z := uint64(*r)
	z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9
	z = (z ^ (z >> 27)) * 0x94d049bb133111eb
	z ^= z >> 31
	return float64(z>>11) / (1 << 53)
}

// layout is the finished picture's bands: outer edges and what is in
// each.
func (f fall) layout() ([]float64, []Band) {
	r := f.body.Radius
	var bands []Band
	if f.spread {
		for k := 0; k < slices; k++ {
			top := r - 2*r*float64(k)/slices
			mix := f.between(top-2*r/slices, top)
			total := sum(mix)
			for i := range mix {
				mix[i] /= total
			}
			bands = append(bands, Band{Mix: mix})
		}
	} else {
		for i := range f.body.Layers {
			mix := make([]float64, len(f.body.Layers))
			mix[i] = 1
			bands = append(bands, Band{Mix: mix})
		}
	}
	return f.bands(r), bands
}

// Sky flattens every body where it stands.
func Sky(q SkyRequest) (*SkyResult, error) {
	c, err := catalog.Resolve(q.Preset, q.Models, q.Params)
	if err != nil {
		return nil, err
	}
	if q.Seed < 0 || q.Seed > 1<<30 {
		return nil, &core.FieldError{Field: "seed", Message: "The seed must be a whole number from 0 to about a billion."}
	}
	out := &SkyResult{Choice: Resolved{Models: c.Models, Params: c.Params}, Touching: [][2]string{}}
	neptune := body("neptune").Orbit
	out.Origin = [2]float64{neptune, 0}
	random := rng(q.Seed)
	planets := 0.0
	for _, b := range bodies {
		f := newFall(b, c)
		edges, bands := f.layout()
		radius := edges[len(edges)-1]
		for i := range edges {
			edges[i] /= radius
		}
		phase := novelPhase[b.ID] * math.Pi / 180
		if q.Seed != 0 {
			phase = 2 * math.Pi * random.next()
		}
		out.Bodies = append(out.Bodies, SkyBody{Body: b, X: b.Orbit * math.Cos(phase), Y: b.Orbit * math.Sin(phase), Radius: radius, Edges: edges, Bands: bands})
		if b.Orbit > 0 {
			planets += math.Pi * radius * radius
		}
	}
	out.Covered = planets / (math.Pi * neptune * neptune)
	// The plane spreads evenly from where it began, so bodies fall in
	// order of their distance from there.
	far := func(b SkyBody) float64 { return math.Hypot(b.X-out.Origin[0], b.Y-out.Origin[1]) }
	turn := make([]int, len(out.Bodies))
	for i := range turn {
		turn[i] = i
	}
	sort.SliceStable(turn, func(a, b int) bool { return far(out.Bodies[turn[a]]) < far(out.Bodies[turn[b]]) })
	for n, i := range turn {
		out.Bodies[i].Order = n + 1
	}
	for i, a := range out.Bodies {
		for _, b := range out.Bodies[i+1:] {
			if math.Hypot(a.X-b.X, a.Y-b.Y) < a.Radius+b.Radius {
				out.Touching = append(out.Touching, [2]string{a.Body.ID, b.Body.ID})
			}
		}
	}
	return out, nil
}
