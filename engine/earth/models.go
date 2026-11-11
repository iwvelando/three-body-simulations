// Package earth simulates the Earth's surface environment over its
// history, with and without life, from interchangeable published models.
// docs/models.md gives each model's source, equations and departures.
package earth

import "math"

// Time runs from the planet's formation (0) to the present (ageNow), in
// billions of years. Several source models count time before present
// instead; ago converts.
const ageNow = 4.5

func ago(age float64) float64 { return ageNow - age }

// luminosityGough is Gough (1981): L/L0 = 1/(1 + 0.4 (1 - t/t0)), with t
// the Sun's age and t0 = 4.57 Gyr. The planet is taken to form 0.07 Gyr
// after the Sun, so the present is exactly 1.
func luminosityGough(age float64) float64 {
	const sunNow = 4.57
	return 1 / (1 + 0.4*(1-(age+sunNow-ageNow)/sunNow))
}

// The CO2-only climate fit of Krissansen-Totton, Arney & Catling (2018):
// a polynomial in x = log10(pCO2/bar) and y = luminosity relative to
// today, fitted to a 1-D radiative-convective model. Coefficients and
// term order are those published with the paper (clim_model.py).
var ktCoefficients = [25]float64{
	3145.89156036, -894.19626463, -14231.92214014, -3791.69941395, 18527.77037214,
	-33560.74243889, 26297.60786657, -7674.7687673, 4461.16266511, -1569.24844923,
	11329.24842061, -21270.62144395, -14022.32137627, 26860.83381806, 7684.55056014,
	5722.63936369, -178.26420159, -396.14681854, 6399.09085414, 875.42303333,
	-1605.36365431, 1304.94455772, -1569.30078917, -8012.66961608, -3415.93123913,
}

func ktPolynomial(x, y float64) float64 {
	x2, x3, x4 := x*x, x*x*x, x*x*x*x
	y2, y3, y4 := y*y, y*y*y, y*y*y*y
	terms := [25]float64{1, x, y, x2, x2 * y, x2 * y2, y2, x * y2, x * y, x3, x3 * y3, y3, x3 * y2, x2 * y3, x3 * y, x * y3,
		x4, x4 * y4, y4, x4 * y, x4 * y2, x4 * y3, y4 * x, y4 * x2, y4 * x3}
	sum := 0.0
	for i, c := range ktCoefficients {
		sum += c * terms[i]
	}
	return sum
}

// The polynomial is used where it behaves: 1e-4 to 10 bar of CO2 and 0.7
// to 1.1 of today's sunlight. Beyond those edges the temperature continues
// along the edge's own slope, never downward, so that more CO2 or more
// sunlight never cools the planet. Results out there are extrapolations.
const (
	ktLogMin, ktLogMax = -4.0, 1.0
	ktSunMin, ktSunMax = 0.7, 1.1
)

func climateKT(pco2, sun float64) float64 {
	x := math.Log10(pco2)
	xc := math.Min(math.Max(x, ktLogMin), ktLogMax)
	yc := math.Min(math.Max(sun, ktSunMin), ktSunMax)
	T := ktPolynomial(xc, yc)
	const h = 0.5
	if x < ktLogMin {
		slope := math.Max(0, (ktPolynomial(ktLogMin+h, yc)-ktPolynomial(ktLogMin, yc))/h)
		T += slope * (x - ktLogMin)
	}
	if x > ktLogMax {
		slope := math.Max(0, (ktPolynomial(ktLogMax, yc)-ktPolynomial(ktLogMax-h, yc))/h)
		T += slope * (x - ktLogMax)
	}
	const k = 0.02
	if sun < ktSunMin {
		slope := math.Max(0, (ktPolynomial(xc, ktSunMin+k)-ktPolynomial(xc, ktSunMin))/k)
		T += slope * (sun - ktSunMin)
	}
	if sun > ktSunMax {
		slope := math.Max(0, (ktPolynomial(xc, ktSunMax)-ktPolynomial(xc, ktSunMax-k))/k)
		T += slope * (sun - ktSunMax)
	}
	return math.Max(T, 150)
}

// Reference state: the preindustrial Earth of Krissansen-Totton et al.
const co2Now = 2.8e-4 // bar

var tempNow = climateKT(co2Now, 1)

// climateSimple is the textbook logarithmic response: a fixed warming per
// doubling of CO2 and a linear response to sunlight, through today's state.
func climateSimple(pco2, sun, perDoubling, perSun float64) float64 {
	return math.Max(tempNow+perDoubling*math.Log2(pco2/co2Now)+perSun*(sun-1), 150)
}

// heatFlow is Krissansen-Totton et al. (2018) eq. S8, Q = (1 - t/4.5)^-n
// with t in Gyr before present. Their runs start 4.0 Gyr ago and the
// expression diverges at 4.5, so earlier times hold the 4.0 Gyr value.
func heatFlow(tAgo, n float64) float64 {
	return math.Pow(1-math.Min(tAgo, 4.0)/4.5, -n)
}

// landKT is their eq. S6: the land fraction relative to today, lfrac in
// the Archean, growing around `timing` Gyr ago.
func landKT(tAgo, lfrac, timing float64) float64 {
	return math.Max(0, 1-1/(1/(1-lfrac)+math.Exp(-10*(tAgo-timing))))
}

