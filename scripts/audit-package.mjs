import { execFileSync } from "node:child_process";

const output = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  encoding: "utf8",
});
const [report] = JSON.parse(output);
if (!report || !Array.isArray(report.files)) throw new Error("npm did not return a pack manifest");

const paths = report.files.map((file) => file.path);
const required = ["package.json", "README.md", "LICENSE", "CHANGELOG.md"];
for (const path of required) {
  if (!paths.includes(path)) throw new Error(`Published package is missing ${path}`);
}
if (
  !paths.some((path) => path === "dist/index.js") ||
  !paths.some((path) => path === "dist/index.cjs")
) {
  throw new Error("Published package is missing ESM or CommonJS entry points");
}

const allowedRoots = ["dist/", "README.md", "LICENSE", "CHANGELOG.md", "package.json"];
const unexpected = paths.filter(
  (path) => !allowedRoots.some((allowed) => path === allowed || path.startsWith(allowed)),
);
if (unexpected.length > 0) throw new Error(`Unexpected published files: ${unexpected.join(", ")}`);

process.stdout.write(
  `Package audit passed: ${report.name}@${report.version}, ${paths.length} files, ${report.size} bytes.\n`,
);
