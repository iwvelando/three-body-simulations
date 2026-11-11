package flat

import (
	"bytes"
	"encoding/binary"
	"errors"
	"math"
	"reflect"
	"testing"

	"threebody/engine/core"
)

// ---- the sky ----

func mustSky(t *testing.T, q SkyRequest) *SkyResult {
	t.Helper()
	r, err := Sky(q)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

// The novel's order, as far as the passages give it: Neptune and Saturn,
// then the Earth and Mercury, the Sun, then Venus and Mars; Uranus is on
// the far side.
func TestTheNovelsArrangementFallsInTheNovelsOrder(t *testing.T) {
	r := mustSky(t, SkyRequest{})
	var order []string
	for n := 1; n <= len(r.Bodies); n++ {
		for _, b := range r.Bodies {
			if b.Order == n {
				order = append(order, b.Body.ID)
			}
		}
	}
	want := []string{"neptune", "saturn", "earth", "mercury", "sun", "venus", "mars", "jupiter", "uranus", "pluto"}
	if !reflect.DeepEqual(order, want) {
		t.Fatalf("order %v", order)
	}
	if len(r.Touching) != 0 {
		t.Errorf("under the Sun's clock nothing is wide enough to touch: %v", r.Touching)
	}
}

// With flat Jupiter and Saturn wide enough to touch, the planets still
// cover about 1% of the space inside Neptune's orbit, and the flat Sun
// is wider than all of it.
func TestStarryNightSky(t *testing.T) {
	r := mustSky(t, SkyRequest{Preset: "starry"})
	near(t, "covered by planets", r.Covered, 0.0113, 0.03)
	touching := false
	for _, b := range r.Bodies {
		near(t, b.Body.ID+" stays on its orbit", math.Hypot(b.X, b.Y)+1, b.Body.Orbit+1, 1e-9)
		if b.Body.ID == "sun" {
			near(t, "flat Sun, AU", b.Radius/AU, 78, 0.02)
		}
	}
	for _, pair := range r.Touching {
		touching = touching || (pair[0] == "sun" && pair[1] == "neptune")
	}
	if !touching {
		t.Errorf("the flat Sun should reach Neptune: %v", r.Touching)
	}
}

func TestShufflingIsSeeded(t *testing.T) {
	a, b, c := mustSky(t, SkyRequest{Seed: 7}), mustSky(t, SkyRequest{Seed: 7}), mustSky(t, SkyRequest{Seed: 8})
	if !reflect.DeepEqual(a, b) {
		t.Error("the same seed gave a different sky")
	}
	if reflect.DeepEqual(a.Bodies, c.Bodies) || reflect.DeepEqual(a.Bodies, mustSky(t, SkyRequest{}).Bodies) {
		t.Error("a different seed gave the same sky")
	}
	if _, err := Sky(SkyRequest{Seed: -1}); err == nil {
		t.Error("a negative seed should be refused")
	}
}

// ---- snowflakes: Reiter (2005) ----

func ice(cells []float64) int {
	n := 0
	for _, v := range cells {
		if v >= 1 {
			n++
		}
	}
	return n
}

// The paper: with no background and nothing added, nothing grows; with
// no background and something added, plates form. Adding a whole unit
// each step freezes one more ring of cells each step, and a hexagon k
// rings out holds 1 + 3k(k+1) cells.
func TestReitersLimits(t *testing.T) {
	if n := ice(grow(0, 0, 1, 12, 50)); n != 1 {
		t.Errorf("no vapor, no growth: %d cells of ice", n)
	}
	for _, k := range []int{1, 2, 5} {
		if n := ice(grow(0, 1, 1, 12, k)); n != 1+3*k*(k+1) {
			t.Errorf("plate after %d steps: %d cells, want %d", k, n, 1+3*k*(k+1))
		}
	}
}

// With the paper's dendrite setting the crystal branches, and stays
// six-fold: a sixth of a turn maps hex cell (q, r) to (−r, q + r).
func TestReitersDendriteIsSixFold(t *testing.T) {
	const radius = 30
	cells := grow(0.4, 0.0001, 1, radius, 400)
	side := 2*radius + 1
	at := func(q, r int) bool { return cells[(r+radius)*side+q+radius] >= 1 }
	reach, count := 0.0, 0
	for q := -radius; q <= radius; q++ {
		for r := -radius; r <= radius; r++ {
			if q*q+q*r+r*r > 22*22 { // inside the round field, √3/2 of 30
				continue
			}
			if at(q, r) != at(-r, q+r) {
				t.Fatalf("not six-fold at (%d, %d)", q, r)
			}
			if at(q, r) {
				count++
				reach = math.Max(reach, math.Sqrt(float64(q*q+q*r+r*r)))
			}
		}
	}
	if reach < 5 {
		t.Fatalf("it barely grew: reach %g", reach)
	}
	// A plate of that reach would be solid; a dendrite is mostly gaps.
	if solid := 1 + 3*reach*(reach+1); float64(count) > 0.7*solid {
		t.Errorf("%d cells within reach %g is a plate, not a dendrite", count, reach)
	}
}

func TestSnowflakesAreSeededAndUnalike(t *testing.T) {
	a, pa, err := Snowflakes(SnowRequest{Seed: 3, Count: 4, Size: 48})
	if err != nil {
		t.Fatal(err)
	}
	b, pb, _ := Snowflakes(SnowRequest{Seed: 3, Count: 4, Size: 48})
	if !reflect.DeepEqual(a, b) || !bytes.Equal(pa, pb) {
		t.Error("the same seed gave different snow")
	}
	if len(pa) != 4*48*48 || len(a.Flakes) != 4 {
		t.Fatalf("%d bytes, %d flakes", len(pa), len(a.Flakes))
	}
	if bytes.Equal(pa[:48*48], pa[48*48:2*48*48]) {
		t.Error("two flakes are alike")
	}
	for _, q := range []SnowRequest{{Count: 0, Size: 48}, {Count: 4, Size: 4}, {Count: 400, Size: 48}} {
		var fe *core.FieldError
		if _, _, err := Snowflakes(q); !errors.As(err, &fe) {
			t.Errorf("%+v should be refused", q)
		}
	}
}

// ---- the flow a picture rides ----

// The velocity a uniform source over a rectangle gives, against a plain
// sum over the rectangle's area.
func TestRectangleFieldMatchesDirectSum(t *testing.T) {
	const a, b, n = 1.0, 0.6, 400
	for _, p := range [][2]float64{{0.3, 0.2}, {1.7, 0.4}, {-0.5, 2.0}, {0, 0}, {2.5, -1.5}} {
		var sx, sy float64
		for i := 0; i < n; i++ {
			for j := 0; j < n; j++ {
				dx := p[0] - (-a + (float64(i)+0.5)*2*a/n)
				dy := p[1] - (-b + (float64(j)+0.5)*2*b/n)
				d := dx*dx + dy*dy
				sx += dx / d
				sy += dy / d
			}
		}
		cell := (2 * a / n) * (2 * b / n) / (2 * math.Pi)
		ux, uy := rectField(a, b, p[0], p[1])
		if math.Abs(ux-sx*cell) > 2e-3 || math.Abs(uy-sy*cell) > 2e-3 {
			t.Errorf("at %v: got (%g, %g), sum (%g, %g)", p, ux, uy, sx*cell, sy*cell)
		}
	}
}

// A line that feeds one unit of area per unit length to each side: the
// flow leaves it at speed one, and far away is a point source of
// strength 4 (two sides, length 2), speed 4/(2πr).
func TestLineFieldNearAndFar(t *testing.T) {
	_, uy := lineField(0.3, 1e-9)
	near(t, "leaving the line", uy, 1, 1e-6)
	ux, uy := lineField(300, 400)
	near(t, "far", math.Hypot(ux, uy), 4/(2*math.Pi*500), 1e-4)
	near(t, "radial", uy/ux, 400.0/300, 1e-4)
}

// Carried by that flow, the strip between two nearby starting points
// grows by its width for every unit fed in, however far it goes: areas
// are kept.
func TestTheFlowKeepsAreas(t *testing.T) {
	for _, fed := range []float64{0.5, 40, 1e6} {
		const rows = 24
		left, right := trace(0.30, fed/rows, rows), trace(0.34, fed/rows, rows)
		// Shoelace around: out along one path, back along the other.
		var outline [][2]float64
		outline = append(outline, right...)
		for i := len(left) - 1; i >= 0; i-- {
			outline = append(outline, left[i])
		}
		area := 0.0
		for i, p := range outline {
			q := outline[(i+1)%len(outline)]
			area += p[0]*q[1] - q[0]*p[1]
		}
		near(t, "strip", math.Abs(area)/2, 0.04*fed, 0.02)
	}
}

// ---- the painting ----

// A picture with large and small features, 64 by 48.
func testPicture() ([]byte, int, int) {
	const w, h = 64, 48
	px := make([]byte, 4*w*h)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			i := 4 * (y*w + x)
			px[i] = byte(4 * x)
			px[i+1] = byte(5 * y)
			px[i+2] = 40
			if (x/8+y/8)%2 == 0 {
				px[i+2] = 220
			}
			px[i+3] = 255
		}
	}
	return px, w, h
}

