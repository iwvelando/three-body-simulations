package engine

import (
	"encoding/json"
	"strings"
	"testing"
)

func call(t *testing.T, request string) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal([]byte(Handle(request)), &out); err != nil {
		t.Fatalf("reply is not JSON: %v", err)
	}
	return out
}

func TestSimulationsListsEarth(t *testing.T) {
	out := call(t, `{"action":"simulations"}`)
	list := out["simulations"].([]any)
	if len(list) == 0 || list[0].(map[string]any)["id"] != "earth" {
		t.Fatalf("simulations: %v", out)
	}
}

func TestEarthCatalogAndRun(t *testing.T) {
	cat := call(t, `{"sim":"earth","action":"catalog"}`)
	if len(cat["slots"].([]any)) < 8 || len(cat["presets"].([]any)) != 3 {
		t.Fatalf("catalog: %d slots", len(cat["slots"].([]any)))
	}
	run := call(t, `{"sim":"earth","action":"run","life":false,"preset":"skeptic"}`)
	series := run["series"].(map[string]any)
	if len(series["temperature"].([]any)) != len(run["time"].([]any)) || run["summary"].(map[string]any)["state"] != "temperate" {
		t.Fatalf("run: %v", run["summary"])
	}
}

func TestErrorsAreReadableJSON(t *testing.T) {
	for request, field := range map[string]string{
		`{`:                               "",
		`{"sim":"mars","action":"run"}`:   "sim",
		`{"sim":"earth","action":"leap"}`: "action",
		`{"sim":"earth","action":"run","params":{"weathering.te":-1}}`: "params.weathering.te",
		`{"sim":"earth","action":"run","lief":true}`:                   "",
	} {
		out := call(t, request)
		msg, _ := out["error"].(string)
		if msg == "" || strings.Contains(msg, "json:") || strings.Contains(msg, "unmarshal") {
			t.Errorf("%s: error %q", request, msg)
		}
		if got, _ := out["field"].(string); got != field {
			t.Errorf("%s: field %q, want %q", request, got, field)
		}
	}
}

func TestTerrainKeepsLargeArraysOutOfTheJSON(t *testing.T) {
	cat := call(t, `{"sim":"earth","action":"terrain-catalog"}`)
	if len(cat["scenes"].([]any)) != 2 {
		t.Fatalf("terrain catalog: %v", cat)
	}
	meta, heights, cover := Terrain(`{"sim":"earth","action":"terrain","scene":"mountains","params":{"duration":0.2}}`)
	var out map[string]any
	if err := json.Unmarshal([]byte(meta), &out); err != nil {
		t.Fatal(err)
	}
	n := int(out["size"].(float64))
	frames := len(out["times"].([]any))
	if len(heights) != frames*n*n || len(cover) != n*n || len(meta) > 8000 {
		t.Fatalf("%d heights, %d cover, %d bytes of JSON for %d frames of %d", len(heights), len(cover), len(meta), frames, n)
	}
	meta, heights, _ = Terrain(`{"sim":"earth","action":"terrain","scene":"moon"}`)
	if heights != nil || json.Unmarshal([]byte(meta), &out) != nil || out["field"] != "scene" {
		t.Fatalf("refusal: %s", meta)
	}
	if out := call(t, `{"sim":"earth","action":"terrain","scene":"crater"}`); out["field"] != "action" {
		t.Errorf("Handle must send terrain runs to Terrain: %v", out)
	}
}

func TestChanceEnsemble(t *testing.T) {
	cat := call(t, `{"sim":"earth","action":"chance-catalog"}`)
	if len(cat["params"].([]any)) < 4 || len(cat["speculative"].([]any)) == 0 {
		t.Fatalf("chance catalog: %v", cat)
	}
	out := call(t, `{"sim":"earth","action":"chance","seed":1,"from":10,"count":8,"runs":5}`)
	if len(out["chance"].([]any)) != 8 || len(out["life"].([]any)) != 8 || out["from"].(float64) != 10 {
		t.Fatalf("chance: %v", out)
	}
	if out := call(t, `{"sim":"earth","action":"chance","count":8,"runs":0}`); out["field"] != "runs" {
		t.Errorf("refusal: %v", out)
	}
}

func TestSimulationsListsMozi(t *testing.T) {
	list := call(t, `{"action":"simulations"}`)["simulations"].([]any)
	if len(list) != 3 || list[1].(map[string]any)["id"] != "mozi" || list[2].(map[string]any)["id"] != "flat" {
		t.Fatalf("simulations: %v", list)
	}
}

