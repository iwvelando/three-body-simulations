package mozi

import (
	"errors"
	"math"
	"reflect"
	"testing"

	"threebody/engine/core"
)

func mustRun(t *testing.T, q Request) *Result {
	t.Helper()
	r, err := Run(q)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func mustSky(t *testing.T, q SkyRequest) *Frames {
	t.Helper()
	f, err := Sky(q)
	if err != nil {
		t.Fatal(err)
	}
	return f
}

func rad(deg float64) float64 { return deg * math.Pi / 180 }

// angle between two unit vectors, in degrees.
func between(a, b [3]float64) float64 {
	dot := a[0]*b[0] + a[1]*b[1] + a[2]*b[2]
	return math.Acos(math.Max(-1, math.Min(1, dot))) * 180 / math.Pi
}

// turn applies a unit quaternion (w, x, y, z) to a vector, written out
// from the rotation matrix rather than the engine's own product.
func turn(q [4]float64, v [3]float64) [3]float64 {
	w, x, y, z := q[0], q[1], q[2], q[3]
	return [3]float64{
		(1-2*(y*y+z*z))*v[0] + 2*(x*y-w*z)*v[1] + 2*(x*z+w*y)*v[2],
		2*(x*y+w*z)*v[0] + (1-2*(x*x+z*z))*v[1] + 2*(y*z-w*x)*v[2],
		2*(x*z-w*y)*v[0] + 2*(y*z+w*x)*v[1] + (1-2*(x*x+y*y))*v[2],
	}
}

func TestCatalogIsConsistentAndAllSpeculative(t *testing.T) {
	c := Catalog()
	if err := c.Check(); err != nil {
		t.Fatal(err)
	}
	for _, s := range c.Slots {
		for _, m := range s.Models {
			if !m.Speculative {
				t.Errorf("%s.%s has no published basis and must say so", s.ID, m.ID)
			}
		}
	}
	if c.Presets[0].ID != "mozi" {
		t.Errorf("first preset %q", c.Presets[0].ID)
	}
}

// With one gear the sun is an ordinary sun at latitude 90° − tilt: it
// rises once a day, and the share of the day it is up follows the sunrise
// equation, cos(h) = −tan(latitude) tan(declination).
func TestPerfectClockworkKeepsTheSunriseEquation(t *testing.T) {
	const tilt, lamp = 50.0, 20.0
	r := mustRun(t, Request{Preset: "clockwork", Params: map[string]float64{"outer.tilt": tilt, "outer.lamp": lamp, "clerk.span": 400}})
	n := len(r.Calendar.Rise)
	if n < 398 || n > 400 {
		t.Fatalf("%d sunrises in 400 days", n)
	}
	want := math.Acos(-math.Tan(rad(90-tilt))*math.Tan(rad(lamp))) / math.Pi
	for i := 0; i < n; i++ {
		if d := r.Calendar.Length[i]; math.Abs(d-1) > 1e-6 {
			t.Fatalf("day %d lasts %v days", i, d)
		}
		if got := r.Calendar.Daylight[i]; math.Abs(got-want) > 1e-5 {
			t.Fatalf("day %d: daylight %v of the day, want %v", i, got, want)
		}
		if math.Abs(r.Calendar.Light[i]-1) > 1e-3 {
			t.Fatalf("day %d: light %v, want the standard day's", i, r.Calendar.Light[i])
		}
	}
	if len(r.Eras) != 1 || r.Eras[0].Kind != "stable" || r.Eras[0].From != 0 || r.Eras[0].To != 400 {
		t.Fatalf("eras: %+v", r.Eras)
	}
	if r.Summary.Stable != 1 || r.Summary.Chaotic != 0 || r.Summary.LongestStable != 400 {
		t.Fatalf("summary: %+v", r.Summary)
	}
}

func TestErasAreRunsOfRegularDays(t *testing.T) {
	// Ten sunrises a day apart, then a five-day gap, then eight more.
	rise := []float64{}
	regular := []bool{}
	for i := 0; i < 10; i++ {
		rise = append(rise, 1+float64(i))
		regular = append(regular, true)
	}
	regular[9] = false // the cycle that runs into the gap
	for i := 0; i < 8; i++ {
		rise = append(rise, 15+float64(i))
		regular = append(regular, true)
	}
	regular[12] = false
	// Runs of regular cycles: 9 (days 1 to 10), 2 (15 to 17), 5 (from 18).
	// Days counts the sunrises inside an era.
	got := classify(rise, regular, 5, 30)
	want := []Era{
		{Kind: "stable", From: 0, To: 10, Days: 9},
		{Kind: "chaotic", From: 10, To: 18, Days: 4},
		{Kind: "stable", From: 18, To: 30, Days: 5},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v\nwant %+v", got, want)
	}
	if got := classify(nil, nil, 5, 30); !reflect.DeepEqual(got, []Era{{Kind: "chaotic", From: 0, To: 30}}) {
		t.Fatalf("a sky with no sunrise: %+v", got)
	}
	// Too short a run of good days is still chaos.
	if got := classify(rise, regular, 10, 30); len(got) != 1 || got[0].Kind != "chaotic" {
		t.Fatalf("minimum run of 10: %+v", got)
	}
}

// Wang's first objection: holes in one sphere cannot move against each
// other. The second shell is Mozi's answer.
func TestTheSunMovesAgainstTheStarsOnlyWithTwoShells(t *testing.T) {
	spread := func(shells string) float64 {
		q := Request{Models: map[string]string{"shells": shells}}
		stars := mustRun(t, q).Stars
		if len(stars) < 100 {
			t.Fatalf("%d stars", len(stars))
		}
		f := mustSky(t, SkyRequest{Request: q, From: 3, Step: 0.5, Count: 120})
		lo, hi := math.Inf(1), math.Inf(-1)
		for i := range f.Time {
			star := turn(f.Inner[i], [3]float64{stars[0][0], stars[0][1], stars[0][2]})
			a := between(f.Sun[i], star)
			lo, hi = math.Min(lo, a), math.Max(hi, a)
		}
		return hi - lo
	}
	// Star positions are rounded to four places for the reply.
	if got := spread("one"); got > 0.02 {
		t.Errorf("one sphere: the sun moved %v° against a star", got)
	}
	if got := spread("two"); got < 20 {
		t.Errorf("two shells: the sun moved only %v° against a star in 60 days", got)
	}
}

// Wang's second objection: the sun's size changes. A rigid machine cannot
// do that; breathing shells change the gap the light crosses.
func TestTheSunChangesSizeOnlyWhenTheShellsBreathe(t *testing.T) {
	sizes := func(q Request) (lo, hi float64, f *Frames) {
		f = mustSky(t, SkyRequest{Request: q, From: 0, Step: 2, Count: 300})
		lo, hi = math.Inf(1), math.Inf(-1)
		for _, s := range f.Size {
			lo, hi = math.Min(lo, s), math.Max(hi, s)
		}
		return
	}
	geometry := map[string]float64{"hole.size": 0.1, "hole.spread": 5, "shells.gap": 0.35}
	lo, hi, _ := sizes(Request{Models: map[string]string{"breathing": "rigid"}, Params: geometry})
	// Hole 0.1 wide, light spreading 5° either side over a gap of 0.35:
	// 0.1 + 0.7 tan 5° = 0.16124 wide on a shell of radius 1, which is
	// 2 atan(0.08062) = 9.219° across from the center.
	if math.Abs(lo-9.219) > 0.002 || math.Abs(hi-9.219) > 0.002 {
		t.Errorf("rigid: sun %v° to %v° across, want 9.219°", lo, hi)
	}
	lo, hi, f := sizes(Request{Params: geometry})
	if hi-lo < 1 {
		t.Errorf("breathing: sun only %v° to %v° across", lo, hi)
	}
	for i := range f.Time {
		ro, ri := f.OuterRadius[i], f.InnerRadius[i]
		if ro <= ri {
			t.Fatalf("shells cross at day %v: outer %v, inner %v", f.Time[i], ro, ri)
		}
		// The hole grows with its shell (1.35 at rest).
		if math.Abs(f.Hole[i]-0.1*ro/1.35) > 1e-4 {
			t.Fatalf("day %v: hole %v wide in a shell of radius %v", f.Time[i], f.Hole[i], ro)
		}
		w := 0.1*ro/1.35 + 2*(ro-ri)*math.Tan(rad(5))
		if want := 2 * math.Atan(w/(2*ri)) * 180 / math.Pi; math.Abs(f.Size[i]-want) > 1e-3 {
			t.Fatalf("day %v: sun %v° across, want %v° for radii %v and %v", f.Time[i], f.Size[i], want, ro, ri)
		}
	}
	// One breathing sphere: the hole swells with its shell, so nothing
	// changes from the center. This is why Mozi needed two.
	lo, hi, _ = sizes(Request{Models: map[string]string{"shells": "one"}, Params: geometry})
	if hi-lo > 1e-6 || math.Abs(lo-2*math.Atan(0.05)*180/math.Pi) > 1e-3 {
		t.Errorf("one sphere: sun %v° to %v° across", lo, hi)
	}
}

func TestTheDarkCloudDimsTheSunWithoutMovingIt(t *testing.T) {
	clear := mustRun(t, Request{})
	cloudy := mustRun(t, Request{Models: map[string]string{"cloud": "cloud"}})
	if !reflect.DeepEqual(clear.Calendar.Rise, cloudy.Calendar.Rise) || !reflect.DeepEqual(clear.Calendar.Daylight, cloudy.Calendar.Daylight) {
		t.Error("the cloud moved a sunrise or a sunset")
	}
	dimmer, brighter := 0, 0
	for i := range clear.Calendar.Light {
		if cloudy.Calendar.Light[i] < clear.Calendar.Light[i]-1e-9 {
			dimmer++
		}
		if cloudy.Calendar.Light[i] > clear.Calendar.Light[i]+1e-9 {
			brighter++
		}
	}
	if dimmer == 0 || brighter != 0 {
		t.Errorf("%d days dimmer and %d brighter under the cloud", dimmer, brighter)
	}
	// At the middle of a passage the sun is all but out.
	q := SkyRequest{Request: Request{Models: map[string]string{"cloud": "cloud"}, Params: map[string]float64{"cloud.every": 100, "cloud.length": 4}}, From: 50, Step: 1, Count: 2}
	if f := mustSky(t, q); f.Brightness[0] > 0.05 || f.Brightness[0] < 0 {
		t.Errorf("sun at %v of its brightness under the cloud", f.Brightness[0])
	}
}

func TestFlyingStarsAreDustOrNothing(t *testing.T) {
	f := mustSky(t, SkyRequest{From: 0, Step: 0.25, Count: 8})
	if len(f.Flying) != 8 || len(f.Flying[0]) == 0 {
		t.Fatalf("dust: %v", f.Flying)
	}
	for _, v := range f.Flying[3] {
		if n := math.Sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]); math.Abs(n-1) > 1e-3 {
			t.Errorf("a flying star is not on the sky: %v", v)
		}
	}
	if reflect.DeepEqual(f.Flying[0], f.Flying[7]) {
		t.Error("the dust does not move")
	}
	f = mustSky(t, SkyRequest{Request: Request{Models: map[string]string{"flying": "none"}}, From: 0, Step: 0.25, Count: 8})
	for _, specks := range f.Flying {
		if len(specks) != 0 {
			t.Fatalf("no flying stars asked for, got %v", specks)
		}
	}
}

