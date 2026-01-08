// api/tasks.js
const {
  env, json, handleOptions, notionFetch,
  titlePlain, richTextPlain, selectName, multiSelectFirst,
  dateStart, dateLabel, isOverdue, normalizeStatus,
  uniqueSorted, segmentsForWip, sortTasks,
} = require("./_util");

// Notion relation property returns: { relation: [{ id: "page_id" }, ...] }
function relationFirstId(prop) {
  const rel = prop?.relation;
  if (!Array.isArray(rel) || rel.length === 0) return "";
  return rel[0]?.id || "";
}

async function queryAllPages(dbId) {
  const out = [];
  let start_cursor = undefined;

  for (let i = 0; i < 10; i++) {
    const body = { page_size: 100 };
    if (start_cursor) body.start_cursor = start_cursor;

    const data = await notionFetch(`/databases/${dbId}/query`, { method: "POST", body });
    out.push(...(data.results || []));
    if (!data.has_more) break;
    start_cursor = data.next_cursor;
  }
  return out;
}

function getTextProp(props, propName) {
  const p = props?.[propName];
  if (!p) return "";
  return titlePlain(p) || richTextPlain(p) || selectName(p) || multiSelectFirst(p) || "";
}

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;

  try {
    const TASKS_DB_ID = env("TASKS_DB_ID");
    const PROJECTS_DB_ID = env("PROJECTS_DB_ID");
    const EMPLOYEES_DB_ID = env("EMPLOYEES_DB_ID");

    if (!TASKS_DB_ID || !PROJECTS_DB_ID || !EMPLOYEES_DB_ID) {
      return json(res, 500, { error: "Missing TASKS_DB_ID / PROJECTS_DB_ID / EMPLOYEES_DB_ID env vars" });
    }

    // ---- property names (customize via env) ----
    const TASK_PROP_TITLE = env("TASK_PROP_TITLE", "Name");
    const TASK_PROP_STATUS = env("TASK_PROP_STATUS", "Status");
    const TASK_PROP_DUE = env("TASK_PROP_DUE", "Due Date");
    const TASK_PROP_PRIORITY = env("TASK_PROP_PRIORITY", "Priority");
    const TASK_PROP_ASSIGNEE_REL = env("TASK_PROP_ASSIGNEE_REL", "Employee");
    const TASK_PROP_PROJECT_REL = env("TASK_PROP_PROJECT_REL", "Project");

    const PROJ_PROP_TITLE = env("PROJ_PROP_TITLE", "Name");
    const PROJ_PROP_DEPT = env("PROJ_PROP_DEPT", "Department");

    const EMP_PROP_TITLE = env("EMP_PROP_TITLE", "Name");
    const EMP_PROP_ROLE = env("EMP_PROP_ROLE", "Role");
    const EMP_PROP_DEPT = env("EMP_PROP_DEPT", "Department");

    const WIP_LIMIT = Number(env("WIP_LIMIT", "10"));
    const QUEUE_LIMIT = Number(env("QUEUE_LIMIT", "5"));

    // ---- 1) Projects map ----
    const projectPages = await queryAllPages(PROJECTS_DB_ID);
    const projectById = new Map(); // projectPageId -> { name, department }
    for (const p of projectPages) {
      const props = p.properties || {};
      const name = getTextProp(props, PROJ_PROP_TITLE) || "—";
      const dept = getTextProp(props, PROJ_PROP_DEPT) || "";
      projectById.set(p.id, { name, department: dept });
    }

    // ---- 2) Employees map ----
    const employeePages = await queryAllPages(EMPLOYEES_DB_ID);
    const employeeById = new Map(); // employeePageId -> { name, role, department }
    for (const e of employeePages) {
      const props = e.properties || {};
      const name = getTextProp(props, EMP_PROP_TITLE) || "Unknown";
      const role = getTextProp(props, EMP_PROP_ROLE) || "";
      const dept = EMP_PROP_DEPT ? (getTextProp(props, EMP_PROP_DEPT) || "") : "";
      employeeById.set(e.id, { name, role, department: dept });
    }

    // ---- 3) Tasks (enriched) ----
    const taskPages = await queryAllPages(TASKS_DB_ID);

    const tasks = [];
    for (const t of taskPages) {
      const props = t.properties || {};

      const title = getTextProp(props, TASK_PROP_TITLE) || "Untitled";

      const statusLabel =
        selectName(props[TASK_PROP_STATUS]) ||
        getTextProp(props, TASK_PROP_STATUS) ||
        "";

      const dueIso = dateStart(props[TASK_PROP_DUE]);
      const dueLabel = dateLabel(dueIso);
      const overdue = isOverdue(dueIso, statusLabel);

      const priority =
        selectName(props[TASK_PROP_PRIORITY]) ||
        multiSelectFirst(props[TASK_PROP_PRIORITY]) ||
        getTextProp(props, TASK_PROP_PRIORITY) ||
        "";

      const employeeId = relationFirstId(props[TASK_PROP_ASSIGNEE_REL]);
      if (!employeeId) continue; // widget is per-person; skip unassigned

      const emp = employeeById.get(employeeId) || { name: "Unknown", role: "", department: "" };

      const projectId = relationFirstId(props[TASK_PROP_PROJECT_REL]);
      const proj = projectById.get(projectId) || { name: "", department: "" };

      const blocked = normalizeStatus(statusLabel) === "blocked";

      tasks.push({
        id: t.id,
        title,
        url: t.url || "",
        statusLabel,
        dueLabel: dueLabel || "",
        overdue,
        blocked,
        priority,
        project: proj.name || "",
        department: proj.department || emp.department || "",
        assigneeName: emp.name,
        assigneeId: employeeId,
        role: emp.role || emp.department || "",
      });
    }

    // ---- group by assignee (same as before) ----
    const byAssignee = new Map();
    for (const task of tasks) {
      if (!byAssignee.has(task.assigneeId)) byAssignee.set(task.assigneeId, []);
      byAssignee.get(task.assigneeId).push(task);
    }

    const people = [];
    const allProjects = [];
    const allDepartments = [];

    for (const [, list] of byAssignee.entries()) {
      const name = list[0]?.assigneeName || "Unknown";
      const role = list[0]?.role || "";

      const projectsAll = uniqueSorted(list.map(x => x.project || ""));
      const departmentsAll = uniqueSorted(list.map(x => x.department || ""));

      projectsAll.forEach(x => allProjects.push(x));
      departmentsAll.forEach(x => allDepartments.push(x));

      const wipTasks = list.filter(x => {
        const st = normalizeStatus(x.statusLabel);
        return st === "inprogress" || st === "blocked";
      });
      const queueTasks = list.filter(x => normalizeStatus(x.statusLabel) === "queue");

      const currentTask = (() => {
        const sorted = sortTasks(list.slice());
        for (const x of sorted) {
          if (normalizeStatus(x.statusLabel) !== "done") return x;
        }
        return sorted[0] || null;
      })();

      people.push({
        name,
        role,
        currentProject: projectsAll[0] || "",
        wip: wipTasks.length,
        wipLimit: WIP_LIMIT,
        queue: queueTasks.length,
        queueLimit: QUEUE_LIMIT,
        blockedCount: wipTasks.filter(x => x.blocked).length,
        overdueCount: list.filter(x => x.overdue).length,
        currentTask,
        segments: segmentsForWip(list, WIP_LIMIT),
        projectsAll,
        departmentsAll,
      });
    }

    people.sort((a, b) => (b.wip - a.wip) || String(a.name).localeCompare(String(b.name)));

    return json(res, 200, {
      updatedText: `Updated ${new Date().toLocaleString()}`,
      options: {
        projects: uniqueSorted(allProjects),
        departments: uniqueSorted(allDepartments),
      },
      people,
    });
  } catch (e) {
    return json(res, 500, { error: String(e?.message || e) });
  }
};
