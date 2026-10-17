import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { writeAtomicTextFile } from "../src/services/atomicFileWrite.js";

test("atomic text writes preserve complete content and clean temporary files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "atomic-state-test-"));

  try {
    const destination = path.join(root, "upload.tmp.json");
    const firstState = JSON.stringify({
      token: "test-token",
      temporaryPath: path.join(root, "upload.tmp"),
      recoveryStatus: "RECOVERY_PENDING",
    });

    await writeAtomicTextFile(destination, firstState);

    assert.equal(await readFile(destination, "utf8"), firstState);
    assert.deepEqual(await readdir(root), ["upload.tmp.json"]);

    const secondState = JSON.stringify({
      token: "test-token",
      temporaryPath: path.join(root, "upload.tmp"),
      recoveryReference: path.join(root, "stored-file"),
      recoveryStatus: "RECOVERY_PENDING",
    });

    await writeAtomicTextFile(destination, secondState);

    assert.equal(await readFile(destination, "utf8"), secondState);
    assert.deepEqual(JSON.parse(await readFile(destination, "utf8")), {
      token: "test-token",
      temporaryPath: path.join(root, "upload.tmp"),
      recoveryReference: path.join(root, "stored-file"),
      recoveryStatus: "RECOVERY_PENDING",
    });
    assert.deepEqual(await readdir(root), ["upload.tmp.json"]);

    await assert.rejects(
      writeAtomicTextFile(path.join(root, "missing", "state.json"), "{}")
    );

    assert.equal(await readFile(destination, "utf8"), secondState);
    assert.deepEqual(await readdir(root), ["upload.tmp.json"]);

    console.log("PASS: complete JSON state is written.");
    console.log("PASS: subsequent writes replace the state without changing its format.");
    console.log("PASS: temporary siblings are cleaned after success.");
    console.log("PASS: failed writes preserve the previous valid state.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});