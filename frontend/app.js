(() => {
  const $ = (id) => document.getElementById(id);

  const rowsEl = $("rows");
  const popoverEl = $("popover");
  const toastEl = $("toast");

  const projectSelect = $("projectSelect");
  const deptSelect = $("deptSelect");
  const searchInput = $("searchInput");

  const updatedEl = $("updated");
  const summaryEl = $("summary");

  const apiBase = (() => {
    const p = new URLSearchParams(location.search);
    return p.get("api") || "";
  })();

  const state = {
    people: [],
    options: { projects: [], departments: [] },
    updatedText: "Updated —",
    filters: {
      project: "All Projects",
      department: "All Departments",
      search: "",
    },
  };

  function demoPayload() {
    // Used when ?demo=1 or when API is unreachable. Matches the UI spec.
    return {
      updatedText: "Updated just now (demo)",
      options: {
        projects: ["Website Refresh", "Mobile App", "Product Launch", "API Platform"],
        departments: ["Design", "Engineering", "Marketing"],
      },
      people: [
        {
          name: "Sarah Chen",
          role: "Design",
          currentProject: "Website Refresh",
          wip: 6,
          wipLimit: 10,
          queue: 3,
          queueLimit: 5,
          currentTask: {
            id: "demo-sarah-1",
            title: "Draft Q1 landing page copy and hero section",
            url: "#",
            statusLabel: "In Progress",
            dueLabel: "2026-01-09",
            overdue: false,
            blocked: false,
            priority: "P2 Medium",
          },
          segments: [
            {
              kind: "task",
              status: "inprogress",
              overdue: false,
              task: {
                id: "demo-sarah-1",
                title: "Draft Q1 landing page copy and hero section",
                url: "#",
                statusLabel: "In Progress",
                dueLabel: "2026-01-09",
                overdue: false,
                blocked: false,
                priority: "P2 Medium",
              },
            },
            {
              kind: "task",
              status: "inprogress",
              overdue: false,
              task: {
                id: "demo-sarah-2",
                title: "Homepage layout polish",
                url: "#",
                statusLabel: "In Progress",
                dueLabel: "2026-01-10",
                overdue: false,
                blocked: false,
                priority: "P3 Low",
              },
            },
            {
              kind: "task",
              status: "blocked",
              overdue: false,
              task: {
                id: "demo-sarah-3",
                title: "Finalize brand type scale (waiting on approval)",
                url: "#",
                statusLabel: "Blocked",
                dueLabel: "2026-01-11",
                overdue: false,
                blocked: true,
                priority: "P1 High",
              },
            },
            {
              kind: "task",
              status: "inprogress",
              overdue: true,
              task: {
                id: "demo-sarah-4",
                title: "Update design tokens",
                url: "#",
                statusLabel: "In Progress",
                dueLabel: "2026-01-01",
                overdue: true,
                blocked: false,
                priority: "P2 Medium",
              },
            },
            {
              kind: "task",
              status: "inprogress",
              overdue: false,
              task: {
                id: "demo-sarah-5",
                title: "Export assets",
                url: "#",
                statusLabel: "In Progress",
                dueLabel: "2026-01-12",
                overdue: false,
                blocked: false,
                priority: "P3 Low",
              },
            },
            {
              kind: "task",
              status: "inprogress",
              overdue: false,
              task: {
                id: "demo-sarah-6",
                title: "QA responsive breakpoints",
                url: "#",
                statusLabel: "In Progress",
                dueLabel: "2026-01-13",
                overdue: false,
                blocked: false,
                priority: "P2 Medium",
              },
            },
            { kind: "empty" },
            { kind: "empty" },
            { kind: "empty" },
            { kind: "empty" },
          ],
          projectsAll: ["Website Refresh"],
          departmentsAll: ["Design"],
          blockedCount: 1,
          overdueCount: 1,
        },
        {
          name: "Marcus Lee",
          role: "Engineering",
          currentProject: "Mobile App",
          wip: 11,
          wipLimit: 10,
          queue: 3,
          queueLimit: 5,
          currentTask: {
            id: "demo-marcus-1",
            title: "Implement authentication flow for iOS",
            url: "#",
            statusLabel: "In Progress",
            dueLabel: "2026-01-08",
            overdue: false,
            blocked: false,
            priority: "P1 High",
          },
          segments: [
            {
              kind: "task",
              status: "inprogress",
              overdue: false,
              task: {
                id: "demo-marcus-1",
                title: "Implement authentication flow for iOS",
                url: "#",
                statusLabel: "In Progress",
                dueLabel: "2026-01-08",
                overdue: false,
                blocked: false,
                priority: "P1 High",
              },
            },
            {
              kind: "task",
              status: "blocked",
              overdue: false,
              task: {
                id: "demo-marcus-2",
                title: "Fix CI signing issue (blocked)",
                url: "#",
                statusLabel: "Blocked",
                dueLabel: "2026-01-09",
                overdue: false,
                blocked: true,
                priority: "P1 High",
              },
            },
            {
              kind: "task",
              status: "inprogress",
              overdue: true,
              task: {
                id: "demo-marcus-3",
                title: "Patch rate limit regression",
                url: "#",
                statusLabel: "In Progress",
                dueLabel: "2026-01-02",
                overdue: true,
                blocked: false,
                priority: "P2 Medium",
              },
            },
            {
              kind: "task",
              status: "inprogress",
              overdue: false,
              task: {
                id: "demo-marcus-4",
                title: "Refactor API client",
                url: "#",
                statusLabel: "In Progress",
                dueLabel: "2026-01-12",
                overdue: false,
                blocked: false,
                priority: "P3 Low",
              },
            },
            {
              kind: "task",
              status: "inprogress",
              overdue: false,
              task: {
                id: "demo-marcus-5",
                title: "Telemetry events",
                url: "#",
                statusLabel: "In Progress",
                dueLabel: "2026-01-13",
                overdue: false,
                blocked: false,
                priority: "P3 Low",
              },
            },
            {
              kind: "task",
              status: "inprogress",
              overdue: false,
              task: {
                id: "demo-marcus-6",
                title: "Push notification token handling",
                url: "#",
                statusLabel: "In Progress",
                dueLabel: "2026-01-14",
                overdue: false,
                blocked: false,
                priority: "P2 Medium",
              },
            },
            {
              kind: "task",
              status: "blocked",
              overdue: false,
              task: {
                id: "demo-marcus-7",
                title: "Backend contract change (blocked)",
                url: "#",
                statusLabel: "Blocked",
                dueLabel: "2026-01-15",
                overdue: false,
                blocked: true,
                priority: "P2 Medium",
              },
            },
            {
              kind: "task",
              status: "inprogress",
              overdue: false,
              task: {
                id: "demo-marcus-8",
                title: "Crash fix",
                url: "#",
                statusLabel: "In Progress",
                dueLabel: "2026-01-10",
                overdue: false,
                blocked: false,
                priority: "P1 High",
              },
            },
            {
              kind: "task",
              status: "inprogress",
              overdue: false,
              task: {
                id: "demo-marcus-9",
                title: "App startup perf",
                url: "#",
                statusLabel: "In Progress",
                dueLabel: "2026-01-16",
                overdue: false,
                blocked: false,
                priority: "P3 Low",
              },
            },
            { kind: "overflow", overflow: 2 },
          ],
          projectsAll: ["Mobile App"],
          departmentsAll: ["Engineering"],
          blockedCount: 2,
          overdueCount: 1,
        },
        {
          name: "Emma Davis",
          role: "Marketing",
          currentProject: "Product Launch",
          wip: 2,
          wipLimit: 10,
          queue: 6,
          queueLimit: 5,
          currentTask: {
            id: "demo-emma-1",
            title: "Prepare email campaign templates",
            url: "#",
            statusLabel: "In Progress",
            dueLabel: "2026-01-11",
            overdue: false,
            blocked: false,
            priority: "P2 Medium",
          },
          segments: [
            {
              kind: "task",
              status: "inprogress",
              overdue: false,
              task: {
                id: "demo-emma-1",
                title: "Prepare email campaign templates",
                url: "#",
                statusLabel: "In Progress",
                dueLabel: "2026-01-11",
                overdue: false,
                blocked: false,
                priority: "P2 Medium",
              },
            },
            {
              kind: "task",
              status: "inprogress",
              overdue: false,
              task: {
                id: "demo-emma-2",
                title: "Finalize launch FAQ",
                url: "#",
                statusLabel: "In Progress",
                dueLabel: "2026-01-13",
                overdue: false,
                blocked: false,
                priority: "P3 Low",
              },
            },
            { kind: "empty" },
            { kind: "empty" },
            { kind: "empty" },
            { kind: "empty" },
            { kind: "empty" },
            { kind: "empty" },
            { kind: "empty" },
            { kind: "empty" },
          ],
          projectsAll: ["Product Launch"],
          departmentsAll: ["Marketing"],
          blockedCount: 0,
          overdueCount: 0,
        },
      ],
    };
  }

  function setSelectOptions(select, items, allLabel) {
    select.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = allLabel;
    optAll.textContent = allLabel;
    select.appendChild(optAll);

    for (const it of items) {
      const opt = document.createElement("option");
      opt.value = it;
      opt.textContent = it;
      select.appendChild(opt);
    }
  }

  function parsePriorityClass(priorityText = "") {
    const s = String(priorityText).toLowerCase();
    if (s.includes("p0")) return "priority--p0";
    if (s.includes("p1")) return "priority--p1";
    if (s.includes("p2")) return "priority--p2";
    if (s.includes("p3")) return "priority--p3";
    return "priority--p2";
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.setAttribute("aria-hidden", "false");
    setTimeout(() => toastEl.setAttribute("aria-hidden", "true"), 2000);
  }

  function closePopover() {
    popoverEl.setAttribute("aria-hidden", "true");
    popoverEl.innerHTML = "";
  }

  function openPopover(anchorRect, task, allowUnblock) {
    const x = Math.min(anchorRect.left, window.innerWidth - 460) + window.scrollX;
    const y = anchorRect.bottom + 8 + window.scrollY;

    const prClass = parsePriorityClass(task.priority);

    popoverEl.innerHTML = `
      <div class="pop__title">${escapeHtml(task.title)}</div>
      <div class="pop__sub">
        <span>${escapeHtml(task.statusLabel || "")}</span>
        ${task.dueLabel ? `<span>• Due: ${escapeHtml(task.dueLabel)}</span>` : ""}
        ${task.priority ? `<span class="priority ${prClass}">${escapeHtml(task.priority)}</span>` : ""}
      </div>

      <div class="pop__actions">
        ${allowUnblock ? `<button class="btn btn--danger" id="btnUnblock">Mark Unblocked</button>` : ""}
        <button class="btn" id="btnComment">Add Comment</button>
      </div>

      <div class="pop__footer">
        <a class="link" href="${task.url || "#"}" target="_blank" rel="noreferrer">Open task in Notion →</a>
        <button class="btn" id="btnClose">Close</button>
      </div>
    `;

    popoverEl.style.left = `${x}px`;
    popoverEl.style.top = `${y}px`;
    popoverEl.setAttribute("aria-hidden", "false");

    const btnClose = $("btnClose");
    if (btnClose) btnClose.onclick = closePopover;

    const btnComment = $("btnComment");
    if (btnComment) {
      btnComment.onclick = async () => {
        const txt = prompt("Comment to add:");
        if (!txt) return;
        try {
          await apiPost("/api/comment", { pageId: task.id, comment: txt });
          showToast("Comment added");
          closePopover();
          await load();
        } catch (e) {
          showToast("Failed to comment");
          console.error(e);
        }
      };
    }

    const btnUnblock = $("btnUnblock");
    if (btnUnblock) {
      btnUnblock.onclick = async () => {
        try {
          await apiPost("/api/unblock", { pageId: task.id });
          showToast("Unblocked");
          closePopover();
          await load();
        } catch (e) {
          showToast("Failed to unblock");
          console.error(e);
        }
      };
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function apiUrl(path) {
    if (apiBase) return apiBase.replace(/\/$/, "") + path;
    return path;
  }

  async function apiGet(path) {
    const res = await fetch(apiUrl(path), { credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "omit",
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${t}`);
    }
    return await res.json().catch(() => ({}));
  }

  function render() {
    const q = state.filters.search.trim().toLowerCase();

    const filteredPeople = state.people.filter((p) => {
      if (state.filters.project !== "All Projects") {
        const all = (p.projectsAll || []).map(String);
        if (!all.includes(state.filters.project)) return false;
      }
      if (state.filters.department !== "All Departments") {
        const all = (p.departmentsAll || []).map(String);
        if (!all.includes(state.filters.department)) return false;
      }
      if (q) {
        const name = String(p.name || "").toLowerCase();
        const proj = String(p.currentProject || "").toLowerCase();
        const role = String(p.role || "").toLowerCase();
        if (!name.includes(q) && !proj.includes(q) && !role.includes(q)) return false;
      }
      return true;
    });

    // Summary totals (respect current filters)
    let sumWip = 0,
      sumQueue = 0,
      sumOverdue = 0,
      sumBlocked = 0;
    for (const p of filteredPeople) {
      sumWip += Number(p.wip || 0);
      sumQueue += Number(p.queue || 0);
      // Prefer backend-provided counts (accurate even with overflow)
      if (typeof p.overdueCount === "number") sumOverdue += p.overdueCount;
      else {
        // fallback: count visible overdue segments only
        sumOverdue += (p.segments || []).filter((s) => s?.task && s.task.overdue).length;
      }
      if (typeof p.blockedCount === "number") sumBlocked += p.blockedCount;
      else {
        sumBlocked += (p.segments || []).filter((s) => s?.task && s.task.blocked).length;
      }
    }
    if (summaryEl) {
      summaryEl.textContent = `WIP ${sumWip} • Queue ${sumQueue} • Overdue ${sumOverdue} • Blocked ${sumBlocked}`;
    }

    rowsEl.innerHTML = "";

    for (const person of filteredPeople) {
      const row = document.createElement("div");
      row.className = "row";

      const initials = (String(person.name || "")
        .split(" ")
        .slice(0, 2)
        .map((x) => x[0] || "")
        .join("")
        .toUpperCase() || "?");

      const personEl = document.createElement("div");
      personEl.className = "person";
      personEl.innerHTML = `
        <div class="avatar">${escapeHtml(initials)}</div>
        <div class="person__meta">
          <div class="projectline">Current Project • ${escapeHtml(person.currentProject || "—")}</div>
          <div class="personname">${escapeHtml(person.name || "")}</div>
          <div class="role">${escapeHtml(person.role || "")}</div>
        </div>
      `;

      const barEl = document.createElement("div");
      barEl.className = "taskbar";

      const segmentsEl = document.createElement("div");
      segmentsEl.className = "segments";

      const segments = person.segments || [];
      for (const seg of segments) {
        if (seg.kind === "empty") {
          const el = document.createElement("div");
          el.className = "seg";
          segmentsEl.appendChild(el);
          continue;
        }

        if (seg.kind === "overflow") {
          const el = document.createElement("div");
          el.className = "seg seg--overflow";
          el.textContent = `+${seg.overflow}`;
          segmentsEl.appendChild(el);
          continue;
        }

        const task = seg.task;
        const el = document.createElement("div");
        el.className = "seg seg--task";
        if (seg.status === "blocked") el.classList.add("seg--blocked");

        if (task && task.overdue) {
          const corner = document.createElement("div");
          corner.className = "seg__corner";
          el.appendChild(corner);
        }

        if (seg.status === "blocked") {
          const icon = document.createElement("div");
          icon.className = "seg__icon";
          icon.textContent = "⦸";
          el.appendChild(icon);
        }

        el.onclick = (e) => {
          e.stopPropagation();
          const r = el.getBoundingClientRect();
          openPopover(r, task, Boolean(task.blocked));
        };

        segmentsEl.appendChild(el);
      }

      barEl.appendChild(segmentsEl);

      const metricsEl = document.createElement("div");
      metricsEl.className = "metrics";

      const wipText = document.createElement("span");
      wipText.className = "metrictext";
      wipText.textContent = `WIP ${person.wip || 0}/${person.wipLimit || 10}`;

      const dot = document.createElement("span");
      dot.className = "dot";

      const queuePill = document.createElement("span");
      const qOk = Number(person.queue || 0) <= Number(person.queueLimit || 5);
      queuePill.className = `pill ${qOk ? "pill--ok" : "pill--bad"}`;
      queuePill.textContent = `Queue ${person.queue || 0}/${person.queueLimit || 5}`;

      metricsEl.appendChild(wipText);
      metricsEl.appendChild(dot);
      metricsEl.appendChild(queuePill);

      const currentEl = document.createElement("div");
      currentEl.className = "currenttask";
      currentEl.textContent = `Current task: ${person.currentTask?.title || "—"}`;

      currentEl.onclick = (e) => {
        e.stopPropagation();
        if (!person.currentTask) return;
        const r = currentEl.getBoundingClientRect();
        openPopover(r, person.currentTask, Boolean(person.currentTask.blocked));
      };

      row.appendChild(personEl);
      row.appendChild(barEl);
      row.appendChild(metricsEl);
      row.appendChild(currentEl);

      rowsEl.appendChild(row);
    }

    if (filteredPeople.length === 0) {
      rowsEl.innerHTML = `<div style="padding:16px;color:#6b7280;font-size:13px">No teammates match your filters.</div>`;
    }
  }

  async function load() {
    const DEMO = new URLSearchParams(location.search).get("demo") === "1";
    if (DEMO) {
      const data = demoPayload();
      state.people = data.people || [];
      state.options = data.options || { projects: [], departments: [] };
      state.updatedText = data.updatedText || "Updated —";
      setSelectOptions(projectSelect, state.options.projects || [], "All Projects");
      setSelectOptions(deptSelect, state.options
