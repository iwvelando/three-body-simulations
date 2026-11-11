package flat

import "math"

// Layer is one shell of a body, from the layer below it out to Outer.
type Layer struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	// Outer is the layer's outer radius in kilometers.
	Outer float64 `json:"outer"`
	// Density is the layer's mean density in kg/m³.
	Density float64 `json:"density"`
	Color   string  `json:"color"`
	// Schematic says why a boundary or density is not a published value.
	Schematic string `json:"schematic,omitempty"`
	// Sea marks water, which the novel has freeze into snow crystals on
	// the plane.
	Sea bool `json:"sea,omitempty"`
}

// Surface describes a body's face for drawing: a manner (a glowing
// "star", cratered "rock", "earth" with seas, land and cloud, swirled
// "cloud", or striped "bands") and its colors. For "earth" the colors
// are sea, land, desert and ice. Nothing is worked out from it.
type Surface struct {
	Kind   string   `json:"kind"`
	Colors []string `json:"colors"`
	// Spot is the color of one large marking, if the body has one.
	Spot string `json:"spot,omitempty"`
	// Rings is the color of a ring system, if the body has one.
	Rings string `json:"rings,omitempty"`
	// Caps says the poles are white.
	Caps bool `json:"caps,omitempty"`
}

var looks = map[string]Surface{
	"sun":     {Kind: "star", Colors: []string{"#fff6d8", "#ffb53f", "#ef6a1c"}},
	"mercury": {Kind: "rock", Colors: []string{"#8f8983", "#6c6660", "#a9a29a"}},
	"venus":   {Kind: "cloud", Colors: []string{"#ead9a8", "#d6bb7b", "#f4e9c6"}},
	"earth":   {Kind: "earth", Colors: []string{"#1b4a8c", "#3d7a3c", "#b79c64", "#f4f7fa"}},
	"mars":    {Kind: "rock", Colors: []string{"#b4532f", "#8a3b22", "#d28f60"}, Caps: true},
	"jupiter": {Kind: "bands", Colors: []string{"#e9dcc3", "#b07a52", "#dcc19a", "#9c6a48", "#efe4cf", "#c49364"}, Spot: "#b2472d"},
	"saturn":  {Kind: "bands", Colors: []string{"#efe2b6", "#d8c38a", "#f3ebcd", "#cdb57a"}, Rings: "#cbbd95"},
	"uranus":  {Kind: "bands", Colors: []string{"#a9e1e4", "#9bd8dc", "#b5e8ea"}},
	"neptune": {Kind: "bands", Colors: []string{"#3e6fe0", "#3460c9", "#5685ea", "#2f58bd"}, Spot: "#27469b"},
	"pluto":   {Kind: "rock", Colors: []string{"#b89c83", "#89705c", "#d9c7b2"}, Spot: "#eadfce"},
}

// Body is a round body as nested shells. Sizes, masses and orbits are
// from the NASA Planetary Fact Sheets; each body's Source names where
// its layers come from. docs/models-flat.md has the full record.
type Body struct {
	ID     string  `json:"id"`
	Label  string  `json:"label"`
	Radius float64 `json:"radius"`
	// Orbit is the mean distance from the Sun in kilometers.
	Orbit  float64 `json:"orbit"`
	Source string  `json:"source"`
	// Star marks a body that shines, drawn with flames at its rim.
	Star bool `json:"star,omitempty"`
	// Surface is how the body looks from outside before it falls.
	Surface Surface `json:"surface"`
	Layers  []Layer `json:"layers"`
}

const (
	cubicKm = 1e9 // m³ in a km³
	// AU is the Earth's mean distance from the Sun, in kilometers.
	AU = 149.6e6
)

func ball(r float64) float64 { return 4 * math.Pi * r * r * r / 3 }

func (b *Body) mass() float64 {
	total, inner := 0.0, 0.0
	for _, l := range b.Layers {
		total += l.Density * (ball(l.Outer) - ball(inner)) * cubicKm
		inner = l.Outer
	}
	return total
}

// cut is a layer given the way its source gives it: an outer radius and
// either a mean density or the share of the body's mass inside it.
type cut struct {
	id, label, color string
	outer            float64
	density          float64 // kg/m³, or
	inside           float64 // share of the body's mass within outer
	schematic        string
}

