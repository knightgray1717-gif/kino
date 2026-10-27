/** Pair: pages/creators.html */
import { attr, compact, esc, fill as fillTpl, initial, setField, slot, tpl } from "../html.js";

export function fill(root, ctx) {
    setField(root, "copy", `${ctx.creators.length} curators with titles on Kino.`);
    const cards = ctx.creators.map((c) => {
        const titles = ctx.videos.filter((v) => v.uploader === c.name);
        const cover = [...titles].sort((a, b) => b.views - a.views)[0];
        const followed = ctx.follows.includes(c.name);
            return fillTpl(tpl("roster-card"), {
            name: esc(c.name),
            channel: "#channel/" + encodeURIComponent(c.name),
            cover: attr(cover?.thumbnail || ""),
            initial: esc(initial(c.name)),
            stats: `${c.titles} ${c.titles === 1 ? "title" : "titles"} · ${compact(c.views)} views`,
            latest: cover ? "Latest: " + esc(cover.title) : "",
            followedClass: followed ? "is-subscribed" : "",
            followLabel: followed ? "Following" : "Follow"
        });
    }).join("");
    slot(root, "grid", cards || '<div class="empty-state">No creators yet.</div>');
}
