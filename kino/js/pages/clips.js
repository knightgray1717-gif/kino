/** Pair: pages/clips.html */
import { attr, esc, fill as fillTpl, slot, text, titleCase, tpl } from "../html.js";

export function fill(root, ctx) {
    const clips = ctx.videos.filter((v) => v.format === "clip");
    text(root, '[data-slot="count"]', String(clips.length));
    slot(root, "feed", clips.length
        ? clips.map((video) => fillTpl(tpl("clip-card"), {
            id: video.id,
            src: attr(video.src),
            thumbnail: attr(video.thumbnail),
            title: esc(video.title),
            uploader: esc(video.uploader),
            runtime: esc(video.runtime),
            category: esc(titleCase(video.category))
        })).join("")
        : '<div class="empty-state">No clips yet.</div>');
}

export function bind(root, extras) {
    const state = extras.state;
    const cards = [...root.querySelectorAll(".clip-card")];
    if (!cards.length) return () => {};

    const scroller = root.querySelector(".clips-feed") || root;
    state.clipIndex = 0;
    const io = new IntersectionObserver((entries) => {
        let best = null;
        entries.forEach((entry) => {
            const vid = entry.target.querySelector("video");
            if (!vid) return;
            if (entry.isIntersecting) {
                vid.play().catch(() => {});
                if (!best || entry.intersectionRatio > best.ratio) {
                    best = { card: entry.target, ratio: entry.intersectionRatio };
                }
            } else {
                vid.pause();
                vid.currentTime = 0;
            }
        });
        if (best) {
            const i = cards.indexOf(best.card);
            if (i >= 0) state.clipIndex = i;
        }
    }, { root: scroller, threshold: [0.6, 0.9] });
    cards.forEach((card) => io.observe(card));

    const goTo = (next) => {
        const i = Math.max(0, Math.min(cards.length - 1, next));
        state.clipIndex = i;
        cards[i].scrollIntoView({ behavior: "smooth", block: "center" });
    };
    const onKey = (e) => {
        if (document.body.dataset.page !== "clips") return;
        if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
        if (!document.getElementById("search-overlay")?.classList.contains("hidden")) return;
        if (!document.getElementById("login-modal")?.classList.contains("hidden")) return;
        if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "j") {
            e.preventDefault();
            goTo(state.clipIndex + 1);
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "k") {
            e.preventDefault();
            goTo(state.clipIndex - 1);
        } else if (e.key === " ") {
            e.preventDefault();
            const vid = cards[state.clipIndex]?.querySelector("video");
            if (!vid) return;
            if (vid.paused) vid.play().catch(() => {});
            else vid.pause();
        }
    };
    document.addEventListener("keydown", onKey);
    return () => {
        io.disconnect();
        document.removeEventListener("keydown", onKey);
    };
}
