// Package diaz is Wallfacer Rey Diaz's plan from The Dark Forest: bombs
// slow Mercury until it falls into the Sun, the Sun throws out a spiral
// of gas, and the gas drags the other planets in after it. Each step has
// a model from published physics, and the three steps the physics does
// not allow also have an invented one, marked speculative.
// docs/models-diaz.md records what each is built on.
package diaz

import (
	"math"

	"threebody/engine/core"
)

const (
	// Newton's constant, m³/(kg·s²) (CODATA 2018).
	gravity = 6.6743e-11
	// The astronomical unit, meters (IAU 2012).
	au  = 1.495978707e11
	day = 86400.0
	// The Sun, from NASA's Sun Fact Sheet.
	sunGM     = 1.32712e20 // m³/s²
	sunMass   = 1.9884e30  // kg
	sunRadius = 6.957e8    // m
	sunTurn   = 609.12 * 3600
	sunTilt   = 7.25 * math.Pi / 180
	// The base of the convection zone, as a share of the radius
	// (Christensen-Dalsgaard et al. 1991).
	convectionBase = 0.713
	// The Earth's air and water, kg (NASA's Earth Fact Sheet).
	earthAir = 5.1e18
	earthSea = 1.4e21
	// Heat to bring a kilogram of sea water from 15 °C to the boil and
	// boil it away: 4186 J/(kg·K) × 85 K + 2.257e6 J/kg.
	boil = 4186*85 + 2.257e6
)

// Body is the Sun or a planet. Masses and radii are NASA's Planetary
// Fact Sheets; the orbits are JPL's approximate elements for 1800 to
// 2050 (Standish & Williams), with the Earth standing for the
// Earth-Moon barycenter.
type Body struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	// Mass in kilograms.
	Mass float64 `json:"mass"`
	// Radius in kilometers.
	Radius float64 `json:"radius"`
	// Orbit is the semi-major axis in AU.
	Orbit   float64      `json:"orbit"`
	Star    bool         `json:"star,omitempty"`
	Surface core.Surface `json:"surface"`
	// a (AU), e, I, L, longitude of perihelion, longitude of the node
	// (degrees) at J2000, and their change per century.
	el, rate [6]float64
}

var bodies = []*Body{
	{ID: "sun", Label: "The Sun", Mass: sunMass, Radius: sunRadius / 1000, Star: true},
	{ID: "mercury", Label: "Mercury", Mass: 0.33010e24, Radius: 2439.7,
		el:   [6]float64{0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593},
		rate: [6]float64{0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081}},
	{ID: "venus", Label: "Venus", Mass: 4.87e24, Radius: 6051.8,
		el:   [6]float64{0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255},
		rate: [6]float64{0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418}},
	{ID: "earth", Label: "The Earth", Mass: 5.9722e24, Radius: 6371,
		el:   [6]float64{1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0},
		rate: [6]float64{0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0}},
	{ID: "mars", Label: "Mars", Mass: 0.642e24, Radius: 3389.5,
		el:   [6]float64{1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891},
		rate: [6]float64{0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343}},
	{ID: "jupiter", Label: "Jupiter", Mass: 1898.13e24, Radius: 69911,
		el:   [6]float64{5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909},
		rate: [6]float64{-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106}},
	{ID: "saturn", Label: "Saturn", Mass: 568e24, Radius: 58232,
		el:   [6]float64{9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448},
		rate: [6]float64{-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794}},
	{ID: "uranus", Label: "Uranus", Mass: 86.8e24, Radius: 25362,
		el:   [6]float64{19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503},
		rate: [6]float64{-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589}},
	{ID: "neptune", Label: "Neptune", Mass: 102e24, Radius: 24622,
		el:   [6]float64{30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574},
		rate: [6]float64{0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664}},
}

