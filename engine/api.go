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
	"threebody/engine/flat"
	"threebody/engine/mozi"
)

// Simulation names one simulation the engine can run.
type Simulation struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

var simulations = []Simulation{
	{ID: "earth", Title: "Earth without life"},
	{ID: "mozi", Title: "Mozi's machine"},
	{ID: "flat", Title: "Into two dimensions"},
}

// decode reads a request into q, refusing fields q does not have.
func decode(request string, q any) bool {
	d := json.NewDecoder(bytes.NewReader([]byte(request)))
	d.DisallowUnknownFields()
	return d.Decode(q) == nil
}

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
			if !decode(request, &q) {
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
			if !decode(request, &q) {
				return refuse("", "The request was not understood.")
			}
			return reply(earth.Run(q.Request))
		}
		return refuse("action", "Unknown action.")
	case "mozi":
		switch e.Action {
		case "catalog":
			return reply(mozi.Catalog(), nil)
		case "run":
			var q struct {
				envelope
				mozi.Request
			}
			if !decode(request, &q) {
				return refuse("", "The request was not understood.")
			}
			return reply(mozi.Run(q.Request))
		case "sky":
			var q struct {
				envelope
				mozi.SkyRequest
			}
			if !decode(request, &q) {
				return refuse("", "The request was not understood.")
			}
			return reply(mozi.Sky(q.SkyRequest))
		}
		return refuse("action", "Unknown action.")
	case "flat":
		switch e.Action {
		case "catalog":
			return reply(flat.Catalog(), nil)
		case "painting-catalog":
			return reply(flat.PaintingCatalog(), nil)
		case "run":
			var q struct {
				envelope
				flat.Request
			}
			if !decode(request, &q) {
				return refuse("", "The request was not understood.")
			}
			return reply(flat.Run(q.Request))
		case "sky":
			var q struct {
				envelope
				flat.SkyRequest
			}
			if !decode(request, &q) {
				return refuse("", "The request was not understood.")
			}
			return reply(flat.Sky(q.SkyRequest))
		case "painting", "snowflakes":
			return refuse("action", "Pictures travel as bytes; ask through Bytes.")
		}
		return refuse("action", "Unknown action.")
	}
	return refuse("sim", "Unknown simulation.")
}

// Bytes answers the requests whose pictures are too large to travel as
// JSON numbers: {"sim":"flat","action":"painting", ...} with the picture
// as RGBA bytes beside it, and {"sim":"flat","action":"snowflakes", ...}.
// The reply's own pictures come back as bytes beside its JSON, which
// says where each one is. A refusal is the usual JSON with nil bytes.
func Bytes(request string, in []byte) (meta string, out []byte) {
	defer func() {
		if recover() != nil {
			meta, out = refuse("", "The simulation could not finish. Try different settings."), nil
		}
	}()
	var e envelope
	if json.Unmarshal([]byte(request), &e) != nil {
		return refuse("", "The request was not understood."), nil
	}
	if e.Sim != "flat" {
		return refuse("sim", "Unknown simulation."), nil
	}
	switch e.Action {
	case "painting":
		var q struct {
			envelope
			flat.PaintingRequest
		}
		if !decode(request, &q) {
			return refuse("", "The request was not understood."), nil
		}
		r, bytes, err := flat.Painting(q.PaintingRequest, in)
		if err != nil {
			return reply(nil, err), nil
		}
		return reply(r, nil), bytes
	case "snowflakes":
		var q struct {
			envelope
			flat.SnowRequest
		}
		if !decode(request, &q) {
			return refuse("", "The request was not understood."), nil
		}
		r, bytes, err := flat.Snowflakes(q.SnowRequest)
		if err != nil {
			return reply(nil, err), nil
		}
		return reply(r, nil), bytes
	}
	return refuse("action", "Unknown action."), nil
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
	if !decode(request, &q) || q.Sim != "earth" || q.Action != "terrain" {
		return refuse("", "The request was not understood."), nil, nil
	}
	r, err := terrain.Run(q.Request)
	if err != nil {
		return reply(nil, err), nil, nil
	}
	return reply(r, nil), r.Heights, r.Cover
}
