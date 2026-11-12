package core

import (
	"errors"
	"math"
	"testing"
)

func sample() *Catalog {
	return &Catalog{
		Slots: []Slot{{ID: "climate", Label: "Climate", Help: "h", Models: []Model{
			{ID: "a", Label: "A", Summary: "s", Citation: "c", Params: []string{"x"}},
			{ID: "b", Label: "B", Summary: "s", Citation: "c", Params: []string{"x"}},
		}}},
		Params:  []Param{{ID: "x", Label: "X", Unit: "K", Min: 1, Max: 10, Default: 2, Help: "h", When: Always}},
		Presets: []Preset{{ID: "p", Label: "P", Models: map[string]string{"climate": "b"}, Params: map[string]float64{"x": 5}}},
	}
}

func TestResolveLayersDefaultsPresetAndOverrides(t *testing.T) {
	c := sample()
	if err := c.Check(); err != nil {
		t.Fatal(err)
	}
	got, err := c.Resolve("", nil, nil)
	if err != nil || got.Models["climate"] != "a" || got.Params["x"] != 2 {
		t.Fatalf("defaults: %+v %v", got, err)
	}
	got, _ = c.Resolve("p", nil, nil)
	if got.Models["climate"] != "b" || got.Params["x"] != 5 {
		t.Fatalf("preset: %+v", got)
	}
	got, _ = c.Resolve("p", map[string]string{"climate": "a"}, map[string]float64{"x": 7})
	if got.Models["climate"] != "a" || got.Params["x"] != 7 {
		t.Fatalf("overrides: %+v", got)
	}
}

func TestResolveNamesTheOffendingField(t *testing.T) {
	c := sample()
	cases := []struct {
		preset string
		models map[string]string
		params map[string]float64
		field  string
	}{
		{"nope", nil, nil, "preset"},
		{"", map[string]string{"climate": "z"}, nil, "models.climate"},
		{"", map[string]string{"oceans": "a"}, nil, "models.oceans"},
		{"", nil, map[string]float64{"x": 11}, "params.x"},
		{"", nil, map[string]float64{"x": math.NaN()}, "params.x"},
		{"", nil, map[string]float64{"y": 1}, "params.y"},
	}
	for _, k := range cases {
		_, err := c.Resolve(k.preset, k.models, k.params)
		var fe *FieldError
		if !errors.As(err, &fe) || fe.Field != k.field {
			t.Errorf("want field %s, got %v", k.field, err)
		}
	}
}

func TestCheckCatchesDescriptorMistakes(t *testing.T) {
	c := sample()
	c.Params[0].Default = 99
	if c.Check() == nil {
		t.Error("default outside range accepted")
	}
	c = sample()
	c.Slots[0].Models[0].Params = []string{"missing"}
	if c.Check() == nil {
		t.Error("dangling parameter accepted")
	}
	c = sample()
	c.Presets[0].Params["x"] = 50
	if c.Check() == nil {
		t.Error("preset outside range accepted")
	}
}

// A request wrong in several places is refused for the same one every
// time: slots, then parameters, each in the catalog's order, then keys
// the catalog does not know, by name.
func TestResolveRefusesTheSameFieldEveryTime(t *testing.T) {
	c := &Catalog{
		Slots: []Slot{
			{ID: "s1", Label: "One", Help: "h", Models: []Model{{ID: "a", Label: "A", Summary: "s", Citation: "c", Params: []string{"x", "y", "z"}}}},
			{ID: "s2", Label: "Two", Help: "h", Models: []Model{{ID: "a", Label: "A", Summary: "s", Citation: "c"}}},
		},
		Params: []Param{
			{ID: "x", Label: "X", Min: 1, Max: 10, Default: 2, Help: "h", When: Always},
			{ID: "y", Label: "Y", Min: 1, Max: 10, Default: 2, Help: "h", When: Always},
			{ID: "z", Label: "Z", Min: 1, Max: 10, Default: 2, Help: "h", When: Always},
		},
	}
	if err := c.Check(); err != nil {
		t.Fatal(err)
	}
	field := func(models map[string]string, params map[string]float64) string {
		t.Helper()
		_, err := c.Resolve("", models, params)
		var fe *FieldError
		if !errors.As(err, &fe) {
			t.Fatalf("no refusal: %v", err)
		}
		return fe.Field
	}
	for i := 0; i < 200; i++ {
		if got := field(map[string]string{"s2": "no", "s1": "no"}, map[string]float64{"x": 99}); got != "models.s1" {
			t.Fatalf("slots: %s", got)
		}
		if got := field(nil, map[string]float64{"z": 99, "y": 99, "x": 99}); got != "params.x" {
			t.Fatalf("parameters: %s", got)
		}
		if got := field(nil, map[string]float64{"q": 1, "b": 1, "m": 1}); got != "params.b" {
			t.Fatalf("unknown parameters: %s", got)
		}
		if got := field(map[string]string{"q": "a", "b": "a"}, nil); got != "models.b" {
			t.Fatalf("unknown slots: %s", got)
		}
	}
}

// A parameter that counts things says so, and starts on a whole number.
func TestWholeParametersMustStartWhole(t *testing.T) {
	c := sample()
	c.Params[0].Whole = true
	c.Params[0].Default = 2.5
	if c.Check() == nil {
		t.Fatal("a whole parameter with a fractional default passed")
	}
}