func init() {
	for _, b := range bodies {
		b.Surface = core.Looks[b.ID]
		b.Orbit = b.el[0]
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

const rad = math.Pi / 180

// anomaly solves Kepler's equation M = E - e·sin E. The left side grows
// with E, so halving the interval always finds it, even at e = 1.
func anomaly(mean, e float64) float64 {
	turns := math.Floor(mean / (2 * math.Pi))
	mean -= turns * 2 * math.Pi
	lo, hi := 0.0, 2*math.Pi
	for i := 0; i < 60; i++ {
		mid := (lo + hi) / 2
		if mid-e*math.Sin(mid) < mean {
			lo = mid
		} else {
			hi = mid
		}
	}
	return (lo+hi)/2 + turns*2*math.Pi
}

// place is a point of an orbit in the J2000 ecliptic frame, in the units
// of a: JPL's steps 4 and 5. Angles are radians; peri and node are
// longitudes.
func place(a, e, tilt, peri, node, mean float64) [3]float64 {
	E := anomaly(mean, e)
	x, y := a*(math.Cos(E)-e), a*math.Sqrt(math.Max(0, 1-e*e))*math.Sin(E)
	w := peri - node
	cw, sw, cn, sn, ci, si := math.Cos(w), math.Sin(w), math.Cos(node), math.Sin(node), math.Cos(tilt), math.Sin(tilt)
	return [3]float64{
		(cw*cn-sw*sn*ci)*x + (-sw*cn-cw*sn*ci)*y,
		(cw*sn+sw*cn*ci)*x + (-sw*sn+cw*cn*ci)*y,
		sw*si*x + cw*si*y,
	}
}

// elements are a body's orbit a number of days after J2000, angles in
// radians and the mean anomaly last.
func (b *Body) elements(days float64) (a, e, tilt, peri, node, mean float64) {
	T := days / 36525
	v := [6]float64{}
	for i := range v {
		v[i] = b.el[i] + b.rate[i]*T
	}
	return v[0], v[1], v[2] * rad, v[4] * rad, v[5] * rad, (v[3] - v[4]) * rad
}

// position is where a planet is, in AU, a number of days after J2000.
func (b *Body) position(days float64) [3]float64 {
	a, e, tilt, peri, node, mean := b.elements(days)
	return place(a, e, tilt, peri, node, mean)
}

// period is the time an orbit of semi-major axis a (meters) takes.
func period(a float64) float64 { return 2 * math.Pi * math.Sqrt(a*a*a/sunGM) }

// pushDay is the first time after J2000 that Mercury is at aphelion,
// in days: the cheapest place to slow it.
var pushDay = func() float64 {
	m := body("mercury")
	at := 0.0
	for i := 0; i < 8; i++ {
		_, _, _, _, _, mean := m.elements(at)
		gap := math.Mod(math.Pi-mean, 2*math.Pi)
		if gap < -math.Pi {
			gap += 2 * math.Pi
		}
		at += gap / ((m.rate[3] - m.rate[4]) * rad / 36525)
	}
	return at
}()

// aphelion is Mercury's greatest distance from the Sun at the push, in
// meters, and its speed there.
func aphelion() (far, speed float64) {
	a, e, _, _, _, _ := body("mercury").elements(pushDay)
	far = a * au * (1 + e)
	return far, math.Sqrt(sunGM * (1 - e) / (a * au * (1 + e)))
}

// turn rotates v by an angle about the Sun's axis, which leans 7.25
// degrees from the ecliptic's. Which way it leans is not modeled.
func turn(v [3]float64, angle float64) [3]float64 {
	k := [3]float64{0, -math.Sin(sunTilt), math.Cos(sunTilt)}
	c, s := math.Cos(angle), math.Sin(angle)
	dot := k[0]*v[0] + k[1]*v[1] + k[2]*v[2]
	cross := [3]float64{k[1]*v[2] - k[2]*v[1], k[2]*v[0] - k[0]*v[2], k[0]*v[1] - k[1]*v[0]}
	var out [3]float64
	for i := range out {
		out[i] = v[i]*c + cross[i]*s + k[i]*dot*(1-c)
	}
	return out
}

func unit(v [3]float64) [3]float64 {
	n := math.Sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2])
	if n == 0 {
		return [3]float64{1, 0, 0}
	}
	return [3]float64{v[0] / n, v[1] / n, v[2] / n}
}

// splitmix64, so the same request scatters its gas the same way
// everywhere.
type rng uint64

func (r *rng) next() float64 {
	*r += 0x9e3779b97f4a7c15
	z := uint64(*r)
	z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9
	z = (z ^ (z >> 27)) * 0x94d049bb133111eb
	z ^= z >> 31
	return float64(z>>11) / (1 << 53)
}
