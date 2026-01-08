// api/unblock.js
const { env, json, handleOptions, notionFetch } = require("./_util");

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;

  try {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    let body = "";
    await new Promise(resolve => {
      req.on("data", chunk => (body += chunk));
      req.on("end", resolve);
    });
    const data = body ? JSON.parse(body) : {};
    const pageId = data.pageId;
    if (!pageId) return json(res, 400, { error: "Missing pageId" });

    const PROP_STATUS = env("PROP_STATUS", "Status");
    const UNBLOCK_TO_STATUS = env("UNBLOCK_TO_STATUS", "In Progress");

    // Patch the page: set status to "In Progress" (change with env var above)
    await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: {
        properties: {
          [PROP_STATUS]: { select: { name: UNBLOCK_TO_STATUS } },
        },
      },
    });

    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { error: String(e?.message || e) });
  }
};

