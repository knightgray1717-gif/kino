/** Pair: pages/live.html */
import { attr, esc, fill as fillTpl, formatLabel, slot, tpl } from "../html.js";

export function fill(root, ctx) {
    const rows = ctx.videos.slice(0, 8).map((video, i) => {
        const liveNow = video.liveNow || i < 2;
        return fillTpl(tpl("live-item"), {
            id: video.id,
            thumbnail: attr(video.thumbnail),
            title: esc(video.title),
            slot: liveNow ? '<span class="live-now">Live now</span>' : esc(video.liveSlot),
            company: esc(video.company),
            format: esc(formatLabel(video)),
            action: liveNow ? "Join" : "Watch"
        });
    }).join("");
    slot(root, "rows", rows);
}
