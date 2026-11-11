// Package flat is the collapse into two dimensions from Death's End:
// three-dimensional things falling into a plane and spreading out on it
// with nothing overlapping. The novel gives a few numbers and no
// mechanism, so every model here is this site's invention and is marked
// speculative. docs/models-flat.md records what each is built on.
package flat

import "threebody/engine/core"

const (
	citeNovel = "Liu Cixin, Death's End (fiction)"
	citeHere  = citeNovel + "; rule invented for this site"
)

// BodyCatalog is the bodies view's catalog: the shared descriptors and
// the bodies that can be dropped.
type BodyCatalog struct {
	*core.Catalog
	Bodies []*Body `json:"bodies"`
	// Focus names the body a preset's statement in the novel is about.
	Focus map[string]string `json:"focus"`
}

var thickness = core.Param{ID: "sheet.thickness", Label: "Thickness of the sheet", Unit: "m", Min: 1e-10, Max: 1e6, Default: 192000, Log: true,
	Help: "How thin flat matter is spread. Area is volume divided by this, so a thinner sheet means a far larger picture.", When: core.Always, Basic: true}

var keptSlot = core.Slot{ID: "kept", Label: "What is kept", Help: "What the flat picture has the same amount of as the solid thing.", Models: []core.Model{
	{ID: "volume", Label: "Volume", Summary: "Every cubic meter becomes the same area, whatever it is made of.", Citation: citeHere, Params: []string{"sheet.thickness"}, Speculative: true},
	{ID: "mass", Label: "Mass", Summary: "Every kilogram becomes the same area: the sheet is as thick as the setting says for water, and denser matter spreads wider.", Citation: citeHere, Params: []string{"sheet.thickness"}, Speculative: true},
}}

// The thicknesses are each worked out from one statement in the novel;
// TestFlatPresets and docs/models-flat.md say how.
func presets(first string) []core.Preset {
	all := []core.Preset{
		{ID: "sun30", Label: "The Sun's thirty seconds", Summary: "The novel's clock: the flat Sun is wider than the Sun after thirty seconds of an hour-long fall. That needs a sheet 192 km thick.",
			Models: map[string]string{}, Params: map[string]float64{"sheet.thickness": 192000}},
		{ID: "snow", Label: "Snowflake sea", Summary: "The novel's snowflakes: the Earth's ocean becomes a ring wide enough for crystals 4,500 km across. That needs a sheet 8.5 m thick.",
			Models: map[string]string{}, Params: map[string]float64{"sheet.thickness": 8.5}},
		{ID: "starry", Label: "Starry Night", Summary: "The novel's sky: the flat planets are as wide as the gaps between them. Flat Jupiter and Saturn touch when the sheet is 3.3 m thick.",
			Models: map[string]string{}, Params: map[string]float64{"sheet.thickness": 3.3}},
		{ID: "atoms", Label: "Every atom side by side", Summary: "The novel's detail: nothing hidden, down to single particles. That needs a sheet one atom thick.",
			Models: map[string]string{}, Params: map[string]float64{"sheet.thickness": 1e-10}},
	}
	for i, p := range all {
		if p.ID == first {
			all[0], all[i] = all[i], all[0]
		}
	}
	return all
}

var catalog = &BodyCatalog{
	Catalog: &core.Catalog{
		Slots: []core.Slot{
			{ID: "landing", Label: "How matter lands", Help: "Where each piece of the body ends up on the plane.", Models: []core.Model{
				{ID: "shells", Label: "Shell by shell", Summary: "Each shell of the body becomes a ring, the core in the middle: the novel's planets, ringed like a cut tree.", Citation: citeHere, Params: []string{}, Speculative: true},
				{ID: "spread", Label: "Spreading pool", Summary: "Matter spreads from where it touches, pushing aside what landed before, like the novel's ice cream melting on hot glass. First in ends furthest out.", Citation: citeHere, Params: []string{}, Speculative: true},
			}},
			keptSlot,
			{ID: "plane", Label: "The plane's advance", Help: "How fast the plane rises through whatever is falling into it.", Models: []core.Model{
				{ID: "steady", Label: "Steady", Summary: "The plane rises at one speed, set by how long the Sun takes to go under. The novel says an hour.", Citation: citeHere, Params: []string{"plane.hour"}, Speculative: true},
			}},
		},
		Params: []core.Param{
			thickness,
			{ID: "plane.hour", Label: "Time for the Sun to fall", Unit: "min", Min: 1, Max: 600, Default: 60, Log: true,
				Help: "How long the plane takes to cross the Sun. Smaller bodies take less in proportion.", When: core.Always},
		},
		Presets: presets("sun30"),
	},
	Bodies: bodies,
	Focus:  map[string]string{"sun30": "sun", "snow": "earth", "starry": "jupiter"},
}

