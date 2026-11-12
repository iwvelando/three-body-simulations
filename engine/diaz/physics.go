package diaz

import "math"

// megaton is the energy of a megaton of TNT at the 4 × 10⁶ J/kg that
// Ahrens & Harris (1992) use.
const megaton = 4e6 * 1e9

// needed is the speed Mercury must lose at aphelion for its new path to
// come within `target` solar radii of the Sun's center (vis-viva).
func needed(target float64) float64 {
	far, speed := aphelion()
	q := target * sunRadius
	return speed - math.Sqrt(2*sunGM*q/(far*(far+q)))
}

// mercuryEscape is the speed needed to leave Mercury's surface.
func mercuryEscape() float64 {
	m := body("mercury")
	return math.Sqrt(2 * gravity * m.Mass / (m.Radius * 1000))
}

// ceiling is the most that bombs can slow Mercury, in m/s. Only rock
// that leaves Mercury for good pushes it (Ahrens & Harris), and rock
// thrown at speed v keeps sqrt(v² - escape²) of it. For a given energy
// the momentum kept is greatest at v = sqrt(2) × escape, where it is
// energy / escape. `coupling` is the share of the bombs' energy that
// reaches the rock.
func ceiling(count, yield, coupling float64) float64 {
	return coupling * count * yield * megaton / (mercuryEscape() * body("mercury").Mass)
}

// escape is the speed needed to leave the Sun's surface.
var escape = math.Sqrt(2 * sunGM / sunRadius)

// apex is how far from the Sun's center, in solar radii, gas thrown
// straight up at a share f of escape speed gets before turning back.
func apex(f float64) float64 { return 1 / (1 - f*f) }

// radial is the distance from the Sun's center, in meters, of gas a
// time t after it left the surface straight up at a share f of escape
// speed, and whether it is still aloft. The path is Kepler's with no
// sideways speed: a cycloid below escape speed, its hyperbolic twin
// above.
func radial(f, t float64) (r float64, aloft bool) {
	if t <= 0 {
		return sunRadius, t == 0
	}
	switch {
	case f >= 1-1e-9 && f <= 1+1e-9:
		return math.Pow(math.Pow(sunRadius, 1.5)+1.5*math.Sqrt(2*sunGM)*t, 2.0/3), true
	case f < 1:
		// r = a(1 - cos η), t = sqrt(a³/GM)(η - sin η), from where r = R.
		a := sunRadius * apex(f) / 2
		rate := math.Sqrt(a * a * a / sunGM)
		start := math.Acos(1 - sunRadius/a)
		clock := func(eta float64) float64 { return rate * (eta - math.Sin(eta)) }
		if t >= clock(2*math.Pi-start)-clock(start) {
			return sunRadius, false
		}
		lo, hi := start, 2*math.Pi-start
		for i := 0; i < 60; i++ {
			mid := (lo + hi) / 2
			if clock(mid)-clock(start) < t {
				lo = mid
			} else {
				hi = mid
			}
		}
		return a * (1 - math.Cos((lo+hi)/2)), true
	default:
		// r = a(cosh η - 1), t = sqrt(a³/GM)(sinh η - η).
		a := sunRadius / (2 * (f*f - 1))
		rate := math.Sqrt(a * a * a / sunGM)
		start := math.Acosh(1 + sunRadius/a)
		clock := func(eta float64) float64 { return rate * (math.Sinh(eta) - eta) }
		lo, hi := start, start+1
		for clock(hi)-clock(start) < t {
			hi += 1
		}
		for i := 0; i < 60; i++ {
			mid := (lo + hi) / 2
			if clock(mid)-clock(start) < t {
				lo = mid
			} else {
				hi = mid
			}
		}
		return a * (math.Cosh((lo+hi)/2) - 1), true
	}
}

