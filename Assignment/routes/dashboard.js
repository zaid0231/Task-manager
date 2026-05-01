const express = require("express");
const { authenticate } = require("../middleware/auth");
const { db } = require("../db");

const router = express.Router();

router.get("/", authenticate, async (req, res, next) => {
  try {
    const membershipRows = await db("project_members").where({
      user_id: req.user.id,
    });
    const projectIds = membershipRows.map((row) => row.project_id);

    const projectList = await db("projects")
      .whereIn("id", projectIds)
      .select("id", "name", "description", "due_date");

    const statusCounts = await db("tasks")
      .whereIn("project_id", projectIds)
      .select("status")
      .count("id as count")
      .groupBy("status");

    const counts = { todo: 0, in_progress: 0, done: 0 };
    statusCounts.forEach((row) => {
      counts[row.status] = Number(row.count);
    });

    const taskRows = await db("tasks")
      .leftJoin("users", "tasks.assigned_to", "users.id")
      .leftJoin("projects", "tasks.project_id", "projects.id")
      .whereIn("tasks.project_id", projectIds)
      .select(
        "tasks.id",
        "tasks.project_id",
        "tasks.status",
        "tasks.due_date",
        "tasks.completed_at",
        "tasks.created_at",
        "tasks.title",
        "tasks.assigned_to",
        "users.name as assignee_name",
        "projects.name as project_name",
      );

    const tasksCompletedByUser = {};
    const projectCompletionRates = projectList.map((project) => ({
      id: project.id,
      name: project.name,
      total: 0,
      done: 0,
    }));

    taskRows.forEach((task) => {
      const projectRate = projectCompletionRates.find(
        (project) => project.id === task.project_id,
      );
      if (projectRate) {
        projectRate.total += 1;
        if (task.status === "done") {
          projectRate.done += 1;
        }
      }
      if (task.status === "done" && task.assigned_to) {
        const name = task.assignee_name || "Unassigned";
        tasksCompletedByUser[name] = (tasksCompletedByUser[name] || 0) + 1;
      }
    });

    const overdueTasks = taskRows.filter(
      (task) =>
        task.due_date &&
        task.due_date < new Date().toISOString().slice(0, 10) &&
        task.status !== "done",
    );
    const overdueCount = overdueTasks.length;

    const completedTasks = taskRows.filter((task) => task.status === "done");
    const historySource = completedTasks.map((task) => {
      const dateValue = task.completed_at || task.created_at;
      return dateValue ? new Date(dateValue) : null;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weeklyLabels = [];
    const weeklyCounts = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      weeklyLabels.push(date.toISOString().slice(0, 10));
      weeklyCounts.push(0);
    }

    const monthLabels = [];
    const monthCounts = [];
    const weekStarts = [];
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    for (let i = 3; i >= 0; i -= 1) {
      const start = new Date(currentWeekStart);
      start.setDate(currentWeekStart.getDate() - i * 7);
      weekStarts.push(start);
      monthLabels.push(
        `Week of ${start.toISOString().slice(5, 10).replace("-", "/")}`,
      );
      monthCounts.push(0);
    }

    historySource.forEach((date) => {
      if (!date) {
        return;
      }
      const dateString = date.toISOString().slice(0, 10);
      const weekIndex = weeklyLabels.indexOf(dateString);
      if (weekIndex !== -1) {
        weeklyCounts[weekIndex] += 1;
      }
      weekStarts.forEach((start, index) => {
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        if (date >= start && date < end) {
          monthCounts[index] += 1;
        }
      });
    });

    const weeklyPerformance = weeklyLabels.map((label, index) => ({
      label,
      value: weeklyCounts[index],
    }));
    const monthlyPerformance = monthLabels.map((label, index) => ({
      label,
      value: monthCounts[index],
    }));

    const tasksCompletedArray = Object.entries(tasksCompletedByUser)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const projectRates = projectCompletionRates.map((project) => ({
      id: project.id,
      name: project.name,
      rate:
        project.total === 0
          ? 0
          : Math.round((project.done / project.total) * 100),
    }));

    res.json({
      projects: projectList,
      statusCounts: counts,
      overdueTasks,
      overdueStats: { count: overdueCount },
      tasksCompletedByUser: tasksCompletedArray,
      projectCompletionRates: projectRates,
      weeklyPerformance,
      monthlyPerformance,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
