/** Pair: pages/home.html */
import { chips, compact, esc, formatLabel, rail, slot, text, titleCase } from "../html.js";

export function fill(root, ctx) {
    const list = ctx.creatorFilter === "all"
        ? ctx.videos
        : ctx.videos.filter((v) => v.uploader === ctx.creatorFilter);
    const creators = ["all", ...new Set(ctx.videos.map((v) => v.uploader))].map((name) => ({
        id: name,
        label: name === "all" ? "All curators" : name
    }));
    const featured = list.find((v) => v.format === "film") || list[0];
    if (featured) {
        const img = root.querySelector(".premiere-hero-img");
        if (img) {
            img.src = featured.thumbnail;
            img.alt = featured.title;
        }
        text(root, '[data-hero="title"]', featured.title);
        text(root, '[data-hero="desc"]', featured.desc || "");
        const meta = [formatLabel(featured), featured.uploader, featured.runtime, titleCase(featured.category), compact(featured.views) + " views"]
            .map((label) => `<span class="meta-chip">${esc(label)}</span>`).join("");
        const metaEl = root.querySelector('[data-hero="meta"]');
        if (metaEl) metaEl.innerHTML = meta;
        const watch = root.querySelector('[data-hero="watch"]');
        if (watch) watch.setAttribute("href", "#player/" + featured.id);
    }
    slot(root, "creators", chips(creators, ctx.creatorFilter, "creator"));
    slot(root, "rails", [
        ctx.history?.length ? rail("Continue watching", "#history", ctx.history.slice(0, 4)) : "",
        rail("Latest drops", "#discovery", list.slice(0, 8)),
        rail("Trending in the house", "#discovery", [...list].sort((a, b) => b.views - a.views).slice(0, 8)),
        rail("Short drops", "#clips", list.filter((v) => v.format === "clip"))
    ].join(""));
}
