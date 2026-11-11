// Package mozi is the universe machine Mozi shows Wang in The Three-Body
// Problem: two nested shells in a sea of fire, turned by gears, with a
// clerk at the center recording the sun. The novel gives no numbers, so
// every model here is this site's invention and is marked speculative.
package mozi

import "threebody/engine/core"

const (
	citeNovel = "Liu Cixin, The Three-Body Problem (fiction)"
	citeHere  = citeNovel + "; numbers invented for this site"
)

var catalog = &core.Catalog{
	Slots: []core.Slot{
		{ID: "shells", Label: "Shells", Help: "How many spheres the universe is made of.", Models: []core.Model{
			{ID: "two", Label: "Two shells", Summary: "Mozi's revised machine. The sun is a hole in the outer shell, cast onto the inner one; the stars are small holes in the inner shell. Each shell turns by itself, so the sun moves against the stars.", Citation: citeHere, Params: []string{"outer.tilt", "outer.lamp", "hole.size", "hole.spread", "shells.gap", "inner.drift"}, Speculative: true},
			{ID: "one", Label: "One sphere", Summary: "Mozi's first idea: the sun and the stars are holes in a single sphere. Wang's objection holds: the sun can never move against the stars.", Citation: citeHere, Params: []string{"outer.tilt", "outer.lamp", "hole.size"}, Speculative: true},
		}},
		{ID: "breathing", Label: "Breathing", Help: "Whether the shells expand and shrink.", Models: []core.Model{
			{ID: "breathing", Label: "Shells expand and shrink", Summary: "Mozi's answer to the sun changing size: the sea of fire swells and squeezes the shells, which changes the gap the light crosses.", Citation: citeHere, Params: []string{"breath.depth", "breath.period"}, Speculative: true},
			{ID: "rigid", Label: "Rigid shells", Summary: "The shells keep their size, so the sun's size and brightness never change. Wang's second objection.", Citation: citeHere, Params: []string{}, Speculative: true},
		}},
		{ID: "gearing", Label: "Gearing", Help: "What turns the outer shell: Mozi's stand-in for the currents in the sea of fire.", Models: []core.Model{
			{ID: "trains", Label: "Three gear trains", Summary: "Three trains with mismatched periods speed, slow and tilt the shell. When they cancel, the days are regular; when they pull together, the days go wild.", Citation: citeHere, Params: []string{"gear.strength", "gear.first", "gear.second", "gear.third"}, Speculative: true},
			{ID: "single", Label: "Single gear", Summary: "One steady gear. A control: the sun keeps perfect time and the Stable Era never ends.", Citation: citeHere, Params: []string{}, Speculative: true},
		}},
		{ID: "flying", Label: "Flying stars", Help: "The quick points of light Wang insists are important.", Models: []core.Model{
			{ID: "dust", Label: "Dust inside the sphere", Summary: "Mozi's shrug: specks drifting inside the sphere that catch the light. They mean nothing and predict nothing.", Citation: citeHere, Params: []string{"flying.count"}, Speculative: true},
			{ID: "none", Label: "None", Summary: "The machine has no flying stars at all.", Citation: citeHere, Params: []string{}, Speculative: true},
		}},
		{ID: "cloud", Label: "Dark cloud", Help: "Mozi's answer to the day the sun went out.", Models: []core.Model{
			{ID: "none", Label: "None", Summary: "Nothing ever covers the hole.", Citation: citeHere, Params: []string{}, Speculative: true},
			{ID: "cloud", Label: "A cloud over the hole", Summary: "Now and then a dark patch in the sea of fire drifts over the hole and the sun goes out for a while.", Citation: citeHere, Params: []string{"cloud.every", "cloud.length"}, Speculative: true},
		}},
		{ID: "clerk", Label: "The clerk's rule", Help: "How the clerk at the center sorts the record into eras.", Models: []core.Model{
			{ID: "regular", Label: "Regular days", Summary: "A day is regular when its length, its daylight and its warmth are close to a standard day's. A long enough run of regular days is a Stable Era; everything else is a Chaotic Era.", Citation: citeHere, Params: []string{"clerk.tolerance", "clerk.mild", "clerk.run", "clerk.span"}, Speculative: true},
		}},
	},
	Params: []core.Param{
		{ID: "gear.strength", Label: "Strength of the currents", Unit: "×", Min: 0, Max: 3, Default: 1, Help: "How hard the three gear trains push the outer shell off a steady turn.", When: core.Always, Basic: true},
		{ID: "gear.first", Label: "First train", Unit: "days", Min: 5, Max: 100, Default: 17, Help: "How long the first train takes to come around.", When: core.Always},
		{ID: "gear.second", Label: "Second train", Unit: "days", Min: 5, Max: 100, Default: 18.1, Help: "The second train. Set close to the first, the two drift slowly in and out of step.", When: core.Always},
		{ID: "gear.third", Label: "Third train", Unit: "days", Min: 5, Max: 100, Default: 21.7, Help: "A third train, out of step with both, so no two eras are alike.", When: core.Always},
		{ID: "breath.depth", Label: "Depth of breathing", Unit: "", Min: 0, Max: 0.9, Default: 0.5, Help: "How much the gap between the shells opens and closes, as a share of the gap.", When: core.Always, Basic: true},
		{ID: "breath.period", Label: "Breath", Unit: "days", Min: 20, Max: 1000, Default: 290, Help: "How long one expansion and contraction takes.", When: core.Always},
		{ID: "outer.tilt", Label: "Tilt of the axle", Unit: "°", Min: 30, Max: 80, Default: 50, Help: "How far the outer shell's axle leans from upright. It sets how high the sun climbs.", When: core.Always},
		{ID: "outer.lamp", Label: "Place of the hole", Unit: "°", Min: -20, Max: 20, Default: 8, Help: "How far the large hole sits from the shell's equator. Further up means longer days.", When: core.Always},
		{ID: "hole.size", Label: "Size of the large hole", Unit: "inner radii", Min: 0.02, Max: 0.2, Default: 0.06, Help: "Width of the hole that makes the sun, with the shells at rest.", When: core.Always},
		{ID: "hole.spread", Label: "Spread of the light", Unit: "°", Min: 0, Max: 10, Default: 3, Help: "How much the light fans out as it crosses the gap. A wider gap then means a larger, fainter sun.", When: core.Always},
		{ID: "shells.gap", Label: "Gap between the shells", Unit: "inner radii", Min: 0.1, Max: 0.8, Default: 0.35, Help: "Distance from the inner shell to the outer one at rest.", When: core.Always},
		{ID: "inner.drift", Label: "Sun's lap of the stars", Unit: "days", Min: 30, Max: 2000, Default: 360, Help: "How long the inner shell takes to fall one whole turn behind the outer one.", When: core.Always},
		{ID: "flying.count", Label: "Specks of dust", Unit: "", Min: 1, Max: 5, Default: 2, Help: "How many flying stars drift inside the sphere. Fractions round to the nearest whole speck.", When: core.Always},
		{ID: "cloud.every", Label: "Time between clouds", Unit: "days", Min: 20, Max: 2000, Default: 400, Help: "How often a dark patch crosses the hole.", When: core.Always},
		{ID: "cloud.length", Label: "Length of a passage", Unit: "days", Min: 0.2, Max: 20, Default: 3, Help: "How long the cloud takes to cross.", When: core.Always},
		{ID: "clerk.tolerance", Label: "Clerk's tolerance", Unit: "% of a day", Min: 1, Max: 40, Default: 10, Help: "How far a day's length or its daylight may stray from a standard day and still count as regular.", When: core.Always, Basic: true},
		{ID: "clerk.mild", Label: "Mild weather", Unit: "%", Min: 5, Max: 100, Default: 30, Help: "How far a day's sunlight may stray from a standard day's and still count as mild.", When: core.Always},
		{ID: "clerk.run", Label: "Shortest Stable Era", Unit: "days", Min: 2, Max: 100, Default: 20, Help: "How many regular days in a row the clerk needs before calling it a Stable Era.", When: core.Always},
		{ID: "clerk.span", Label: "Length of the calendar", Unit: "days", Min: 200, Max: 4000, Default: 2000, Help: "How far ahead the machine is run.", When: core.Always},
	},
	Presets: []core.Preset{
		{ID: "mozi", Label: "Mozi's machine", Summary: "The machine as Mozi describes it: two breathing shells and gears for the currents in the sea of fire.",
			Models: map[string]string{}, Params: map[string]float64{}},
		{ID: "clockwork", Label: "Perfect clockwork", Summary: "One steady gear and rigid shells. The sun keeps perfect time: a Stable Era without end.",
			Models: map[string]string{"gearing": "single", "breathing": "rigid", "flying": "none"}, Params: map[string]float64{}},
		{ID: "rough", Label: "Rough seas", Summary: "The same machine with the currents pushing twice as hard. Stable Eras are short and rare.",
			Models: map[string]string{}, Params: map[string]float64{"gear.strength": 2}},
	},
}

// Catalog returns the machine's aspects, models, parameters and presets.
// The first model of each aspect and each parameter's default are the
// Mozi's machine preset.
func Catalog() *core.Catalog { return catalog }
