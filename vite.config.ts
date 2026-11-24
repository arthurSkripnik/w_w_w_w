import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// One self-contained HTML file in dist/, published as a claude.ai artifact.
export default defineConfig({
  plugins: [preact(), viteSingleFile()],
  build: { target: "es2022", cssCodeSplit: false, assetsInlineLimit: 100_000_000 },
});
