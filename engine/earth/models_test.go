package earth

import (
	"math"
	"testing"
)

func near(t *testing.T, name string, got, want, tol float64) {
	t.Helper()
	if math.IsNaN(got) || math.Abs(got-want) > tol {
		t.Errorf("%s = %g, want %g ± %g", name, got, want, tol)
	}
}

// Gough (1981): the Sun was about 30% fainter 4 billion years ago, the
// figure Krissansen-Totton et al. (2018) quote for their own runs.
func TestGoughLuminosity(t *testing.T) {
	near(t, "present", luminosityGough(ageNow), 1, 1e-12)
	near(t, "4.0 Ga", luminosityGough(ageNow-4.0), 0.741, 0.004)
	if luminosityGough(1) >= luminosityGough(2) {
		t.Error("luminosity must rise with time")
	}
}

// Values tabulated independently from the coefficients published with
// Krissansen-Totton et al. (2018), clim_model.py, CO2-only fit.
func TestClimateFitReproducesPublishedPolynomial(t *testing.T) {
	near(t, "modern", climateKT(2.8e-4, 1), 286.8, 0.1)
	near(t, "1 bar", climateKT(1, 1), 340.0, 0.1)
	near(t, "0.1 bar, faint Sun", climateKT(0.1, 0.8), 288.6, 0.1)
	near(t, "0.01 bar, 0.7", climateKT(0.01, 0.7), 259.5, 0.1)
}

// Outside the fitted range the polynomial turns over; the engine must keep
// warming monotonic in CO2 instead.
func TestClimateStaysMonotonicBeyondTheFit(t *testing.T) {
	for _, s := range []float64{0.72, 0.85, 1} {
		last := 0.0
		for lp := -7.0; lp <= 2.5; lp += 0.1 {
			T := climateKT(math.Pow(10, lp), s)
			if T < last-1e-9 {
				t.Fatalf("S=%g: cooling with more CO2 at 10^%.1f bar (%g after %g)", s, lp, T, last)
			}
			last = T
		}
	}
}

// Wordsworth & Pierrehumbert (2014) print the surface temperatures above
// which the upper atmosphere turns moist: over 340 K under 1 bar of N2,
// about 295 K under 0.1 bar and about 255 K under 0.01 bar, where their
// parameter M passes 1.
func TestMoistureParameterMatchesPrintedThresholds(t *testing.T) {
	for _, k := range []struct{ pn, ts float64 }{{1, 340}, {0.1, 295}, {0.01, 255}} {
		m := moistureM(k.ts, k.pn)
		if m < 0.6 || m > 1.6 {
			t.Errorf("M(%g K, %g bar) = %g, want about 1", k.ts, k.pn, m)
		}
		if moistureM(k.ts-25, k.pn) > 0.5 {
			t.Errorf("M should be well below 1 at %g K under %g bar", k.ts-25, k.pn)
		}
	}
}

func TestColdTrap(t *testing.T) {
	// Today's stratosphere holds a few parts per million of water.
	modern := coldTrapWater(288, 1, 200)
	if modern < 5e-7 || modern > 3e-5 {
		t.Errorf("modern stratospheric water %g, want parts per million", modern)
	}
	// The moist greenhouse: near 340 K under 1 bar the trap fails.
	if f := coldTrapWater(340, 1, 200); f < 3e-4 || f > 5e-2 {
		t.Errorf("stratospheric water at 340 K = %g, want around 3e-3", f)
	}
	if f := coldTrapWater(365, 1, 200); f < 2e-2 {
		t.Errorf("stratospheric water at 365 K = %g, want a wet stratosphere", f)
	}
	// Thinner air traps less.
	if coldTrapWater(300, 0.1, 200) <= 10*coldTrapWater(300, 1, 200) {
		t.Error("a tenth of the air should leave the stratosphere far wetter")
	}
	last := 0.0
	for ts := 250.0; ts <= 400; ts += 5 {
		f := coldTrapWater(ts, 1, 200)
		if f < last || f > 1 || math.IsNaN(f) {
			t.Fatalf("cold trap not monotonic or out of range at %g K: %g after %g", ts, f, last)
		}
		last = f
	}
	// A colder trap is drier.
	if coldTrapWater(300, 1, 170) >= coldTrapWater(300, 1, 210) {
		t.Error("a colder trap must be drier")
	}
}

// Catling & Kasting (2017) eq. 5.57: 2.5e13 f_T atoms per cm2 per second.
// A stratosphere with 3e-3 water then loses an ocean in about the age of
// the Earth, the classic moist-greenhouse benchmark.
func TestDiffusionLimitedEscape(t *testing.T) {
	rate := oceanLossRate(3e-3) // oceans per Gyr
	near(t, "time to lose an ocean (Gyr)", 1/rate, 3.9, 0.5)
	if oceanLossRate(4e-6) > 1e-3 {
		t.Error("today's stratosphere should lose a negligible fraction of an ocean per Gyr")
	}
}

// Krissansen-Totton et al. (2018) eqs. S6 and S7 as coded by the authors.
func TestLandAndBiologyCurves(t *testing.T) {
	near(t, "land now", landKT(0, 0.4, 2.5), 1, 0.01)
	near(t, "land at 4 Ga", landKT(4, 0.4, 2.5), 0.4, 0.01)
	near(t, "biology now", bioKT(0, 0.25), 1, 0.01)
	near(t, "biology at 4 Ga", bioKT(4, 0.25), 0.25, 0.01)
	if bioKT(1.5, 0.25) > 0.3 {
		t.Error("the biological step is centered 0.6 Ga ago")
	}
}

// Krissansen-Totton et al. (2018) heat flow, eq. S8: Q = (1 - t/4.5)^-n.
func TestHeatFlow(t *testing.T) {
	near(t, "now", heatFlow(0, 0.5), 1, 1e-12)
	near(t, "2.25 Ga", heatFlow(2.25, 1), 2, 1e-9)
	if q := heatFlow(4.5, 0.5); math.IsInf(q, 0) || q != heatFlow(4.0, 0.5) {
		t.Errorf("heat flow must hold its 4.0 Ga value before that, got %g", q)
	}
}

// Lenton & von Bloh (2001) and Franck et al. (2006): a parabola in
// temperature and a Michaelis-Menten curve in CO2.
func TestProductivity(t *testing.T) {
	c := func(celsius float64) float64 { return celsius + 273.15 }
	if productivity(c(0), 3e-4, 0, 50) != 0 || productivity(c(50), 3e-4, 0, 50) != 0 || productivity(c(60), 3e-4, 0, 50) != 0 {
		t.Error("productivity must vanish at and beyond the tolerance window")
	}
	if productivity(c(25), 1e-5, 0, 50) != 0 {
		t.Error("productivity must vanish at 10 ppm CO2")
	}
	// Half saturation at Pmin + P1/2 = 220.8 ppm.
	near(t, "half saturation", productivity(c(25), 220.8e-6, 0, 50), 0.5, 1e-9)
	if productivity(c(20), 3e-4, 0, 50) >= productivity(c(25), 3e-4, 0, 50) {
		t.Error("optimum is the middle of the window")
	}
	// Eq. 1 of Lenton & von Bloh: no productivity leaves 1/alpha.
	near(t, "abiotic limit", bioticFeedback(0, 1, 20), 1.0/20, 1e-12)
	near(t, "present", bioticFeedback(1, 1, 20), 1, 1e-12)
}
