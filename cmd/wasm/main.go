//go:build js && wasm

// Command wasm exposes the engine to the browser worker. Transport only:
// no simulation logic lives here.
package main

import (
	"syscall/js"
	"unsafe"

	"threebody/engine"
)

func main() {
	js.Global().Set("threeBody", js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) != 1 || args[0].Type() != js.TypeString {
			return `{"error":"Expected one JSON string.","field":""}`
		}
		return engine.Handle(args[0].String())
	}))
	// Terrain replies carry their arrays as Float32Array views, never as
	// JSON numbers: { json, heights, cover }, or the refusal JSON alone.
	js.Global().Set("threeBodyTerrain", js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) != 1 || args[0].Type() != js.TypeString {
			return `{"error":"Expected one JSON string.","field":""}`
		}
		meta, heights, cover := engine.Terrain(args[0].String())
		if heights == nil {
			return meta
		}
		return map[string]any{"json": meta, "heights": floats(heights), "cover": floats(cover)}
	}))
	// A run whose places come back as one Float32Array beside the JSON:
	// { json, floats }, or the refusal JSON alone.
	js.Global().Set("threeBodyFloats", js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) != 1 || args[0].Type() != js.TypeString {
			return `{"error":"Expected one JSON string.","field":""}`
		}
		meta, out := engine.Floats(args[0].String())
		if out == nil {
			return meta
		}
		return map[string]any{"json": meta, "floats": floats(out)}
	}))
	// Pictures go in and come out as Uint8Arrays beside the JSON:
	// (json, bytes?) gives { json, bytes }, or the refusal JSON alone.
	js.Global().Set("threeBodyBytes", js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) < 1 || len(args) > 2 || args[0].Type() != js.TypeString {
			return `{"error":"Expected a JSON string and, at most, bytes.","field":""}`
		}
		var in []byte
		if len(args) == 2 && args[1].InstanceOf(js.Global().Get("Uint8Array")) {
			in = make([]byte, args[1].Length())
			js.CopyBytesToGo(in, args[1])
		}
		meta, out := engine.Bytes(args[0].String(), in)
		if out == nil {
			return meta
		}
		bytes := js.Global().Get("Uint8Array").New(len(out))
		js.CopyBytesToJS(bytes, out)
		return map[string]any{"json": meta, "bytes": bytes}
	}))
	select {}
}

// floats copies a slice into a new Float32Array. WebAssembly and every
// browser are little-endian, so the bytes are copied as they lie.
func floats(v []float32) js.Value {
	raw := unsafe.Slice((*byte)(unsafe.Pointer(unsafe.SliceData(v))), 4*len(v))
	bytes := js.Global().Get("Uint8Array").New(len(raw))
	js.CopyBytesToJS(bytes, raw)
	return js.Global().Get("Float32Array").New(bytes.Get("buffer"), 0, len(v))
}
