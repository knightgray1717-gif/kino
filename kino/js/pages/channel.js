/** Pair: pages/channel.html */
import { compact, grid, initial, setField, slot } from "../html.js";

export function fill(root, ctx) {
    const name = ctx.param || "";
    const titles = ctx.videos.filter((v) => v.uploader === name);
    const followed = ctx.follows.includes(name);
    const views = titles.reduce((s, v) => s + v.views, 0);
    setField(root, "initial", initial(name));
    setField(root, "name", name);
    setField(root, "stats", `${titles.length} ${titles.length === 1 ? "title" : "titles"} · ${compact(views)} views`);
    const follow = root.querySelector('[data-field="follow"]');
    if (follow) {
        follow.dataset.follow = name;
        follow.textContent = followed ? "Following" : "Follow";
        follow.classList.toggle("is-subscribed", followed);
    }
    slot(root, "grid", grid(titles));
}
