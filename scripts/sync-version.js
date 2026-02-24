/**
 * Syncs the version from root package.json into all workspace package.json files.
 * Run before electron-builder so the installer picks up the correct version.
 */
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"));
const version = rootPkg.version;

const workspaces = ["packages/shared", "packages/backend", "packages/frontend"];

for (const ws of workspaces) {
  const pkgPath = path.join(rootDir, ws, "package.json");
  if (!fs.existsSync(pkgPath)) continue;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  if (pkg.version !== version) {
    console.log(`${ws}: ${pkg.version} -> ${version}`);
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  } else {
    console.log(`${ws}: already at ${version}`);
  }
}

console.log(`All packages synced to v${version}`);