func TestIdenticalRequestsGiveIdenticalResults(t *testing.T) {
	q := Request{Preset: "rough", Params: map[string]float64{"gear.strength": 1.3}}
	if !reflect.DeepEqual(mustRun(t, q), mustRun(t, q)) {
		t.Error("two runs of one request differ")
	}
	s := SkyRequest{Request: q, From: 12.5, Step: 0.01, Count: 50}
	if !reflect.DeepEqual(mustSky(t, s), mustSky(t, s)) {
		t.Error("two skies of one request differ")
	}
}

func TestCoarseAndFineAgree(t *testing.T) {
	for _, preset := range []string{"mozi", "clockwork", "rough"} {
		coarse := mustRun(t, Request{Preset: preset})
		fine := mustRun(t, Request{Preset: preset, Resolution: "fine"})
		if len(coarse.Calendar.Rise) != len(fine.Calendar.Rise) {
			t.Fatalf("%s: %d sunrises coarse, %d fine", preset, len(coarse.Calendar.Rise), len(fine.Calendar.Rise))
		}
		for i, at := range coarse.Calendar.Rise {
			if math.Abs(at-fine.Calendar.Rise[i]) > 1e-4 {
				t.Fatalf("%s: sunrise %d at %v coarse, %v fine", preset, i, at, fine.Calendar.Rise[i])
			}
			if math.Abs(coarse.Calendar.Light[i]-fine.Calendar.Light[i]) > 0.01 {
				t.Fatalf("%s: day %d light %v coarse, %v fine", preset, i, coarse.Calendar.Light[i], fine.Calendar.Light[i])
			}
		}
		if !reflect.DeepEqual(coarse.Eras, fine.Eras) && len(coarse.Eras) != len(fine.Eras) {
			t.Errorf("%s: %d eras coarse, %d fine", preset, len(coarse.Eras), len(fine.Eras))
		}
	}
}

