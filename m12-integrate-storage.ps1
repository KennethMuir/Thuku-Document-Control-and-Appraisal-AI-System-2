$ErrorActionPreference = "Stop"

$serverPath = "apps\api\src\server.ts"
$content = Get-Content $serverPath -Raw

# ============================================================
# 1. Add storage service import
# ============================================================

$anchor = 'import { ocrPdf } from "./services/ocr.js";'

if (-not $content.Contains($anchor)) {
    throw "M12 step 1 failed: OCR import not found."
}

if (-not $content.Contains('from "./services/storage.js"')) {
    $replacement = $anchor + "`r`nimport { LocalFileStorage } from `"./services/storage.js`";"
    $content = $content.Replace($anchor, $replacement)
}

# ============================================================
# 2. Instantiate LocalFileStorage
# ============================================================

$anchor = 'fs.mkdirSync(temporaryRoot, { recursive: true });'

if (-not $content.Contains($anchor)) {
    throw "M12 step 2 failed: temporaryRoot initialization not found."
}

if (-not $content.Contains('const localFileStorage')) {
    $replacement = $anchor + "`r`n`r`nconst localFileStorage =`r`n  new LocalFileStorage(`r`n    storageRoot`r`n  );"
    $content = $content.Replace($anchor, $replacement)
}

# ============================================================
# 3. Replace EXACT upload storage block
# ============================================================

$old = @"
        targetPath =
          path.join(
            storageRoot,
            `${documentCode}${extension}`
          );

        await fs.promises.rename(
          temporaryPath,
          targetPath
        );

        const extracted =
          await extractDocumentContent(
            targetPath,
            extension,
            originalName
          );
"@

$new = @"
        const storedFilename =
          `${documentCode}${extension}`;

        const storedDocument =
          await localFileStorage.store(
            temporaryPath,
            storedFilename
          );

        targetPath =
          storedDocument.localPath;

        const extracted =
          await extractDocumentContent(
            storedDocument.localPath,
            extension,
            originalName
          );
"@

if (-not $content.Contains($old)) {
    throw "M12 step 3 failed: exact upload storage block from lines 3287-3303 was not found."
}

$content = $content.Replace($old, $new)

# ============================================================
# 4. Add authenticated owner immediately after temporaryPath
# ============================================================

$anchor = @"
    const temporaryPath =
      req.file.path;
"@

if (-not $content.Contains($anchor)) {
    throw "M12 step 4 failed: temporaryPath block not found."
}

if (-not $content.Contains('const ownerUser')) {
    $replacement = @"
    const temporaryPath =
      req.file.path;

    const authenticatedRequest =
      req as AuthenticatedRequest;

    const ownerUser =
      authenticatedRequest.authUser;

    if (!ownerUser) {
      await fs.promises.unlink(
        temporaryPath
      ).catch(() => undefined);

      return res.status(401).json({
        success: false,
        error:
          "Authentication required",
      });
    }
"@

    $content = $content.Replace($anchor, $replacement)
}

# ============================================================
# 5. Add owner_user_id to documents INSERT
# ============================================================

$old = @"
                filename,
                title,
                document_date,
"@

$new = @"
                filename,
                title,
                owner_user_id,
                document_date,
"@

if (-not $content.Contains($old)) {
    throw "M12 step 5a failed: documents column block not found."
}

$content = $content.Replace($old, $new)

# Find the exact document parameter sequence.
$old = @"
              documentCode,
              uploadNumber,
              originalName,
              extracted.title,
              extracted.date,
"@

$new = @"
              documentCode,
              uploadNumber,
              originalName,
              extracted.title,
              ownerUser.id,
              extracted.date,
"@

if (-not $content.Contains($old)) {
    throw "M12 step 5b failed: documents parameter block not found."
}

$content = $content.Replace($old, $new)

# Add the extra placeholder to the documents VALUES block.
$old = @"
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10
"@

$new = @"
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11
"@

if (-not $content.Contains($old)) {
    throw "M12 step 5c failed: documents VALUES block not found."
}

$content = $content.Replace($old, $new)

# ============================================================
# 6. Add storage provider/reference to document_files
# ============================================================

$old = @"
              storage_path,
              mime_type,
              file_size
"@

$new = @"
              storage_path,
              storage_provider,
              storage_reference,
              mime_type,
              file_size
"@

if (-not $content.Contains($old)) {
    throw "M12 step 6a failed: document_files column block not found."
}

$content = $content.Replace($old, $new)

# The document_files VALUES block is separate from the documents
# VALUES block, so target the exact six-placeholder sequence.
$old = @"
              $1,
              $2,
              $3,
              $4,
              $5,
              $6
            )
"@

$new = @"
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8
            )
"@

if (-not $content.Contains($old)) {
    throw "M12 step 6b failed: document_files VALUES block not found."
}

$content = $content.Replace($old, $new)

$old = @"
            documentId,
            originalName,
            `${documentCode}${extension}`,
            targetPath,
            req.file.mimetype || null,
            req.file.size
"@

$new = @"
            documentId,
            originalName,
            `${documentCode}${extension}`,
            targetPath,
            storedDocument.provider,
            storedDocument.reference,
            req.file.mimetype || null,
            req.file.size
"@

if (-not $content.Contains($old)) {
    throw "M12 step 6c failed: document_files parameter block not found."
}

$content = $content.Replace($old, $new)

# ============================================================
# 7. Replace file retrieval SELECT
# ============================================================

$old = @"
            SELECT
              original_filename,
              stored_filename,
              storage_path,
              mime_type
            FROM document_files
            WHERE document_id = $1
"@

$new = @"
            SELECT
              df.original_filename,
              df.stored_filename,
              df.storage_provider,
              df.storage_reference,
              df.mime_type,
              d.owner_user_id
            FROM document_files df
            INNER JOIN documents d
              ON d.id = df.document_id
            WHERE df.document_id = $1
"@

if (-not $content.Contains($old)) {
    throw "M12 step 7 failed: existing file retrieval SELECT was not found."
}

$content = $content.Replace($old, $new)

# ============================================================
# 8. Replace direct storage_path file access
# ============================================================

$old = @"
      if (
        !fs.existsSync(
          file.storage_path
        )
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Stored document file is missing",
        });
      }

      res.setHeader(
        "Content-Type",
        file.mime_type ||
          "application/octet-stream"
      );

      res.setHeader(
        "Content-Disposition",
        `inline; filename="${String(
          file.original_filename
        ).replace(/"/g, "")}"`
      );

      return res.sendFile(
        path.resolve(
          file.storage_path
        )
      );
"@

$new = @"
      const authenticatedRequest =
        req as AuthenticatedRequest;

      const authenticatedUser =
        authenticatedRequest.authUser;

      if (!authenticatedUser) {
        return res.status(401).json({
          success: false,
          error:
            "Authentication required",
        });
      }

      const isOwner =
        Number(file.owner_user_id) ===
        authenticatedUser.id;

      const isPrivilegedReviewer =
        authenticatedUser.role === "ADMIN" ||
        authenticatedUser.role === "APPRAISER";

      if (
        !isOwner &&
        !isPrivilegedReviewer
      ) {
        return res.status(403).json({
          success: false,
          error:
            "You do not have access to this document file",
        });
      }

      const storageProvider =
        String(
          file.storage_provider || ""
        ).toUpperCase();

      if (
        storageProvider !== "LOCAL"
      ) {
        return res.status(500).json({
          success: false,
          error:
            `Storage provider '${storageProvider}' is not available yet`,
        });
      }

      if (
        !file.storage_reference
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Stored document file has no storage reference",
        });
      }

      const fileExists =
        await localFileStorage.exists(
          file.storage_reference
        );

      if (!fileExists) {
        return res.status(404).json({
          success: false,
          error:
            "Stored document file is missing",
        });
      }

      const localPath =
        localFileStorage.resolve(
          file.storage_reference
        );

      res.setHeader(
        "Content-Type",
        file.mime_type ||
          "application/octet-stream"
      );

      res.setHeader(
        "Content-Disposition",
        `inline; filename="${String(
          file.original_filename
        ).replace(/"/g, "")}"`
      );

      return res.sendFile(
        localPath
      );
"@

if (-not $content.Contains($old)) {
    throw "M12 step 8 failed: existing direct file retrieval block was not found."
}

$content = $content.Replace($old, $new)

# ============================================================
# 9. Final validation before saving
# ============================================================

$required = @(
    'import { LocalFileStorage }',
    'const localFileStorage',
    'await localFileStorage.store(',
    'const ownerUser',
    'owner_user_id',
    'storedDocument.provider',
    'storedDocument.reference',
    'df.storage_provider',
    'df.storage_reference',
    'const isOwner',
    'await localFileStorage.exists(',
    'localFileStorage.resolve('
)

foreach ($item in $required) {
    if (-not $content.Contains($item)) {
        throw "M12 final validation failed: missing '$item'. server.ts was NOT written."
    }
}

# ============================================================
# 10. Save only after every step succeeded
# ============================================================

$content.TrimEnd() + "`r`n" |
    Set-Content $serverPath -Encoding utf8

Write-Host ""
Write-Host "M12 SERVER STORAGE INTEGRATION APPLIED SUCCESSFULLY." -ForegroundColor Green
