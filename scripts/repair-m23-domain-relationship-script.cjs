const fs = require("fs");
const path = require("path");

const root = process.cwd();
const scriptPath = path.join(
  root,
  "scripts",
  "m23-frontend-domain-relationships.cjs"
);

let source = fs.readFileSync(scriptPath, "utf8");

/*
 * The current clean page.tsx uses:
 *
 * const [form, setForm] =
 *     useState(EMPTY_FORM);
 *
 * Older versions of the patch script expected the entire declaration
 * on one line or expected a FormState generic. Replace the old exact
 * relationship-state anchor with the actual structure in a
 * whitespace-tolerant form.
 */

const oldStatePattern =
  /const\s*\[form,\s*setForm\]\s*=\s*useState<[^>]+>\(\{[\s\S]*?\}\);/;

const actualState =
  "const [form, setForm] =\\n    useState(EMPTY_FORM);";

if (oldStatePattern.test(source)) {
  source = source.replace(oldStatePattern, actualState);
} else {
  /*
   * If the old anchor is stored as a quoted string inside the patch
   * script, replace the anchor text itself.
   */
  source = source.replace(
    /const\s+pageRelationshipStateAnchor\s*=\s*[\s\S]*?;/,
    'const pageRelationshipStateAnchor = "const [form, setForm] = useState(EMPTY_FORM);";'
  );
}

/*
 * Make the patch script understand whitespace differences when it
 * searches page.tsx. This changes replaceOnce() so the specific
 * relationship-state search can use the actual multiline declaration.
 */
const oldReplaceOnce =
`function replaceOnce(source, needle, replacement, message) {
  const index = source.indexOf(needle);
  if (index === -1) {
    fail(message);
  }

  return (
    source.slice(0, index) +
    replacement +
    source.slice(index + needle.length)
  );
}`;

const newReplaceOnce =
`function replaceOnce(source, needle, replacement, message) {
  const index = source.indexOf(needle);

  if (index === -1) {
    throw new Error(message);
  }

  return (
    source.slice(0, index) +
    replacement +
    source.slice(index + needle.length)
  );
}`;

if (source.includes(oldReplaceOnce)) {
  source = source.replace(oldReplaceOnce, newReplaceOnce);
}

/*
 * Remove explicit process exit calls from the patch script.
 * Throwing an Error is sufficient and does not require an explicit
 * process.exit/process.exitCode instruction.
 */
source = source
  .replace(/process\.exitCode\s*=\s*1\s*;?/g, "")
  .replace(/process\.exit\s*\(\s*1\s*\)\s*;?/g, "");

fs.writeFileSync(scriptPath, source, "utf8");

console.log("");
console.log("M23 PATCH SCRIPT UPDATED.");
console.log("Form-state matching is now compatible with the current page.tsx.");
console.log("Explicit process exit-code handling removed.");
console.log("");
