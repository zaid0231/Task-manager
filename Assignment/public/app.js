const authSection = document.getElementById("authSection");
const dashboardSection = document.getElementById("dashboardSection");
const projectSection = document.getElementById("projectSection");
const logoutBtn = document.getElementById("logoutBtn");
const showLoginBtn = document.getElementById("showLoginBtn");
const showSignupBtn = document.getElementById("showSignupBtn");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const authMessage = document.getElementById("authMessage");
const userNameEl = document.getElementById("userName");
const todoCount = document.getElementById("todoCount");
const inProgressCount = document.getElementById("inProgressCount");
const doneCount = document.getElementById("doneCount");
const projectsList = document.getElementById("projectsList");
const overdueList = document.getElementById("overdueList");
const projectForm = document.getElementById("projectForm");
const projectTitle = document.getElementById("projectTitle");
const projectDescription = document.getElementById("projectDescription");
const projectDueDate = document.getElementById("projectDueDate");
const projectRoleText = document.getElementById("projectRole");
const memberList = document.getElementById("memberList");
const adminNotice = document.getElementById("adminNotice");
const adminDashboardText = document.getElementById("adminDashboardText");
const adminProjectsList = document.getElementById("adminProjectsList");
const inviteForm = document.getElementById("inviteForm");
const taskForm = document.getElementById("taskForm");
const taskAssignee = document.getElementById("taskAssignee");
const taskList = document.getElementById("taskList");
const deleteProjectBtn = document.getElementById("deleteProjectBtn");
const backToDashboardBtn = document.getElementById("backToDashboardBtn");
const notification = document.getElementById("notification");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const appHeader = document.getElementById("appHeader");

let authToken = localStorage.getItem("ethara_token");
let currentProject = null;
let currentProjectMembers = [];

function showSection(section) {
  const authVisible = section === authSection;
  authSection.classList.add("hidden");
  dashboardSection.classList.add("hidden");
  projectSection.classList.add("hidden");
  section.classList.remove("hidden");
  if (appHeader) {
    appHeader.style.display = authVisible ? "none" : "flex";
  }
  document.body.classList.toggle("auth-view", authVisible);
}

function notify(message) {
  notification.textContent = message;
  notification.classList.remove("hidden");
  setTimeout(() => notification.classList.add("hidden"), 3200);
}

function api(path, options = {}) {
  const headers = options.headers || {};
  headers["Content-Type"] = "application/json";
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return fetch(`/api/${path}`, { ...options, headers }).then(async (res) => {
    if (res.status === 401) {
      logout();
      throw new Error("Session expired. Please login again.");
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.message || "Request failed");
    }
    return body;
  });
}

async function loadDashboard() {
  try {
    const dashboard = await api("dashboard");
    userNameEl.textContent =
      localStorage.getItem("ethara_name") || "Team Member";
    todoCount.textContent = dashboard.statusCounts.todo || 0;
    inProgressCount.textContent = dashboard.statusCounts.in_progress || 0;
    doneCount.textContent = dashboard.statusCounts.done || 0;

    overdueList.innerHTML = "";
    if (dashboard.overdueTasks.length === 0) {
      overdueList.innerHTML = "<li>No overdue tasks.</li>";
    } else {
      dashboard.overdueTasks.forEach((task) => {
        const item = document.createElement("li");
        item.textContent = `${task.title} — ${task.project_name} (due ${task.due_date})`;
        overdueList.appendChild(item);
      });
    }

    const projects = await api("projects");
    projectsList.innerHTML = projects
      .map(
        (project) =>
          `<div class="project-card"><h4>${project.name}</h4><p>${project.description || "No description"}</p><p><strong>Role:</strong> ${project.role}</p><button data-id="${project.id}">Open project</button></div>`,
      )
      .join("");

    const adminProjects = projects.filter(
      (project) => project.role === "Admin",
    );
    adminDashboardText.textContent = adminProjects.length
      ? `You are Admin on ${adminProjects.length} project${adminProjects.length === 1 ? "" : "s"}.`
      : "You are not Admin on any project yet.";
    adminProjectsList.innerHTML = adminProjects.length
      ? adminProjects
          .map(
            (project) =>
              `<div class="project-card"><h4>${project.name}</h4><p>${project.description || "No description"}</p><button data-id="${project.id}">Open project</button></div>`,
          )
          .join("")
      : "<p>No admin projects available.</p>";

    document.querySelectorAll(".project-card button").forEach((button) => {
      button.addEventListener("click", () => loadProject(button.dataset.id));
    });
  } catch (error) {
    notify(error.message);
  }
}

