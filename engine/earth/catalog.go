package earth

import "threebody/engine/core"

const (
	citeKT    = "Krissansen-Totton, Arney & Catling 2018, PNAS 115, 4105"
	citeLvB   = "Lenton & von Bloh 2001, Geophys. Res. Lett. 28, 1715"
	citeSV    = "Schwartzman & Volk 1989, Nature 340, 457"
	citeWHAK  = "Walker, Hays & Kasting 1981, J. Geophys. Res. 86, 9776"
	citeWP    = "Wordsworth & Pierrehumbert 2014, Astrophys. J. Lett. 785, L20"
	citeCK    = "Catling & Kasting 2017, Atmospheric Evolution on Inhabited and Lifeless Worlds, eq. 5.57"
	citeHoe   = "Höning, Hansen-Goos, Airo & Spohn 2014, Planet. Space Sci. 98, 5"
	citeGough = "Gough 1981, Solar Physics 74, 21"
)

var catalog = &core.Catalog{
	Slots: []core.Slot{
		{ID: "sun", Label: "Sun", Help: "How sunlight changes as the Sun ages.", Models: []core.Model{
			{ID: "gough", Label: "Brightening Sun", Summary: "The young Sun starts about 30% fainter and brightens steadily.", Citation: citeGough, Params: []string{"sun.distance"}},
			{ID: "constant", Label: "Constant Sun", Summary: "Today's sunlight throughout. A control, not a real history.", Citation: "Control case", Params: []string{"sun.distance"}},
		}},
		{ID: "climate", Label: "Climate", Help: "Surface temperature from sunlight and carbon dioxide.", Models: []core.Model{
			{ID: "kt2018", Label: "Radiative-convective fit", Summary: "A fit to a one-dimensional climate model with water-vapor feedback.", Citation: citeKT + " (SI eq. S28)", Params: []string{}},
			{ID: "simple", Label: "Fixed sensitivity", Summary: "A set warming for each doubling of carbon dioxide.", Citation: "Logarithmic CO2 forcing, after Arrhenius 1896", Params: []string{"climate.sensitivity", "climate.solar"}},
		}},
		{ID: "outgassing", Label: "Volcanoes", Help: "How fast the interior returns carbon dioxide to the air.", Models: []core.Model{
			{ID: "declining", Label: "Cooling interior", Summary: "A hotter young Earth outgasses faster; the rate falls as the interior cools.", Citation: citeKT + " (SI eqs. S8, S9)", Params: []string{"outgassing.scale", "outgassing.modern", "outgassing.heat", "outgassing.exponent"}},
			{ID: "constant", Label: "Steady", Summary: "Today's outgassing throughout.", Citation: citeWHAK, Params: []string{"outgassing.scale", "outgassing.modern"}},
		}},
		{ID: "carbon", Label: "Rock weathering", Help: "How rock removes carbon dioxide from the air: the planet's thermostat.", Models: []core.Model{
			{ID: "continental", Label: "Continents only", Summary: "Only land weathering removes carbon dioxide, so life's grip on it sets the climate.", Citation: citeWHAK + "; form of " + citeKT + " eq. 1", Params: []string{"weathering.co2", "weathering.te"}},
			{ID: "seafloor", Label: "Continents and seafloor", Summary: "Warm seafloor basalt also takes up carbon dioxide, with or without life.", Citation: citeKT + " (eq. 1, SI eq. S3)", Params: []string{"weathering.co2", "weathering.te", "seafloor.spreading", "seafloor.energy", "seafloor.gradient"}},
		}},
		{ID: "biosphere", Label: "Life and weathering", Help: "How much living things speed up rock weathering.", Models: []core.Model{
			{ID: "staged", Label: "Stepwise enhancement", Summary: "Microbes, then land plants, each speed weathering by a set factor.", Citation: citeSV + "; timing from " + citeKT + " (SI eq. S7)", Params: []string{"biosphere.enhancement", "biosphere.early", "biosphere.origin"}},
			{ID: "productivity", Label: "Productivity feedback", Summary: "Weathering follows how well life grows, so life that overheats stops helping.", Citation: citeLvB + " (eq. 1); Franck, Bounama & von Bloh 2006, Biogeosciences 3, 85", Params: []string{"biosphere.alpha", "biosphere.tmin", "biosphere.tmax", "biosphere.origin"}},
			{ID: "none", Label: "No effect", Summary: "Life leaves weathering alone.", Citation: "Null case; compare Gilbert-Janizek et al. 2026, arXiv:2602.02267", Params: []string{"biosphere.origin"}},
		}},
		{ID: "continents", Label: "Continents", Help: "How much land there is to weather.", Models: []core.Model{
			{ID: "same", Label: "Same either way", Summary: "Continents grow on the same schedule with or without life.", Citation: citeKT + " (SI eq. S6)", Params: []string{"land.archean", "land.timing"}},
			{ID: "hoening", Label: "Life grows continents", Summary: "Without life's sediments, continents shrink toward a few percent of the surface.", Citation: citeHoe, Params: []string{"land.archean", "land.timing", "land.abiotic", "land.relax"}},
		}},
		{ID: "oxygen", Label: "Oxygen", Help: "Oxygen in the air, which only life supplies.", Models: []core.Model{
			{ID: "staged", Label: "Two-step rise", Summary: "Oxygen appears about 2.4 billion years ago and reaches today's level about 0.6 billion years ago.", Citation: "Illustrative staging after Lyons, Reinhard & Planavsky 2014, Nature 506, 307", Params: []string{"oxygen.first", "oxygen.middle", "oxygen.second"}},
		}},
		{ID: "nitrogen", Label: "Nitrogen", Help: "The bulk of the air, which keeps water from reaching the upper atmosphere.", Models: []core.Model{
			{ID: "fixed", Label: "Fixed", Summary: "The same nitrogen pressure throughout.", Citation: "Stüeken et al. 2016, Astrobiology 16, 949, find large swings need life", Params: []string{"nitrogen.pressure"}},
		}},
		{ID: "water", Label: "Water loss", Help: "How water escapes to space as hydrogen.", Models: []core.Model{
			{ID: "diffusion", Label: "Cold trap and diffusion", Summary: "Water that passes the cold upper atmosphere is split by sunlight and its hydrogen escapes.", Citation: citeWP + "; " + citeCK, Params: []string{"water.trap", "water.initial"}},
			{ID: "off", Label: "No loss", Summary: "The planet keeps all its water.", Citation: "Control case", Params: []string{"water.initial"}},
		}},
		{ID: "stripping", Label: "Unshielded loss", Help: "The passage's own guess: with no shield against ultraviolet light and solar wind, the water is stripped away.", Models: []core.Model{
			{ID: "unshielded", Label: "Steady stripping", Summary: "A set extra loss whenever nothing living shields the air. No published basis.", Citation: "Liu Cixin, Death's End (fiction); shields after Goldblatt, Lenton & Watson 2006, Nature 443, 683, and Arney et al. 2016, Astrobiology 16, 873", Params: []string{"stripping.rate"}, Speculative: true},
			{ID: "none", Label: "None", Summary: "No extra loss: only the published escape physics.", Citation: "Gunell et al. 2018, Astron. Astrophys. 614, L3, find a magnetic field does not reduce escape", Params: []string{}},
		}},
		{ID: "early", Label: "Molten start", Help: "How long the newborn surface stays molten.", Models: []core.Model{
			{ID: "cooling", Label: "Exponential cooling", Summary: "The magma surface cools over a few million years. For display only.", Citation: "Timescale after Zahnle et al. 2007, Space Sci. Rev. 129, 35", Params: []string{"early.magma"}},
		}},
	},
	Params: []core.Param{
		{ID: "sun.distance", Label: "Distance from the Sun", Unit: "AU", Min: 0.9, Max: 1.2, Default: 1, Help: "Earth's orbit. Sunlight falls with the square of distance.", When: core.Always, Basic: true},
		{ID: "climate.sensitivity", Label: "Warming per CO2 doubling", Unit: "K", Min: 1.5, Max: 8, Default: 4, Help: "Temperature rise each time carbon dioxide doubles.", When: core.Always},
		{ID: "climate.solar", Label: "Warming per unit sunlight", Unit: "K", Min: 60, Max: 200, Default: 145, Help: "Temperature change for a doubling of sunlight, scaled linearly.", When: core.Always},
		{ID: "outgassing.scale", Label: "Volcanic activity", Unit: "× today", Min: 0.25, Max: 4, Default: 1, Log: true, Help: "Multiplies carbon dioxide released by volcanoes at all times.", When: core.Always, Basic: true},
		{ID: "outgassing.modern", Label: "Outgassing today", Unit: "trillion mol C per year", Min: 6, Max: 10, Default: 8, Help: "Carbon released by volcanoes today. It sets how fast carbon dioxide piles up once the oceans are gone.", When: core.Always},
		{ID: "outgassing.heat", Label: "Heat-flow exponent", Unit: "", Min: 0, Max: 0.73, Default: 0.36, Help: "How steeply the young Earth's heat flow exceeded today's.", When: core.Always},
		{ID: "outgassing.exponent", Label: "Outgassing exponent", Unit: "", Min: 1, Max: 2, Default: 1.5, Help: "How outgassing scales with heat flow.", When: core.Always},
		{ID: "weathering.co2", Label: "Weathering response to CO2", Unit: "", Min: 0.1, Max: 0.5, Default: 0.3, Help: "Exponent on carbon dioxide in the weathering rate.", When: core.Always},
		{ID: "weathering.te", Label: "Weathering response to warmth", Unit: "K", Min: 10, Max: 40, Default: 25, Help: "Warming that speeds weathering by a factor of e. Larger means a weaker thermostat.", When: core.Always},
		{ID: "seafloor.spreading", Label: "Seafloor spreading exponent", Unit: "", Min: 0, Max: 2, Default: 1, Help: "How seafloor weathering scales with heat flow.", When: core.Always},
		{ID: "seafloor.energy", Label: "Basalt activation energy", Unit: "kJ/mol", Min: 60, Max: 100, Default: 80, Help: "How sharply seafloor weathering speeds up with warmth.", When: core.Always},
		{ID: "seafloor.gradient", Label: "Deep-ocean warming", Unit: "K per K", Min: 0.8, Max: 1.4, Default: 1.1, Help: "Deep-ocean warming for each degree at the surface.", When: core.Always},
		{ID: "biosphere.enhancement", Label: "Life's weathering boost", Unit: "×", Min: 10, Max: 1000, Default: 300, Log: true, Help: "How many times faster rock weathers today than on a lifeless Earth.", When: core.Always, Basic: true},
		{ID: "biosphere.early", Label: "Microbial share", Unit: "of today", Min: 0.1, Max: 0.999, Default: 0.25, Help: "Weathering under microbes alone, before land plants, relative to today.", When: core.WithOn},
		{ID: "biosphere.origin", Label: "Life begins", Unit: "billion years after formation", Min: 0.05, Max: 1.5, Default: 0.3, Help: "When life starts to act on the planet.", When: core.WithOn},
		{ID: "biosphere.alpha", Label: "Life's weathering boost", Unit: "×", Min: 1, Max: 60, Default: 20, Log: true, Help: "Weathering amplification from life at today's productivity.", When: core.Always},
		{ID: "biosphere.tmin", Label: "Coldest for growth", Unit: "°C", Min: -5, Max: 10, Default: 0, Help: "Global mean temperature below which productivity stops.", When: core.WithOn},
		{ID: "biosphere.tmax", Label: "Hottest for growth", Unit: "°C", Min: 30, Max: 100, Default: 50, Help: "Global mean temperature above which productivity stops.", When: core.WithOn},
		{ID: "land.archean", Label: "Early land", Unit: "of today", Min: 0.1, Max: 0.75, Default: 0.4, Help: "Land area on the young Earth relative to today.", When: core.Always},
		{ID: "land.timing", Label: "Continents grow", Unit: "billion years ago", Min: 2, Max: 3, Default: 2.5, Help: "When the continents reach most of their size.", When: core.Always},
		{ID: "land.abiotic", Label: "Lifeless land", Unit: "of today", Min: 0.03, Max: 0.5, Default: 0.075, Log: true, Help: "Land a lifeless Earth settles toward: 3% of the surface against today's 40%.", When: core.WithOff},
		{ID: "land.relax", Label: "Continent loss time", Unit: "billion years", Min: 0.5, Max: 10, Default: 4, Help: "How slowly a lifeless Earth's continents shrink.", When: core.WithOff},
		{ID: "oxygen.first", Label: "First oxygen", Unit: "billion years ago", Min: 2, Max: 2.6, Default: 2.4, Help: "When oxygen first builds up in the air.", When: core.WithOn},
		{ID: "oxygen.middle", Label: "Middle-age oxygen", Unit: "of today", Min: 0.001, Max: 0.1, Default: 0.01, Log: true, Help: "Oxygen between the two rises, relative to today.", When: core.WithOn},
		{ID: "oxygen.second", Label: "Second rise", Unit: "billion years ago", Min: 0.4, Max: 0.8, Default: 0.6, Help: "When oxygen climbs to today's level.", When: core.WithOn},
		{ID: "nitrogen.pressure", Label: "Nitrogen in the air", Unit: "bar", Min: 0.05, Max: 3, Default: 0.79, Log: true, Help: "Pressure of nitrogen. Thin air lets more water reach the upper atmosphere.", When: core.Always, Basic: true},
		{ID: "water.trap", Label: "Cold-trap temperature", Unit: "K", Min: 150, Max: 220, Default: 200, Help: "Temperature of the coldest layer water must pass on its way up.", When: core.Always},
		{ID: "water.initial", Label: "Starting water", Unit: "oceans", Min: 0.5, Max: 3, Default: 1.1, Help: "Water the planet starts with, in present-day oceans.", When: core.Always},
		{ID: "stripping.rate", Label: "Stripping rate", Unit: "oceans per billion years", Min: 0, Max: 5, Default: 0.3, Help: "Extra water lost per billion years while nothing shields the air. Speculative.", When: core.Always},
		{ID: "early.magma", Label: "Molten for", Unit: "billion years", Min: 0.001, Max: 0.1, Default: 0.005, Log: true, Help: "How long the surface takes to cool from magma.", When: core.Always},
	},
	Presets: []core.Preset{
		{ID: "green-glasses", Label: "Green Glasses", Summary: "Life's influence at the strong end of what has been published, plus the passage's own unshielded stripping. The lifeless Earth dries out.",
			Models: map[string]string{}, Params: map[string]float64{}},
		{ID: "skeptic", Label: "Skeptic", Summary: "Seafloor weathering works without life and holds the climate. The lifeless Earth stays wet.",
			Models: map[string]string{"carbon": "seafloor", "continents": "same", "stripping": "none"},
			Params: map[string]float64{"water.initial": 1, "biosphere.enhancement": 10, "weathering.te": 15, "weathering.co2": 0.3}},
		{ID: "central", Label: "Middle of the road", Summary: "Each model at the middle of its published range.",
			Models: map[string]string{"carbon": "seafloor", "continents": "same", "stripping": "none"},
			Params: map[string]float64{"water.initial": 1, "biosphere.enhancement": 100, "weathering.te": 25, "weathering.co2": 0.3}},
	},
}

// Catalog returns the Earth simulation's aspects, models, parameters and
// presets. The first model of each aspect and each parameter's default
// are the Green Glasses preset.
func Catalog() *core.Catalog { return catalog }
