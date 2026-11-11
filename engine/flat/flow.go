package flat

import "math"

// A picture falling into the plane feeds flat matter in where it
// touches, and what is already there is pushed aside without being
// squeezed. That is the flow of a fluid with a source spread over the
// footprint and no rotation, which for a line and for a rectangle has a
// closed form. While the footprint keeps its shape the flow is steady,
// so matter follows fixed paths, and the strip between two paths gains
// equal area in equal time: areas are kept exactly.

// lineField is the velocity at (x, y) for a line from (−1, 0) to (1, 0)
// that feeds one unit of area per unit length per unit time to each
// side: (1/π)·conj(ln((ζ+1)/(ζ−1))).
func lineField(x, y float64) (float64, float64) {
	re := 0.5 * math.Log(((x+1)*(x+1)+y*y)/((x-1)*(x-1)+y*y))
	im := math.Atan2(y, x+1) - math.Atan2(y, x-1)
	return re / math.Pi, -im / math.Pi
}

// rectField is the velocity at (x, y) for a rectangle of half-width a
// and half-height b that feeds one unit of area per unit area per unit
// time: (1/2π)∬(r − r′)/|r − r′|² over the rectangle.
func rectField(a, b, x, y float64) (float64, float64) {
	// ∫ ½ln(X² + Y²) dY, less a term that cancels between the two sides.
	f := func(X, Y float64) float64 {
		out := 0.0
		if d := X*X + Y*Y; d > 0 {
			out = 0.5 * Y * math.Log(d)
		}
		if X != 0 {
			out += X * math.Atan(Y/X)
		}
		return out
	}
	ux := f(x+a, y+b) - f(x+a, y-b) - f(x-a, y+b) + f(x-a, y-b)
	uy := f(y+b, x+a) - f(y+b, x-a) - f(y-b, x+a) + f(y-b, x-a)
	return ux / (2 * math.Pi), uy / (2 * math.Pi)
}

// carry moves a point through a steady field for a length of time, by
// fourth-order Runge-Kutta. Steps are short where the field turns
// sharply, which `scale` reports as a length at each point.
func carry(field func(x, y float64) (float64, float64), scale func(x, y float64) float64, x, y, time float64) (float64, float64) {
	for left, guard := time, 0; left > 0 && guard < 200000; guard++ {
		ux, uy := field(x, y)
		speed := math.Hypot(ux, uy)
		if speed == 0 {
			return x, y
		}
		dt := math.Min(left, 0.08*scale(x, y)/speed)
		ax, ay := field(x+dt/2*ux, y+dt/2*uy)
		bx, by := field(x+dt/2*ax, y+dt/2*ay)
		cx, cy := field(x+dt*bx, y+dt*by)
		x += dt / 6 * (ux + 2*ax + 2*bx + cx)
		y += dt / 6 * (uy + 2*ay + 2*by + cy)
		left -= dt
	}
	return x, y
}

// fromEnds is the distance to the nearer end of the line.
func fromEnds(x, y float64) float64 {
	return math.Max(1e-12, math.Min(math.Hypot(x-1, y), math.Hypot(x+1, y)))
}

// trace follows the matter that left the line at x0: where it is after
// each of `rows` equal amounts `step` have been fed in behind it.
func trace(x0, step float64, rows int) [][2]float64 {
	out := make([][2]float64, rows+1)
	x, y := x0, 0.0
	out[0] = [2]float64{x, y}
	for k := 1; k <= rows; k++ {
		x, y = carry(lineField, fromEnds, x, y, step)
		out[k] = [2]float64{x, y}
	}
	return out
}