// Model S (Christensen-Dalsgaard et al. 1996): the Sun's density in
// g/cm³ at shares of its radius, copied from the published table
// (cptrho.l5bi.d.15c), outermost first.
var modelS = [][2]float64{
	{1.0007126, 3.2924832e-09}, {1.0000000, 1.9979759e-07}, {0.9999003, 2.6496451e-07},
	{0.9995001, 5.0627038e-07}, {0.9990020, 1.1513800e-06}, {0.9980059, 4.2552140e-06},
	{0.9950034, 4.8832759e-05}, {0.9899796, 3.2609988e-04}, {0.9799893, 1.4415590e-03},
	{0.9700565, 3.1525480e-03}, {0.9498860, 7.9419773e-03}, {0.9301570, 1.4114192e-02},
	{0.9003548, 2.6096106e-02}, {0.8699795, 4.1650016e-02}, {0.8499561, 5.3842620e-02},
	{0.8002121, 9.1494512e-02}, {0.7502938, 1.4141638e-01}, {0.7203475, 1.7826016e-01},
	{0.7126379, 1.8869531e-01}, {0.7003509, 2.0791810e-01}, {0.6496615, 3.2181351e-01},
	{0.6002312, 5.0575827e-01}, {0.5495608, 8.2265142e-01}, {0.4997651, 1.3564155e+00},
	{0.4495908, 2.2938280e+00}, {0.4001115, 3.9262490e+00}, {0.3499797, 6.8694118e+00},
	{0.2997464, 1.2086554e+01}, {0.2499539, 2.0868394e+01}, {0.1996552, 3.5052888e+01},
	{0.1498327, 5.6254750e+01}, {0.1001302, 8.7280708e+01}, {0.0502321, 1.2842233e+02},
}

// between is the mass per square meter between two levels of the Sun,
// taking the density to change by equal ratios over equal heights.
func between(x1, d1, x2, d2 float64) float64 {
	height := (x1 - x2) * sunRadius
	if math.Abs(d2/d1-1) < 1e-9 {
		return 1000 * d1 * height
	}
	return 1000 * (d2 - d1) * height / math.Log(d2/d1)
}

// column is the mass above a square meter of the level at a share x of
// the Sun's radius, in kg/m².
func column(x float64) float64 {
	total := 0.0
	for i := 1; i < len(modelS); i++ {
		hi, lo := modelS[i-1], modelS[i]
		if x >= hi[0] {
			break
		}
		if x > lo[0] {
			// The density at x, read between the two rows.
			d := hi[1] * math.Pow(lo[1]/hi[1], (hi[0]-x)/(hi[0]-lo[0]))
			return total + between(hi[0], hi[1], x, d)
		}
		total += between(hi[0], hi[1], lo[0], lo[1])
	}
	return total
}

// depth is the level, as a share of the Sun's radius, with a given
// column above it. The table stops at a twentieth of the radius.
func depth(mass float64) float64 {
	lo, hi := modelS[len(modelS)-1][0], modelS[0][0]
	if mass >= column(lo) {
		return lo
	}
	for i := 0; i < 60; i++ {
		mid := (lo + hi) / 2
		if column(mid) > mass {
			lo = mid
		} else {
			hi = mid
		}
	}
	return (lo + hi) / 2
}

// The share of the momentum of the gas a body meets that it takes up,
// for a body plunging into the Sun (Brown, Carlson & Toner 2015).
const plungeDrag = 0.5

// frictionDrag is the force of gas of density rho on a ball of the given
// radius moving through it at speed u: ½·C·ρ·πR²·u² (Adachi, Hayashi &
// Nakazawa 1976, equation 3.5).
func frictionDrag(c, rho, radius, u float64) float64 {
	return 0.5 * c * rho * math.Pi * radius * radius * u * u
}

// gravityDrag is the pull of a body's own wake on it, for a body far
// faster than sound in the gas: 4π(GM)²ρ/V² · ln(r_max/r_min) (Ostriker
// 1999, equation 1). r_min is the body's size and r_max the gas's.
func gravityDrag(gm, rho, v, rmin, rmax float64) float64 {
	if rmax <= rmin {
		return 0
	}
	return 4 * math.Pi * gm * gm * rho / (v * v) * math.Log(rmax/rmin)
}

// advance moves an orbit's size on by one step of a rate da/dt, by the
// midpoint rule, and never below nothing.
func advance(a, step float64, rate func(a float64) float64) float64 {
	half := a + rate(a)*step/2
	if half <= 0 {
		return 0
	}
	return math.Max(0, a+rate(half)*step)
}
