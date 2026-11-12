package diaz

import (
	"math"

	"threebody/engine/core"
)

// Request asks for the plan to be run.
type Request struct {
	Preset string             `json:"preset,omitempty"`
	Models map[string]string  `json:"models,omitempty"`
	Params map[string]float64 `json:"params,omitempty"`
	// Resolution is "coarse" (the default) or "fine": how many moments
	// are returned and how finely the planets' decay is followed.
	Resolution string `json:"resolution,omitempty"`
}

// Resolved echoes the models and parameters a run used.
type Resolved struct {
	Models map[string]string  `json:"models"`
	Params map[string]float64 `json:"params"`
}

// Impact is Mercury reaching the Sun.
type Impact struct {
	// Time in seconds after the push.
	Time float64 `json:"time"`
	// Speed in m/s and Angle in degrees from straight down.
	Speed float64 `json:"speed"`
	Angle float64 `json:"angle"`
	// Energy of motion, joules.
	Energy float64 `json:"energy"`
	// Depth is where drag alone would stop it, as a share of the Sun's
	// radius, if it held together; Deep says that is under the
	// convection zone.
	Depth float64 `json:"depth"`
	Deep  bool    `json:"deep"`
	// Bound is the most mass the energy could lift out of the Sun, kg;
	// Ejecta is what the chosen model throws out.
	Bound  float64 `json:"bound"`
	Ejecta float64 `json:"ejecta"`
	// Escaping is the share of the gas that leaves for good, on free
	// paths.
	Escaping float64 `json:"escaping"`
}

// Fate is what becomes of a planet other than Mercury: "untouched" (no
// gas was thrown), "nudged" (gas passed it once), "falls", "dragged"
// (in the gas but not fallen within ten billion years) or "beyond"
// (the gas never reached it).
type Fate struct {
	ID   string `json:"id"`
	Fate string `json:"fate"`
	// Time of its fall, seconds after the push.
	Time float64 `json:"time,omitempty"`
	// Nudge is the most a passing jet could slow it, m/s, if it were
	// hit square on.
	Nudge float64 `json:"nudge,omitempty"`
}

// Chapter is a stretch of the story with its own pace: frames From to To
// run from Start to End, in seconds after the push. They are evenly
// spaced in time except in the fall, where they crowd toward the Sun.
type Chapter struct {
	ID    string  `json:"id"`
	From  int     `json:"from"`
	To    int     `json:"to"`
	Start float64 `json:"start"`
	End   float64 `json:"end"`
	// Slowed says some planet goes round the Sun too many times in the
	// chapter to follow, so its motion round its orbit is drawn slowed,
	// not worked out.
	Slowed bool `json:"slowed,omitempty"`
	// Body is whose fall the chapter leads to or follows.
	Body string `json:"body,omitempty"`
	// Flow says whose impact is sending gas out of the Sun in this
	// chapter; empty if none is.
	Flow string `json:"flow,omitempty"`
}

// Flow is the gas from one impact. Its parcels' directions (three
// numbers each) start at Dirs in the numbers beside the reply, and
// their distances from the Sun in AU, one row per frame of its chapter,
// at Radii. A distance of zero is gas not yet out or back in the Sun.
// A planet that falls into a Sun with nothing left to give has a flow
// with no parcels.
type Flow struct {
	Body    string `json:"body"`
	Chapter int    `json:"chapter"`
	Count   int    `json:"count"`
	Dirs    int    `json:"dirs"`
	Radii   int    `json:"radii"`
	// Stays says the gas is still there after its chapter.
	Stays bool `json:"stays"`
	// Time of the impact, seconds after the push; Mass thrown out, kg;
	// Edge of all the gas afterwards, AU.
	Time float64 `json:"time"`
	Mass float64 `json:"mass"`
	Edge float64 `json:"edge"`
}

// Places says where the bodies' positions are in the numbers beside the
// reply: for each frame, each body's x, y and z in AU, the Sun first.
type Places struct {
	Offset int `json:"offset"`
	Frames int `json:"frames"`
	Bodies int `json:"bodies"`
}

// Rings says where the orbits' outlines are in the numbers beside the
// reply: for each planet in turn, Points places around an orbit of its
// shape and tilt whose size is one, to be scaled by Orbits. The ring
// numbered Pushed, counting from one, is Mercury's path after the push.
type Rings struct {
	Offset int `json:"offset"`
	Points int `json:"points"`
	Pushed int `json:"pushed"`
}