// shells turns cuts into layers. Where a cut names the mass inside it,
// the layer's density is that mass over the layer's volume; a cut with
// neither takes whatever mass is left.
func shells(mass float64, cuts []cut) []Layer {
	out := make([]Layer, len(cuts))
	inner, within := 0.0, 0.0
	for i, c := range cuts {
		volume := (ball(c.outer) - ball(inner)) * cubicKm
		density := c.density
		switch {
		case density > 0:
		case c.inside > 0:
			density = (c.inside*mass - within) / volume
		default:
			density = (mass - within) / volume
		}
		within += density * volume
		out[i] = Layer{ID: c.id, Label: c.label, Outer: c.outer, Density: density, Color: c.color, Schematic: c.schematic}
		inner = c.outer
	}
	return out
}

// PREM's density, in g/cm³, as polynomials in x = r / 6371 km
// (Dziewonski & Anderson 1981, Table I).
var prem = []struct {
	from, to float64
	c        [4]float64
}{
	{0, 1221.5, [4]float64{13.0885, 0, -8.8381, 0}},
	{1221.5, 3480, [4]float64{12.5815, -1.2638, -3.6426, -5.5281}},
	{3480, 5701, [4]float64{7.9565, -6.4761, 5.5283, -3.0807}},
	{5701, 5771, [4]float64{5.3197, -1.4836, 0, 0}},
	{5771, 5971, [4]float64{11.2494, -8.0298, 0, 0}},
	{5971, 6151, [4]float64{7.1089, -3.8045, 0, 0}},
	{6151, 6346.6, [4]float64{2.6910, 0.6924, 0, 0}},
	{6346.6, 6356, [4]float64{2.900, 0, 0, 0}},
	{6356, 6368, [4]float64{2.600, 0, 0, 0}},
	{6368, 6371, [4]float64{1.020, 0, 0, 0}},
}

// premDensity is the mean density in kg/m³ between two radii, by
// Simpson's rule on each polynomial piece.
func premDensity(from, to float64) float64 {
	mass := 0.0
	for _, p := range prem {
		lo, hi := math.Max(from, p.from), math.Min(to, p.to)
		if hi <= lo {
			continue
		}
		shell := func(r float64) float64 {
			x := r / 6371
			return (p.c[0] + x*(p.c[1]+x*(p.c[2]+x*p.c[3]))) * 4 * math.Pi * r * r
		}
		const n = 64
		step := (hi - lo) / n
		sum := shell(lo) + shell(hi)
		for i := 1; i < n; i++ {
			w := 2.0
			if i%2 == 1 {
				w = 4
			}
			sum += w * shell(lo+float64(i)*step)
		}
		mass += sum * step / 3
	}
	return 1000 * mass / (ball(to) - ball(from))
}

const (
	citeNASA   = "NASA Planetary Fact Sheets (Williams, NSSDCA)"
	citePREM   = "Dziewonski & Anderson (1981)"
	citeSun    = "Christensen-Dalsgaard et al. (1991, 1996)"
	citeHauck  = "Hauck et al. (2013)"
	citeMars   = "Stähler et al. (2021)"
	citeGiants = "Guillot (1999)"
	citeIce    = "Nettelmann et al. (2013)"
)

