package mozi

import (
	"math"

	"threebody/engine/core"
)

// The clerk's frame: z is up, the floor is the horizon. Time is in days,
// one day being one turn of the main gear.

type vec [3]float64

// quat is a unit quaternion (w, x, y, z).
type quat [4]float64

func (a quat) mul(b quat) quat {
	return quat{
		a[0]*b[0] - a[1]*b[1] - a[2]*b[2] - a[3]*b[3],
		a[0]*b[1] + a[1]*b[0] + a[2]*b[3] - a[3]*b[2],
		a[0]*b[2] - a[1]*b[3] + a[2]*b[0] + a[3]*b[1],
		a[0]*b[3] + a[1]*b[2] - a[2]*b[1] + a[3]*b[0],
	}
}

// turn rotates v by q: v + 2 u × (u × v + w v), u being q's vector part.
func (q quat) turn(v vec) vec {
	u := vec{q[1], q[2], q[3]}
	c := cross(u, v)
	c = vec{c[0] + q[0]*v[0], c[1] + q[0]*v[1], c[2] + q[0]*v[2]}
	d := cross(u, c)
	return vec{v[0] + 2*d[0], v[1] + 2*d[1], v[2] + 2*d[2]}
}

func cross(a, b vec) vec {
	return vec{a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]}
}

func aboutZ(angle float64) quat {
	return quat{math.Cos(angle / 2), 0, 0, math.Sin(angle / 2)}
}

func aboutX(angle float64) quat {
	return quat{math.Cos(angle / 2), math.Sin(angle / 2), 0, 0}
}

const (
	degree = math.Pi / 180
	turnOf = 2 * math.Pi
)

// Each gear train's pull, with the currents at strength 1: rate is how
// much it speeds or slows the day at its peak (as a share of a day), lean
// how far it tips the axle (degrees), swing how far it swings the gimbal
// ring (degrees). The phases only set where the run starts. All invented.
var trains = [3]struct{ rate, lean, swing, phase float64 }{
	{rate: 0.12, lean: 6, swing: 0, phase: 0.4},
	{rate: 0.12, lean: 6, swing: 0, phase: 2.0},
	{rate: 0.10, lean: 6, swing: 25, phase: 4.1},
}

// machine is one resolved setting of the model.
type machine struct {
	twoShells         bool
	tilt, lamp        float64 // radians
	hole, spread, gap float64
	drift             float64
	strength          float64
	periods           [3]float64
	breath, breathing float64 // depth, period
	specks            int
	cloudEvery        float64 // 0 when no cloud
	cloudLength       float64
}

func build(c core.Choice) machine {
	p := c.Params
	m := machine{
		twoShells: c.Models["shells"] == "two",
		tilt:      p["outer.tilt"] * degree,
		lamp:      p["outer.lamp"] * degree,
		hole:      p["hole.size"],
		spread:    p["hole.spread"] * degree,
		gap:       p["shells.gap"],
		drift:     p["inner.drift"],
		periods:   [3]float64{p["gear.first"], p["gear.second"], p["gear.third"]},
		breathing: p["breath.period"],
	}
	if c.Models["gearing"] == "trains" {
		m.strength = p["gear.strength"]
	}
	if c.Models["breathing"] == "breathing" {
		m.breath = p["breath.depth"]
	}
	if c.Models["flying"] == "dust" {
		m.specks = int(math.Round(p["flying.count"]))
	}
	if c.Models["cloud"] == "cloud" {
		m.cloudEvery, m.cloudLength = p["cloud.every"], p["cloud.length"]
	}
	return m
}

// standard is the same machine with one steady gear, rigid shells and a
// clear sea of fire: the day the clerk measures all others against.
func (m machine) standard() machine {
	m.strength, m.breath, m.cloudEvery = 0, 0, 0
	return m
}

// outer is the outer shell's attitude: the main axle's spin, the axle's
// lean from upright, and the swing of the gimbal ring that holds it.
func (m machine) outer(t float64) quat {
	spin, lean, swing := turnOf*t, m.tilt, 0.0
	for k, g := range trains {
		phase := turnOf*t/m.periods[k] + g.phase
		// A sine in the spin of size rate × period changes the rate of
		// turning by up to `rate` of a day per day.
		spin += m.strength * g.rate * m.periods[k] * math.Sin(phase)
		lean += m.strength * g.lean * degree * math.Sin(phase+1.3)
		swing += m.strength * g.swing * degree * math.Sin(phase+2.6)
	}
	// The axle cannot lean through the floor or past upright.
	lean = math.Max(5*degree, math.Min(175*degree, lean))
	return aboutZ(swing).mul(aboutX(lean)).mul(aboutZ(spin))
}

// inner is the inner shell's attitude. With two shells it turns steadily
// on the same lean, a little slower than the main gear, so it falls one
// turn behind every `drift` days. With one sphere it is the outer shell.
func (m machine) inner(t float64) quat {
	if !m.twoShells {
		return m.outer(t)
	}
	return aboutX(m.tilt).mul(aboutZ(turnOf * t * (1 - 1/m.drift)))
}