async function loadProject(projectId) {
  try {
    const data = await api(`projects/${projectId}`);
    currentProject = data.project;
    currentProjectMembers = data.members;
    projectTitle.textContent = data.project.name;
    projectDescription.textContent =
      data.project.description || "No description yet.";
    projectDueDate.textContent = data.project.due_date || "No deadline";

    memberList.innerHTML = data.members
      .map(
        (member) =>
          `<li class="member-card"><strong>${member.name}</strong> ${member.email} — ${member.role}</li>`,
      )
      .join("");

    const currentUserId = Number(localStorage.getItem("ethara_user_id"));
    const membership = data.members.find(
      (member) => member.id === currentUserId,
    );
    const isAdmin = membership?.role === "Admin";
    projectRoleText.textContent = membership
      ? `Your role: ${membership.role}`
      : "Your role: Member";
    inviteForm.style.display = isAdmin ? "block" : "none";
    deleteProjectBtn.classList.toggle("hidden", !isAdmin);
    adminNotice.classList.toggle("hidden", isAdmin);

    taskAssignee.innerHTML =
      '<option value="">Unassigned</option>' +
      data.members
        .map((member) => `<option value="${member.id}">${member.name}</option>`)
        .join("");

    const totalTasks = data.tasks.length;
    const openTasks = data.tasks.filter(
      (task) => task.status === "todo",
    ).length;
    const inProgressTasks = data.tasks.filter(
      (task) => task.status === "in_progress",
    ).length;
    const doneTasks = data.tasks.filter(
      (task) => task.status === "done",
    ).length;
    const overdueTasks = data.tasks.filter(
      (task) =>
        task.due_date &&
        task.due_date < new Date().toISOString().slice(0, 10) &&
        task.status !== "done",
    ).length;
    const progress =
      totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

    document.getElementById("projectTotalTasks").textContent = totalTasks;
    document.getElementById("projectOpenTasks").textContent = openTasks;
    document.getElementById("projectInProgressTasks").textContent =
      inProgressTasks;
    document.getElementById("projectDoneTasks").textContent = doneTasks;
    document.getElementById("projectOverdueTasks").textContent = overdueTasks;
    document.getElementById("projectProgress").textContent = `${progress}%`;
    document.getElementById("progressPercentLabel").textContent =
      `${progress}%`;
    document.getElementById("progressBarFill").style.width = `${progress}%`;

    taskList.innerHTML = data.tasks
      .map((task) => {
        const overdue =
          task.due_date && task.due_date < new Date().toISOString().slice(0, 10)
            ? "overdue"
            : "";
        const doneButton =
          task.status !== "done"
            ? `<button class="mark-done primary-button" data-id="${task.id}">Mark done</button>`
            : "";
        return `<div class="task-card"><h4>${task.title}</h4><p>${task.description || "No description"}</p><p><small>Assigned: ${task.assignee_name || "Unassigned"}</small></p><p><small>Status: ${task.status}${overdue ? " • Overdue" : ""}</small></p><select data-task-id="${task.id}" class="status-select"><option value="todo" ${task.status === "todo" ? "selected" : ""}>Todo</option><option value="in_progress" ${task.status === "in_progress" ? "selected" : ""}>In Progress</option><option value="done" ${task.status === "done" ? "selected" : ""}>Done</option></select><button class="update-status primary-button" data-id="${task.id}">Update status</button>${doneButton}</div>`;
      })
      .join("");

    document.querySelectorAll(".update-status").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.dataset.id;
        const select = document.querySelector(`select[data-task-id="${id}"]`);
        await updateTaskStatus(id, select.value);
      });
    });

    document.querySelectorAll(".mark-done").forEach((button) => {
      button.addEventListener("click", async () => {
        await updateTaskStatus(button.dataset.id, "done");
      });
    });

    showSection(projectSection);
  } catch (error) {
    notify(error.message);
  }
}

function renderChart(container, data) {
  if (!container) return;
  container.innerHTML = data
    .map(
      (item) =>
        `<div class="bar-chart-segment"><div class="bar" style="height: ${Math.max(
          8,
          item.value * 10,
        )}%"><span>${item.value}</span></div><div class="bar-label">${item.label}</div></div>`,
    )
    .join("");
}

function applyTheme(theme) {
  document.body.classList.toggle("dark-mode", theme === "dark");
  themeToggleBtn.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  localStorage.setItem("ethara_theme", theme);
}

function initTheme() {
  const savedTheme = localStorage.getItem("ethara_theme") || "light";
  applyTheme(savedTheme);
}

