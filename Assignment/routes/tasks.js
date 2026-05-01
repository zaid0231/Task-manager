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

router.get("/project/:projectId", authenticate, async (req, res, next) => {
  try {
    const projectId = Number(req.params.projectId);
    await ensureProjectMember(projectId, req.user.id);

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

    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/project/:projectId",
  authenticate,
  body("title").trim().notEmpty(),
  body("description").optional().trim(),
  body("status").optional().isIn(["todo", "in_progress", "done"]),
  body("assigned_to").optional().isInt(),
  body("due_date").optional().isDate(),
  async (req, res, next) => {
    try {
      const projectId = Number(req.params.projectId);
      await ensureProjectMember(projectId, req.user.id);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        description,
        assigned_to,
        due_date,
        status = "todo",
      } = req.body;
      const taskPayload = {
        project_id: projectId,
        title,
        description,
        status,
        due_date,
        completed_at: status === "done" ? db.fn.now() : null,
      };
      if (assigned_to) {
        const user = await db("users").where({ id: assigned_to }).first();
        if (!user) {
          return res.status(404).json({ message: "Assigned user not found" });
        }
        taskPayload.assigned_to = assigned_to;
      }

      const [taskId] = await db("tasks").insert(taskPayload);
      const task = await db("tasks").where({ id: taskId }).first();
      res.json(task);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:taskId",
  authenticate,
  body("title").optional().trim().notEmpty(),
  body("description").optional().trim(),
  body("status").optional().isIn(["todo", "in_progress", "done"]),
  body("assigned_to").optional().isInt(),
  body("due_date").optional().isDate(),
  async (req, res, next) => {
    try {
      const taskId = Number(req.params.taskId);
      const task = await db("tasks").where({ id: taskId }).first();
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const membership = await ensureProjectMember(
        task.project_id,
        req.user.id,
      );
      const isAdmin = membership.role === "Admin";

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updates = {};
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.description !== undefined)
        updates.description = req.body.description;
      if (req.body.due_date !== undefined) updates.due_date = req.body.due_date;

      if (req.body.status !== undefined) {
        if (!isAdmin && task.assigned_to !== req.user.id) {
          return res
            .status(403)
            .json({ message: "Only task assignee or admin may update status" });
        }
        updates.status = req.body.status;
        updates.completed_at = req.body.status === "done" ? db.fn.now() : null;
      }

      if (req.body.assigned_to !== undefined) {
        if (!isAdmin) {
          return res
            .status(403)
            .json({ message: "Only admins can reassign tasks" });
        }
        const user = await db("users")
          .where({ id: req.body.assigned_to })
          .first();
        if (!user) {
          return res.status(404).json({ message: "Assigned user not found" });
        }
        updates.assigned_to = req.body.assigned_to;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }

      await db("tasks").where({ id: taskId }).update(updates);
      const updatedTask = await db("tasks").where({ id: taskId }).first();
      res.json(updatedTask);
    } catch (error) {
      next(error);
    }
  },
);

router.delete("/:taskId", authenticate, async (req, res, next) => {
  try {
    const taskId = Number(req.params.taskId);
    const task = await db("tasks").where({ id: taskId }).first();
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    await ensureProjectAdmin(task.project_id, req.user.id);
    await db("tasks").where({ id: taskId }).del();
    res.json({ message: "Task deleted" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
