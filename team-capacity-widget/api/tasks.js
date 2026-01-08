// api/tasks.js
const {
  env, json, handleOptions, notionFetch,
  titlePlain, richTextPlain, selectName, multiSelectFirst, peopleFirst,
  dateStart, dateLabel, isOverdue, normalizeStatus,
  uniqueSorted, segmentsForWip, sortTasks,
} = require("./_util");

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;

  try {
    const DATABASE_ID = env("DATABASE_ID");
    if (!DATABASE_ID) return json(res, 500, { error: "Missing DATABASE_ID env var" });

    // property mapping (must match Notion DB property names)
    const PROP_TITLE = env("PROP_TITLE", "Name");
    const PROP_ASSIGNEE = env("PROP_ASSIGNEE", "Assignee");
    const PROP_STATUS = env("PROP_STATUS", "Status");
    const PROP_DUE = env("PROP_DUE", "Due Date");
    const PROP_PROJECT = env("PROP_PROJECT", "Project");
    const PROP_DEPARTMENT = env("PROP_DEPARTMENT", "Department");
    const PROP_PRIORITY = env("PROP_PRIORITY", "Priority");
    const PROP_ROLE = env("PROP_ROLE", "Role");

    // pagination (in case you have lots of tasks)
    let pages = [];
    let start_cursor = undefined;

    for (let i = 0; i < 10; i++) { // up to ~1000 rows if page_size=100
      const body = { page_size: 100 };
      if (start_cursor) body.start_cursor = start_cursor;

      const data = await notionFetch(`/databases/${DATABASE_ID}/query`, { method: "POST", body });
      pages.push(...(data.results || []));
      if (!data.has_more) break;
      start_cursor = data.next_cursor;
    }

    // convert pages -> tasks
    const tasks = [];
    for (const p of pages) {
      const props = p.properties || {};

      const titleProp = props[PROP_TITLE];
      const assigneeProp = props[PROP_ASSIGNEE];
      const statusProp = props[PROP_STATUS];
      const dueProp = props[PROP_DUE];
      const projectProp = props[PROP_PROJECT];
      const deptProp = props[PROP_DEPARTMENT];
      const priorityProp = props[PROP_PRIORITY];
      const roleProp = props[PROP_ROLE];

      const title =
        titlePlain(titleProp) ||
        richTextPlain(titleProp) ||
        "Untitled";

      const assignee = peopleFirst(assigneeProp);
      if (!assignee?.id) continue; // skip unassigned tasks

      const statusLabel =
        selectName(statusProp) ||
        richTextPlain(statusProp) ||
        "";

      const dueIso = dateStart(dueProp);
      const dueLabel = dateLabel(dueIso);
      const overdue = isOverdue(dueIso, statusLabel);

      const project =
        selectName(projectProp) ||
        multiSelectFirst(projectProp) ||
        richTextPlain(projectProp) ||
        "";

      const department =
        selectName(deptProp) ||
        multiSelectFirst(deptProp) ||
        richTextPlain(deptProp) ||
        "";

      const priority =
        selectName(priorityProp) ||
        multiSelectFirst(priorityProp) ||
        richTextPlain(priorityProp) ||
        "";

      const role =
        selectName(roleProp) ||
        multiSelectFirst(roleProp) ||
        richTextPlain(roleProp) ||
        "";

      const blocked = normalizeStatus(statusLabel) === "blocked";

      tasks.push({
        id: p.id,
        title,
        url: p.url || "",
        statusLabel,
        dueLabel: dueLabel || "",
        overdue,
        blocked,
        priority,
        project,
        department,
        assigneeName: assignee.name || "Unknown",
        assigneeId: assignee.id,
        role,
      });
    }

    // group by assignee
    const byAssignee = new Map();
    for (const t of tasks) {
      const id = t.assigneeId;
      if (!byAssignee.has(id)) byAssignee.set(id, []);
      byAssignee.get(id).push(t);
    }

    const people = [];
    const allProjects = [];
    const allDepartments = [];

    const WIP_LIMIT = Number(env("WIP_LIMIT", "10"));
    const QUEUE_LIMIT = Number(env("QUEUE_LIMIT", "5"));

    for (const [assigneeId, list] of byAssignee.entries()) {
      const name = list[0]?.assigneeName || "Unknown";
      const role = list[0]?.role || list[0]?.department || "";

      const projectsAll = uniqueSorted(list.map(t => t.project || ""));
      const departmentsAll = uniqueSorted(list.map(t => t.department || ""));

      projectsAll.forEach(x => allProjects.push(x));
      departmentsAll.forEach(x => allDepartments.push(x));

      const wipTasks = list.filter(t => {
        const st = normalizeStatus(t.statusLabel);
        return st === "inprogress" || st === "blocked";
      });
      const queueTasks = list.filter(t => normalizeStatus(t.statusLabel) === "queue");

      const currentTask = (() => {
        const sorted = sortTasks(list.slice());
        for (const t of sorted) {
          if (normalizeStatus(t.statusLabel) !== "done") return t;
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
        blockedCount: wipTasks.filter(t => t.blocked).length,
        overdueCount: list.filter(t => t.overdue).length,
        currentTask,
        segments: segmentsForWip(list, WIP_LIMIT),
        projectsAll,
        departmentsAll,
      });
    }

    // sort people by wip desc then name
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

