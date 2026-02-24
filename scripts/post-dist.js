/**
 * Post-dist script: copies the NSIS installer
 * to a top-level `distribute/` folder with version in the filename.
 */
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const releaseDir = path.join(rootDir, "release");
const distributeDir = path.join(rootDir, "distribute");

// Read version from backend package.json
const backendPkg = JSON.parse(
  fs.readFileSync(path.join(rootDir, "packages", "backend", "package.json"), "utf-8")
);
const version = backendPkg.version;
const productName = backendPkg.build?.productName || "SignInSentinel";

// Ensure distribute/ exists
fs.mkdirSync(distributeDir, { recursive: true });

let copied = 0;

// Copy NSIS installer (e.g., "SignInSentinel Setup 0.5.0.exe")
const releaseFiles = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir) : [];
for (const file of releaseFiles) {
  if (file.endsWith(".exe") && file.toLowerCase().includes("setup")) {
    const src = path.join(releaseDir, file);
    const dest = path.join(distributeDir, `${productName}-Setup-${version}.exe`);
    fs.copyFileSync(src, dest);
    console.log(`Copied installer: ${dest}`);
    copied++;
    break;
  }
}

if (copied === 0) {
  console.warn("Warning: No installer found. Check that electron-builder completed successfully.");
  console.warn(`  Looked in: ${releaseDir}`);
  console.warn(`  Expected product name: ${productName}, version: ${version}`);
  if (fs.existsSync(releaseDir)) {
    console.warn(`  Found files: ${releaseFiles.join(", ")}`);
  }
} else {
  console.log(`\nDistribution files (v${version}) saved to: ${distributeDir}`);
}
