/** Pair: pages/discovery.html */
import { card, chips, grid, slot, titleCase } from "../html.js";

export function fill(root, ctx) {
    const cats = ["all", ...new Set(ctx.videos.map((v) => v.category))].map((c) => ({
        id: c,
        label: c === "all" ? "Everything" : titleCase(c)
    }));
    const filtered = ctx.videos.filter((v) => {
        const catOk = ctx.categoryFilter === "all" || v.category === ctx.categoryFilter;
        const modeOk = ctx.discoverMode === "clips" ? v.format === "clip" : v.format !== "clip";
        return catOk && modeOk;
    });
    const trending = [...ctx.videos].sort((a, b) => b.views - a.views).slice(0, 8);
    slot(root, "trending", trending.map(card).join(""));
    slot(root, "categories", chips(cats, ctx.categoryFilter, "category"));
    root.querySelectorAll("[data-mode]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.mode === ctx.discoverMode);
    });
    slot(root, "grid", grid(filtered));
}
