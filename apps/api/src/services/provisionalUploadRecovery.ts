import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

export type RecoveryState = {
  temporaryPath: string;
  sha256Hash: string;
  recoveryReference?: string;
  recoveryProvider?: "LOCAL" | "SERVER" | "CLOUD";
  recoveryFilename?: string;
  recoveryStatus?: "RECOVERY_PENDING";
};

export type RecoveryStorage = {
  exists(reference: string): Promise<boolean>;
  openReadStream(reference: string): Readable;
};

export type RecoveryDependencies<T extends RecoveryState> = {
  storage: RecoveryStorage;
  persist(state: T): Promise<void>;
};

export type RecoveryResult =
  | { status: "NOT_PENDING" }
  | { status: "RECOVERED"; cleanupDeferred: true }
  | { status: "RECOVERY_PENDING" }
  | { status: "HASH_MISMATCH" }
  | { status: "STATE_WRITE_FAILED"; error: unknown };

async function calculateReferenceSha256(
  storage: RecoveryStorage,
  reference: string
): Promise<string> {
  const hash = createHash("sha256");
  const stream = storage.openReadStream(reference);

  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }

  return hash.digest("hex");
}

export async function recoverProvisionalUpload<T extends RecoveryState>(
  state: T,
  dependencies: RecoveryDependencies<T>
): Promise<RecoveryResult> {
  if (state.recoveryStatus !== "RECOVERY_PENDING") {
    return { status: "NOT_PENDING" };
  }

  const reference = state.recoveryReference;

  // Old recovery records without complete storage metadata remain blocked.
  if (!reference || !state.recoveryProvider || !state.recoveryFilename) {
    return { status: "RECOVERY_PENDING" };
  }

  try {
    if (!(await dependencies.storage.exists(reference))) {
      return { status: "RECOVERY_PENDING" };
    }
  } catch {
    return { status: "RECOVERY_PENDING" };
  }

  let actualHash: string;

  try {
    actualHash = await calculateReferenceSha256(
      dependencies.storage,
      reference
    );
  } catch {
    return { status: "RECOVERY_PENDING" };
  }

  if (actualHash !== state.sha256Hash) {
    return { status: "HASH_MISMATCH" };
  }

  try {
    await dependencies.persist({ ...state });
  } catch (error) {
    return { status: "STATE_WRITE_FAILED", error };
  }

  // The stored reference is verified in place. Never restore or delete files.
  return { status: "RECOVERED", cleanupDeferred: true };
}