// sun is the direction of the sun from the center: the hole, fixed on the
// outer shell `lamp` above the shell's equator.
func (m machine) sun(t float64) vec {
	return m.outer(t).turn(vec{math.Cos(m.lamp), 0, math.Sin(m.lamp)})
}

// radii are the two shells' sizes. The inner shell at rest has radius 1.
// Breathing moves the gap by up to `breath` of itself and the inner shell
// by a little, on two slow rhythms.
func (m machine) radii(t float64) (outer, inner float64) {
	a := turnOf * t / m.breathing
	inner = 1 + 0.12*m.breath*math.Sin(a+0.7)
	if !m.twoShells {
		return inner, inner
	}
	gap := m.gap * (1 + m.breath*(0.65*math.Sin(a)+0.35*math.Sin(a/0.38+1)))
	return inner + gap, inner
}

// spot is what the clerk sees of the sun: how wide it is (degrees), how
// bright its surface is and how much light it sends, the last two against
// the machine at rest. The hole grows and shrinks with its shell. Light
// through it fans out by `spread` on each side as it crosses the gap, so
// the patch on the inner shell is wider and fainter than the hole.
func (m machine) spot(t float64) (size, brightness, light float64) {
	outer, inner := m.radii(t)
	dim := m.dimming(t)
	if !m.twoShells {
		// One sphere: the sun is the hole itself, and swells with it.
		return 2 * math.Atan(m.hole/2) / degree, dim, dim
	}
	hole := m.holeWidth(outer)
	width := hole + 2*(outer-inner)*math.Tan(m.spread)
	rest := m.hole + 2*m.gap*math.Tan(m.spread)
	size = 2 * math.Atan(width/(2*inner)) / degree
	brightness = dim * (hole / width) * (hole / width) / ((m.hole / rest) * (m.hole / rest))
	// Everything that comes through the hole lands on the patch, so the
	// light at the center goes as the hole's area over the distance squared.
	light = dim * (hole / m.hole) * (hole / m.hole) / (inner * inner)
	return
}

// holeWidth is the large hole's width when its shell has the given
// radius: it stretches with the shell it is cut in.
func (m machine) holeWidth(shell float64) float64 {
	if !m.twoShells {
		return m.hole * shell
	}
	return m.hole * shell / (1 + m.gap)
}

// dimming is the share of the sun's light the dark cloud lets through.
// A passage is centered halfway between multiples of `cloudEvery`.
func (m machine) dimming(t float64) float64 {
	if m.cloudEvery == 0 {
		return 1
	}
	from := math.Mod(t, m.cloudEvery) - m.cloudEvery/2
	x := from / (m.cloudLength / 2)
	return 1 - math.Exp(-x*x*x*x)
}

// noise is a small repeatable generator (SplitMix64) for the star field
// and the dust. Nothing here depends on the clock or on map order.
type noise uint64

func (n *noise) next() float64 {
	*n += 0x9e3779b97f4a7c15
	z := uint64(*n)
	z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9
	z = (z ^ (z >> 27)) * 0x94d049bb133111eb
	return float64((z^(z>>31))>>11) / (1 << 53)
}

func (n *noise) direction() vec {
	z := 2*n.next() - 1
	a := turnOf * n.next()
	r := math.Sqrt(1 - z*z)
	return vec{r * math.Cos(a), r * math.Sin(a), z}
}

const starCount = 240

// stars are the small holes in the inner shell, fixed on it: a direction
// and a brightness from 0 to 1, with few bright and many faint.
func stars() [][4]float64 {
	n := noise(141)
	out := make([][4]float64, starCount)
	for i := range out {
		d := n.direction()
		b := n.next()
		out[i] = [4]float64{round(d[0], 4), round(d[1], 4), round(d[2], 4), round(0.15+0.85*b*b*b, 3)}
	}
	return out
}

// flying puts each speck of dust on its own circle around the center.
func (m machine) flying(t float64) []vec {
	n := noise(7)
	out := make([]vec, m.specks)
	for i := range out {
		axis := n.direction()
		u := cross(axis, vec{0.36, 0.48, 0.8})
		length := math.Sqrt(u[0]*u[0] + u[1]*u[1] + u[2]*u[2])
		u = vec{u[0] / length, u[1] / length, u[2] / length}
		v := cross(axis, u)
		a := turnOf * (t/(0.4+2.6*n.next()) + n.next())
		out[i] = vec{
			math.Cos(a)*u[0] + math.Sin(a)*v[0],
			math.Cos(a)*u[1] + math.Sin(a)*v[1],
			math.Cos(a)*u[2] + math.Sin(a)*v[2],
		}
	}
	return out
}

func round(v float64, places int) float64 {
	scale := math.Pow(10, float64(places))
	return math.Round(v*scale) / scale
}
