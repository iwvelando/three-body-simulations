package core

// Surface describes a body's face for drawing: a manner (a glowing
// "star", cratered "rock", "earth" with seas, land and cloud, swirled
// "cloud", or striped "bands") and its colors. For "earth" the colors
// are sea, land, desert and ice. Nothing is worked out from it.
type Surface struct {
	Kind   string   `json:"kind"`
	Colors []string `json:"colors"`
	// Spot is the color of one large marking, if the body has one.
	Spot string `json:"spot,omitempty"`
	// Rings is the color of a ring system, if the body has one.
	Rings string `json:"rings,omitempty"`
	// Caps says the poles are white.
	Caps bool `json:"caps,omitempty"`
}

// Looks is each body's face, by id.
var Looks = map[string]Surface{
	"sun":     {Kind: "star", Colors: []string{"#fff6d8", "#ffb53f", "#ef6a1c"}},
	"mercury": {Kind: "rock", Colors: []string{"#8f8983", "#6c6660", "#a9a29a"}},
	"venus":   {Kind: "cloud", Colors: []string{"#ead9a8", "#d6bb7b", "#f4e9c6"}},
	"earth":   {Kind: "earth", Colors: []string{"#1b4a8c", "#3d7a3c", "#b79c64", "#f4f7fa"}},
	"mars":    {Kind: "rock", Colors: []string{"#b4532f", "#8a3b22", "#d28f60"}, Caps: true},
	"jupiter": {Kind: "bands", Colors: []string{"#e9dcc3", "#b07a52", "#dcc19a", "#9c6a48", "#efe4cf", "#c49364"}, Spot: "#b2472d"},
	"saturn":  {Kind: "bands", Colors: []string{"#efe2b6", "#d8c38a", "#f3ebcd", "#cdb57a"}, Rings: "#cbbd95"},
	"uranus":  {Kind: "bands", Colors: []string{"#a9e1e4", "#9bd8dc", "#b5e8ea"}},
	"neptune": {Kind: "bands", Colors: []string{"#3e6fe0", "#3460c9", "#5685ea", "#2f58bd"}, Spot: "#27469b"},
	"pluto":   {Kind: "rock", Colors: []string{"#b89c83", "#89705c", "#d9c7b2"}, Spot: "#eadfce"},
}