func mustPaint(t *testing.T, q PaintingRequest) (*PaintingResult, []byte) {
	t.Helper()
	px, w, h := testPicture()
	q.Width, q.Height = w, h
	r, out, err := Painting(q, px)
	if err != nil {
		t.Fatal(err)
	}
	return r, out
}

func TestAPictureAloneAndEdgeFirstComesBack(t *testing.T) {
	for _, edge := range []string{"bottom", "top", "left", "right"} {
		r, out := mustPaint(t, PaintingRequest{Models: map[string]string{"entry": edge}})
		if r.Score < 0.9 {
			t.Errorf("%s: recovered %g", edge, r.Score)
		}
		// 92.1 cm wide and three quarters as tall, 1 mm deep, on a sheet
		// one atom thick: area = volume / thickness.
		near(t, edge+" area", r.Area, 0.921*0.69075*0.001/1e-10, 1e-9)
		// Each half of the depth becomes half a disc: πR²/2 each.
		near(t, edge+" across", r.Across, 2*math.Sqrt(r.Area/math.Pi), 0.03)
		if r.Restored.Width != 64 || r.Restored.Height != 48 || len(out) < r.Restored.Offset+4*64*48 {
			t.Fatalf("%s: restored section %+v in %d bytes", edge, r.Restored, len(out))
		}
		if r.Mesh.Offset%4 != 0 || r.Mesh.Count != 2*r.Cols*(r.Rows+1) || !r.Mirror {
			t.Errorf("%s: mesh %+v for %d by %d", edge, r.Mesh, r.Cols, r.Rows)
		}
		// Every mesh point is inside the frame the picture is drawn in.
		for i := 0; i < r.Mesh.Count; i++ {
			v := math.Float32frombits(binary.LittleEndian.Uint32(out[r.Mesh.Offset+4*i:]))
			if !(v >= -1.0001 && v <= 1.0001) {
				t.Fatalf("%s: mesh value %g", edge, v)
			}
		}
	}
}

