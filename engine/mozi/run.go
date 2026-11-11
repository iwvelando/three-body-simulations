package mozi

import (
	"math"

	"threebody/engine/core"
)

// Request asks for the clerk's calendar from one setting of the machine.
type Request struct {
	Preset string             `json:"preset,omitempty"`
	Models map[string]string  `json:"models,omitempty"`
	Params map[string]float64 `json:"params,omitempty"`
	// Resolution is "coarse" (the default) or "fine": how closely the sun
	// is watched for a crossing of the horizon.
	Resolution string `json:"resolution,omitempty"`
}

// Calendar is the clerk's record, one entry per sunrise that is followed
// by another. All times are in days.
type Calendar struct {
	// Rise is when the sun came up.
	Rise []float64 `json:"rise"`
	// Length is the time to the next sunrise.
	Length []float64 `json:"length"`
	// Daylight is how long the sun stayed up.
	Daylight []float64 `json:"daylight"`
	// Size is the sun's widest that day, in degrees.
	Size []float64 `json:"size"`
	// Light is the sunlight received, against a standard day's.
	Light []float64 `json:"light"`
	// Regular marks the days the clerk's rule accepts.
	Regular []bool `json:"regular"`
}

// Era is a stretch of the calendar: "stable" or "chaotic".
type Era struct {
	Kind string  `json:"kind"`
	From float64 `json:"from"`
	To   float64 `json:"to"`
	// Days counts the sunrises inside it.
	Days int `json:"days"`
}

// Standard is the day the clerk measures against: the same machine with
// one steady gear, rigid shells and a clear sea of fire.
type Standard struct {
	Daylight float64 `json:"daylight"`
	Size     float64 `json:"size"`
}

// Summary counts the eras.
type Summary struct {
	Sunrises      int     `json:"sunrises"`
	Stable        int     `json:"stable"`
	Chaotic       int     `json:"chaotic"`
	LongestStable float64 `json:"longestStable"`
	// StableShare is the share of the span spent in Stable Eras.
	StableShare float64 `json:"stableShare"`
}

// Resolved echoes the models and parameters a run used.
type Resolved struct {
	Models map[string]string  `json:"models"`
	Params map[string]float64 `json:"params"`
}

// Result is the calendar, its eras and the star field the sky is drawn
// with (directions fixed on the inner shell, and a brightness).
type Result struct {
	Span     float64      `json:"span"`
	Calendar Calendar     `json:"calendar"`
	Eras     []Era        `json:"eras"`
	Standard Standard     `json:"standard"`
	Stars    [][4]float64 `json:"stars"`
	Summary  Summary      `json:"summary"`
	Choice   Resolved     `json:"choice"`
}

func resolve(q Request) (core.Choice, int, error) {
	c, err := catalog.Resolve(q.Preset, q.Models, q.Params)
	if err != nil {
		return c, 0, err
	}
	switch q.Resolution {
	case "", "coarse":
		return c, 96, nil
	case "fine":
		return c, 480, nil
	}
	return c, 0, &core.FieldError{Field: "resolution", Message: `Resolution must be "coarse" or "fine".`}
}

// crossings finds every moment in [from, to] at which the sun crosses
// the horizon, watching `perDay` times a day and closing in on each
// change of sign by bisection. up[i] says whether crossing i is a rise.
func (m machine) crossings(from, to float64, perDay int) (at []float64, up []bool) {
	steps := int(math.Ceil((to - from) * float64(perDay)))
	height := func(t float64) float64 { return m.sun(t)[2] }
	t0, h0 := from, height(from)
	for i := 1; i <= steps; i++ {
		t1 := from + float64(i)/float64(perDay)
		h1 := height(t1)
		if (h0 < 0) != (h1 < 0) {
			lo, hi, below := t0, t1, h0 < 0
			for k := 0; k < 48; k++ {
				mid := (lo + hi) / 2
				if (height(mid) < 0) == below {
					lo = mid
				} else {
					hi = mid
				}
			}
			at = append(at, (lo+hi)/2)
			up = append(up, below)
		}
		t0, h0 = t1, h1
	}
	return
}

