import { Router, type Request, type Response } from "express";
import { Pool } from "pg";
import { requireAuthentication } from "../middleware/auth.js";

export function createDocumentTypesRouter(
  pool: Pool
) {
  const router = Router();

router.get(
  "/",
  requireAuthentication(pool),
  async (
    _req: Request,
    res: Response
  ) => {
    try {
      const result =
        await pool.query(`
          SELECT
            id,
            name,
            description
          FROM document_types
          ORDER BY name
        `);

      res.json({
        success: true,
        documentTypes:
          result.rows,
      });
    } catch (error) {
      console.error(
        "Document types query failed:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to retrieve document types",
      });
    }
  }
);

  return router;
}