// Catalog returns the bodies view's aspects, models, parameters, presets
// and bodies. Defaults are the first preset.
func Catalog() *BodyCatalog { return catalog }

var painting = &core.Catalog{
	Slots: []core.Slot{
		{ID: "entry", Label: "How it goes in", Help: "Which part of the picture touches the plane first.", Models: []core.Model{
			{ID: "bottom", Label: "Bottom edge first", Summary: "The picture stands on the plane and sinks. Each row spreads away from the line where it went in.", Citation: citeHere, Params: []string{"sheet.thickness", "paper.depth", "paper.width"}, Speculative: true},
			{ID: "top", Label: "Top edge first", Summary: "Upside down: the top row goes in first and ends furthest out.", Citation: citeHere, Params: []string{"sheet.thickness", "paper.depth", "paper.width"}, Speculative: true},
			{ID: "left", Label: "Left edge first", Summary: "On its side, left edge down.", Citation: citeHere, Params: []string{"sheet.thickness", "paper.depth", "paper.width"}, Speculative: true},
			{ID: "right", Label: "Right edge first", Summary: "On its side, right edge down.", Citation: citeHere, Params: []string{"sheet.thickness", "paper.depth", "paper.width"}, Speculative: true},
			{ID: "flat", Label: "Flat, face down", Summary: "The whole face touches at once, so the picture has to get out from under itself. It leaves as bands around the place it landed.", Citation: citeHere, Params: []string{"sheet.thickness", "paper.depth", "paper.width"}, Speculative: true},
		}},
		{ID: "company", Label: "What falls with it", Help: "The museum's worry: a picture that falls inside a planet is mixed with the planet.", Models: []core.Model{
			{ID: "alone", Label: "Alone in space", Summary: "Carried off and let go, as the characters do. Nothing else lands near it.", Citation: citeHere, Params: []string{"reader"}, Speculative: true},
			{ID: "buried", Label: "Buried in Pluto", Summary: "Left in the museum under Pluto's surface. It spreads as one thread among the planet's rings.", Citation: citeHere, Params: []string{"reader", "buried.depth"}, Speculative: true},
		}},
		{ID: "back", Label: "The back", Help: "What the half of the sheet behind the picture is made of.", Models: []core.Model{
			{ID: "bare", Label: "Bare canvas", Summary: "The paint is on the front. The back half lands as plain canvas on the other side of the line.", Citation: citeHere, Params: []string{}, Speculative: true},
			{ID: "soaked", Label: "Soaked through", Summary: "The color runs all the way through, so both sides land as the picture.", Citation: citeHere, Params: []string{}, Speculative: true},
		}},
	},
	Params: []core.Param{
		func() core.Param { p := thickness; p.Default = 1e-10; return p }(),
		{ID: "paper.depth", Label: "Depth of the picture", Unit: "mm", Min: 0.05, Max: 10, Default: 1, Log: true, Help: "How thick the canvas or paper is.", When: core.Always, Basic: true},
		{ID: "paper.width", Label: "Width of the picture", Unit: "cm", Min: 5, Max: 1000, Default: 92.1, Log: true, Help: "How wide the picture is. The default is the width of The Starry Night.", When: core.Always},
		{ID: "reader", Label: "Sharpness of the reader", Unit: "dots", Min: 16, Max: 1024, Default: 512, Log: true, Help: "How many dots across the flat picture whoever restores it can tell apart.", When: core.Always, Basic: true},
		{ID: "buried.depth", Label: "Depth under the surface", Unit: "m", Min: 1, Max: 10000, Default: 100, Log: true, Help: "How far under Pluto's surface the picture lies.", When: core.Always},
	},
	Presets: presets("atoms"),
}

// PaintingCatalog returns the painting view's descriptors.
func PaintingCatalog() *core.Catalog { return painting }
