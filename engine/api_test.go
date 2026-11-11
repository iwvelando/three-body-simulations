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