// Ratios are the novel's own sums, from NASA's masses.
type Ratios struct {
	// Three is Venus, the Earth and Mars over Mercury.
	Three float64 `json:"three"`
	// Jupiter is Jupiter over the four inner planets.
	Jupiter float64 `json:"jupiter"`
}

// Result is the plan played out.
type Result struct {
	// Needed is the speed Mercury must lose at aphelion to touch the
	// Sun, and Delivered what the bombs take off, m/s.
	Needed    float64 `json:"needed"`
	Delivered float64 `json:"delivered"`
	// BombsNeeded is how many bombs of the chosen yield the fall would
	// take at the most any bomb could do.
	BombsNeeded float64 `json:"bombsNeeded"`
	Falls       bool    `json:"falls"`
	// Perihelion of Mercury's new path, in solar radii.
	Perihelion float64 `json:"perihelion"`
	// FallDays from the push to the Sun.
	FallDays float64 `json:"fallDays,omitempty"`
	Impact   *Impact `json:"impact,omitempty"`
	Fates    []Fate  `json:"fates"`
	// AirGone and SeaGone are when the Earth has met its own air's mass
	// in gas, and when drag has put in the heat to boil its sea away, in
	// seconds after the push; zero if never.
	AirGone float64 `json:"airGone,omitempty"`
	SeaGone float64 `json:"seaGone,omitempty"`
	// Exhausted says the eruptions asked for more than the Sun holds.
	Exhausted bool `json:"exhausted,omitempty"`
	// CloudMass is all the gas thrown out, kg.
	CloudMass float64 `json:"cloudMass"`
	Ratios    Ratios  `json:"ratios"`
	// Speculative says a model with no published basis is in use.
	Speculative bool `json:"speculative"`

	Chapters []Chapter `json:"chapters"`
	// Time of each frame, seconds after the push.
	Time []float64 `json:"time"`
	// Orbits[b][i] is body b's distance scale (semi-major axis, AU) at
	// frame i; Gone[b] is the first frame at which it is in the Sun, or
	// -1.
	Orbits [][]float64 `json:"orbits"`
	Gone   []int       `json:"gone"`
	// Edge is how far the gas has reached at each frame, AU.
	Edge   []float64 `json:"edge"`
	Flows  []Flow    `json:"flows"`
	Places Places    `json:"places"`
	Rings  Rings     `json:"rings"`
	Choice Resolved  `json:"choice"`
	// Floats are the numbers beside the reply.
	Floats []float32 `json:"-"`
}

const (
	year = 365.25 * day
	// Past this the Sun itself will have changed.
	horizon = 1e10 * year
	parcels = 1500
	// Places around each orbit's outline.
	ringPoints = 96
	// Half the angle of the cone a jet opens into on free paths. A
	// choice, not a published value.
	cone = 30 * rad
	// How long a jet on free paths is watched.
	watch = 40 * day
)

// orbit is a path around the Sun and where on it a body is.
type orbit struct {
	a, e, tilt, peri, node, mean float64
}

func (o orbit) at() [3]float64 { return place(o.a, o.e, o.tilt, o.peri, o.node, o.mean) }

// moment is the planets' orbit sizes, in meters, at a time.
type moment struct {
	t float64
	a [9]float64
}

type run struct {
	out    *Result
	frames int
	places []float32
	rings  []float32
	extra  []float32
}

// ring adds the outline of an orbit, at a size of one.
func (r *run) ring(o orbit) {
	o.a = 1
	for k := 0; k < ringPoints; k++ {
		// Evenly spaced around the ellipse's own angle, which keeps a
		// long thin path smooth where it turns close to the Sun.
		E := 2 * math.Pi * float64(k) / ringPoints
		o.mean = E - o.e*math.Sin(E)
		p := o.at()
		r.rings = append(r.rings, float32(p[0]), float32(p[1]), float32(p[2]))
	}
}

