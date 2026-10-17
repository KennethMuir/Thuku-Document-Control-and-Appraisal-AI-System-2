import { constants, createReadStream, promises as fs } from "node:fs";
import type { Readable } from "node:stream";
import path from "node:path";

export type StorageProvider =
  | "LOCAL"
  | "SERVER"
  | "CLOUD";

export type StoredDocument = {
  provider: StorageProvider;
  reference: string;
};

export interface FileStorageService {
  store(
    temporaryPath: string,
    storedFilename: string
  ): Promise<StoredDocument>;

  exists(
    reference: string
  ): Promise<boolean>;

  openReadStream(reference: string): Readable;

  restore(
    reference: string,
    temporaryPath: string
  ): Promise<void>;

  delete(
    reference: string
  ): Promise<void>;
}

export class LocalFileStorage
  implements FileStorageService
{
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async store(
    temporaryPath: string,
    storedFilename: string
  ): Promise<StoredDocument> {
    const targetPath = path.join(
      this.root,
      storedFilename
    );

    await fs.rename(
      temporaryPath,
      targetPath
    );

    return {
      provider: "LOCAL",
      reference: targetPath,
    };
  }

  async exists(
    reference: string
  ): Promise<boolean> {
    try {
      await fs.access(
        this.resolve(reference)
      );
      return true;
    } catch {
      return false;
    }
  }

  openReadStream(reference: string): Readable {
    return createReadStream(this.resolve(reference));
  }

  async restore(
    reference: string,
    temporaryPath: string
  ): Promise<void> {
    const sourcePath = this.resolve(reference);

    // Copy without overwriting the destination. Keep the stored source
    // until the caller has verified the restored file's integrity.
    await fs.copyFile(
      sourcePath,
      temporaryPath,
      constants.COPYFILE_EXCL
    );
  }

  resolve(
    reference: string
  ): string {
    return path.resolve(reference);
  }

  async delete(
    reference: string
  ): Promise<void> {
    try {
      await fs.unlink(
        this.resolve(reference)
      );
    } catch (error) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error
          ? error.code
          : undefined;

      if (code === "ENOENT") {
        return;
      }

      throw error;
    }
  }
}
