const fs = require("fs");
const path = require("path");

const scriptPath =
  ".\\scripts\\m23-frontend-domain-relationships-final.cjs";

let script =
  fs.readFileSync(scriptPath, "utf8");

/*
 * Replace the brittle insertAfterExact() implementation with one
 * that first tries an exact match and then performs a whitespace-
 * tolerant match.
 */
const startMarker =
  "function insertAfterExact(text, anchor, insertion, description) {";

const start =
  script.indexOf(startMarker);

if (start < 0) {
  throw new Error(
    "Could not locate insertAfterExact() in the final M23 patch script."
  );
}

let depth = 0;
let bodyEnd = -1;
let started = false;
let quote = null;
let escaped = false;

for (
  let i = start;
  i < script.length;
  i++
) {
  const ch = script[i];

  if (quote) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === quote) {
      quote = null;
    }

    continue;
  }

  if (
    ch === "'" ||
    ch === '"' ||
    ch === "`"
  ) {
    quote = ch;
    continue;
  }

  if (ch === "{") {
    depth++;
    started = true;
    continue;
  }

  if (ch === "}") {
    depth--;

    if (
      started &&
      depth === 0
    ) {
      bodyEnd = i + 1;
      break;
    }
  }
}

if (bodyEnd < 0) {
  throw new Error(
    "Could not determine the end of insertAfterExact()."
  );
}

const replacement = String.raw`
function insertAfterExact(
  text,
  anchor,
  insertion,
  description
) {
  /*
   * First attempt the exact anchor.
   */
  const exactIndex =
    text.indexOf(anchor);

  if (exactIndex >= 0) {
    const secondExact =
      text.indexOf(
        anchor,
        exactIndex + anchor.length
      );

    if (secondExact >= 0) {
      throw new Error(
        "Expected exactly one occurrence of " +
          description +
          ", but found more than one."
      );
    }

    return (
      text.slice(
        0,
        exactIndex + anchor.length
      ) +
      insertion +
      text.slice(
        exactIndex + anchor.length
      )
    );
  }

  /*
   * Exact formatting did not match.
   *
   * Build a whitespace-tolerant regular expression
   * from the supplied anchor. This allows differences such
   * as:
   *
   * import type {
   *   ...
   * }
   *
   * versus:
   *
   * import type {
   * ...
   * }
   *
   * without weakening the actual textual content.
   */
  const escaped =
    anchor.replace(
      /[.*+?^$()|[\]\\]/g,
      "\\$&"
    );

  const whitespaceTolerant =
    escaped.replace(
      /\\\s+/g,
      "\\s+"
    );

  const regex =
    new RegExp(
      whitespaceTolerant
    );

  const matches =
    Array.from(
      text.matchAll(
        new RegExp(
          regex.source,
          "g"
        )
      )
    );

  if (matches.length === 0) {
    throw new Error(
      "Could not locate " +
        description +
        "."
    );
  }

  if (matches.length !== 1) {
    throw new Error(
      "Expected exactly one occurrence of " +
        description +
        ", found " +
        matches.length +
        "."
    );
  }

  const match =
    matches[0];

  const index =
    match.index;

  return (
    text.slice(
      0,
      index + match[0].length
    ) +
    insertion +
    text.slice(
      index + match[0].length
    )
  );
}`;

script =
  script.slice(0, start) +
  replacement +
  script.slice(bodyEnd);

fs.writeFileSync(
  scriptPath,
  script,
  "utf8"
);

console.log(
  "Whitespace-tolerant insertAfterExact() installed."
);

console.log(
  "\n===== VERIFYING FINAL PATCH SCRIPT ====="
);

require("child_process").execFileSync(
  "node",
  ["--check", scriptPath],
  {
    stdio: "inherit"
  }
);

console.log(
  "Patch script syntax OK."
);

console.log(
  "\n===== RUNNING FINAL M23 FRONTEND PATCH ====="
);

require("child_process").execFileSync(
  "node",
  [scriptPath],
  {
    stdio: "inherit"
  }
);