func TestFaceDownOrBuriedDoesNotComeBack(t *testing.T) {
	alone, _ := mustPaint(t, PaintingRequest{})
	flat, _ := mustPaint(t, PaintingRequest{Models: map[string]string{"entry": "flat"}})
	// Each path out from under the picture keeps only its average, which
	// for this test picture's broad gradients is still about half.
	if flat.Score > alone.Score-0.3 {
		t.Errorf("face down recovered %g against %g edge first", flat.Score, alone.Score)
	}
	near(t, "face down area", flat.Area, alone.Area, 1e-9)
	buried, _ := mustPaint(t, PaintingRequest{Models: map[string]string{"company": "buried"}})
	if buried.Score > 0.05 {
		t.Errorf("buried recovered %g", buried.Score)
	}
	// Pluto, radius 1188 km, on a sheet one atom thick: the ring the
	// picture lands in is at √(⅔R³/h); it is stretched round by that
	// over where it stood, and shares its place with the 1,188 km of
	// rock and ice that lay on the same line to the middle.
	ring := math.Sqrt(2.0 / 3 * 1188 * 1188 * 1188 / 1e-13)
	near(t, "stretch", buried.Stretch, ring/1187.9, 1e-6)
	near(t, "dilution", buried.Dilution, 2*1187.9*1e-6/(1188*1188), 1e-6)
}

// A coarser reader gets less back.
func TestTheReaderLimitsWhatComesBack(t *testing.T) {
	sharp, _ := mustPaint(t, PaintingRequest{})
	blunt, _ := mustPaint(t, PaintingRequest{Params: map[string]float64{"reader": 16}})
	if blunt.Score >= sharp.Score-0.1 {
		t.Errorf("16 dots recovered %g, 512 dots %g", blunt.Score, sharp.Score)
	}
}

// Under the Sun's clock the sheet is far thicker than the picture, so it
// cannot spread: it lands as a line narrower than an atom.
func TestAThickSheetLeavesALine(t *testing.T) {
	r, _ := mustPaint(t, PaintingRequest{Preset: "sun30"})
	near(t, "area", r.Area, 0.921*0.69075*0.001/192000, 1e-9)
	near(t, "across", r.Across, 0.921, 0.01)
	if r.Tall > 1e-8 || r.Score > 0.05 {
		t.Errorf("tall %g m, recovered %g", r.Tall, r.Score)
	}
}

func TestPaintingIsRepeatableAndRefusesBadInput(t *testing.T) {
	a, pa := mustPaint(t, PaintingRequest{})
	b, pb := mustPaint(t, PaintingRequest{})
	if !reflect.DeepEqual(a, b) || !bytes.Equal(pa, pb) {
		t.Error("identical requests gave different replies")
	}
	px, w, h := testPicture()
	for field, q := range map[string]PaintingRequest{
		"pixels":        {Width: w, Height: h + 1},
		"width":         {Width: 0, Height: h},
		"height":        {Width: w, Height: 4000},
		"models.entry":  {Width: w, Height: h, Models: map[string]string{"entry": "sideways"}},
		"params.reader": {Width: w, Height: h, Params: map[string]float64{"reader": 1}},
	} {
		_, _, err := Painting(q, px)
		var fe *core.FieldError
		if !errors.As(err, &fe) || fe.Field != field {
			t.Errorf("%s: got %v", field, err)
		}
	}
}
