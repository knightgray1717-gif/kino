/** Pair: pages/player.html */
import { attr, compact, esc, fill as fillTpl, initial, setField, slot, tpl } from "../html.js";

function clock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const s = Math.floor(seconds);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function neighbors(ctx) {
    const id = Number(ctx.currentVideo?.id);
    const queue = (ctx.watchQueue || []).map(Number).filter((n) => n > 0);
    const i = queue.indexOf(id);
    if (i < 0) return { prev: null, next: null };
    return {
        prev: i > 0 ? queue[i - 1] : null,
        next: i < queue.length - 1 ? queue[i + 1] : null
    };
}

function setJump(btn, id) {
    if (!btn) return;
    btn.disabled = !id;
    btn.dataset.to = id ? String(id) : "";
}

export function fill(root, ctx) {
    const v = ctx.currentVideo;
    const player = root.querySelector('[data-role="player"]');
    const missing = root.querySelector('[data-role="missing"]');
    if (!v) {
        if (player) player.hidden = true;
        if (missing) missing.hidden = false;
        return;
    }
    if (player) player.hidden = false;
    if (missing) missing.hidden = true;
    const video = root.querySelector("#player-video");
    if (video) {
        video.src = v.src;
        video.poster = v.thumbnail;
    }
    setField(root, "title", v.title);
    setField(root, "uploader", v.uploader);
    setField(root, "desc", v.desc || "");
    setField(root, "company", v.company || "");
    setField(root, "director", v.director || "");
    setField(root, "producer", v.producer || "");
    setField(root, "featured", v.featured || "");
    setField(root, "likes", compact(v.likes));
    setField(root, "stats", `${compact(v.views)} views · ${v.date || ""}`);
    setField(root, "comment-count", String((ctx.comments || []).length));
    setField(root, "me-initial", initial(ctx.me?.name || "U"));
    setField(root, "save-label", ctx.saved ? "Saved" : "Save");
    const { prev, next } = neighbors(ctx);
    setJump(root.querySelector('[data-jump="-1"]'), prev);
    setJump(root.querySelector('[data-jump="1"]'), next);
    const channel = root.querySelector('[data-field="channel"]');
    if (channel) {
        channel.textContent = initial(v.uploader);
        channel.setAttribute("href", "#channel/" + encodeURIComponent(v.uploader));
    }
    const follow = root.querySelector('[data-field="follow"]');
    if (follow) {
        follow.dataset.follow = v.uploader;
        follow.textContent = ctx.followed ? "Following" : "Follow";
        follow.classList.toggle("is-subscribed", Boolean(ctx.followed));
    }
    const like = root.querySelector('[data-field="like"]');
    if (like) {
        like.dataset.like = v.id;
        like.classList.toggle("is-liked", Boolean(ctx.liked));
    }
    const save = root.querySelector('[data-field="save"]');
    if (save) {
        save.dataset.save = v.id;
        save.classList.toggle("is-saved", Boolean(ctx.saved));
    }
    const comments = (ctx.comments || []).length
        ? ctx.comments.map((c) => fillTpl(tpl("comment-row"), {
            initial: esc(initial(c.user)),
            user: esc(c.user),
            time: esc(c.time || ""),
            text: esc(c.text)
        })).join("")
        : '<p class="muted">Be the first note in the house.</p>';
    slot(root, "comments", comments);
    slot(root, "upnext", (ctx.upNext || []).map((uv) => fillTpl(tpl("up-next-item"), {
        id: uv.id,
        thumbnail: attr(uv.thumbnail),
        title: esc(uv.title),
        uploader: esc(uv.uploader),
        views: compact(uv.views),
        runtime: esc(uv.runtime)
    })).join(""));
}

export function bind(root, extras) {
    const video = root.querySelector("#player-video");
    const stage = root.querySelector('[data-role="stage"]');
    const playBtn = root.querySelector("[data-toggle-play]");
    const scrub = root.querySelector("#player-scrub");
    const timeEl = root.querySelector('[data-field="time"]');
    if (!video) return () => {};

    const syncPlay = () => {
        const paused = video.paused;
        stage?.classList.toggle("is-paused", paused);
        const icon = playBtn?.querySelector("i");
        if (icon) icon.className = paused ? "fas fa-play" : "fas fa-pause";
        if (playBtn) playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
    };
    const syncTime = () => {
        const dur = video.duration || 0;
        const cur = video.currentTime || 0;
        if (timeEl) timeEl.textContent = clock(cur) + " / " + clock(dur);
        if (scrub && !scrub.matches(":active") && dur) scrub.value = String(Math.round((cur / dur) * 1000));
    };
    const toggle = () => {
        if (video.paused) video.play().catch(() => {});
        else video.pause();
    };
    const onEnded = () => {
        if (extras.state.me && !extras.state.me.autoplay) return;
        const next = extras.state.upNext[0];
        if (next) extras.go("player/" + next.id);
    };
    const onKey = (e) => {
        if (document.body.dataset.page !== "player") return;
        if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
        if (e.key === " " || e.code === "Space") {
            e.preventDefault();
            toggle();
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            video.currentTime = Math.max(0, video.currentTime - 5);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
        }
    };
    const onStage = (e) => {
        if (e.target.closest("button, input")) return;
        toggle();
    };
    const onSeek = (e) => {
        const btn = e.target.closest("[data-seek]");
        if (!btn) return;
        video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + Number(btn.dataset.seek)));
    };
    const onJump = (e) => {
        const btn = e.target.closest("[data-jump]");
        if (!btn || btn.disabled || !btn.dataset.to) return;
        extras.go("player/" + btn.dataset.to);
    };
    const onScrub = () => {
        if (!video.duration) return;
        video.currentTime = (Number(scrub.value) / 1000) * video.duration;
    };

    stage?.addEventListener("click", onStage);
    root.addEventListener("click", onSeek);
    root.addEventListener("click", onJump);
    playBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        toggle();
    });
    scrub?.addEventListener("input", onScrub);
    video.addEventListener("play", syncPlay);
    video.addEventListener("pause", syncPlay);
    video.addEventListener("timeupdate", syncTime);
    video.addEventListener("loadedmetadata", syncTime);
    video.addEventListener("ended", onEnded);
    document.addEventListener("keydown", onKey);
    stage?.classList.add("is-paused");
    video.play().catch(() => {});
    syncPlay();
    syncTime();

    return () => {
        stage?.removeEventListener("click", onStage);
        root.removeEventListener("click", onSeek);
        root.removeEventListener("click", onJump);
        document.removeEventListener("keydown", onKey);
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("play", syncPlay);
        video.removeEventListener("pause", syncPlay);
        video.removeEventListener("timeupdate", syncTime);
        video.removeEventListener("loadedmetadata", syncTime);
        video.pause();
    };
}
