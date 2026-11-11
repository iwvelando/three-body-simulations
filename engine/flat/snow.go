package flat

import (
	"math"

	"threebody/engine/core"
)

// The snow crystals are Reiter's cellular model (Chaos, Solitons &
// Fractals 23, 2005), as the paper states it. Cells sit on a hexagonal
// lattice and hold an amount of water; one or more is ice. A cell is
// receptive when it is ice or touches ice. Each step, a receptive cell
// keeps what it has and gains gamma; everything held by unreceptive
// cells diffuses, each cell becoming half itself and a twelfth of each
// neighbor (alpha = 1; in general u + alpha/12·(sum of neighbors − 6u)),
// and that diffused water is added everywhere. The start is one cell of
// ice in a background level beta, held at beta beyond a fixed distance.

var hexNeighbors = [6][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}, {1, -1}, {-1, 1}}

// grow runs the model for a number of steps and returns every cell's
// value, row by row in axial coordinates: cell (q, r) is at
// (r+radius)·side + q+radius, side = 2·radius + 1. That array is a
// rhombus, so the round field inside it, beyond which cells are held at
// beta, has a radius of √3/2 of the array's, less a cell.
func grow(beta, gamma, alpha float64, radius, steps int) []float64 {
	cells, _ := growUntil(beta, gamma, alpha, radius, steps, math.Inf(1))
	return cells
}

// growUntil stops early once ice is `reach` cells from the seed, and
// says how many steps it took.
func growUntil(beta, gamma, alpha float64, radius, steps int, reach float64) ([]float64, int) {
	side := 2*radius + 1
	u := make([]float64, side*side)
	next := make([]float64, side*side)
	free := make([]float64, side*side)
	inside := make([]bool, side*side)
	distance := make([]float64, side*side)
	for r := -radius; r <= radius; r++ {
		for q := -radius; q <= radius; q++ {
			i := (r+radius)*side + q + radius
			u[i] = beta
			distance[i] = math.Sqrt(float64(q*q + q*r + r*r))
			inside[i] = distance[i] < math.Sqrt(3)/2*float64(radius)-1
		}
	}
	u[radius*side+radius] = 1
	offsets := [6]int{}
	for k, n := range hexNeighbors {
		offsets[k] = n[1]*side + n[0]
	}
	taken := 0
	for ; taken < steps; taken++ {
		furthest := 0.0
		for i := range u {
			receptive := u[i] >= 1
			if u[i] >= 1 {
				furthest = math.Max(furthest, distance[i])
			} else if inside[i] {
				for _, o := range offsets {
					receptive = receptive || u[i+o] >= 1
				}
			}
			if receptive {
				free[i] = 0
				next[i] = u[i] + gamma
			} else {
				free[i] = u[i]
				next[i] = 0
			}
		}
		if furthest >= reach {
			break
		}
		for i := range u {
			if !inside[i] {
				next[i] = u[i]
				continue
			}
			around := 0.0
			for _, o := range offsets {
				around += free[i+o]
			}
			next[i] += free[i] + alpha/12*(around-6*free[i])
		}
		u, next = next, u
	}
	return u, taken
}

// SnowRequest asks for a handful of crystals, each grown from its own
// setting of the model.
type SnowRequest struct {
	Seed  int `json:"seed,omitempty"`
	Count int `json:"count"`
	// Size is each crystal's picture, in dots a side.
	Size int `json:"size"`
}

// Flake records the setting one crystal grew from.
type Flake struct {
	Beta  float64 `json:"beta"`
	Gamma float64 `json:"gamma"`
	Steps int     `json:"steps"`
}

// SnowResult describes the bytes beside it: Count pictures of Size by
// Size dots, one byte a dot, 255 where there is ice.
type SnowResult struct {
	Count  int     `json:"count"`
	Size   int     `json:"size"`
	Flakes []Flake `json:"flakes"`
}

// Snowflakes grows crystals in the dendrite corner of the paper's
// diagram: a low background and little added from outside.
func Snowflakes(q SnowRequest) (*SnowResult, []byte, error) {
	switch {
	case q.Count < 1 || q.Count > 24:
		return nil, nil, &core.FieldError{Field: "count", Message: "Ask for 1 to 24 snowflakes."}
	case q.Size < 16 || q.Size > 256:
		return nil, nil, &core.FieldError{Field: "size", Message: "A snowflake's picture is 16 to 256 dots a side."}
	case q.Seed < 0 || q.Seed > 1<<30:
		return nil, nil, &core.FieldError{Field: "seed", Message: "The seed must be a whole number from 0 to about a billion."}
	}
	const radius = 52
	side := 2*radius + 1
	out := &SnowResult{Count: q.Count, Size: q.Size}
	pixels := make([]byte, q.Count*q.Size*q.Size)
	random := rng(q.Seed + 1)
	for n := 0; n < q.Count; n++ {
		beta := 0.3 + 0.35*random.next()
		gamma := math.Pow(10, -4+1.7*random.next())
		cells, steps := growUntil(beta, gamma, 1, radius, 6000, 0.78*radius)
		out.Flakes = append(out.Flakes, Flake{Beta: beta, Gamma: gamma, Steps: steps})
		// Each dot takes the hexagonal cell it falls in.
		for py := 0; py < q.Size; py++ {
			for px := 0; px < q.Size; px++ {
				x := (2*(float64(px)+0.5)/float64(q.Size) - 1) * 0.8 * radius
				y := (2*(float64(py)+0.5)/float64(q.Size) - 1) * 0.8 * radius
				fr := y / (math.Sqrt(3) / 2)
				fq := x - fr/2
				// Round in cube coordinates so the nearest cell wins.
				fs := -fq - fr
				rq, rr, rs := math.Round(fq), math.Round(fr), math.Round(fs)
				dq, dr, ds := math.Abs(rq-fq), math.Abs(rr-fr), math.Abs(rs-fs)
				if dq > dr && dq > ds {
					rq = -rr - rs
				} else if dr > ds {
					rr = -rq - rs
				}
				cq, cr := int(rq), int(rr)
				if cq < -radius || cq > radius || cr < -radius || cr > radius {
					continue
				}
				if cells[(cr+radius)*side+cq+radius] >= 1 {
					pixels[n*q.Size*q.Size+py*q.Size+px] = 255
				}
			}
		}
	}
	return out, pixels, nil
}
