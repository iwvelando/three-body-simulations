import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { readFileSync } from "node:fs";
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: mode === "lan" ? [basicSsl()] : [],
  build: { outDir: "dist" },
  preview: {
    headers: {
      "Content-Security-Policy": readFileSync(
        "deploy/content-security-policy.txt",
        "utf8",
      ).trim(),
    },
  },
}));