func TestMoziCatalogRunAndSky(t *testing.T) {
	cat := call(t, `{"sim":"mozi","action":"catalog"}`)
	if len(cat["slots"].([]any)) != 6 || len(cat["presets"].([]any)) != 3 {
		t.Fatalf("catalog: %v", cat)
	}
	raw := Handle(`{"sim":"mozi","action":"run","preset":"clockwork"}`)
	// The calendar travels as JSON; it must stay small.
	if len(raw) > 150_000 {
		t.Fatalf("run reply is %d bytes", len(raw))
	}
	run := call(t, `{"sim":"mozi","action":"run","preset":"clockwork"}`)
	eras := run["eras"].([]any)
	if len(eras) != 1 || eras[0].(map[string]any)["kind"] != "stable" || len(run["stars"].([]any)) < 100 {
		t.Fatalf("run: %v", run["summary"])
	}
	sky := call(t, `{"sim":"mozi","action":"sky","from":2,"step":0.01,"count":5,"models":{"flying":"none"}}`)
	if len(sky["sun"].([]any)) != 5 || len(sky["flying"].([]any)[0].([]any)) != 0 {
		t.Fatalf("sky: %v", sky)
	}
	for request, field := range map[string]string{
		`{"sim":"mozi","action":"leap"}`:                                     "action",
		`{"sim":"mozi","action":"run","models":{"shells":"three"}}`:          "models.shells",
		`{"sim":"mozi","action":"run","params":{"gear.strength":99}}`:        "params.gear.strength",
		`{"sim":"mozi","action":"run","from":2}`:                             "",
		`{"sim":"mozi","action":"sky","from":2,"step":0.01,"count":0}`:       "count",
		`{"sim":"mozi","action":"sky","from":2,"step":0.01,"count":5,"x":1}`: "",
	} {
		out := call(t, request)
		if msg, _ := out["error"].(string); msg == "" || strings.Contains(msg, "json:") {
			t.Errorf("%s: error %q", request, msg)
		}
		if got, _ := out["field"].(string); got != field {
			t.Errorf("%s: field %q, want %q", request, got, field)
		}
	}
}

func TestFlatCatalogRunAndSky(t *testing.T) {
	cat := call(t, `{"sim":"flat","action":"catalog"}`)
	if len(cat["slots"].([]any)) != 3 || len(cat["presets"].([]any)) != 4 || len(cat["bodies"].([]any)) != 10 {
		t.Fatalf("catalog: %v", cat)
	}
	if cat := call(t, `{"sim":"flat","action":"painting-catalog"}`); len(cat["slots"].([]any)) != 3 {
		t.Fatalf("painting catalog: %v", cat)
	}
	raw := Handle(`{"sim":"flat","action":"run","body":"earth","models":{"landing":"spread"},"resolution":"fine"}`)
	if len(raw) > 400_000 {
		t.Fatalf("run reply is %d bytes", len(raw))
	}
	run := call(t, `{"sim":"flat","action":"run","body":"neptune"}`)
	if len(run["rings"].([]any)) != 3 || run["duration"].(float64) <= 0 {
		t.Fatalf("run: %v", run["rings"])
	}
	sky := call(t, `{"sim":"flat","action":"sky","seed":4}`)
	if len(sky["bodies"].([]any)) != 10 {
		t.Fatalf("sky: %v", sky)
	}
	for request, field := range map[string]string{
		`{"sim":"flat","action":"leap"}`:                                "action",
		`{"sim":"flat","action":"run","body":"vulcan"}`:                 "body",
		`{"sim":"flat","action":"run","params":{"sheet.thickness":-1}}`: "params.sheet.thickness",
		`{"sim":"flat","action":"run","seed":2}`:                        "",
		`{"sim":"flat","action":"sky","seed":-2}`:                       "seed",
		`{"sim":"flat","action":"painting","width":2,"height":2}`:       "action",
		`{"sim":"flat","action":"snowflakes","count":2,"size":32}`:      "action",
	} {
		out := call(t, request)
		if msg, _ := out["error"].(string); msg == "" || strings.Contains(msg, "json:") {
			t.Errorf("%s: error %q", request, msg)
		}
		if got, _ := out["field"].(string); got != field {
			t.Errorf("%s: field %q, want %q", request, got, field)
		}
	}
}

// Pictures travel as bytes beside the JSON in both directions.
func TestFlatBytes(t *testing.T) {
	picture := make([]byte, 4*8*6)
	for i := range picture {
		picture[i] = byte(i * 7)
	}
	meta, out := Bytes(`{"sim":"flat","action":"painting","width":8,"height":6}`, picture)
	var reply struct {
		Restored struct{ Offset, Width, Height int }
		Flat     struct{ Offset, Width, Height int }
		Error    string
	}
	if err := json.Unmarshal([]byte(meta), &reply); err != nil || reply.Error != "" {
		t.Fatalf("painting: %v %s", err, meta)
	}
	if reply.Restored.Width != 8 || len(out) != reply.Restored.Offset+4*8*6 || reply.Flat.Width < 256 || len(meta) > 6000 {
		t.Fatalf("painting: %d bytes beside %s", len(out), meta)
	}
	meta, out = Bytes(`{"sim":"flat","action":"snowflakes","seed":1,"count":2,"size":32}`, nil)
	if len(out) != 2*32*32 || strings.Contains(meta, "error") {
		t.Fatalf("snowflakes: %d bytes, %s", len(out), meta)
	}
	for request, field := range map[string]string{
		`{"sim":"flat","action":"painting","width":8,"height":7}`:  "pixels",
		`{"sim":"flat","action":"painting","width":8,"hieght":6}`:  "",
		`{"sim":"flat","action":"snowflakes","count":0,"size":32}`: "count",
		`{"sim":"flat","action":"run"}`:                            "action",
		`{"sim":"earth","action":"painting","width":8,"height":6}`: "sim",
		`{`: "",
	} {
		meta, out := Bytes(request, picture)
		var refusal map[string]any
		if out != nil || json.Unmarshal([]byte(meta), &refusal) != nil || refusal["error"] == "" || refusal["field"] != field {
			t.Errorf("%s: %s", request, meta)
		}
	}
}
