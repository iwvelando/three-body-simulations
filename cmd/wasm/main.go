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
