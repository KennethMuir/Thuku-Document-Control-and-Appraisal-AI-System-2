import { promises as fs } from "node:fs";
import path from "node:path";

export type StorageProvider =
  | "LOCAL"
  | "SERVER"
  | "CLOUD";

export type StoredDocument = {
  provider: StorageProvider;
  reference: string;
  localPath: string;
};

export interface FileStorageService {
  store(
    temporaryPath: string,
    storedFilename: string
  ): Promise<StoredDocument>;

  exists(
    reference: string
  ): Promise<boolean>;

  resolve(
    reference: string
  ): string;

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
      localPath: targetPath,
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
