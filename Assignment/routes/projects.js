const express = require("express");
const { body, validationResult } = require("express-validator");
const { authenticate } = require("../middleware/auth");
const { db } = require("../db");

const router = express.Router();

async function getMembership(projectId, userId) {
  return db("project_members")
    .where({ project_id: projectId, user_id: userId })
    .first();
}

async function ensureProjectMember(projectId, userId) {
  const membership = await getMembership(projectId, userId);
  if (!membership) {
    const error = new Error("Not a member of this project");
    error.status = 403;
    throw error;
  }
  return membership;
}

async function ensureProjectAdmin(projectId, userId) {
  const membership = await ensureProjectMember(projectId, userId);
  if (membership.role !== "Admin") {
    const error = new Error("Admin access required");
    error.status = 403;
    throw error;
  }
  return membership;
}

router.get("/", authenticate, async (req, res, next) => {
  try {
    const projects = await db("projects")
      .join("project_members", "projects.id", "project_members.project_id")
      .where("project_members.user_id", req.user.id)
      .select(
        "projects.id",
        "projects.name",
        "projects.description",
        "projects.due_date",
        "projects.owner_id",
        "project_members.role",
      );
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  authenticate,
  body("name").trim().notEmpty(),
  body("description").optional().trim(),
  body("due_date").optional().isDate(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, due_date } = req.body;
      const [projectId] = await db("projects").insert({
        name,
        description,
        due_date,
        owner_id: req.user.id,
      });
      const project = await db("projects").where({ id: projectId }).first();

      await db("project_members").insert({
        project_id: project.id,
        user_id: req.user.id,
        role: "Admin",
      });
      res.json(project);
    } catch (error) {
      next(error);
    }
  },
);

router.get("/:projectId", authenticate, async (req, res, next) => {
  try {
    const projectId = Number(req.params.projectId);
    await ensureProjectMember(projectId, req.user.id);

    const project = await db("projects").where({ id: projectId }).first();
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const members = await db("project_members")
      .join("users", "project_members.user_id", "users.id")
      .where("project_members.project_id", projectId)
      .select("users.id", "users.name", "users.email", "project_members.role");

    const tasks = await db("tasks")
      .leftJoin("users", "tasks.assigned_to", "users.id")
      .where("tasks.project_id", projectId)
      .select(
        "tasks.id",
        "tasks.title",
        "tasks.description",
        "tasks.status",
        "tasks.due_date",
        "tasks.assigned_to",
        "users.name as assignee_name",
      )
      .orderBy("tasks.created_at", "desc");

    res.json({ project, members, tasks });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/:projectId",
  authenticate,
  body("name").optional().trim().notEmpty(),
  body("description").optional().trim(),
  body("due_date").optional().isDate(),
  async (req, res, next) => {
    try {
      const projectId = Number(req.params.projectId);
      await ensureProjectAdmin(projectId, req.user.id);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updates = {};
      ["name", "description", "due_date"].forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }

      await db("projects").where({ id: projectId }).update(updates);
      const project = await db("projects").where({ id: projectId }).first();
      res.json(project);
    } catch (error) {
      next(error);
    }
  },
);

router.delete("/:projectId", authenticate, async (req, res, next) => {
  try {
    const projectId = Number(req.params.projectId);
    await ensureProjectAdmin(projectId, req.user.id);
    await db("projects").where({ id: projectId }).del();
    res.json({ message: "Project deleted" });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:projectId/members",
  authenticate,
  body("email").isEmail().normalizeEmail(),
  body("role").optional().isIn(["Admin", "Member"]),
  async (req, res, next) => {
    try {
      const projectId = Number(req.params.projectId);
      await ensureProjectAdmin(projectId, req.user.id);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, role = "Member" } = req.body;
      const user = await db("users").where({ email }).first();
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const exists = await db("project_members")
        .where({ project_id: projectId, user_id: user.id })
        .first();
      if (exists) {
        await db("project_members").where({ id: exists.id }).update({ role });
        return res.json({ message: "Project role updated" });
      }

      await db("project_members").insert({
        project_id: projectId,
        user_id: user.id,
        role,
      });
      res.json({
        message: "Member added",
        member: { id: user.id, name: user.name, email: user.email, role },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ message: err.message || "Server error" });
});

module.exports = router;
