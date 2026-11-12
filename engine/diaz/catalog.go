package diaz

import "threebody/engine/core"

const (
	citeNovel   = "Liu Cixin, The Dark Forest (fiction)"
	citeHere    = citeNovel + "; rule invented for this site"
	citeBombs   = "Ahrens & Harris (1992); the ceiling is energy and momentum bookkeeping"
	citeImpact  = "Brown, Carlson & Toner (2015); Christensen-Dalsgaard et al. (1996), Model S; energy bookkeeping"
	citeKepler  = "Kepler's laws; the Sun's turn from NASA's Sun Fact Sheet"
	citeDrag    = "Adachi, Hayashi & Nakazawa (1976); Ostriker (1999)"
	citeOrbits  = "Standish & Williams, JPL approximate elements"
	citeFactual = "NASA Planetary Fact Sheets (Williams, NSSDCA)"
)

// SystemCatalog is the descriptors and the bodies they act on.
type SystemCatalog struct {
	*core.Catalog
	Bodies []*Body `json:"bodies"`
	// Sources says where the bodies' numbers come from.
	Sources []string `json:"sources"`
}

var catalog = &SystemCatalog{
	Catalog: &core.Catalog{
		Slots: []core.Slot{
			{ID: "bombs", Label: "The bombs", Help: "How much the bombs on Mercury slow it.", Models: []core.Model{
				{ID: "charges", Label: "Buried charges", Summary: "Each bomb throws rock off Mercury, and only rock that leaves for good pushes the planet. This is the most any bombs could do: all of their energy into rock thrown at the best speed.", Citation: citeBombs, Params: []string{"bombs.count", "bombs.yield", "bombs.coupling"}},
				{ID: "plan", Label: "As strong as the plan needs", Summary: "Mercury loses exactly the speed that sends it into the Sun, however many bombs that would take.", Citation: citeHere, Params: []string{"bombs.target", "bombs.yield"}, Speculative: true},
			}},
			{ID: "impact", Label: "What the Sun throws out", Help: "How much of the Sun is thrown into space when a planet hits it.", Models: []core.Model{
				{ID: "energy", Label: "No more than the fall pays for", Summary: "The planet's energy of motion is all there is to spend. Since it arrives at about the speed needed to leave the Sun, it can lift out its own mass at most.", Citation: citeImpact, Params: []string{"ejecta.share"}},
				{ID: "eruption", Label: "The wound erupts", Summary: "The novel's Sun: the hole lets out far more than the impact paid for, as if the Sun were under pressure. It is not; the Sun's weight and pressure are in balance.", Citation: citeHere, Params: []string{"eruption.gain"}, Speculative: true},
			}},
			{ID: "cloud", Label: "What the gas does", Help: "Where the gas goes once it has left the Sun.", Models: []core.Model{
				{ID: "free", Label: "Falls back or leaves", Summary: "Gas thrown up follows the same paths as anything else under the Sun's pull. Slower than escape speed it falls back within hours or days; faster, it is gone for good.", Citation: citeKepler, Params: []string{"ejecta.speed", "ejecta.spread"}},
				{ID: "standing", Label: "A standing spiral", Summary: "The novel's spiral: the gas unwinds from the turning Sun like a mainspring, stops where it has reached, and stays there without orbiting.", Citation: citeHere, Params: []string{"cloud.reach", "cloud.speed", "cloud.flare"}, Speculative: true},
			}},
			{ID: "drag", Label: "Drag on a planet", Help: "How gas slows a planet moving through it.", Models: []core.Model{
				{ID: "gas", Label: "Friction and wake", Summary: "The gas a planet runs into slows it, and so does the pull of the wake it gathers behind it. For Jupiter the wake counts for far more than the friction.", Citation: citeDrag, Params: []string{"drag.coefficient"}},
			}},
		},
		Params: []core.Param{
			{ID: "bombs.count", Label: "Bombs", Unit: "", Min: 1e3, Max: 1e15, Default: 1e6, Log: true, Basic: true,
				Help: "How many bombs are set off on Mercury. The novel's plan asks for a million.", When: core.Always},
			{ID: "bombs.yield", Label: "Yield of each bomb", Unit: "Mt", Min: 1, Max: 1e4, Default: 200, Log: true,
				Help: "The energy of one bomb, in megatons of TNT. The novel asks for two hundred at the least.", When: core.Always},
			{ID: "bombs.coupling", Label: "Energy that reaches the rock", Unit: "", Min: 0.002, Max: 1, Default: 1, Log: true,
				Help: "The share of a bomb's energy that goes into the rock. Nearly all for a deeply buried bomb; 0.2% to 1.8% for one at the surface.", When: core.Always},
			{ID: "bombs.target", Label: "How close Mercury's new path comes to the Sun's center", Unit: "solar radii", Min: 0, Max: 1, Default: 0.5,
				Help: "Zero is a straight fall. At one the path only grazes the surface.", When: core.Always},
			{ID: "ejecta.share", Label: "Energy that goes into thrown gas", Unit: "", Min: 0.01, Max: 1, Default: 1, Log: true,
				Help: "The share of the impact's energy that ends up as gas moving outward. The rest stays in the Sun as heat.", When: core.Always},
			{ID: "ejecta.speed", Label: "Speed of the thrown gas", Unit: "× escape speed", Min: 0.5, Max: 1.5, Default: 1,
				Help: "The middle speed of the gas as it leaves, against the 618 km/s needed to escape the Sun.", When: core.Always},
			{ID: "ejecta.spread", Label: "Spread of speeds", Unit: "", Min: 0, Max: 0.5, Default: 0.1,
				Help: "How far above and below the middle speed the gas ranges, as a share of it.", When: core.Always},
			{ID: "eruption.gain", Label: "Strength of the eruption", Unit: "×", Min: 1, Max: 1e6, Default: 1000, Log: true, Basic: true,
				Help: "How many times more gas comes out than the impact's energy could lift. Nothing in the novel fixes it; it sets how long the planets take to fall.", When: core.Always},
			{ID: "cloud.reach", Label: "Reach of the spiral in the novel's example", Unit: "AU", Min: 0.5, Max: 10, Default: 3,
				Help: "How far the spiral reached around the star the novel describes, whose planet was 4% of the Earth's mass. Other impacts reach further in proportion to the cube root of their energy.", When: core.Always},
			{ID: "cloud.speed", Label: "Speed the spiral unwinds", Unit: "km/s", Min: 1, Max: 500, Default: 50, Log: true,
				Help: "How fast the gas moves outward. With the Sun's turn it sets how tightly the spiral is wound.", When: core.Always},
			{ID: "cloud.flare", Label: "Thickness of the spiral", Unit: "", Min: 0.01, Max: 0.5, Default: 0.1, Log: true,
				Help: "Half the spiral's thickness as a share of the distance from the Sun. Thinner gas is denser.", When: core.Always},
			{ID: "drag.coefficient", Label: "Drag coefficient", Unit: "", Min: 0.5, Max: 2, Default: 2,
				Help: "How much of the momentum of the gas it meets a planet takes up. Two for a body far faster than sound in the gas.", When: core.Always},
		},
		Presets: []core.Preset{
			{ID: "plan", Label: "The Wallbreaker's telling", Summary: "The plan as the novel tells it. Three things are invented to make it run: bombs strong enough, a Sun that erupts, and gas that stays.",
				Models: map[string]string{"bombs": "plan", "impact": "eruption", "cloud": "standing"}, Params: map[string]float64{}},
			{ID: "granted", Label: "Grant only the fall", Summary: "Mercury is sent into the Sun by whatever it takes. Everything after that is published physics.",
				Models: map[string]string{"bombs": "plan", "impact": "energy", "cloud": "free"}, Params: map[string]float64{}},
			{ID: "published", Label: "Published physics only", Summary: "A million 200 megaton bombs, at the most they could possibly do.",
				Models: map[string]string{"bombs": "charges", "impact": "energy", "cloud": "free"}, Params: map[string]float64{}},
		},
	},
	Bodies:  bodies,
	Sources: []string{citeFactual, citeOrbits},
}

// Catalog returns the aspects, models, parameters, presets and bodies.
func Catalog() *SystemCatalog { return catalog }
