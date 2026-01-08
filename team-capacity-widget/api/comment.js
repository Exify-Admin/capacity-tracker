// api/comment.js
const { json, handleOptions, notionFetch } = require("./_util");

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
    const comment = data.comment;

    if (!pageId || !comment) return json(res, 400, { error: "Missing pageId/comment" });

    await notionFetch(`/comments`, {
      method: "POST",
      body: {
        parent: { page_id: pageId },
        rich_text: [{ type: "text", text: { content: comment } }],
      },
    });

    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { error: String(e?.message || e) });
  }
};

