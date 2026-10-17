import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { test } from "node:test";

import {
  recoverProvisionalUpload,
  type RecoveryState,
} from "../src/services/provisionalUploadRecovery.js";

const payload = "verified provisional upload content";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function makeState(
  overrides: Partial<RecoveryState> = {}
): RecoveryState {
  return {
    temporaryPath: "test-provisional-file",
    sha256Hash: sha256(payload),
    recoveryReference: "test-stored-reference",
    recoveryProvider: "LOCAL",
    recoveryFilename: "DOC-TEST.pdf",
    recoveryStatus: "RECOVERY_PENDING",
    ...overrides,
  };
}

function makeHarness(options: {
  exists?: boolean;
  content?: string;
  streamError?: Error;
  persistError?: Error;
} = {}) {
  let existsCalls = 0;
  let streamCalls = 0;
  let persistCalls = 0;

  const dependencies = {
    storage: {
      async exists(_reference: string): Promise<boolean> {
        existsCalls += 1;
        return options.exists ?? true;
      },
      openReadStream(_reference: string): Readable {
        streamCalls += 1;
        if (options.streamError) {
          throw options.streamError;
        }
        return Readable.from([
          Buffer.from(options.content ?? payload),
        ]);
      },
    },
    async persist(_state: RecoveryState): Promise<void> {
      persistCalls += 1;
      if (options.persistError) {
        throw options.persistError;
      }
    },
  };

  return {
    dependencies,
    counts: () => ({ existsCalls, streamCalls, persistCalls }),
  };
}

test("non-pending uploads are not changed", async () => {
  const harness = makeHarness();
  const result = await recoverProvisionalUpload(
    makeState({ recoveryStatus: undefined }),
    harness.dependencies
  );

  assert.deepEqual(result, { status: "NOT_PENDING" });
  assert.deepEqual(harness.counts(), {
    existsCalls: 0,
    streamCalls: 0,
    persistCalls: 0,
  });
});

test("verified stored file is reused without restoring or deleting it", async () => {
  const harness = makeHarness();
  const state = makeState();

  const result = await recoverProvisionalUpload(
    state,
    harness.dependencies
  );

  assert.deepEqual(result, {
    status: "RECOVERED",
    cleanupDeferred: true,
  });
  assert.deepEqual(harness.counts(), {
    existsCalls: 1,
    streamCalls: 1,
    persistCalls: 1,
  });
  assert.equal(state.recoveryReference, "test-stored-reference");
  assert.equal(state.recoveryProvider, "LOCAL");
  assert.equal(state.recoveryFilename, "DOC-TEST.pdf");
  assert.equal(state.recoveryStatus, "RECOVERY_PENDING");
});

test("incomplete recovery metadata remains blocked", async () => {
  const harness = makeHarness();
  const state = makeState({ recoveryFilename: undefined });

  const result = await recoverProvisionalUpload(
    state,
    harness.dependencies
  );

  assert.deepEqual(result, { status: "RECOVERY_PENDING" });
  assert.deepEqual(harness.counts(), {
    existsCalls: 0,
    streamCalls: 0,
    persistCalls: 0,
  });
});

test("missing stored reference remains pending", async () => {
  const harness = makeHarness({ exists: false });

  const result = await recoverProvisionalUpload(
    makeState(),
    harness.dependencies
  );

  assert.deepEqual(result, { status: "RECOVERY_PENDING" });
  assert.equal(harness.counts().streamCalls, 0);
  assert.equal(harness.counts().persistCalls, 0);
});

test("hash mismatch blocks recovery without persisting state", async () => {
  const harness = makeHarness({ content: "different content" });

  const result = await recoverProvisionalUpload(
    makeState(),
    harness.dependencies
  );

  assert.deepEqual(result, { status: "HASH_MISMATCH" });
  assert.equal(harness.counts().persistCalls, 0);
});

test("persistence failure is reported and leaves recovery pending", async () => {
  const harness = makeHarness({
    persistError: new Error("simulated state write failure"),
  });

  const result = await recoverProvisionalUpload(
    makeState(),
    harness.dependencies
  );

  assert.equal(result.status, "STATE_WRITE_FAILED");
  if (result.status === "STATE_WRITE_FAILED") {
    assert.match(String(result.error), /state write failure/);
  }
});

test("stored-file read failure remains pending", async () => {
  const harness = makeHarness({
    streamError: new Error("simulated read failure"),
  });

  const result = await recoverProvisionalUpload(
    makeState(),
    harness.dependencies
  );

  assert.deepEqual(result, { status: "RECOVERY_PENDING" });
  assert.equal(harness.counts().persistCalls, 0);
});