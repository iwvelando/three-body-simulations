// Package core holds what every simulation shares: descriptors for the
// models and parameters a simulation offers, and validation of requests
// against them. It has no dependency on any transport or interface.
package core

import (
	"fmt"
	"math"
)

// When says under which setting of a simulation's master switch (for the
// Earth simulation, the Life checkbox) a parameter has any effect.
type When string

const (
	Always  When = "always"
	WithOn  When = "on"
	WithOff When = "off"
)

// Param describes one adjustable number. The interface renders its control
// from this descriptor alone.
type Param struct {
	ID      string  `json:"id"`
	Label   string  `json:"label"`
	Unit    string  `json:"unit"`
	Min     float64 `json:"min"`
	Max     float64 `json:"max"`
	Default float64 `json:"default"`
	// Log asks for a logarithmic slider.
	Log  bool   `json:"log,omitempty"`
	Help string `json:"help"`
	When When   `json:"when"`
	// Basic parameters appear in the short panel; the rest sit under
	// their model in the Models menu.
	Basic bool `json:"basic,omitempty"`
}

// Model is one interchangeable description of an aspect of a simulation.
type Model struct {
	ID       string   `json:"id"`
	Label    string   `json:"label"`
	Summary  string   `json:"summary"`
	Citation string   `json:"citation"`
	Params   []string `json:"params"`
	// Speculative marks a model with no published quantitative basis.
	Speculative bool `json:"speculative,omitempty"`
}

// Slot is an aspect of a simulation and the models that can govern it.
// The first model is the default.
type Slot struct {
	ID     string  `json:"id"`
	Label  string  `json:"label"`
	Help   string  `json:"help"`
	Models []Model `json:"models"`
}

// Preset names a set of model choices and parameter values.
type Preset struct {
	ID      string             `json:"id"`
	Label   string             `json:"label"`
	Summary string             `json:"summary"`
	Models  map[string]string  `json:"models"`
	Params  map[string]float64 `json:"params"`
}

// Catalog is everything the interface needs to build a simulation's
// controls.
type Catalog struct {
	Slots   []Slot   `json:"slots"`
	Params  []Param  `json:"params"`
	Presets []Preset `json:"presets"`
}

// FieldError is a refusal that names the request field at fault, such as
// "params.weathering.te" or "models.climate".
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"error"`
}

func (e *FieldError) Error() string { return e.Message }

// Choice is a request's model choices and parameter values.
type Choice struct {
	Models map[string]string
	Params map[string]float64
}

// Resolve fills a choice from the catalog's defaults, then the named
// preset, then the request's own overrides, and validates the result.
// Every slot ends with a known model and every parameter with a finite
// value inside its range.
func (c *Catalog) Resolve(preset string, models map[string]string, params map[string]float64) (Choice, error) {
	out := Choice{Models: map[string]string{}, Params: map[string]float64{}}
	slots := map[string]*Slot{}
	for i := range c.Slots {
		s := &c.Slots[i]
		slots[s.ID] = s
		out.Models[s.ID] = s.Models[0].ID
	}
	specs := map[string]*Param{}
	for i := range c.Params {
		p := &c.Params[i]
		specs[p.ID] = p
		out.Params[p.ID] = p.Default
	}
	if preset != "" {
		var found *Preset
		for i := range c.Presets {
			if c.Presets[i].ID == preset {
				found = &c.Presets[i]
			}
		}
		if found == nil {
			return out, &FieldError{"preset", fmt.Sprintf("Unknown preset %q.", preset)}
		}
		for k, v := range found.Models {
			out.Models[k] = v
		}
		for k, v := range found.Params {
			out.Params[k] = v
		}
	}
	for k, v := range models {
		out.Models[k] = v
	}
	for k, v := range params {
		out.Params[k] = v
	}
	for slot, id := range out.Models {
		s, ok := slots[slot]
		if !ok {
			return out, &FieldError{"models." + slot, fmt.Sprintf("Unknown aspect %q.", slot)}
		}
		known := false
		for _, m := range s.Models {
			known = known || m.ID == id
		}
		if !known {
			return out, &FieldError{"models." + slot, fmt.Sprintf("%s has no model %q.", s.Label, id)}
		}
	}
	for id, v := range out.Params {
		p, ok := specs[id]
		if !ok {
			return out, &FieldError{"params." + id, fmt.Sprintf("Unknown parameter %q.", id)}
		}
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return out, &FieldError{"params." + id, p.Label + " must be a finite number."}
		}
		if v < p.Min || v > p.Max {
			return out, &FieldError{"params." + id, fmt.Sprintf("%s must be between %g and %g %s.", p.Label, p.Min, p.Max, p.Unit)}
		}
	}
	return out, nil
}

// Check reports descriptor mistakes: duplicate or dangling identifiers and
// defaults outside their ranges. Tests call it on every catalog.
func (c *Catalog) Check() error {
	specs := map[string]bool{}
	for _, p := range c.Params {
		if specs[p.ID] {
			return fmt.Errorf("duplicate parameter %s", p.ID)
		}
		specs[p.ID] = true
		if !(p.Min < p.Max) || p.Default < p.Min || p.Default > p.Max {
			return fmt.Errorf("parameter %s: default %g outside [%g, %g]", p.ID, p.Default, p.Min, p.Max)
		}
		if p.Log && p.Min <= 0 {
			return fmt.Errorf("parameter %s: logarithmic with a nonpositive minimum", p.ID)
		}
		if p.Label == "" || p.Help == "" || p.When == "" {
			return fmt.Errorf("parameter %s: missing label, help or when", p.ID)
		}
	}
	used := map[string]bool{}
	for _, s := range c.Slots {
		if len(s.Models) == 0 {
			return fmt.Errorf("slot %s has no models", s.ID)
		}
		for _, m := range s.Models {
			if m.Label == "" || m.Summary == "" || m.Citation == "" {
				return fmt.Errorf("model %s.%s: missing label, summary or citation", s.ID, m.ID)
			}
			for _, id := range m.Params {
				if !specs[id] {
					return fmt.Errorf("model %s.%s names unknown parameter %s", s.ID, m.ID, id)
				}
				used[id] = true
			}
		}
	}
	for id := range specs {
		if !used[id] {
			return fmt.Errorf("parameter %s belongs to no model", id)
		}
	}
	for _, p := range c.Presets {
		if _, err := c.Resolve(p.ID, nil, nil); err != nil {
			return fmt.Errorf("preset %s: %w", p.ID, err)
		}
	}
	return nil
}
