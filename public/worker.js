/* Transport only: every simulation runs inside this worker. */
let ready = false;
(async () => {
  try {
    importScripts("./wasm_exec.js");
    const go = new Go();
    const response = await fetch("./engine.wasm");
    if (!response.ok) throw new Error("Could not load the simulation engine.");
    const { instance } = await WebAssembly.instantiate(
      await response.arrayBuffer(),
      go.importObject,
    );
    void go.run(instance);
    ready = true;
    postMessage({ type: "ready" });
  } catch (error) {
    postMessage({ type: "error", error: String(error) });
  }
})();
onmessage = ({ data }) => {
  if (!ready) return;
  let result;
  const transfer = [];
  try {
    if (data.request.action === "terrain") {
      // Large arrays arrive beside the JSON and are handed over, not copied.
      const reply = threeBodyTerrain(JSON.stringify(data.request));
      if (typeof reply === "string") result = JSON.parse(reply);
      else {
        result = JSON.parse(reply.json);
        result.heights = reply.heights;
        result.cover = reply.cover;
        transfer.push(reply.heights.buffer, reply.cover.buffer);
      }
    } else if (
      data.request.action === "painting" ||
      data.request.action === "snowflakes"
    ) {
      // Pictures travel as bytes in both directions.
      const reply = threeBodyBytes(JSON.stringify(data.request), data.bytes);
      if (typeof reply === "string") result = JSON.parse(reply);
      else {
        result = JSON.parse(reply.json);
        result.bytes = reply.bytes;
        transfer.push(reply.bytes.buffer);
      }
    } else result = JSON.parse(threeBody(JSON.stringify(data.request)));
  } catch {
    result = { error: "Something went wrong. Try again.", field: "" };
  }
  postMessage({ type: "result", id: data.id, result }, transfer);
};