var bodies = func() []*Body {
	earthCore := premDensity(0, 3480) * ball(3480) * cubicKm
	earthMass := premDensity(0, 6371) * ball(6371) * cubicKm
	const (
		sun, mercury, venus, mars = 1.9884e30, 0.330e24, 4.87e24, 0.642e24
		jupiter, saturn           = 1898e24, 568e24
		uranus, neptune, pluto    = 86.8e24, 102e24, 0.0130e24
	)
	return []*Body{
		{ID: "sun", Label: "The Sun", Radius: 695700, Star: true, Source: citeSun + "; core boundary conventional", Layers: shells(sun, []cut{
			// Mass inside each boundary by integrating Model S's density.
			{id: "core", label: "Core", color: "#fff6dc", outer: 0.25 * 695700, inside: 0.4817, schematic: "The core has no sharp edge; a quarter of the radius is the usual convention."},
			{id: "radiative", label: "Radiation zone", color: "#e8502a", outer: 0.713 * 695700, inside: 0.9756},
			{id: "convective", label: "Convection zone", color: "#f6a93b", outer: 695700},
		})},
		{ID: "mercury", Label: "Mercury", Radius: 2439.7, Orbit: 57.9e6, Source: citeHauck, Layers: shells(mercury, []cut{
			{id: "core", label: "Core", color: "#c9b79a", outer: 2020, density: 6980},
			{id: "mantle", label: "Mantle and crust", color: "#7d766e", outer: 2439.7, density: 3380},
		})},
		{ID: "venus", Label: "Venus", Radius: 6051.8, Orbit: 108.2e6, Source: "Earth's proportions; Venus's core has not been measured", Layers: shells(venus, []cut{
			{id: "core", label: "Core", color: "#d9b77c", outer: 6051.8 * 3480 / 6371, inside: earthCore / earthMass, schematic: "Venus's core has not been measured. This is the Earth's, scaled."},
			{id: "mantle", label: "Mantle and crust", color: "#b5803f", outer: 6051.8},
		})},
		{ID: "earth", Label: "The Earth", Radius: 6371, Orbit: AU, Source: citePREM, Layers: []Layer{
			{ID: "inner-core", Label: "Inner core", Outer: 1221.5, Density: premDensity(0, 1221.5), Color: "#f3e3b3"},
			{ID: "outer-core", Label: "Outer core", Outer: 3480, Density: premDensity(1221.5, 3480), Color: "#e0a04a"},
			{ID: "mantle", Label: "Mantle", Outer: 6346.6, Density: premDensity(3480, 6346.6), Color: "#a2492c"},
			{ID: "crust", Label: "Crust", Outer: 6368, Density: premDensity(6346.6, 6368), Color: "#6b5a4b"},
			{ID: "ocean", Label: "Ocean", Outer: 6371, Density: premDensity(6368, 6371), Color: "#eef4fb", Sea: true},
		}},
		{ID: "mars", Label: "Mars", Radius: 3389.5, Orbit: 228.0e6, Source: citeMars, Layers: shells(mars, []cut{
			{id: "core", label: "Core", color: "#e3b877", outer: 1830, density: 6000},
			{id: "mantle", label: "Mantle and crust", color: "#a7482a", outer: 3389.5},
		})},
		{ID: "jupiter", Label: "Jupiter", Radius: 69911, Orbit: 778.5e6, Source: citeGiants, Layers: shells(jupiter, []cut{
			{id: "metallic", label: "Metallic hydrogen", color: "#8f6f5b", outer: 0.80 * 69911, inside: 0.85},
			{id: "molecular", label: "Molecular hydrogen", color: "#dcb98c", outer: 69911},
		})},
		{ID: "saturn", Label: "Saturn", Radius: 58232, Orbit: 1432.0e6, Source: citeGiants, Layers: shells(saturn, []cut{
			{id: "core", label: "Core", color: "#3d3229", outer: 11070, inside: 0.1, schematic: "The paper gives the core a tenth of the mass and no size. This radius assumes 10 g/cm³."},
			{id: "metallic", label: "Metallic hydrogen", color: "#a58b68", outer: 0.50 * 58232, inside: 0.5},
			{id: "molecular", label: "Molecular hydrogen", color: "#f3e3b0", outer: 58232},
		})},
		{ID: "uranus", Label: "Uranus", Radius: 25362, Orbit: 2867.0e6, Source: citeIce + ", model U1", Layers: shells(uranus, []cut{
			{id: "core", label: "Rock core", color: "#33302d", outer: 0.176 * 25362, inside: 0.61 / 14.538},
			{id: "inner", label: "Water-rich inner envelope", color: "#e9f1f2", outer: 0.772 * 25362, inside: 0.913},
			{id: "outer", label: "Hydrogen-rich outer envelope", color: "#8fd3d6", outer: 25362},
		})},
		{ID: "neptune", Label: "Neptune", Radius: 24622, Orbit: 4515.0e6, Source: citeIce + ", model N1; core size from the novel", Layers: shells(neptune, []cut{
			{id: "core", label: "Rock core", color: "#2b2a2e", outer: 0.927*24622 - 20000, inside: 3.15 / 17.148, schematic: "The paper gives the core's mass and no size. This leaves the mantle the 20,000 km the novel gives it."},
			{id: "inner", label: "Water-rich mantle", color: "#f1f3f5", outer: 0.927 * 24622, inside: 0.953},
			{id: "outer", label: "Hydrogen and helium", color: "#3f6fe0", outer: 24622},
		})},
		{ID: "pluto", Label: "Pluto", Radius: 1188, Orbit: 5906.4e6, Source: "Two layers that give Pluto's mean density; not a published model", Layers: shells(pluto, []cut{
			{id: "core", label: "Rock core", color: "#6d5f55", outer: 841, density: 3500, schematic: "Rock at 3.5 g/cm³ under ice at 0.95 g/cm³, sized to give Pluto's mean density."},
			{id: "ice", label: "Ice", color: "#e6ddd0", outer: 1188, density: 950, schematic: "See the core."},
		})},
	}
}()

func init() {
	for _, b := range bodies {
		b.Surface = looks[b.ID]
	}
}

func body(id string) *Body {
	for _, b := range bodies {
		if b.ID == id {
			return b
		}
	}
	return nil
}