// daylight sums one stretch of daylight: the light that reaches the
// floor (Simpson's rule on the sun's height times its light) and the
// sun's widest.
func (m machine) daylight(rise, set float64) (light, widest float64) {
	n := 2 * int(math.Max(24, math.Ceil((set-rise)*48)))
	h := (set - rise) / float64(n)
	for i := 0; i <= n; i++ {
		t := rise + float64(i)*h
		size, _, flux := m.spot(t)
		weight := 2.0
		switch {
		case i == 0 || i == n:
			weight = 1
		case i%2 == 1:
			weight = 4
		}
		light += weight * flux * math.Max(0, m.sun(t)[2])
		widest = math.Max(widest, size)
	}
	return light * h / 3, widest
}

// Run turns the machine through its span and returns the clerk's record.
func Run(q Request) (*Result, error) {
	c, perDay, err := resolve(q)
	if err != nil {
		return nil, err
	}
	m := build(c)
	span := c.Params["clerk.span"]
	r := &Result{Span: span, Stars: stars(), Eras: []Era{}, Choice: Resolved{c.Models, c.Params}}

	// The standard day. Two days hold a whole one, sunrise to sunset.
	base := m.standard()
	var usual, usualLight float64
	at, up := base.crossings(0, 2.5, perDay)
	for i := 0; i+1 < len(at); i++ {
		if up[i] && !up[i+1] {
			usual = at[i+1] - at[i]
			usualLight, r.Standard.Size = base.daylight(at[i], at[i+1])
			break
		}
	}
	r.Standard = Standard{Daylight: round(usual, 6), Size: round(r.Standard.Size, 4)}

	tolerance := c.Params["clerk.tolerance"] / 100
	mild := c.Params["clerk.mild"] / 100
	at, up = m.crossings(0, span, perDay)
	cal := &r.Calendar
	*cal = Calendar{Rise: []float64{}, Length: []float64{}, Daylight: []float64{}, Size: []float64{}, Light: []float64{}, Regular: []bool{}}
	for i := 0; i < len(at); i++ {
		if !up[i] {
			continue
		}
		// Crossings alternate, so the next rise is two on.
		if i+2 >= len(at) {
			break
		}
		length, lit := at[i+2]-at[i], at[i+1]-at[i]
		light, widest := m.daylight(at[i], at[i+1])
		if usualLight > 0 {
			light /= usualLight
		}
		cal.Rise = append(cal.Rise, round(at[i], 6))
		cal.Length = append(cal.Length, round(length, 6))
		cal.Daylight = append(cal.Daylight, round(lit, 6))
		cal.Size = append(cal.Size, round(widest, 4))
		cal.Light = append(cal.Light, round(light, 5))
		cal.Regular = append(cal.Regular, usual > 0 &&
			math.Abs(length-1) <= tolerance &&
			math.Abs(lit-usual) <= tolerance &&
			math.Abs(light-1) <= mild)
	}
	r.Eras = classify(cal.Rise, cal.Regular, int(math.Round(c.Params["clerk.run"])), span)
	r.Summary.Sunrises = len(cal.Rise)
	for _, e := range r.Eras {
		if e.Kind == "stable" {
			r.Summary.Stable++
			r.Summary.LongestStable = math.Max(r.Summary.LongestStable, e.To-e.From)
			r.Summary.StableShare += (e.To - e.From) / span
		} else {
			r.Summary.Chaotic++
		}
	}
	r.Summary.StableShare = round(r.Summary.StableShare, 4)
	return r, nil
}

// classify sorts a record into eras. A run of at least minRun regular
// days in a row is a Stable Era, from its first sunrise to the sunrise
// that ends its last day; everything else is a Chaotic Era. The eras
// cover the span from 0 without a gap.
func classify(rise []float64, regular []bool, minRun int, span float64) []Era {
	var eras []Era
	add := func(kind string, from, to float64, days int) {
		if n := len(eras); n > 0 && eras[n-1].Kind == kind {
			eras[n-1].To, eras[n-1].Days = to, eras[n-1].Days+days
			return
		}
		eras = append(eras, Era{Kind: kind, From: from, To: to, Days: days})
	}
	end := func(i int) float64 {
		if i < len(rise) {
			return rise[i]
		}
		return span
	}
	for i := 0; i < len(rise); {
		j := i
		for j < len(rise) && regular[j] == regular[i] {
			j++
		}
		kind := "chaotic"
		if regular[i] && j-i >= minRun {
			kind = "stable"
		}
		add(kind, rise[i], end(j), j-i)
		i = j
	}
	if len(eras) == 0 {
		return []Era{{Kind: "chaotic", From: 0, To: span}}
	}
	eras[0].From = 0
	eras[len(eras)-1].To = span
	return eras
}

