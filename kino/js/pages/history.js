/** Pair: pages/history.html */
import { attr, esc, fill as fillTpl, slot, tpl } from "../html.js";

export function fill(root, ctx) {
    const rows = (ctx.history || []).map((video) => fillTpl(tpl("history-row"), {
        id: video.id,
        thumbnail: attr(video.thumbnail),
        title: esc(video.title),
        uploader: esc(video.uploader),
        watched: esc(video.watchedAt || "recently")
    })).join("") || '<div class="empty-state">Watch something and it will land here.</div>';
    slot(root, "rows", rows);
}
