const fs = require("fs");
const path = require("path");

const root = process.cwd();
const pkgRoot = path.join(root, "node_modules", "@mui", "icons-material");
const esmDir = path.join(pkgRoot, "esm");

const variants = ["", "Outlined", "Rounded", "Sharp", "TwoTone"];

function ensureAlias(targetDir, sourceBase, aliasBase, extension) {
  const sourceFile = path.join(targetDir, `${sourceBase}${extension}`);
  const aliasFile = path.join(targetDir, `${aliasBase}${extension}`);

  if (!fs.existsSync(sourceFile) || fs.existsSync(aliasFile)) {
    return;
  }

  if (extension === ".js") {
    const isEsm = targetDir.endsWith(path.sep + "esm");
    const content = isEsm
      ? `export { default } from "./${sourceBase}.js";\n`
      : `'use strict';\nmodule.exports = require("./${sourceBase}.js");\n`;
    try {
      fs.writeFileSync(aliasFile, content, "utf8");
    } catch (error) {
      console.warn(
        `[fix-mui-icons] Skip ${path.basename(aliasFile)}: ${error.code || error.message}`
      );
    }
    return;
  }

  if (extension === ".d.ts") {
    const content = `export { default } from "./${sourceBase}.js";\n`;
    try {
      fs.writeFileSync(aliasFile, content, "utf8");
    } catch (error) {
      console.warn(
        `[fix-mui-icons] Skip ${path.basename(aliasFile)}: ${error.code || error.message}`
      );
    }
  }
}

function runFixes() {
  if (!fs.existsSync(pkgRoot)) {
    console.log("[fix-mui-icons] @mui/icons-material not found, skipping.");
    return;
  }

  for (const variant of variants) {
    const sourceBase = `Dialpad${variant}`;
    const aliasBase = `DialerSip${variant}`;

    ensureAlias(pkgRoot, sourceBase, aliasBase, ".js");
    ensureAlias(pkgRoot, sourceBase, aliasBase, ".d.ts");
    ensureAlias(esmDir, sourceBase, aliasBase, ".js");
    ensureAlias(esmDir, sourceBase, aliasBase, ".d.ts");
  }

  console.log("[fix-mui-icons] Aliases checked.");
}

runFixes();