// SkyRequest asks for the machine's state at Count moments, Step days
// apart, starting at From: what the two views draw.
type SkyRequest struct {
	Request
	From  float64 `json:"from"`
	Step  float64 `json:"step"`
	Count int     `json:"count"`
}

// Frames is the machine at each moment. Vectors are in the clerk's
// frame, z up; attitudes are unit quaternions (w, x, y, z) that carry a
// direction fixed on a shell into that frame.
type Frames struct {
	Time []float64    `json:"time"`
	Sun  [][3]float64 `json:"sun"`
	// Size is the sun's width in degrees; Brightness is its surface
	// brightness and Light the light it sends, against the machine at rest.
	Size        []float64    `json:"size"`
	Brightness  []float64    `json:"brightness"`
	Light       []float64    `json:"light"`
	Outer       [][4]float64 `json:"outer"`
	Inner       [][4]float64 `json:"inner"`
	OuterRadius []float64    `json:"outerRadius"`
	InnerRadius []float64    `json:"innerRadius"`
	// Hole is the width of the large hole, which grows with its shell.
	Hole   []float64      `json:"hole"`
	Flying [][][3]float64 `json:"flying"`
}

const maxFrames = 1000

// Sky returns frames of the machine for the views to draw.
func Sky(q SkyRequest) (*Frames, error) {
	c, _, err := resolve(q.Request)
	if err != nil {
		return nil, err
	}
	maxSpan := 0.0
	for _, p := range catalog.Params {
		if p.ID == "clerk.span" {
			maxSpan = p.Max
		}
	}
	if !(q.From >= 0 && q.From <= maxSpan) {
		return nil, &core.FieldError{Field: "from", Message: "The start must be a day inside the calendar."}
	}
	if !(q.Step >= 1e-4 && q.Step <= 10) {
		return nil, &core.FieldError{Field: "step", Message: "The step must be between 0.0001 and 10 days."}
	}
	if q.Count < 1 || q.Count > maxFrames {
		return nil, &core.FieldError{Field: "count", Message: "Between 1 and 1000 moments can be asked for at once."}
	}
	m := build(c)
	f := &Frames{}
	for i := 0; i < q.Count; i++ {
		t := q.From + float64(i)*q.Step
		sun := m.sun(t)
		size, brightness, light := m.spot(t)
		outer, inner := m.radii(t)
		specks := [][3]float64{}
		for _, v := range m.flying(t) {
			specks = append(specks, [3]float64{round(v[0], 5), round(v[1], 5), round(v[2], 5)})
		}
		f.Time = append(f.Time, round(t, 6))
		f.Sun = append(f.Sun, [3]float64{round(sun[0], 6), round(sun[1], 6), round(sun[2], 6)})
		f.Size = append(f.Size, round(size, 4))
		f.Brightness = append(f.Brightness, round(brightness, 5))
		f.Light = append(f.Light, round(light, 5))
		f.Outer = append(f.Outer, rounded(m.outer(t)))
		f.Inner = append(f.Inner, rounded(m.inner(t)))
		f.OuterRadius = append(f.OuterRadius, round(outer, 5))
		f.InnerRadius = append(f.InnerRadius, round(inner, 5))
		f.Hole = append(f.Hole, round(m.holeWidth(outer), 5))
		f.Flying = append(f.Flying, specks)
	}
	return f, nil
}

func rounded(q quat) [4]float64 {
	return [4]float64{round(q[0], 6), round(q[1], 6), round(q[2], 6), round(q[3], 6)}
}
