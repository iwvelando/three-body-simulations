import { execFileSync } from "node:child_process";
import { copyFileSync, chmodSync, existsSync } from "node:fs";
import { join } from "node:path";
execFileSync(
  "go",
  ["build", "-trimpath", "-o", "public/engine.wasm", "./cmd/wasm"],
  { stdio: "inherit", env: { ...process.env, GOOS: "js", GOARCH: "wasm" } },
);
const root = execFileSync("go", ["env", "GOROOT"], { encoding: "utf8" }).trim();
const license = existsSync(join(root, "LICENSE"))
  ? join(root, "LICENSE")
  : join(root, "../LICENSE");
for (const [src, dest] of [
  [join(root, "lib/wasm/wasm_exec.js"), "public/wasm_exec.js"],
  [license, "public/GO-LICENSE"],
]) {
  if (existsSync(dest)) chmodSync(dest, 0o644);
  copyFileSync(src, dest);
}
