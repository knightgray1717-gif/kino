/** Pair: pages/library.html */
import { esc, fill as fillTpl, grid, slot, text, tpl } from "../html.js";

export function fill(root, ctx) {
    const tab = ctx.libraryTab || "created";
    const saved = ctx.videos.filter((v) => ctx.savedIds.includes(v.id));
    const mine = ctx.videos.filter((v) => ctx.me && v.uploader === ctx.me.name);
    const created = mine;
    root.querySelectorAll("[data-lib]").forEach((el) => el.classList.toggle("active", el.dataset.lib === tab));
    text(root, '[data-count="created"]', created.length + " titles");
    text(root, '[data-count="saved"]', saved.length + " saved");
    text(root, '[data-count="playlists"]', ctx.playlists.length + " playlists");
    let body;
    if (tab === "saved") body = `<div class="unified-grid">${grid(saved)}</div>`;
    else if (tab === "playlists") {
        body = ctx.playlists.length
            ? `<div class="playlist-list">${ctx.playlists.map((pl) => fillTpl(tpl("playlist-card"), {
                id: ctx.videos[0]?.id || "",
                title: esc(pl.title),
                count: pl.count,
                updated: esc(pl.updated)
            })).join("")}</div>`
            : '<div class="empty-state">No playlists yet.</div>';
    } else body = `<div class="unified-grid">${grid(created)}</div>`;
    slot(root, "body", body);
}
