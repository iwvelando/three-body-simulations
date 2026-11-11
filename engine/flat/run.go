package flat

import (
	"math"

	"threebody/engine/core"
)

// Request asks for one body's fall into the plane.
type Request struct {
	Body   string             `json:"body,omitempty"`
	Preset string             `json:"preset,omitempty"`
	Models map[string]string  `json:"models,omitempty"`
	Params map[string]float64 `json:"params,omitempty"`
	// Resolution is "coarse" (the default) or "fine": how many moments
	// of the fall are returned.
	Resolution string `json:"resolution,omitempty"`
}

// Ring is where one layer of the body ends up, shell by shell.
type Ring struct {
	Layer string  `json:"layer"`
	Inner float64 `json:"inner"`
	Outer float64 `json:"outer"`
}

// Band is one strip of the flat picture, from the band inside it out to
// its own edge. Mix is how much of it came from each of the body's
// layers, in the layers' order, adding up to one.
type Band struct {
	Mix []float64 `json:"mix"`
}

// Frames are moments of the fall, evenly spaced from first touch to the
// last of the body going under. Lengths are kilometers, times seconds.
type Frames struct {
	Time []float64 `json:"time"`
	// Sink is the height of the plane above the body's center.
	Sink []float64 `json:"sink"`
	// Foot is the radius of the body where the plane cuts it.
	Foot []float64 `json:"foot"`
	// Rim is the outer edge of the flat picture.
	Rim []float64 `json:"rim"`
	// Bands[i][k] is the outer edge of band k at moment i.
	Bands [][]float64 `json:"bands"`
}

// Resolved echoes the models and parameters a run used.
type Resolved struct {
	Models map[string]string  `json:"models"`
	Params map[string]float64 `json:"params"`
}

// Result is one body's fall.
type Result struct {
	Body *Body `json:"body"`
	// Area of the flat picture in km², and its radius in km.
	Area   float64 `json:"area"`
	Radius float64 `json:"radius"`
	// Duration of the fall in seconds.
	Duration float64 `json:"duration"`
	// Crossing is when the flat picture becomes wider than what is left
	// of the body; RimSpeed is the rim's mean speed until then, km/s.
	Crossing        float64 `json:"crossing"`
	RimSpeed        float64 `json:"rimSpeed"`
	FasterThanLight bool    `json:"fasterThanLight"`
	// Rings are the layers' places when matter lands shell by shell.
	Rings []Ring `json:"rings"`
	// Grain is how many rings the picture has: the layers, shell by
	// shell; one for each sheet's thickness of depth when it spreads.
	Grain float64 `json:"grain"`
	Bands []Band  `json:"bands"`
	// Person is how wide a person (0.07 m³) would be, in km.
	Person float64  `json:"person"`
	Frames Frames   `json:"frames"`
	Choice Resolved `json:"choice"`
}

const lightSpeed = 299792.458 // km/s

// fall is one body under one choice of models.
type fall struct {
	body   *Body
	weight []float64 // flat area per volume of each layer, against 1/h
	h      float64   // sheet thickness, km
	speed  float64   // the plane's, km/s
	spread bool
}

func newFall(b *Body, c core.Choice) fall {
	f := fall{body: b, h: c.Params["sheet.thickness"] / 1000, spread: c.Models["landing"] == "spread"}
	f.speed = 2 * body("sun").Radius / (c.Params["plane.hour"] * 60)
	f.weight = make([]float64, len(b.Layers))
	for i, l := range b.Layers {
		f.weight[i] = 1
		if c.Models["kept"] == "mass" {
			f.weight[i] = l.Density / 1000
		}
	}
	return f
}

// below is the volume of the ball of radius r that lies under height
// top and above height bottom, both measured from its center.
func below(r, bottom, top float64) float64 {
	g := func(z float64) float64 {
		z = math.Max(-r, math.Min(r, z))
		return r*r*z - z*z*z/3
	}
	return math.Pi * (g(top) - g(bottom))
}

// between is how much of each layer lies between two heights.
func (f fall) between(bottom, top float64) []float64 {
	out := make([]float64, len(f.body.Layers))
	inner := 0.0
	for i, l := range f.body.Layers {
		out[i] = f.weight[i] * (below(l.Outer, bottom, top) - below(inner, bottom, top))
		inner = l.Outer
	}
	return out
}

func sum(v []float64) float64 {
	total := 0.0
	for _, x := range v {
		total += x
	}
	return total
}