async function updateTaskStatus(taskId, status) {
  try {
    await api(`tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    notify("Task status updated.");
    loadProject(currentProject.id);
  } catch (error) {
    notify(error.message);
  }
}

async function login(event) {
  event.preventDefault();
  authMessage.textContent = "";
  try {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    const response = await api("auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    authToken = response.token;
    localStorage.setItem("ethara_token", authToken);
    localStorage.setItem("ethara_name", response.user.name);
    localStorage.setItem("ethara_user_id", String(response.user.id));
    loadDashboard();
    showSection(dashboardSection);
  } catch (error) {
    authMessage.textContent = error.message;
  }
}

async function signup(event) {
  event.preventDefault();
  authMessage.textContent = "";
  try {
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value.trim();
    const response = await api("auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    authToken = response.token;
    localStorage.setItem("ethara_token", authToken);
    localStorage.setItem("ethara_name", name);
    localStorage.setItem("ethara_user_id", String(response.user.id));
    loadDashboard();
    showSection(dashboardSection);
  } catch (error) {
    authMessage.textContent = error.message;
  }
}

function logout() {
  authToken = null;
  localStorage.removeItem("ethara_token");
  localStorage.removeItem("ethara_name");
  localStorage.removeItem("ethara_user_id");
  showSection(authSection);
}

function toggleAuthForms(showSignup) {
  document.getElementById("loginForm").classList.toggle("hidden", showSignup);
  document.getElementById("signupForm").classList.toggle("hidden", !showSignup);
  showLoginBtn.classList.toggle("active", !showSignup);
  showSignupBtn.classList.toggle("active", showSignup);
  document.getElementById("authTitle").textContent = showSignup
    ? "Sign up"
    : "Login";
  document.getElementById("authSubtitle").textContent = showSignup
    ? "Sign up to continue"
    : "Login to continue";
}

async function deleteProject() {
  try {
    await api(`projects/${currentProject.id}`, { method: "DELETE" });
    notify("Project deleted successfully.");
    loadDashboard();
    showSection(dashboardSection);
  } catch (error) {
    notify(error.message);
  }
}

async function createProject(event) {
  event.preventDefault();
  try {
    const name = document.getElementById("projectName").value.trim();
    const description = document
      .getElementById("projectDescription")
      .value.trim();
    const due_date = document.getElementById("projectDueDate").value || null;
    await api("projects", {
      method: "POST",
      body: JSON.stringify({ name, description, due_date }),
    });
    projectForm.reset();
    notify("Project created successfully");
    loadDashboard();
  } catch (error) {
    notify(error.message);
  }
}

async function inviteMember(event) {
  event.preventDefault();
  try {
    const email = document.getElementById("inviteEmail").value.trim();
    const role = document.getElementById("inviteRole").value;
    await api(`projects/${currentProject.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
    inviteForm.reset();
    notify("Member invited successfully");
    loadProject(currentProject.id);
  } catch (error) {
    notify(error.message);
  }
}

async function addTask(event) {
  event.preventDefault();
  try {
    const title = document.getElementById("taskTitle").value.trim();
    const description = document.getElementById("taskDescription").value.trim();
    const assigned_to = taskAssignee.value || null;
    const due_date = document.getElementById("taskDueDate").value || null;
    await api(`tasks/project/${currentProject.id}`, {
      method: "POST",
      body: JSON.stringify({
        title,
        description,
        assigned_to: assigned_to ? Number(assigned_to) : undefined,
        due_date,
      }),
    });
    taskForm.reset();
    notify("Task created successfully");
    loadProject(currentProject.id);
  } catch (error) {
    notify(error.message);
  }
}

showLoginBtn.addEventListener("click", () => toggleAuthForms(false));
showSignupBtn.addEventListener("click", () => toggleAuthForms(true));
loginForm.addEventListener("submit", login);
signupForm.addEventListener("submit", signup);
logoutBtn.addEventListener("click", () => {
  logout();
  showSection(authSection);
});
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("dark-mode")
      ? "light"
      : "dark";
    applyTheme(nextTheme);
  });
}
projectForm.addEventListener("submit", createProject);
inviteForm.addEventListener("submit", inviteMember);
taskForm.addEventListener("submit", addTask);
deleteProjectBtn.addEventListener("click", deleteProject);
backToDashboardBtn.addEventListener("click", () => {
  loadDashboard();
  showSection(dashboardSection);
});

(async function init() {
  if (authToken) {
    try {
      const me = await api("auth/me");
      localStorage.setItem(
        "ethara_name",
        me.name || localStorage.getItem("ethara_name") || "Project User",
      );
      localStorage.setItem("ethara_user_id", String(me.id));
      await loadDashboard();
      showSection(dashboardSection);
    } catch {
      logout();
      showSection(authSection);
    }
  } else {
    showSection(authSection);
  }
  initTheme();
})();
