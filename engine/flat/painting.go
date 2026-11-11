package flat

import (
	"encoding/binary"
	"math"

	"threebody/engine/core"
)

// PaintingRequest asks for a picture's fall. The picture itself travels
// beside the request as Width × Height RGBA bytes.
type PaintingRequest struct {
	Width  int                `json:"width"`
	Height int                `json:"height"`
	Preset string             `json:"preset,omitempty"`
	Models map[string]string  `json:"models,omitempty"`
	Params map[string]float64 `json:"params,omitempty"`
}

// Section is an RGBA picture inside the reply's bytes.
type Section struct {
	Offset int `json:"offset"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

// Span is a run of little-endian float32 values inside the reply's bytes.
type Span struct {
	Offset int `json:"offset"`
	Count  int `json:"count"`
}

// Core is the patch left where a picture landed face down.
type Core struct {
	HalfWidth  float64 `json:"halfWidth"`
	HalfHeight float64 `json:"halfHeight"`
	Color      [3]int  `json:"color"`
}

// PaintingResult describes the bytes beside it.
//
// The fall is a sheet of Cols × (Rows+1) points. Mesh holds where the
// matter that left starting place i is after k equal shares of the
// picture have gone in behind it: x then y, i fastest, in a frame from
// −1 to 1 with y down. Texture is what the sheet carries: column i reads
// it at U[i] across, and matter that went in at share j of the way
// through (0 first) reads it j/Rows of the way down. With m shares in,
// that matter is at step m − j, so the last frame has it at Rows − j.
// Still means there is no fall to show: the sheet is drawn as it is.
type PaintingResult struct {
	Width  int       `json:"width"`
	Height int       `json:"height"`
	Cols   int       `json:"cols"`
	Rows   int       `json:"rows"`
	U      []float64 `json:"u"`
	Mesh   Span      `json:"mesh"`
	// Mirror says the back half of the depth lands as the same sheet
	// reflected in Line (x0, y0, x1, y1), carrying Back.
	Mirror bool       `json:"mirror"`
	Line   [4]float64 `json:"line"`
	Still  bool       `json:"still"`
	Core   *Core      `json:"core,omitempty"`
	// Texture, Back, Flat (the finished picture) and Restored (what a
	// reader of limited sharpness gets back) are RGBA.
	Texture  Section `json:"texture"`
	Back     Section `json:"back"`
	Flat     Section `json:"flat"`
	Restored Section `json:"restored"`
	// Area of the picture's own flat matter in m²; Across and Tall are
	// the flat picture's width and height in m.
	Area   float64 `json:"area"`
	Across float64 `json:"across"`
	Tall   float64 `json:"tall"`
	// Thin says the sheet is thicker than the picture, which then
	// cannot spread.
	Thin bool `json:"thin"`
	// Buried only: how many times longer the picture is around Pluto's
	// ring and along it, and the share of the matter there that is the
	// picture.
	Stretch  float64 `json:"stretch,omitempty"`
	Radial   float64 `json:"radial,omitempty"`
	Dilution float64 `json:"dilution,omitempty"`
	// Score is how much of the picture came back: 1 is all of it, 0 is
	// no better than one flat color.
	Score  float64  `json:"score"`
	Choice Resolved `json:"choice"`
}

type rgba = [4]float64 // red, green, blue 0–255; cover 0–1

var bareCanvas = rgba{203, 186, 150, 1}

// image is a picture with colors read between its dots.
type image struct {
	w, h int
	px   []byte
}

func (m image) at(x, y int) rgba {
	x, y = max(0, min(m.w-1, x)), max(0, min(m.h-1, y))
	i := 4 * (y*m.w + x)
	return rgba{float64(m.px[i]), float64(m.px[i+1]), float64(m.px[i+2]), float64(m.px[i+3]) / 255}
}

// sample reads at (x, y) in dots, where dot centers are at halves.
func (m image) sample(x, y float64) rgba {
	x, y = x-0.5, y-0.5
	x0, y0 := math.Floor(x), math.Floor(y)
	fx, fy := x-x0, y-y0
	var out rgba
	for dy := 0; dy < 2; dy++ {
		for dx := 0; dx < 2; dx++ {
			wx, wy := 1-fx, 1-fy
			if dx == 1 {
				wx = fx
			}
			if dy == 1 {
				wy = fy
			}
			c := m.at(int(x0)+dx, int(y0)+dy)
			// Weigh colors by cover so empty dots lend none.
			for k := 0; k < 3; k++ {
				out[k] += wx * wy * c[3] * c[k]
			}
			out[3] += wx * wy * c[3]
		}
	}
	if out[3] > 0 {
		for k := 0; k < 3; k++ {
			out[k] /= out[3]
		}
	}
	return out
}

// sheet is a grid of points with a color for every place between them.
type sheet struct {
	cols, rows int
	pos        [][2]float64 // cols × (rows+1), i fastest
	color      func(fi, fk float64) rgba
}

func (s sheet) at(fi, fk float64) [2]float64 {
	fi = math.Max(0, math.Min(float64(s.cols-1), fi))
	fk = math.Max(0, math.Min(float64(s.rows), fk))
	i, k := int(math.Min(fi, float64(s.cols-2))), int(math.Min(fk, float64(s.rows-1)))
	u, v := fi-float64(i), fk-float64(k)
	p := func(i, k int) [2]float64 { return s.pos[k*s.cols+i] }
	a, b, c, d := p(i, k), p(i+1, k), p(i, k+1), p(i+1, k+1)
	return [2]float64{
		(1-u)*(1-v)*a[0] + u*(1-v)*b[0] + (1-u)*v*c[0] + u*v*d[0],
		(1-u)*(1-v)*a[1] + u*(1-v)*b[1] + (1-u)*v*c[1] + u*v*d[1],
	}
}

// margin keeps the picture off the edge of its frame.
const margin = 0.96

// draw paints sheets into a picture of w × h dots, each dot the mean of
// 2 × 2 samples so edges and fine detail are averaged, as an eye or a
// lens of that sharpness would.
func draw(w, h int, sheets []sheet, under func(x, y float64) (rgba, bool)) image {
	const ss = 2
	sw, sh := w*ss, h*ss
	acc := make([]rgba, sw*sh)
	if under != nil {
		for j := 0; j < sh; j++ {
			for i := 0; i < sw; i++ {
				x := (2*(float64(i)+0.5)/float64(sw) - 1) / margin
				y := (2*(float64(j)+0.5)/float64(sh) - 1) / margin
				if c, ok := under(x, y); ok {
					acc[j*sw+i] = c
				}
			}
		}
	}
	place := func(p [2]float64) [2]float64 {
		return [2]float64{(p[0]*margin + 1) / 2 * float64(sw), (p[1]*margin + 1) / 2 * float64(sh)}
	}
	for _, s := range sheets {
		for k := 0; k < s.rows; k++ {
			for i := 0; i < s.cols-1; i++ {
				corners := [4][2]float64{place(s.pos[k*s.cols+i]), place(s.pos[k*s.cols+i+1]), place(s.pos[(k+1)*s.cols+i+1]), place(s.pos[(k+1)*s.cols+i])}
				at := [4][2]float64{{float64(i), float64(k)}, {float64(i + 1), float64(k)}, {float64(i + 1), float64(k + 1)}, {float64(i), float64(k + 1)}}
				for _, t := range [2][3]int{{0, 1, 2}, {0, 2, 3}} {
					a, b, c := corners[t[0]], corners[t[1]], corners[t[2]]
					area := (b[0]-a[0])*(c[1]-a[1]) - (c[0]-a[0])*(b[1]-a[1])
					if area == 0 {
						continue
					}
					x0 := max(0, int(math.Floor(math.Min(a[0], math.Min(b[0], c[0]))-0.5)))
					x1 := min(sw-1, int(math.Ceil(math.Max(a[0], math.Max(b[0], c[0])))))
					y0 := max(0, int(math.Floor(math.Min(a[1], math.Min(b[1], c[1]))-0.5)))
					y1 := min(sh-1, int(math.Ceil(math.Max(a[1], math.Max(b[1], c[1])))))
					for y := y0; y <= y1; y++ {
						for x := x0; x <= x1; x++ {
							px, py := float64(x)+0.5, float64(y)+0.5
							wa := ((b[0]-px)*(c[1]-py) - (c[0]-px)*(b[1]-py)) / area
							wb := ((c[0]-px)*(a[1]-py) - (a[0]-px)*(c[1]-py)) / area
							wc := 1 - wa - wb
							if wa < 0 || wb < 0 || wc < 0 {
								continue
							}
							fi := wa*at[t[0]][0] + wb*at[t[1]][0] + wc*at[t[2]][0]
							fk := wa*at[t[0]][1] + wb*at[t[1]][1] + wc*at[t[2]][1]
							acc[y*sw+x] = s.color(fi, fk)
						}
					}
				}
			}
		}
	}
	out := image{w: w, h: h, px: make([]byte, 4*w*h)}
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			var c rgba
			for dy := 0; dy < ss; dy++ {
				for dx := 0; dx < ss; dx++ {
					s := acc[(y*ss+dy)*sw+x*ss+dx]
					for k := 0; k < 3; k++ {
						c[k] += s[3] * s[k]
					}
					c[3] += s[3]
				}
			}
			i := 4 * (y*w + x)
			if c[3] > 0 {
				for k := 0; k < 3; k++ {
					out.px[i+k] = byte(math.Round(c[k] / c[3]))
				}
			}
			out.px[i+3] = byte(math.Round(255 * c[3] / (ss * ss)))
		}
	}
	return out
}

// read is what a reader sees at a place in the frame: nothing, where
// the record is empty.
func read(record image, p [2]float64) rgba {
	c := record.sample((p[0]*margin+1)/2*float64(record.w), (p[1]*margin+1)/2*float64(record.h))
	if c[3] < 0.02 {
		return rgba{}
	}
	return c
}

// score compares a restored picture with the original: one minus its
// mean error over the error of guessing the original's mean color.
func score(original, restored image) float64 {
	var mean [3]float64
	n := float64(original.w * original.h)
	for i := 0; i < len(original.px); i += 4 {
		for k := 0; k < 3; k++ {
			mean[k] += float64(original.px[i+k]) / n
		}
	}
	miss, guess := 0.0, 0.0
	for i := 0; i < len(original.px); i += 4 {
		for k := 0; k < 3; k++ {
			v := float64(original.px[i+k])
			miss += math.Abs(v - float64(restored.px[i+k]))
			guess += math.Abs(v - mean[k])
		}
	}
	if guess == 0 {
		return 0
	}
	return math.Max(0, math.Min(1, 1-miss/guess))
}

func whole(c rgba) [3]int {
	return [3]int{int(math.Round(c[0])), int(math.Round(c[1])), int(math.Round(c[2]))}
}

const (
	maxSide  = 1024
	flatSide = 640
	lattice  = 96
)

// Painting drops a picture into the plane, records the flat picture at
// the reader's sharpness and restores it from that record.
func Painting(q PaintingRequest, pixels []byte) (*PaintingResult, []byte, error) {
	switch {
	case q.Width < 1 || q.Width > maxSide:
		return nil, nil, &core.FieldError{Field: "width", Message: "A picture is 1 to 1,024 dots wide."}
	case q.Height < 1 || q.Height > maxSide:
		return nil, nil, &core.FieldError{Field: "height", Message: "A picture is 1 to 1,024 dots tall."}
	case len(pixels) != 4*q.Width*q.Height:
		return nil, nil, &core.FieldError{Field: "pixels", Message: "The picture's size does not match its data."}
	}
	c, err := painting.Resolve(q.Preset, q.Models, q.Params)
	if err != nil {
		return nil, nil, err
	}
	// See-through parts of the picture are bare canvas.
	src := image{w: q.Width, h: q.Height, px: make([]byte, len(pixels))}
	for i := 0; i < len(pixels); i += 4 {
		a := float64(pixels[i+3]) / 255
		for k := 0; k < 3; k++ {
			src.px[i+k] = byte(math.Round(a*float64(pixels[i+k]) + (1-a)*bareCanvas[k]))
		}
		src.px[i+3] = 255
	}
	h := c.Params["sheet.thickness"]
	depth := c.Params["paper.depth"] / 1000
	wide := c.Params["paper.width"] / 100
	tall := wide * float64(src.h) / float64(src.w)
	reader := int(math.Round(c.Params["reader"]))
	out := &PaintingResult{Width: src.w, Height: src.h, Area: wide * tall * depth / h, Thin: depth < h,
		Choice: Resolved{Models: c.Models, Params: c.Params}}

	var p plan
	switch {
	case c.Models["company"] == "buried":
		p = buried(src, c, out, wide, tall, depth, h)
	case c.Models["entry"] == "flat":
		p = faceDown(src, c, out, wide, tall, depth, h)
	default:
		p = edgeFirst(src, c, out, wide, tall, depth, h)
	}

	flat := draw(flatSide, flatSide, p.sheets, p.under)
	record := draw(reader, reader, p.sheets, p.under)
	restored := image{w: src.w, h: src.h, px: make([]byte, len(src.px))}
	for y := 0; y < src.h; y++ {
		for x := 0; x < src.w; x++ {
			col := read(record, p.find(x, y))
			i := 4 * (y*src.w + x)
			for k := 0; k < 3; k++ {
				restored.px[i+k] = byte(math.Round(col[k]))
			}
			restored.px[i+3] = 255
		}
	}
	out.Score = score(src, restored)

	front := p.sheets[len(p.sheets)-1]
	out.Cols, out.Rows = front.cols, front.rows
	bytes := make([]byte, 0, 8*len(front.pos)+4*(flatSide*flatSide+2*src.w*src.h+p.texture.w*p.texture.h+p.back.w*p.back.h))
	out.Mesh = Span{Offset: 0, Count: 2 * len(front.pos)}
	for _, pt := range front.pos {
		bytes = binary.LittleEndian.AppendUint32(bytes, math.Float32bits(float32(pt[0])))
		bytes = binary.LittleEndian.AppendUint32(bytes, math.Float32bits(float32(pt[1])))
	}
	add := func(m image) Section {
		s := Section{Offset: len(bytes), Width: m.w, Height: m.h}
		bytes = append(bytes, m.px...)
		return s
	}
	out.Texture = add(p.texture)
	out.Back = add(p.back)
	out.Flat = add(flat)
	out.Restored = add(restored)
	return out, bytes, nil
}

// plan is one way of falling, ready to draw: the sheets (the picture's
// own last), anything under them, what the sheets carry, and where a
// dot of the original is to be looked for afterwards.
type plan struct {
	sheets  []sheet
	under   func(x, y float64) (rgba, bool)
	texture image
	back    image
	find    func(x, y int) [2]float64
}

func flatColor(c rgba) image {
	return image{w: 1, h: 1, px: []byte{byte(c[0]), byte(c[1]), byte(c[2]), byte(math.Round(255 * c[3]))}}
}

// edgeFirst stands the picture on the plane. The line where it goes in
// feeds each row out to both sides: the front half of the depth one
// way, the back half the other. Rows follow one another down fixed
// paths, so the first row in ends furthest out.
func edgeFirst(src image, c core.Choice, out *PaintingResult, wide, tall, depth, h float64) plan {
	entry := c.Models["entry"]
	// A picture turned so its first row in is row 0 and the line runs
	// along its width. from says which dot of the original each is.
	cw, ch := src.w, src.h
	if entry == "left" || entry == "right" {
		cw, ch = src.h, src.w
	}
	from := func(x, y int) (int, int) {
		switch entry {
		case "top":
			return x, y
		case "left":
			return y, x
		case "right":
			return src.w - 1 - y, x
		}
		return x, src.h - 1 - y
	}
	turned := image{w: cw, h: ch, px: make([]byte, 4*cw*ch)}
	for y := 0; y < ch; y++ {
		for x := 0; x < cw; x++ {
			sx, sy := from(x, y)
			copy(turned.px[4*(y*cw+x):4*(y*cw+x)+4], src.px[4*(sy*src.w+sx):])
		}
	}
	// Onto the screen, y down: the rows spread towards the side that
	// went in first, so the picture stays the way up it was.
	screen := func(p [2]float64) [2]float64 {
		switch entry {
		case "top":
			return [2]float64{p[0], -p[1]}
		case "left":
			return [2]float64{-p[1], p[0]}
		case "right":
			return [2]float64{p[1], p[0]}
		}
		return p
	}
	line := wide
	if entry == "left" || entry == "right" {
		line = tall
	}

	n, rows := min(cw, lattice), min(ch, lattice)
	cols := n + 2
	u := make([]float64, cols)
	u[0], u[cols-1] = 0.00005, 0.99995
	for i := 0; i < n; i++ {
		u[i+1] = (float64(i) + 0.5) / float64(n)
	}
	// In half-lengths of the line: each row is fed out to a side at
	// depth/2h times its own height.
	fed := depth / (2 * h) * 2 * float64(ch) / float64(cw)
	front := sheet{cols: cols, rows: rows, pos: make([][2]float64, cols*(rows+1))}
	rear := sheet{cols: cols, rows: rows, pos: make([][2]float64, cols*(rows+1))}
	reach := 1.0
	for i := 0; i < cols; i++ {
		for k, p := range trace(2*u[i]-1, fed/float64(rows), rows) {
			a, b := screen(p), screen([2]float64{p[0], -p[1]})
			front.pos[k*cols+i], rear.pos[k*cols+i] = a, b
			reach = math.Max(reach, math.Max(math.Abs(a[0]), math.Abs(a[1])))
		}
	}
	ends := [2][2]float64{screen([2]float64{-1, 0}), screen([2]float64{1, 0})}
	span := func(d int) float64 {
		a, b := math.Inf(1), math.Inf(-1)
		for _, s := range []sheet{front, rear} {
			for _, p := range s.pos {
				a, b = math.Min(a, p[d]), math.Max(b, p[d])
			}
		}
		return (b - a) * line / 2
	}
	out.Across, out.Tall = span(0), span(1)
	for i := range front.pos {
		for d := 0; d < 2; d++ {
			front.pos[i][d] /= reach
			rear.pos[i][d] /= reach
		}
	}
	out.U, out.Mirror = u, true
	out.Line = [4]float64{ends[0][0] / reach, ends[0][1] / reach, ends[1][0] / reach, ends[1][1] / reach}

	across := func(fi float64) float64 {
		i := int(math.Max(0, math.Min(float64(cols-2), fi)))
		return u[i] + (fi-float64(i))*(u[i+1]-u[i])
	}
	front.color = func(fi, fk float64) rgba {
		return turned.sample(across(fi)*float64(cw), (1-fk/float64(rows))*float64(ch))
	}
	back := flatColor(bareCanvas)
	rear.color = func(float64, float64) rgba { return bareCanvas }
	if c.Models["back"] == "soaked" {
		back, rear.color = turned, front.color
	}
	// Where the original's dot (x, y) went: undo the turn, then find
	// its column and its row's age on the sheet.
	where := make(map[[2]int][2]int, cw*ch)
	for y := 0; y < ch; y++ {
		for x := 0; x < cw; x++ {
			sx, sy := from(x, y)
			where[[2]int{sx, sy}] = [2]int{x, y}
		}
	}
	find := func(x, y int) [2]float64 {
		t := where[[2]int{x, y}]
		want := (float64(t[0]) + 0.5) / float64(cw)
		i := 0
		for i < cols-2 && u[i+1] < want {
			i++
		}
		fi := float64(i) + (want-u[i])/(u[i+1]-u[i])
		return front.at(fi, float64(rows)*(1-(float64(t[1])+0.5)/float64(ch)))
	}
	return plan{sheets: []sheet{rear, front}, texture: turned, back: back, find: find}
}

// faceDown lays the whole face on the plane at once. Every sheet of the
// depth is fed in over the same rectangle and has to leave it along the
// flow's paths, then joins the bands around it: the front, first in, is
// outermost. All the picture along one path arrives at one point of the
// edge, so what a band shows there is that path's average.
func faceDown(src image, c core.Choice, out *PaintingResult, wide, tall, depth, h float64) plan {
	a, b := 1.0, float64(src.h)/float64(src.w)
	out.Across, out.Tall = wide, tall
	if depth < h {
		// The sheet is thicker than the picture: there is not enough of
		// it to cover its own footprint, so it stays, thinly.
		cover := depth / h
		grid := still(src.w, src.h, a, b, func(u, v float64) rgba {
			col := src.sample(u*float64(src.w), v*float64(src.h))
			col[3] = cover
			return col
		})
		out.Still = true
		out.U = grid.u
		return plan{sheets: []sheet{grid.sheet}, texture: src, back: flatColor(bareCanvas), find: func(x, y int) [2]float64 {
			return [2]float64{(2*(float64(x)+0.5)/float64(src.w) - 1) * a / grid.reach, (2*(float64(y)+0.5)/float64(src.h) - 1) * b / grid.reach}
		}}
	}
	// Places around the rectangle's edge, evenly by length, from the
	// top-left corner clockwise on the screen.
	const bins = 192
	around := 4 * (a + b)
	edge := func(s float64) (float64, float64) {
		s = math.Mod(s, around)
		switch {
		case s < 2*a:
			return -a + s, -b
		case s < 2*a+2*b:
			return a, -b + s - 2*a
		case s < 4*a+2*b:
			return a - (s - 2*a - 2*b), b
		}
		return -a, b - (s - 4*a - 2*b)
	}
	along := func(x, y float64) float64 {
		// The nearest side decides.
		switch m := math.Max(math.Abs(x)/a, math.Abs(y)/b); {
		case -y/b == m:
			return x + a
		case x/a == m:
			return 2*a + y + b
		case y/b == m:
			return 2*a + 2*b + a - x
		}
		return 4*a + 2*b + b - y
	}
	field := func(x, y float64) (float64, float64) { return rectField(a, b, x, y) }
	// Follow a grid of the picture's dots out to the edge.
	nx, ny := min(src.w, lattice), min(src.h, lattice)
	exit := make([]int, nx*ny)
	var sums [bins]rgba
	for j := 0; j < ny; j++ {
		for i := 0; i < nx; i++ {
			fx, fy := (float64(i)+0.5)/float64(nx), (float64(j)+0.5)/float64(ny)
			x, y := (2*fx-1)*a, (2*fy-1)*b
			if math.Hypot(x, y) < 1e-6 {
				x += 1e-6
			}
			for step := 0; step < 2000 && math.Abs(x) < a && math.Abs(y) < b; step++ {
				px, py := x, y
				x, y = carry(field, func(float64, float64) float64 { return 1 }, x, y, 0.25)
				if math.Abs(x) >= a || math.Abs(y) >= b {
					// Back along the last step to the edge itself.
					lo, hi := 0.0, 1.0
					for n := 0; n < 30; n++ {
						mid := (lo + hi) / 2
						if mx, my := px+mid*(x-px), py+mid*(y-py); math.Abs(mx) < a && math.Abs(my) < b {
							lo = mid
						} else {
							hi = mid
						}
					}
					x, y = px+hi*(x-px), py+hi*(y-py)
					break
				}
			}
			bin := int(along(x, y)/around*bins) % bins
			exit[j*nx+i] = bin
			col := src.sample(fx*float64(src.w), fy*float64(src.h))
			for k := 0; k < 3; k++ {
				sums[bin][k] += col[k]
			}
			sums[bin][3]++
		}
	}
	var mean rgba
	shown := make([]rgba, bins)
	for i := range shown {
		// A place no path happened to reach takes its neighbors'.
		for reach := 0; shown[i][3] == 0; reach++ {
			for _, j := range []int{(i + reach) % bins, (i - reach + bins) % bins} {
				if s := sums[j]; s[3] > 0 {
					shown[i] = rgba{s[0] / s[3], s[1] / s[3], s[2] / s[3], 1}
				}
			}
		}
		for k := 0; k < 3; k++ {
			mean[k] += shown[i][k] / bins
		}
	}
	mean[3] = 1
	// Outside, the bands ride away from the edge: depth/h rectangles of
	// area in all, the oldest matter furthest out.
	const rows = 64
	cols := bins + 1
	band := sheet{cols: cols, rows: rows, pos: make([][2]float64, cols*(rows+1))}
	corner := func(x, y float64) float64 {
		return math.Max(1e-9, math.Hypot(math.Abs(x)-a, math.Abs(y)-b))
	}
	reach := 1.0
	for i := 0; i < bins; i++ {
		x, y := edge((float64(i) + 0.5) / bins * around)
		for k := 0; k <= rows; k++ {
			if k > 0 {
				x, y = carry(field, corner, x, y, depth/h/rows)
			}
			band.pos[k*cols+i] = [2]float64{x, y}
			reach = math.Max(reach, math.Max(math.Abs(x), math.Abs(y)))
		}
	}
	for k := 0; k <= rows; k++ {
		band.pos[k*cols+bins] = band.pos[k*cols]
	}
	lo, hi := [2]float64{}, [2]float64{}
	for i := range band.pos {
		for d := 0; d < 2; d++ {
			lo[d], hi[d] = math.Min(lo[d], band.pos[i][d]), math.Max(hi[d], band.pos[i][d])
			band.pos[i][d] /= reach
		}
	}
	out.Across, out.Tall = (hi[0]-lo[0])*wide/2, (hi[1]-lo[1])*wide/2
	soaked := c.Models["back"] == "soaked"
	band.color = func(fi, fk float64) rgba {
		if !soaked && fk < rows/2 {
			return bareCanvas
		}
		return shown[int(math.Round(fi))%bins]
	}
	inside := bareCanvas
	if soaked {
		inside = mean
	}
	out.Core = &Core{HalfWidth: a / reach, HalfHeight: b / reach, Color: whole(inside)}
	out.U = make([]float64, cols)
	for i := range out.U {
		out.U[i] = float64(i) / bins
	}
	texture := image{w: cols, h: rows, px: make([]byte, 4*cols*rows)}
	for t := 0; t < rows; t++ {
		for i := 0; i < cols; i++ {
			col := band.color(float64(i), float64(rows)*(1-(float64(t)+0.5)/rows))
			copy(texture.px[4*(t*cols+i):], []byte{byte(math.Round(col[0])), byte(math.Round(col[1])), byte(math.Round(col[2])), 255})
		}
	}
	return plan{
		sheets: []sheet{band},
		under: func(x, y float64) (rgba, bool) {
			return inside, math.Abs(x) < a/reach && math.Abs(y) < b/reach
		},
		texture: texture, back: flatColor(bareCanvas),
		find: func(x, y int) [2]float64 {
			i, j := min(nx-1, x*nx/src.w), min(ny-1, y*ny/src.h)
			// The picture's half of the bands, midway.
			return band.at(float64(exit[j*nx+i]), 0.75*rows)
		},
	}
}

// grid is a sheet that does not move: a plain rectangle of half-width a
// and half-height b, fitted to the frame.
type grid struct {
	sheet
	u     []float64
	reach float64
}

func still(w, h int, a, b float64, color func(u, v float64) rgba) grid {
	cols, rows := min(w, lattice)+1, min(h, lattice)
	g := grid{sheet: sheet{cols: cols, rows: rows, pos: make([][2]float64, cols*(rows+1))}, u: make([]float64, cols), reach: math.Max(a, b)}
	for k := 0; k <= rows; k++ {
		for i := 0; i < cols; i++ {
			g.u[i] = float64(i) / float64(cols-1)
			// Row 0 of the sheet is the oldest, which a still picture
			// draws at the bottom.
			g.pos[k*cols+i] = [2]float64{(2*g.u[i] - 1) * a / g.reach, (1 - 2*float64(k)/float64(rows)) * b / g.reach}
		}
	}
	g.color = func(fi, fk float64) rgba { return color(fi/float64(cols-1), 1-fk/float64(rows)) }
	return g
}

// buried leaves the picture standing in Pluto's crust at the equator,
// facing outward, while Pluto falls and spreads. The slice of Pluto it
// stands in becomes one ring; the picture is carried round that ring
// with everything else on its line to the axis, drawn out along the
// ring and across it, and thinned among the rest.
func buried(src image, c core.Choice, out *PaintingResult, wide, tall, depth, h float64) plan {
	pluto := body("pluto")
	f := fall{body: pluto, weight: make([]float64, len(pluto.Layers)), h: h / 1000, spread: true}
	for i := range f.weight {
		f.weight[i] = 1
	}
	r := pluto.Radius
	stood := r - c.Params["buried.depth"]/1000
	ring := math.Sqrt(sum(f.between(0, r)) / f.h / math.Pi)
	out.Stretch = ring / stood
	// A slice dz thick becomes a ring R²·dz/(2·ring·h) wide.
	out.Radial = r * r / (2 * ring * f.h)
	// On the picture's line to the axis, a wedge holds R²/2 of matter
	// for every stood·depth of picture.
	out.Dilution = math.Min(1, 2*stood*depth/1000/(r*r))
	out.Across, out.Tall = wide*out.Stretch, tall*out.Radial
	rock := bareCanvas
	for _, l := range pluto.Layers {
		if stood <= l.Outer {
			rock = hex(l.Color)
			break
		}
	}
	a, b := 1.0, out.Tall/out.Across
	if b > 1 {
		a, b = 1/b, 1
	}
	b = math.Max(b, 0.02)
	mixed := func(u, v float64) rgba {
		col := src.sample(u*float64(src.w), v*float64(src.h))
		for k := 0; k < 3; k++ {
			col[k] = rock[k] + out.Dilution*(col[k]-rock[k])
		}
		return col
	}
	g := still(src.w, src.h, a, b, mixed)
	out.Still, out.U = true, g.u
	texture := image{w: src.w, h: src.h, px: make([]byte, len(src.px))}
	for y := 0; y < src.h; y++ {
		for x := 0; x < src.w; x++ {
			col := mixed((float64(x)+0.5)/float64(src.w), (float64(y)+0.5)/float64(src.h))
			copy(texture.px[4*(y*src.w+x):], []byte{byte(math.Round(col[0])), byte(math.Round(col[1])), byte(math.Round(col[2])), 255})
		}
	}
	return plan{sheets: []sheet{g.sheet}, texture: texture, back: flatColor(rock),
		under: func(x, y float64) (rgba, bool) { return rock, true },
		find: func(x, y int) [2]float64 {
			return [2]float64{(2*(float64(x)+0.5)/float64(src.w) - 1) * a / g.reach, (2*(float64(y)+0.5)/float64(src.h) - 1) * b / g.reach}
		}}
}

// hex reads "#rrggbb".
func hex(s string) rgba {
	v := func(i int) float64 {
		n := 0
		for _, ch := range s[i : i+2] {
			n *= 16
			switch {
			case ch >= '0' && ch <= '9':
				n += int(ch - '0')
			case ch >= 'a' && ch <= 'f':
				n += int(ch-'a') + 10
			}
		}
		return float64(n)
	}
	return rgba{v(1), v(3), v(5), 1}
}
