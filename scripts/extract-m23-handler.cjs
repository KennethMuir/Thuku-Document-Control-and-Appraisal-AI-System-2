const fs = require("fs");

const file = ".\\apps\\web\\src\\app\\page.tsx";
const source = fs.readFileSync(file, "utf8");

const start = source.indexOf("const handleMetadataSubmit");

if (start < 0) {
  throw new Error("handleMetadataSubmit was not found.");
}

const open = source.indexOf("{", start);

if (open < 0) {
  throw new Error("Opening brace for handleMetadataSubmit was not found.");
}

let depth = 0;
let quote = null;
let escaped = false;
let lineComment = false;
let blockComment = false;

let close = -1;

for (let i = open; i < source.length; i++) {
  const c = source[i];
  const n = source[i + 1];

  if (lineComment) {
    if (c === "\n") {
      lineComment = false;
    }
    continue;
  }

  if (blockComment) {
    if (c === "*" && n === "/") {
      blockComment = false;
      i++;
    }
    continue;
  }

  if (quote) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (c === "\\") {
      escaped = true;
      continue;
    }

    if (c === quote) {
      quote = null;
    }

    continue;
  }

  if (c === "/" && n === "/") {
    lineComment = true;
    i++;
    continue;
  }

  if (c === "/" && n === "*") {
    blockComment = true;
    i++;
    continue;
  }

  if (c === "'" || c === '"' || c === "`") {
    quote = c;
    continue;
  }

  if (c === "{") {
    depth++;
  } else if (c === "}") {
    depth--;

    if (depth === 0) {
      close = i;
      break;
    }
  }
}

if (close < 0) {
  throw new Error("Closing brace for handleMetadataSubmit was not found.");
}

console.log("\n=== COMPLETE handleMetadataSubmit ===\n");
console.log(source.slice(start, close + 1));

console.log("\n=== BASELINE VERIFICATION ===\n");

for (const filePath of [
  ".\\apps\\web\\src\\app\\page.tsx",
  ".\\apps\\web\\src\\components\\modals\\Modals.tsx",
  ".\\apps\\web\\src\\components\\appraisal\\Appraisal.tsx"
]) {
  const crypto = require("crypto");
  const hash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex")
    .toUpperCase();

  console.log(`${hash}  ${filePath}`);
}