// The sky the two views draw must be the sky the calendar was read from.
func TestTheSkyCrossesTheHorizonAtTheRecordedSunrise(t *testing.T) {
	r := mustRun(t, Request{})
	for _, k := range []int{0, 7, len(r.Calendar.Rise) / 2} {
		at := r.Calendar.Rise[k]
		f := mustSky(t, SkyRequest{From: at - 0.01, Step: 0.01, Count: 3})
		if !(f.Sun[0][2] < 0 && math.Abs(f.Sun[1][2]) < 1e-3 && f.Sun[2][2] > 0) {
			t.Errorf("sunrise %d at day %v: sun heights %v, %v, %v", k, at, f.Sun[0][2], f.Sun[1][2], f.Sun[2][2])
		}
	}
	// The calendar's eras cover the span without gaps.
	at := 0.0
	for _, e := range r.Eras {
		if e.From != at || e.To <= e.From {
			t.Fatalf("era %+v does not start at %v", e, at)
		}
		at = e.To
	}
	if at != r.Span {
		t.Fatalf("eras end at %v of %v days", at, r.Span)
	}
}

func TestErrorsNameTheField(t *testing.T) {
	field := func(err error) string {
		var fe *core.FieldError
		if !errors.As(err, &fe) {
			t.Fatalf("not a field error: %v", err)
		}
		return fe.Field
	}
	_, err := Run(Request{Params: map[string]float64{"outer.tilt": 500}})
	if got := field(err); got != "params.outer.tilt" {
		t.Errorf("field %q", got)
	}
	_, err = Run(Request{Resolution: "finest"})
	if got := field(err); got != "resolution" {
		t.Errorf("field %q", got)
	}
	for name, q := range map[string]SkyRequest{
		"from":  {From: -1, Step: 0.01, Count: 10},
		"step":  {From: 0, Step: 0, Count: 10},
		"count": {From: 0, Step: 0.01, Count: 100000},
	} {
		_, err = Sky(q)
		if got := field(err); got != name {
			t.Errorf("%s: field %q", name, got)
		}
	}
	_, err = Sky(SkyRequest{From: math.NaN(), Step: 0.01, Count: 10})
	if got := field(err); got != "from" {
		t.Errorf("NaN start: field %q", got)
	}
}