// bioKT is their eq. S7: biological enhancement of weathering relative to
// today, cwf in the Archean, stepping up 0.6 Gyr ago.
func bioKT(tAgo, cwf float64) float64 {
	return 1 - 1/(1/(1-cwf)+math.Exp(-10*(tAgo-0.6)))
}

// productivity is the photosynthetic productivity of Lenton & von Bloh
// (2001) and Franck et al. (2006, eqs. 12 to 14) relative to its maximum:
// a parabola over the temperature window, zero at both ends, times a
// Michaelis-Menten curve in CO2 from 10 ppm with half saturation 210.8 ppm
// above that. Franck et al. print the parabola with a leading "1 -", which
// would not vanish at the window's ends as their text and Lenton & von
// Bloh's describe; the form used here does.
func productivity(T, pco2, tminC, tmaxC float64) float64 {
	const pmin, phalf = 10e-6, 210.8e-6
	c := T - 273.15
	if c <= tminC || c >= tmaxC || pco2 <= pmin {
		return 0
	}
	fT := 4 * (c - tminC) * (tmaxC - c) / ((tmaxC - tminC) * (tmaxC - tminC))
	return fT * (pco2 - pmin) / (phalf + pco2 - pmin)
}

// bioticFeedback is the bracket of Lenton & von Bloh (2001) eq. 1:
// (1 - 1/alpha) P/P0 + 1/alpha.
func bioticFeedback(p, p0, alpha float64) float64 {
	return (1-1/alpha)*p/p0 + 1/alpha
}

// Thermodynamic constants for the moist adiabat.
const (
	gasAir      = 287.0   // J/kg/K
	gasVapor    = 461.5   // J/kg/K
	cpAir       = 1040.0  // J/kg/K
	cpVapor     = 1850.0  // J/kg/K
	latentVapor = 2.501e6 // J/kg, over liquid
	latentIce   = 2.834e6 // J/kg, over ice
	tripleT     = 273.16  // K
	tripleP     = 611.66  // Pa
)

func latent(T float64) float64 {
	if T < tripleT {
		return latentIce
	}
	return latentVapor
}

// saturation is the Clausius-Clapeyron vapor pressure of water in Pa, with
// constant latent heat on each side of the triple point.
func saturation(T float64) float64 {
	return tripleP * math.Exp(latent(T)/gasVapor*(1/tripleT-1/T))
}

// moistureM is the parameter M of Wordsworth & Pierrehumbert (2014):
// epsilon p_v L / (p_n c_p T_s), latent over sensible heat. The upper
// atmosphere is moist above about 1. pn is in bar.
func moistureM(ts, pn float64) float64 {
	return (gasAir / gasVapor) * saturation(ts) * latent(ts) / (pn * 1e5 * cpAir * ts)
}

// coldTrapWater is the molar fraction of water vapor at the cold trap: the
// surface air, saturated, lifted along the moist pseudoadiabat until it
// reaches the trap temperature, as Wordsworth & Pierrehumbert (2014)
// prescribe (after Ingersoll 1969). ts and trap are in K, pn is the
// surface pressure of the gases that do not condense, in bar.
//
// The adiabat is the standard one for a dilute or dominant condensable
// (Pierrehumbert 2010): with r = epsilon p_sat / p_a,
//
//	dlnT/dlnp_a = (R_a/c_pa) (1 + L r / (R_a T)) /
//	              (1 + (c_pc/c_pa + (L/(R_c T) - 1) L/(c_pa T)) r).
func coldTrapWater(ts, pn, trap float64) float64 {
	pa := pn * 1e5
	if ts <= trap {
		ps := saturation(ts)
		return ps / (pa + ps)
	}
	eps := gasAir / gasVapor
	// d ln p_a / d ln T at temperature T and dry pressure exp(lp).
	slope := func(lnT, lp float64) float64 {
		T := math.Exp(lnT)
		L := latent(T)
		r := eps * saturation(T) / math.Exp(lp)
		return (1 + (cpVapor/cpAir+(L/(gasVapor*T)-1)*L/(cpAir*T))*r) / ((gasAir / cpAir) * (1 + L*r/(gasAir*T)))
	}
	const steps = 240
	x, lp := math.Log(ts), math.Log(pa)
	h := (math.Log(trap) - x) / steps
	for i := 0; i < steps; i++ {
		k1 := slope(x, lp)
		k2 := slope(x+h/2, lp+h/2*k1)
		k3 := slope(x+h/2, lp+h/2*k2)
		k4 := slope(x+h, lp+h*k3)
		lp += h / 6 * (k1 + 2*k2 + 2*k3 + k4)
		x += h
	}
	ps := saturation(trap)
	return ps / (math.Exp(lp) + ps)
}

// oceanLossRate is the diffusion-limited escape of hydrogen, Catling &
// Kasting (2017) eq. 5.57: 2.5e13 f_T atoms per cm2 per second, where f_T
// counts hydrogen atoms, two per water molecule. It returns present-day
// oceans lost per billion years.
func oceanLossRate(fWater float64) float64 {
	const (
		oceanGrams   = 1.4e24
		avogadro     = 6.022e23
		earthCm2     = 5.1e18
		secondsInGyr = 3.156e16
	)
	hydrogenPerCm2 := oceanGrams / 18.015 * 2 * avogadro / earthCm2
	return 2.5e13 * 2 * fWater * secondsInGyr / hydrogenPerCm2
}
