import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/openai-entry.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: "node20",
  platform: "node",
});
