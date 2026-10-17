import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";

/**
 * Atomically replaces a file using a unique temporary sibling.
 * The temporary file is on the same filesystem as the destination.
 */
export async function writeAtomicTextFile(
  destinationPath: string,
  contents: string
): Promise<void> {
  const temporaryPath =
    `${destinationPath}.${randomUUID()}.tmp`;

  try {
    await fs.writeFile(temporaryPath, contents, {
      encoding: "utf8",
      flag: "wx",
    });

    await fs.rename(temporaryPath, destinationPath);
  } finally {
    await fs.unlink(temporaryPath).catch(() => undefined);
  }
}