// swallowed is how much matter within radius r of the center has gone
// under when the plane stands at height z: of the shell at radius s,
// the cap below z, which is 2πs(z + s) of its 4πs².
func (f fall) swallowed(r, z float64) float64 {
	total, inner := 0.0, 0.0
	whole := func(s float64) float64 { return 4 * math.Pi * s * s * s / 3 }
	part := func(s float64) float64 { return 2 * math.Pi * (z*s*s/2 + s*s*s/3) }
	for i, l := range f.body.Layers {
		lo, hi := inner, math.Min(l.Outer, r)
		inner = l.Outer
		if hi <= lo {
			continue
		}
		// Shells smaller than |z| are wholly under or wholly above.
		edge := math.Max(lo, math.Min(hi, math.Abs(z)))
		if z > 0 {
			total += f.weight[i] * (whole(edge) - whole(lo))
		}
		total += f.weight[i] * (part(hi) - part(edge))
	}
	// Rounding can leave a hair less than nothing.
	return math.Max(0, total)
}

func (f fall) foot(z float64) float64 {
	r := f.body.Radius
	return math.Sqrt(math.Max(0, r*r-z*z))
}

// rim is the flat picture's outer edge with the plane at height z.
func (f fall) rim(z float64) float64 {
	r := f.body.Radius
	// Nothing overlaps and nothing is lost, so however the matter is
	// arranged the picture's area is all that has gone in.
	return math.Sqrt(f.swallowed(r, z) / f.h / math.Pi)
}

const slices = 48

// bands gives the outer edge of every band with the plane at height z.
func (f fall) bands(z float64) []float64 {
	r := f.body.Radius
	if !f.spread {
		out := make([]float64, len(f.body.Layers))
		for i, l := range f.body.Layers {
			out[i] = math.Sqrt(f.swallowed(l.Outer, z) / (f.h * math.Pi))
		}
		return out
	}
	// A slice that went in at height s has been pushed out by all that
	// went in after it, which lies inside it, the newest still under the
	// body. Slices are listed from the top down, so the last one in is
	// first and innermost.
	out := make([]float64, slices)
	for k := range out {
		s := r - 2*r*float64(k+1)/slices
		if k == slices-1 {
			s = -r
		}
		after := 0.0
		if s < z {
			after = sum(f.between(s, z)) / f.h
		}
		out[k] = math.Sqrt(after / math.Pi)
	}
	return out
}

func resolve(q Request) (core.Choice, *Body, int, error) {
	c, err := catalog.Resolve(q.Preset, q.Models, q.Params)
	if err != nil {
		return c, nil, 0, err
	}
	id := q.Body
	if id == "" {
		id = bodies[0].ID
	}
	b := body(id)
	if b == nil {
		return c, nil, 0, &core.FieldError{Field: "body", Message: "Unknown body."}
	}
	switch q.Resolution {
	case "", "coarse":
		return c, b, 96, nil
	case "fine":
		return c, b, 384, nil
	}
	return c, nil, 0, &core.FieldError{Field: "resolution", Message: `Resolution must be "coarse" or "fine".`}
}

// Run drops one body into the plane.
func Run(q Request) (*Result, error) {
	c, b, steps, err := resolve(q)
	if err != nil {
		return nil, err
	}
	f := newFall(b, c)
	r := b.Radius
	out := &Result{Body: b, Duration: 2 * r / f.speed, Choice: Resolved{Models: c.Models, Params: c.Params}}
	out.Area = f.swallowed(r, r) / f.h
	out.Radius = math.Sqrt(out.Area / math.Pi)
	// A person: 70 kg at the density of water.
	out.Person = 2 * math.Sqrt(0.07/c.Params["sheet.thickness"]/math.Pi) / 1000

	// When the flat picture is first wider than what is left standing:
	// the whole body until half of it is under, then the footprint.
	left := func(z float64) float64 {
		if z < 0 {
			return r
		}
		return f.foot(z)
	}
	lo, hi := -r, r
	for i := 0; i < 80; i++ {
		mid := (lo + hi) / 2
		if f.rim(mid) < left(mid) {
			lo = mid
		} else {
			hi = mid
		}
	}
	out.Crossing = (hi + r) / f.speed
	out.RimSpeed = f.rim(hi) / out.Crossing
	out.FasterThanLight = out.RimSpeed > lightSpeed

	out.Grain = float64(len(b.Layers))
	if f.spread {
		out.Grain = 2 * r / f.h
	}
	_, out.Bands = f.layout()
	inner := 0.0
	for i, edge := range func() []float64 { s := f; s.spread = false; return s.bands(r) }() {
		out.Rings = append(out.Rings, Ring{Layer: b.Layers[i].ID, Inner: inner, Outer: edge})
		inner = edge
	}

	for i := 0; i <= steps; i++ {
		z := -r + 2*r*float64(i)/float64(steps)
		if i == steps {
			z = r
		}
		out.Frames.Time = append(out.Frames.Time, out.Duration*float64(i)/float64(steps))
		out.Frames.Sink = append(out.Frames.Sink, z)
		out.Frames.Foot = append(out.Frames.Foot, f.foot(z))
		edges := f.bands(z)
		out.Frames.Bands = append(out.Frames.Bands, edges)
		out.Frames.Rim = append(out.Frames.Rim, edges[len(edges)-1])
	}
	return out, nil
}