// Records how the presets come out. Nothing here is calibrated to the
// novel, which gives no numbers; if a change moves these, update
// docs/models-mozi.md and the science page's "How it came out" with them.
func TestMozisMachineCalendar(t *testing.T) {
	r := mustRun(t, Request{})
	if r.Summary.Stable != 11 || r.Summary.Chaotic != 12 {
		t.Errorf("Mozi's machine: %d Stable and %d Chaotic Eras in %v days", r.Summary.Stable, r.Summary.Chaotic, r.Span)
	}
	if math.Abs(r.Summary.LongestStable-79.2) > 0.1 || math.Abs(r.Summary.StableShare-0.217) > 0.001 {
		t.Errorf("Mozi's machine: longest Stable Era %v days, %v of the time stable", r.Summary.LongestStable, r.Summary.StableShare)
	}
	// The run opens in chaos; the first Stable Era starts on day 166.
	if r.Eras[0].Kind != "chaotic" || math.Abs(r.Eras[0].To-165.9) > 0.1 {
		t.Errorf("first era: %+v", r.Eras[0])
	}
	shortest, longest := math.Inf(1), 0.0
	for _, d := range r.Calendar.Length {
		shortest, longest = math.Min(shortest, d), math.Max(longest, d)
	}
	if math.Abs(shortest-0.75) > 0.01 || math.Abs(longest-1.50) > 0.01 {
		t.Errorf("days from %v to %v long", shortest, longest)
	}
	rough := mustRun(t, Request{Preset: "rough"})
	if rough.Summary.Stable != 2 || rough.Summary.StableShare > 0.03 {
		t.Errorf("Rough seas: %+v", rough.Summary)
	}
}
