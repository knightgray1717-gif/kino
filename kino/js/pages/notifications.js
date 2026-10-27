/** Pair: pages/notifications.html */
import { esc, fill as fillTpl, slot, tpl } from "../html.js";

export function fill(root, ctx) {
    const rows = (ctx.notifications || []).length
            ? ctx.notifications.map((n) => fillTpl(tpl("notice-row"), {
            id: n.id,
            unread: n.read ? "" : "unread",
            title: esc(n.title),
            body: esc(n.body || "")
        })).join("")
        : '<div class="empty-state">No notices yet. Sign in to see house drops.</div>';
    slot(root, "rows", rows);
}