func (r *run) frame(t float64, at [9][3]float64, sizes [9]float64, edge float64) {
	o := r.out
	i := len(o.Time)
	o.Time = append(o.Time, t)
	if n := len(o.Edge); n > 0 && edge < o.Edge[n-1] {
		edge = o.Edge[n-1]
	}
	o.Edge = append(o.Edge, edge)
	for b := range bodies {
		o.Orbits[b] = append(o.Orbits[b], sizes[b])
		p := at[b]
		if b > 0 && sizes[b] == 0 {
			p = [3]float64{}
			if o.Gone[b] < 0 {
				o.Gone[b] = i
			}
		}
		r.places = append(r.places, float32(p[0]), float32(p[1]), float32(p[2]))
	}
}

func (r *run) open(c Chapter) int {
	c.From = len(r.out.Time)
	r.out.Chapters = append(r.out.Chapters, c)
	return len(r.out.Chapters) - 1
}

func (r *run) close() {
	c := &r.out.Chapters[len(r.out.Chapters)-1]
	c.To = len(r.out.Time) - 1
}

// Run plays the plan out.
func Run(q Request) (*Result, error) {
	c, err := catalog.Resolve(q.Preset, q.Models, q.Params)
	if err != nil {
		return nil, err
	}
	n, tol := 24, 0.02
	switch q.Resolution {
	case "", "coarse":
	case "fine":
		n, tol = 48, 0.005
	default:
		return nil, &core.FieldError{Field: "resolution", Message: "Resolution must be coarse or fine."}
	}
	P := c.Params
	out := &Result{Choice: Resolved{Models: c.Models, Params: c.Params}, Fates: []Fate{}, Flows: []Flow{},
		Orbits: make([][]float64, len(bodies)), Gone: make([]int, len(bodies))}
	for b := range out.Gone {
		out.Gone[b] = -1
	}
	for _, s := range catalog.Slots {
		for _, m := range s.Models {
			out.Speculative = out.Speculative || (m.ID == c.Models[s.ID] && m.Speculative)
		}
	}
	mass := func(id string) float64 { return body(id).Mass }
	inner := mass("venus") + mass("earth") + mass("mars")
	out.Ratios = Ratios{Three: inner / mass("mercury"), Jupiter: mass("jupiter") / (inner + mass("mercury"))}
	r := &run{out: out, frames: n}
	mercury := body("mercury")

	// The push, at aphelion.
	far, speed := aphelion()
	out.Needed = needed(1)
	out.BombsNeeded = out.Needed * mercury.Mass * mercuryEscape() / (P["bombs.yield"] * megaton)
	if c.Models["bombs"] == "charges" {
		out.Delivered = math.Min(speed, ceiling(P["bombs.count"], P["bombs.yield"], P["bombs.coupling"]))
	} else {
		out.Delivered = needed(P["bombs.target"])
	}
	left := speed - out.Delivered
	size := 1 / (2/far - left*left/sunGM)
	near := 2*size - far
	out.Perihelion = near / sunRadius
	out.Falls = near <= sunRadius*(1+1e-9)
	ma, _, mtilt, mperi, mnode, _ := mercury.elements(pushDay)
	path := orbit{a: size / au, e: (far - near) / (far + near), tilt: mtilt, peri: mperi, node: mnode, mean: math.Pi}

	for _, p := range bodies[1:] {
		a, e, tilt, peri, node, mean := p.elements(pushDay)
		r.ring(orbit{a, e, tilt, peri, node, mean})
	}
	r.ring(path)

	// Where everything is at a time after the push while JPL's elements
	// still hold, with Mercury on the path given.
	sky := func(t float64, m *orbit) (at [9][3]float64, sizes [9]float64) {
		for b, who := range bodies[1:] {
			at[b+1], sizes[b+1] = who.position(pushDay+t/day), who.el[0]
		}
		if m != nil {
			at[1], sizes[1] = m.at(), m.a
		}
		return
	}

	// One orbit of Mercury up to the push.
	before := period(ma * au)
	r.open(Chapter{ID: "bombs", Start: -before, End: 0, Body: "mercury"})
	for i := 0; i <= n; i++ {
		t := -before * float64(n-i) / float64(n)
		at, sizes := sky(t, nil)
		r.frame(t, at, sizes, 0)
	}
	r.close()

	// The new path: down to the Sun, or once around.
	rate := math.Sqrt(sunGM / (size * size * size))
	// The path's own angle runs from the far point, at half a turn, to
	// where the path meets the Sun, or once around.
	last := 3 * math.Pi
	if out.Falls {
		// r = a(1 - e cos E) = R on the way in.
		last = 2*math.Pi - math.Acos(math.Max(-1, math.Min(1, (1-sunRadius/size)/path.e)))
	}
	clock := func(E float64) float64 { return (E - path.e*math.Sin(E) - math.Pi) / rate }
	span := clock(last)
	if out.Falls {
		out.FallDays = span / day
	}
	r.open(Chapter{ID: "fall", Start: 0, End: span, Body: "mercury"})
	var site [3]float64
	for i := 0; i <= n; i++ {
		// Moments evenly spaced in that angle, not in time: Mercury
		// covers the last of its fall in hours, and equal steps of time
		// would show none of it.
		t := clock(math.Pi + (last-math.Pi)*float64(i)/float64(n))
		m := path
		m.mean = math.Pi + rate*t
		at, sizes := sky(t, &m)
		site = unit(at[1])
		if out.Falls && i == n {
			sizes[1] = 0
		}
		r.frame(t, at, sizes, 0)
	}
	r.close()
	planets := bodies[2:]
	if !out.Falls {
		for _, p := range planets {
			out.Fates = append(out.Fates, Fate{ID: p.ID, Fate: "untouched"})
		}
		return r.finish(), nil
	}

	// The impact.
	hit := math.Sqrt(sunGM * (2/sunRadius - 1/size))
	sine := math.Min(1, far*left/(sunRadius*hit))
	energy := 0.5 * mercury.Mass * hit * hit
	lift := 0.5 * escape * escape
	thick := mercury.Mass / (math.Pi * mercury.Radius * mercury.Radius * 1e6)
	im := &Impact{Time: span, Speed: hit, Angle: math.Asin(sine) / rad, Energy: energy, Bound: energy / lift}
	im.Depth = depth(thick * math.Sqrt(1-sine*sine) / plungeDrag)
	im.Deep = im.Depth < convectionBase
	out.Impact = im
	sunLeft := sunMass
	// thrown is the gas an impact of a given energy sends out. Gas slower
	// than escape speed is costed as if it were lifted clear of the Sun,
	// so the published impact never throws out more than its energy could
	// lift out.
	thrown := func(energy, mean float64) float64 {
		m := P["ejecta.share"] * energy / (lift * math.Max(1, mean))
		if c.Models["impact"] == "eruption" {
			m = P["eruption.gain"] * energy / lift
		}
		if m > sunLeft {
			m, out.Exhausted = sunLeft, true
		}
		sunLeft -= m
		out.CloudMass += m
		return m
	}
	spin := 2 * math.Pi / sunTurn
	random := rng(1)

	if c.Models["cloud"] == "free" {
		// Each parcel leaves within a day, at its own speed, somewhere
		// in the cone, and then only the Sun's pull acts on it.
		shares := make([]float64, parcels)
		square, away := 0.0, 0
		for j := range shares {
			shares[j] = P["ejecta.speed"] * (1 - P["ejecta.spread"] + 2*P["ejecta.spread"]*(float64(j)+0.5)/parcels)
			square += shares[j] * shares[j] / parcels
			// Gas at escape speed itself never comes back, as radial has it.
			if shares[j] >= 1-1e-9 {
				away++
			}
		}
		im.Ejecta = thrown(energy, square)
		im.Escaping = float64(away) / parcels
		flow := Flow{Body: "mercury", Count: parcels, Time: span, Mass: im.Ejecta}
		flow.Chapter = r.open(Chapter{ID: "answer", Start: span, End: span + watch, Body: "mercury", Flow: "mercury"})
		starts := make([]float64, parcels)
		var dirs, radii []float32
		for j := range shares {
			starts[j] = day * random.next()
			// A direction within the cone around the site.
			tip, round := math.Acos(1-random.next()*(1-math.Cos(cone))), 2*math.Pi*random.next()
			side := unit([3]float64{-site[1], site[0], 0})
			up := [3]float64{site[1]*side[2] - site[2]*side[1], site[2]*side[0] - site[0]*side[2], site[0]*side[1] - site[1]*side[0]}
			var d [3]float64
			for k := range d {
				d[k] = math.Cos(tip)*site[k] + math.Sin(tip)*(math.Cos(round)*side[k]+math.Sin(round)*up[k])
			}
			d = turn(d, spin*starts[j])
			dirs = append(dirs, float32(d[0]), float32(d[1]), float32(d[2]))
		}
		for i := 0; i <= n; i++ {
			since := watch * float64(i) / float64(n)
			edge := 0.0
			for j, f := range shares {
				reach, aloft := radial(f, since-starts[j])
				if !aloft || since < starts[j] {
					reach = 0
				}
				edge = math.Max(edge, reach/au)
				radii = append(radii, float32(reach/au))
			}
			at, sizes := sky(span+since, nil)
			sizes[1] = 0
			r.frame(span+since, at, sizes, edge)
		}
		r.close()
		flow.Edge = out.Edge[len(out.Edge)-1]
		r.add(&flow, dirs, radii)
		// The most the jet could do to each planet: all the gas that
		// gets as far as its orbit, spread over the cone there, hitting
		// it square on.
		for _, p := range planets {
			orbitAt := p.el[0] * au
			floor := math.Sqrt(math.Max(0, 1-sunRadius/orbitAt))
			passing, gasSpeed := 0.0, 0.0
			for _, f := range shares {
				if f > floor {
					passing++
					gasSpeed += escape * math.Sqrt(f*f-floor*floor)
				}
			}
			fate := Fate{ID: p.ID, Fate: "nudged"}
			if passing > 0 {
				gasSpeed /= passing
				around := math.Sqrt(sunGM / orbitAt)
				meet := math.Hypot(around, gasSpeed)
				radius := p.Radius * 1000
				focus := 1 + 2*gravity*p.Mass/(radius*meet*meet)
				caught := im.Ejecta * passing / parcels * math.Pi * radius * radius * focus / (2 * math.Pi * (1 - math.Cos(cone)) * orbitAt * orbitAt)
				fate.Nudge = caught * meet / p.Mass
			}
			out.Fates = append(out.Fates, fate)
		}
		return r.finish(), nil
	}

	// A standing spiral. Its edge follows the energy of all the impacts
	// so far, from the novel's example: a planet of 4% of the Earth's
	// mass, a spiral three AU out.
	im.Ejecta = thrown(energy, 1)
	example := 0.5 * 0.04 * mass("earth") * escape * escape
	total := energy
	reach := func() float64 { return P["cloud.reach"] * au * math.Cbrt(total/example) }
	out.CloudMass = im.Ejecta
	edge := reach()
	flare, outward := P["cloud.flare"], P["cloud.speed"]*1000
	// The gas thins as the square of the distance, as a steady outflow
	// does, in a disc whose thickness grows with distance.
	density := func(a float64) float64 { return out.CloudMass / (4 * math.Pi * flare * edge * a * a) }
	force := func(p *Body, a float64) (f, around float64) {
		around = math.Sqrt(sunGM / a)
		radius, rho := p.Radius*1000, density(a)
		return frictionDrag(P["drag.coefficient"], rho, radius, around) + gravityDrag(gravity*p.Mass, rho, around, radius, flare*a), around
	}

	// held says a planet's motion round the Sun was drawn slower than it
	// is in the chapter under way.
	held := false

	// spiral lays out one impact's gas: parcels leave the turning site
	// one after another, move out at the unwinding speed, and stop when
	// the last has left.
	spiral := func(who string, count int, when, start float64, site [3]float64, from, to float64, sizes func(t float64) [9]float64, places func(t float64, i int) [9][3]float64) float64 {
		held = false
		length := to / outward
		flow := Flow{Body: who, Count: count, Time: when, Stays: true, Edge: to / au}
		leaving := who
		if count == 0 {
			leaving = ""
		}
		flow.Chapter = r.open(Chapter{ID: "answer", Start: start, End: start + length, Body: who, Flow: leaving})
		starts := make([]float64, count)
		var dirs, radii []float32
		axis := [3]float64{0, -math.Sin(sunTilt), math.Cos(sunTilt)}
		for j := range starts {
			starts[j] = length * (float64(j) + 0.5) / float64(count)
			d := turn(site, spin*starts[j])
			lift, slip := flare*(2*random.next()-1), 0.02*(2*random.next()-1)
			d = unit(turn([3]float64{d[0] + lift*axis[0], d[1] + lift*axis[1], d[2] + lift*axis[2]}, slip))
			dirs = append(dirs, float32(d[0]), float32(d[1]), float32(d[2]))
		}
		for i := 0; i <= n; i++ {
			since := length * float64(i) / float64(n)
			if i == n {
				// Exactly, as in drift below.
				since = length
			}
			for _, s := range starts {
				at := 0.0
				if since > s {
					at = math.Max(sunRadius, outward*(since-s)) / au
				}
				radii = append(radii, float32(at))
			}
			r.frame(start+since, places(start+since, i), sizes(start+since), math.Max(from, math.Min(to, outward*since))/au)
		}
		r.close()
		r.out.Chapters[flow.Chapter].Slowed = held
		r.add(&flow, dirs, radii)
		return start + length
	}

	// Mercury's spiral, while the planets are still where JPL has them.
	still := func(t float64) [9]float64 {
		_, sizes := sky(t, nil)
		sizes[1] = 0
		return sizes
	}
	cursor := spiral("mercury", parcels, span, span, site, 0, edge, still, func(t float64, _ int) [9][3]float64 {
		at, _ := sky(t, nil)
		return at
	})
	out.Flows[0].Mass = im.Ejecta

	// The drag. Every planet inside the gas loses speed; when one
	// reaches the Sun its impact adds gas and pushes the edge out.
	now := moment{t: cursor}
	for b, p := range bodies {
		if b > 1 {
			now.a[b] = p.el[0] * au
		}
	}
	history := []moment{now}
	type fall struct {
		b      int
		t      float64
		before float64
	}
	var falls []fall
	earth := 3
	swept, heat := 0.0, 0.0
	for now.t < horizon {
		step := math.Inf(1)
		rates := [9]func(a float64) float64{}
		for b, p := range bodies {
			if b < 2 || now.a[b] == 0 || now.a[b] >= edge {
				continue
			}
			p := p
			rates[b] = func(a float64) float64 {
				f, around := force(p, a)
				return -2 * a * f / (p.Mass * around)
			}
			step = math.Min(step, tol*now.a[b]/-rates[b](now.a[b]))
		}
		if math.IsInf(step, 1) {
			break
		}
		step = math.Min(step, horizon-now.t)
		if rates[earth] != nil {
			f, around := force(bodies[earth], now.a[earth])
			radius := bodies[earth].Radius * 1000
			gain := density(now.a[earth]) * around * math.Pi * radius * radius * step
			if out.AirGone == 0 && swept+gain >= earthAir {
				out.AirGone = now.t + step*(earthAir-swept)/gain
			}
			swept += gain
			if out.SeaGone == 0 && heat+f*around*step >= earthSea*boil {
				out.SeaGone = now.t + step*(earthSea*boil-heat)/(f*around*step)
			}
			heat += f * around * step
		}
		was := edge
		for b := range bodies {
			if rates[b] == nil {
				continue
			}
			now.a[b] = advance(now.a[b], step, rates[b])
			if now.a[b] <= sunRadius {
				now.a[b] = 0
				p := bodies[b]
				// It arrives on a circle, at the speed of an orbit that
				// skims the surface: half the energy of a straight fall.
				arrived := 0.5 * p.Mass * sunGM / sunRadius
				falls = append(falls, fall{b: b, t: now.t + step, before: was})
				// An emptied Sun has no gas to send out, and with none the
				// edge stays where it is.
				if thrown(arrived, 1) > 0 {
					total += arrived
					edge = reach()
				}
				out.Flows = append(out.Flows, Flow{Body: p.ID, Time: now.t + step, Mass: out.CloudMass, Edge: edge / au})
			}
		}
		now.t += step
		history = append(history, now)
	}
	// The flows found above are filled in below, in order; keep what
	// each added and where the edge got to.
	found := append([]Flow(nil), out.Flows[1:]...)
	out.Flows = out.Flows[:1]
	for _, p := range planets {
		b := 0
		for i, who := range bodies {
			if who == p {
				b = i
			}
		}
		fate := Fate{ID: p.ID, Fate: "beyond"}
		switch {
		case now.a[b] == 0:
			fate.Fate = "falls"
			for _, f := range falls {
				if f.b == b {
					fate.Time = f.t
				}
			}
		case now.a[b] < edge:
			fate.Fate = "dragged"
		}
		out.Fates = append(out.Fates, fate)
	}

	// The planets' orbit sizes at any time, from the steps taken.
	sizes := func(t float64) [9]float64 {
		lo, hi := 0, len(history)-1
		for hi-lo > 1 {
			mid := (lo + hi) / 2
			if history[mid].t <= t {
				lo = mid
			} else {
				hi = mid
			}
		}
		var s [9]float64
		a, b := history[lo], history[hi]
		share := 0.0
		if b.t > a.t {
			share = math.Max(0, math.Min(1, (t-a.t)/(b.t-a.t)))
		}
		for k := range s {
			s[k] = (a.a[k] + (b.a[k]-a.a[k])*share) / au
			if b.a[k] == 0 && share >= 1 {
				s[k] = 0
			}
		}
		return s
	}
	// From here on each planet keeps its orbit's shape and tilt, and is
	// carried round it by its true motion where that can be followed from
	// frame to frame.
	var carried [9]orbit
	for b, p := range bodies {
		if b > 1 {
			a, e, tilt, peri, node, mean := p.elements(pushDay + cursor/day)
			carried[b] = orbit{a, e, tilt, peri, node, mean}
		}
	}
	seen := cursor
	// The slowed pace is a set turn a frame, less for wider orbits as
	// Kepler has it. A planet never moves faster than that between
	// frames: one that would go round more than once could not be
	// followed, and would seem to jump about its orbit.
	move := func(t float64, _ int) (at [9][3]float64) {
		s := sizes(t)
		for b := 2; b < len(bodies); b++ {
			o := &carried[b]
			if s[b] > 0 {
				o.a = s[b]
				step := (t - seen) * math.Sqrt(sunGM/math.Pow(o.a*au, 3))
				if pace := math.Min(0.5, 0.22*math.Pow(o.a, -1.5)); step > pace {
					step, held = pace, true
				}
				o.mean += step
			}
			at[b] = o.at()
		}
		seen = t
		return
	}
	drift := func(until float64, who string) {
		held = false
		at := r.open(Chapter{ID: "drag", Start: cursor, End: until, Body: who})
		for i := 0; i <= n; i++ {
			t := cursor + (until-cursor)*float64(i)/float64(n)
			if i == n {
				// Exactly, so that rounding never puts the chapter's end
				// after the start of the next.
				t = until
			}
			r.frame(t, move(t, i), sizes(t), reached(out))
		}
		r.close()
		r.out.Chapters[at].Slowed = held
		cursor = until
	}
	for k, f := range falls {
		if f.t > cursor {
			drift(f.t, bodies[f.b].ID)
		}
		where := unit(carried[f.b].at())
		added := found[k].Mass
		if k > 0 {
			added -= found[k-1].Mass
		} else {
			added -= im.Ejecta
		}
		// A fall that threw out no gas has none to show.
		count := parcels
		if added <= 0 {
			added, count = 0, 0
		}
		cursor = spiral(bodies[f.b].ID, count, f.t, cursor, where, f.before, found[k].Edge*au, sizes, move)
		out.Flows[len(out.Flows)-1].Mass = added
	}
	for _, f := range out.Fates {
		if f.Fate == "dragged" && cursor < horizon {
			drift(horizon, "")
			break
		}
	}
	return r.finish(), nil
}

// reached is how far the gas has reached at the last frame.
func reached(out *Result) float64 {
	if len(out.Edge) == 0 {
		return 0
	}
	return out.Edge[len(out.Edge)-1]
}

// add records a flow and where its numbers will lie.
func (r *run) add(f *Flow, dirs, radii []float32) {
	f.Dirs = len(r.extra)
	r.extra = append(r.extra, dirs...)
	f.Radii = len(r.extra)
	r.extra = append(r.extra, radii...)
	r.out.Flows = append(r.out.Flows, *f)
}

// finish puts the bodies' places first, then the orbits' outlines, then
// the flows' numbers.
func (r *run) finish() *Result {
	o := r.out
	o.Places = Places{Offset: 0, Frames: len(o.Time), Bodies: len(bodies)}
	o.Rings = Rings{Offset: len(r.places), Points: ringPoints, Pushed: len(bodies)}
	before := len(r.places) + len(r.rings)
	for i := range o.Flows {
		o.Flows[i].Dirs += before
		o.Flows[i].Radii += before
	}
	o.Floats = append(append(r.places, r.rings...), r.extra...)
	return o
}
