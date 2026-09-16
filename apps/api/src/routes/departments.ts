import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";
import {
  requireAuthentication,
  requireRole,
} from "../middleware/auth.js";

export function createDepartmentsRouter(
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
            code,
            description
          FROM departments
          ORDER BY name
        `);

      res.json({
        success: true,
        departments:
          result.rows,
      });
    } catch (error) {
      console.error(
        "Departments query failed:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to retrieve departments",
      });
    }
  }
);

router.post(
  "/",
  requireAuthentication(pool),
  requireRole("ADMIN"),
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const name =
        typeof req.body?.name === "string"
          ? req.body.name.trim()
          : "";

      const code =
        typeof req.body?.code === "string"
          ? req.body.code.trim().toUpperCase()
          : "";

      const description =
        typeof req.body?.description === "string" &&
        req.body.description.trim()
          ? req.body.description.trim()
          : null;

      if (!name || !code) {
        return res.status(400).json({
          success: false,
          error:
            "Department name and code are required.",
        });
      }

      const result =
        await pool.query(
          `
            INSERT INTO departments (
              name,
              code,
              description
            )
            VALUES ($1, $2, $3)
            RETURNING
              id,
              name,
              code,
              description
          `,
          [
            name,
            code,
            description,
          ]
        );

      return res.status(201).json({
        success: true,
        department:
          result.rows[0],
      });
    } catch (error: any) {
      if (
        error?.code === "23505"
      ) {
        return res.status(409).json({
          success: false,
          error:
            "A department with that name or code already exists.",
        });
      }

      console.error(
        "Department creation failed:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to create department.",
      });
    }
  }
);

router.post(
  "/:departmentId",
  requireAuthentication(pool),
  requireRole("ADMIN"),
  async (
    req: Request,
    res: Response
  ) => {
    const departmentId =
      Number(
        req.params.departmentId
      );

    try {
      if (
        !Number.isInteger(departmentId) ||
        departmentId <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid department ID.",
        });
      }

      const name =
        typeof req.body?.name === "string"
          ? req.body.name.trim()
          : "";

      const code =
        typeof req.body?.code === "string"
          ? req.body.code.trim().toUpperCase()
          : "";

      const description =
        typeof req.body?.description === "string" &&
        req.body.description.trim()
          ? req.body.description.trim()
          : null;

      if (!name || !code) {
        return res.status(400).json({
          success: false,
          error:
            "Department name and code are required.",
        });
      }

      const result =
        await pool.query(
          `
            UPDATE departments
            SET
              name = $1,
              code = $2,
              description = $3
            WHERE id = $4
            RETURNING
              id,
              name,
              code,
              description
          `,
          [
            name,
            code,
            description,
            departmentId,
          ]
        );

      if (
        result.rowCount === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Department not found.",
        });
      }

      return res.json({
        success: true,
        department:
          result.rows[0],
      });
    } catch (error: any) {
      if (
        error?.code === "23505"
      ) {
        return res.status(409).json({
          success: false,
          error:
            "A department with that name or code already exists.",
        });
      }

      console.error(
        "Department update failed:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to update department.",
      });
    }
  }
);

router.post(
  "/:departmentId/delete",
  requireAuthentication(pool),
  requireRole("ADMIN"),
  async (
    req: Request,
    res: Response
  ) => {
    const departmentId =
      Number(
        req.params.departmentId
      );

    try {
      if (
        !Number.isInteger(departmentId) ||
        departmentId <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid department ID.",
        });
      }

      const result =
        await pool.query(
          `
            DELETE FROM departments
            WHERE id = $1
            RETURNING
              id,
              name,
              code
          `,
          [departmentId]
        );

      if (
        result.rowCount === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Department not found.",
        });
      }

      return res.json({
        success: true,
        department:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "Department deletion failed:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to delete department.",
      });
    }
  }
);
  return router;
}