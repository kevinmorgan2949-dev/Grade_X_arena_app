
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const output = path.join(root, "www");

const excluded = new Set([
  ".git",
  ".github",
  "node_modules",
  "www",
  "android",
  "scripts",
  ".gradle"
]);

const excludedFiles = new Set([
  "package.json",
  "package-lock.json",
  "capacitor.config.json",
  "README.md"
]);

function copyWebFiles(source, destination) {
  fs.mkdirSync(destination, { recursive: true });

  for (const item of fs.readdirSync(source, {
    withFileTypes: true
  })) {
    if (excluded.has(item.name) || excludedFiles.has(item.name)) {
      continue;
    }

    const from = path.join(source, item.name);
    const to = path.join(destination, item.name);

    if (item.isDirectory()) {
      copyWebFiles(from, to);
    } else if (item.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

fs.rmSync(output, { recursive: true, force: true });
copyWebFiles(root, output);

if (!fs.existsSync(path.join(output, "index.html"))) {
  console.error("ERROR: index.html was not copied.");
  process.exit(1);
}

console.log("GRADE X Arena web files prepared successfully.");
