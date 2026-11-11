// Package engine is the JSON front door to every simulation. It is what
// the WebAssembly transport and the native tests both call.
package engine

import (
	"bytes"
	"encoding/json"
	"errors"

	"threebody/engine/core"
	"threebody/engine/earth"
	"threebody/engine/earth/chance"
	"threebody/engine/earth/terrain"
)

// Simulation names one simulation the engine can run.
type Simulation struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

var simulations = []Simulation{{ID: "earth", Title: "Earth without life"}}

type envelope struct {
	Sim    string `json:"sim"`
	Action string `json:"action"`
}

func refuse(field, message string) string {
	out, _ := json.Marshal(core.FieldError{Field: field, Message: message})
	return string(out)
}

func reply(v any, err error) string {
	if err != nil {
		var fe *core.FieldError
		if errors.As(err, &fe) {
			return refuse(fe.Field, fe.Message)
		}
		return refuse("", "The simulation could not finish. Try different settings.")
	}
	out, err := json.Marshal(v)
	if err != nil {
		return refuse("", "The simulation produced a value that cannot be shown.")
	}
	return string(out)
}

// Handle answers one JSON request with one JSON reply. A refusal is
// {"error": message, "field": path}, never a panic or a Go error string.
func Handle(request string) (out string) {
	defer func() {
		if recover() != nil {
			out = refuse("", "The simulation could not finish. Try different settings.")
		}
	}()
	var e envelope
	if json.Unmarshal([]byte(request), &e) != nil {
		return refuse("", "The request was not understood.")
	}
	if e.Action == "simulations" && e.Sim == "" {
		return reply(map[string]any{"simulations": simulations}, nil)
	}
	switch e.Sim {
	case "earth":
		switch e.Action {
		case "catalog":
			return reply(earth.Catalog(), nil)
		case "chance-catalog":
			return reply(chance.Catalog(), nil)
		case "chance":
			var q struct {
				envelope
				chance.Request
			}
			d := json.NewDecoder(bytes.NewReader([]byte(request)))
			d.DisallowUnknownFields()
			if d.Decode(&q) != nil {
				return refuse("", "The request was not understood.")
			}
			return reply(chance.Run(q.Request))
		case "terrain-catalog":
			return reply(terrain.Catalog(), nil)
		case "terrain":
			return refuse("action", "Terrain runs return arrays; ask through Terrain.")
		case "run":
			var q struct {
				envelope
				earth.Request
			}
			d := json.NewDecoder(bytes.NewReader([]byte(request)))
			d.DisallowUnknownFields()
			if d.Decode(&q) != nil {
				return refuse("", "The request was not understood.")
			}
			return reply(earth.Run(q.Request))
		}
		return refuse("action", "Unknown action.")
	}
	return refuse("sim", "Unknown simulation.")
}

// Terrain answers a terrain request: {"sim":"earth","action":"terrain",
// "scene":..., "params":...}. The landscape's heights and vegetation cover
// are too large to travel as JSON numbers, so they come back beside the
// JSON reply; the transport hands them over as typed arrays. A refusal is
// the usual JSON with nil arrays.
func Terrain(request string) (meta string, heights, cover []float32) {
	defer func() {
		if recover() != nil {
			meta, heights, cover = refuse("", "The simulation could not finish. Try different settings."), nil, nil
		}
	}()
	var q struct {
		envelope
		terrain.Request
	}
	d := json.NewDecoder(bytes.NewReader([]byte(request)))
	d.DisallowUnknownFields()
	if d.Decode(&q) != nil || q.Sim != "earth" || q.Action != "terrain" {
		return refuse("", "The request was not understood."), nil, nil
	}
	r, err := terrain.Run(q.Request)
	if err != nil {
		return reply(nil, err), nil, nil
	}
	return reply(r, nil), r.Heights, r.Cover
}
