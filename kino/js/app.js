import { api } from "./api.js";
import { bindScreen, renderPage } from "./pages.js";
import { esc, toast } from "./ui.js";

const state = {
    me: null,
    videos: [],
    playlists: [],
    series: [],
    notifications: [],
    unread: 0,
    savedIds: [],
    likedIds: [],
    follows: [],
    history: [],
    creators: [],
    creatorFilter: "all",
    categoryFilter: "all",
    discoverMode: "films",
    libraryTab: "created",
    lastBrowse: "home",
    currentVideo: null,
    comments: [],
    upNext: [],
    liked: false,
    saved: false,
    followed: false,
    uploadFile: null,
    authMode: "signin",
    lastViewed: null,
    watchQueue: [],
    clipIndex: 0,
    unbindPage: null,
    theme: localStorage.getItem("kinoTheme") === "day" ? "day" : "gold"
};

const pageEl = () => document.getElementById("page");

function parseRoute() {
    const raw = (location.hash || "#home").replace(/^#/, "").trim();
    const [name, ...rest] = raw.split("/");
    const aliases = { explore: "discovery", studio: "upload", series: "upload", watch: "player", trending: "discovery" };
    const page = aliases[name] || name || "home";
    return { page, param: decodeURIComponent(rest.join("/")) };
}

function go(hash) {
    location.hash = hash.startsWith("#") ? hash : "#" + hash;
}

async function boot() {
    const data = await api.boot();
    Object.assign(state, {
        me: data.me,
        videos: data.videos,
        playlists: data.playlists,
        series: data.series,
        notifications: data.notifications,
        unread: data.unread,
        savedIds: data.savedIds,
        likedIds: data.likedIds,
        follows: data.follows,
        history: data.history,
        creators: data.creators
    });
    syncChrome();
}

function applyTheme(theme) {
    const next = theme === "day" ? "day" : "gold";
    state.theme = next;
    document.body.dataset.theme = next;
    localStorage.setItem("kinoTheme", next);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = next === "day" ? "#eceef1" : "#070b12";
}

function isSignedIn() {
    return Boolean(state.me) && !state.me.isGuest;
}

function syncChrome() {
    const name = state.me?.name || "Guest";
    const plan = state.me?.plan || "Classic";
    const avatar = document.getElementById("app-user-avatar");
    const username = document.getElementById("sidebar-username");
    const planEl = document.getElementById("sidebar-plan");
    const loginLabel = document.getElementById("top-login-label");
    const bell = document.getElementById("notify-count");
    if (avatar) avatar.textContent = name.trim().charAt(0).toUpperCase();
    if (username) username.textContent = name;
    if (planEl) planEl.textContent = "Kino " + plan;
    if (loginLabel) loginLabel.textContent = isSignedIn() ? "Your seat" : "Log In";
    if (bell) {
        bell.textContent = state.unread || "";
        bell.classList.toggle("hidden", !state.unread);
    }
}

async function render() {
    const { page, param } = parseRoute();
    const from = document.body.dataset.page || "";
    if (page === "player" && from && from !== "player") {
        const sequential = from === "library" || from === "history" || from === "clips";
        state.watchQueue = sequential
            ? [...new Set([...pageEl().querySelectorAll("[data-play]")].map((el) => Number(el.dataset.play)).filter((n) => n > 0))]
            : [];
    }
    if (page !== "player") {
        state.lastBrowse = page;
        state.watchQueue = [];
    }

    document.querySelectorAll(".nav-item[data-section], .mobile-nav button").forEach((item) => {
        const section = item.dataset.section;
        const on = section === page || (page === "channel" && section === "creators") || (page === "player" && section === state.lastBrowse);
        item.classList.toggle("active", on);
    });
    const housePages = ["library", "history", "upload", "settings", "profile"];
    document.getElementById("app-user-chip")?.classList.toggle("is-on", housePages.includes(page));
    document.getElementById("house-menu")?.querySelector(".house-gear")?.classList.toggle("is-on", page === "settings");
    closeHouse();

    const ctx = { ...state, param, theme: state.theme };
    if (page === "player") {
        const id = Number(param);
        try {
            const data = await api.video(id);
            state.currentVideo = data.video;
            state.comments = data.comments;
            state.upNext = data.upNext;
            state.liked = data.liked;
            state.saved = data.saved;
            state.followed = data.followed;
            Object.assign(ctx, {
                currentVideo: data.video,
                comments: data.comments,
                upNext: data.upNext,
                liked: data.liked,
                saved: data.saved,
                followed: data.followed
            });
            if (state.lastViewed !== id) {
                state.lastViewed = id;
                api.view(id).catch(() => {});
            }
        } catch (err) {
            toast(err.message);
            ctx.currentVideo = null;
        }
    }

    document.body.dataset.page = page;
    const mount = pageEl();
    state.unbindPage?.();
    state.unbindPage = null;
    try {
        mount.innerHTML = await renderPage(page, ctx);
    } catch (err) {
        mount.innerHTML = `<div class="content-wrapper"><div class="page-masthead"><p class="eyebrow">Page</p><h1>Could not load this screen</h1><p class="muted">${err.message}</p></div></div>`;
    }
    mount.scrollTop = 0;
    document.body.classList.remove("nav-open");
    state.unbindPage = bindScreen(page, mount, { state, go }) || null;
}

function openAuth(mode) {
    state.authMode = mode;
    const modal = document.getElementById("login-modal");
    const signup = mode === "signup";
    modal.classList.remove("hidden");
    document.getElementById("login-modal-title").textContent = signup ? "Create your Kino seat" : "Sign in to Kino";
    document.getElementById("login-modal-lead").textContent = signup
        ? "A name, an email, and you are in the house."
        : "Demo: demo@kino.local / demo";
    document.getElementById("login-submit").textContent = signup ? "Create account" : "Sign In";
    document.getElementById("login-name").classList.toggle("hidden", !signup);
    document.getElementById("login-name").required = signup;
    document.getElementById("auth-switch-copy").textContent = signup ? "Already have a seat?" : "New here?";
    document.getElementById("goto-signup").textContent = signup ? "Sign in" : "Create an account";
}

function closeAuth() {
    document.getElementById("login-modal").classList.add("hidden");
}

function closeHouse() {
    const menu = document.getElementById("house-menu");
    const chip = document.getElementById("app-user-chip");
    menu?.classList.remove("is-open");
    chip?.setAttribute("aria-expanded", "false");
}

function toggleHouse() {
    const menu = document.getElementById("house-menu");
    const chip = document.getElementById("app-user-chip");
    const open = !menu?.classList.contains("is-open");
    menu?.classList.toggle("is-open", open);
    chip?.setAttribute("aria-expanded", String(open));
}

async function refreshAndRender() {
    await boot();
    await render();
}

function bindShell() {
    document.querySelectorAll(".nav-item[data-section], .mobile-nav button").forEach((item) => {
        item.addEventListener("click", () => {
            closeHouse();
            go(item.dataset.section);
        });
    });
    document.getElementById("nav-toggle")?.addEventListener("click", () => document.body.classList.toggle("nav-open"));
    document.getElementById("membership-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        go("membership");
    });

    document.addEventListener("click", (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (link && !e.defaultPrevented) {
            const href = link.getAttribute("href") || "";
            if (href.length > 1) {
                e.preventDefault();
                go(href.slice(1));
                closeSearch();
                closeHouse();
                document.body.classList.remove("nav-open");
                return;
            }
        }
        const house = document.getElementById("house-menu");
        if (house && !house.contains(e.target)) closeHouse();
        const dropWrap = document.getElementById("topbar-search-wrap");
        if (dropWrap && !dropWrap.contains(e.target)) closeDrop();
        if (!document.body.classList.contains("nav-open")) return;
        const sidebar = document.getElementById("app-sidebar");
        const toggle = document.getElementById("nav-toggle");
        if (sidebar?.contains(e.target) || toggle?.contains(e.target)) return;
        document.body.classList.remove("nav-open");
    });

    document.getElementById("open-search")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeDrop();
        openSearch();
    });
    document.getElementById("search-close")?.addEventListener("click", closeSearch);
    document.getElementById("search-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "search-overlay") closeSearch();
    });
    document.getElementById("global-search")?.addEventListener("input", (e) => renderSearch(e.target.value, "search-results"));
    const topbarSearch = document.getElementById("topbar-search");
    topbarSearch?.addEventListener("focus", () => {
        closeSearch();
        openDrop();
        renderSearch(topbarSearch.value, "search-drop");
    });
    topbarSearch?.addEventListener("input", () => renderSearch(topbarSearch.value, "search-drop"));
    topbarSearch?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            document.querySelector("#search-drop [data-hit]")?.click();
        }
    });

    document.addEventListener("keydown", (e) => {
        const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
        if (e.key === "/" && !typing) { e.preventDefault(); closeDrop(); openSearch(); }
        if (e.key === "Escape") { closeSearch(); closeDrop(); closeAuth(); closeHouse(); document.body.classList.remove("nav-open"); }
    });

    document.getElementById("top-login-btn")?.addEventListener("click", () => {
        if (isSignedIn()) go("profile");
        else openAuth("signin");
    });
    document.getElementById("app-user-chip")?.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleHouse();
    });
    document.getElementById("login-close")?.addEventListener("click", closeAuth);
    document.getElementById("login-modal")?.addEventListener("click", (e) => {
        if (e.target.id === "login-modal") closeAuth();
    });
    document.getElementById("goto-signup")?.addEventListener("click", () => {
        openAuth(state.authMode === "signup" ? "signin" : "signup");
    });
    document.getElementById("login-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const body = {
            name: document.getElementById("login-name").value.trim(),
            email: document.getElementById("login-email").value.trim(),
            password: document.getElementById("login-password").value
        };
        try {
            if (state.authMode === "signup") await api.signup(body);
            else await api.login(body);
            closeAuth();
            toast("Welcome to the house.");
            await refreshAndRender();
        } catch (err) {
            toast(err.message);
        }
    });

    pageEl().addEventListener("click", onPageClick);
    pageEl().addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.target.id === "comment-input") {
            e.preventDefault();
            submitComment();
        }
    });
}

async function onPageClick(e) {
    const themePick = e.target.closest("[data-theme-pick]");
    if (themePick) {
        applyTheme(themePick.dataset.themePick);
        toast(themePick.dataset.themePick === "day" ? "Daylight look is on." : "Blue house look is on.");
        render();
        return;
    }

    if (e.target.closest("#open-login-settings")) { openAuth("signin"); return; }

    const save = e.target.closest("[data-save]");
    if (save) {
        e.preventDefault();
        e.stopPropagation();
        try {
            const data = await api.save(save.dataset.save);
            state.saved = data.saved;
            const id = Number(save.dataset.save);
            state.savedIds = data.saved
                ? [...new Set([...state.savedIds, id])]
                : state.savedIds.filter((x) => x !== id);
            toast(data.saved ? "Saved to your shelf." : "Removed from your shelf.");
            render();
        } catch (err) { toast(err.message); }
        return;
    }

    const like = e.target.closest("[data-like]");
    if (like) {
        try {
            const data = await api.like(like.dataset.like);
            if (state.currentVideo) state.currentVideo.likes = data.likes;
            state.liked = data.liked;
            render();
        } catch (err) { toast(err.message); }
        return;
    }

    const follow = e.target.closest("[data-follow]");
    if (follow) {
        try {
            const data = await api.follow(follow.dataset.follow);
            state.followed = data.followed;
            state.follows = data.followed
                ? [...new Set([...state.follows, data.creator])]
                : state.follows.filter((n) => n !== data.creator);
            toast(data.followed ? `Following ${data.creator}.` : `Unfollowed ${data.creator}.`);
            render();
        } catch (err) { toast(err.message); }
        return;
    }

    const play = e.target.closest("[data-play]");
    if (play) { go("player/" + play.dataset.play); return; }

    const creator = e.target.closest("[data-creator]");
    if (creator) { state.creatorFilter = creator.dataset.creator; render(); return; }

    const category = e.target.closest("[data-category]");
    if (category) { state.categoryFilter = category.dataset.category; render(); return; }

    const mode = e.target.closest("[data-mode]");
    if (mode) { state.discoverMode = mode.dataset.mode; render(); return; }

    const lib = e.target.closest("[data-lib]");
    if (lib) { state.libraryTab = lib.dataset.lib; render(); return; }

    const plan = e.target.closest("[data-plan]");
    if (plan) {
        try {
            await api.updateMe({ plan: plan.dataset.plan });
            toast("You're on Kino " + plan.dataset.plan + ".");
            await refreshAndRender();
        } catch (err) { toast(err.message); }
        return;
    }

    const note = e.target.closest("[data-note]");
    if (note) {
        try { await api.readNote(note.dataset.note); await refreshAndRender(); }
        catch (err) { toast(err.message); }
        return;
    }

    if (e.target.closest("#player-back-btn")) { go(state.lastBrowse || "home"); return; }
    if (e.target.closest("[data-share]")) {
        try {
            await navigator.clipboard.writeText(location.href);
            toast("Link copied.");
        } catch { toast("Copy the URL from the address bar."); }
        return;
    }
    if (e.target.closest("#submit-comment")) { submitComment(); return; }
    if (e.target.closest("#save-series")) { saveSeries(); return; }
    if (e.target.closest("#publish-upload")) { publishUpload(); return; }
    if (e.target.closest("#save-settings")) { saveSettings(); return; }
    if (e.target.closest("#logout-btn")) {
        await api.logout();
        toast("Signed out.");
        await refreshAndRender();
        return;
    }
    if (e.target.closest(".top-login-btn")) { openAuth("signin"); }
}

async function submitComment() {
    const input = document.getElementById("comment-input");
    const text = input?.value.trim();
    if (!text || !state.currentVideo) return;
    try {
        const data = await api.comment(state.currentVideo.id, text);
        state.comments = data.comments;
        input.value = "";
        render();
    } catch (err) { toast(err.message); }
}

async function saveSeries() {
    try {
        const data = await api.saveSeries({
            title: document.getElementById("series-title")?.value,
            season: document.getElementById("season-number")?.value,
            episodes: document.getElementById("episode-count")?.value,
            description: document.getElementById("series-description")?.value,
            company: document.getElementById("series-company")?.value,
            director: document.getElementById("series-director")?.value
        });
        state.series = data.series;
        toast("Series saved on the server.");
        render();
    } catch (err) { toast(err.message); }
}

async function publishUpload() {
    const title = document.getElementById("upload-title")?.value.trim();
    const desc = document.getElementById("upload-desc")?.value.trim();
    const format = document.getElementById("project-type")?.value || "film";
    const modBox = document.getElementById("upload-moderation");
    if (!title) { toast("Give it a title first."); return; }
    const body = new FormData();
    body.append("title", title);
    body.append("desc", desc);
    body.append("format", format);
    if (state.uploadFile) body.append("file", state.uploadFile);
    if (modBox) {
        modBox.classList.remove("hidden", "is-pass", "is-flag", "is-reject");
        modBox.textContent = "Kino bot is scanning…";
    }
    try {
        const data = await api.createVideo(body);
        state.uploadFile = null;
        const mod = data.moderation || {};
        const status = mod.status || (data.held ? "flag" : "pass");
        if (modBox) {
            modBox.classList.add(status === "flag" ? "is-flag" : "is-pass");
            modBox.textContent = mod.summary || data.message || "Cleared by Kino bot.";
        }
        if (data.held || status === "flag") {
            toast(data.message || "Held for agent review.");
            await refreshAndRender();
            return;
        }
        toast("Published to the house.");
        await refreshAndRender();
        go("library");
    } catch (err) {
        if (modBox) {
            modBox.classList.add("is-reject");
            modBox.textContent = err.message || "Rejected by Kino bot.";
        }
        toast(err.message);
    }
}

async function saveSettings() {
    try {
        await api.updateMe({
            name: document.getElementById("settings-name")?.value,
            autoplay: document.getElementById("settings-autoplay")?.value === "1"
        });
        toast("Settings saved.");
        await refreshAndRender();
    } catch (err) { toast(err.message); }
}

function openSearch() {
    document.getElementById("search-overlay").classList.remove("hidden");
    const input = document.getElementById("global-search");
    renderSearch(input.value, "search-results");
    setTimeout(() => input.focus(), 20);
}

function closeSearch() {
    document.getElementById("search-overlay").classList.add("hidden");
}

function openDrop() {
    document.getElementById("search-drop")?.classList.remove("hidden");
}

function closeDrop() {
    document.getElementById("search-drop")?.classList.add("hidden");
}

function renderSearch(query, targetId) {
    const box = document.getElementById(targetId || "search-results");
    if (!box) return;
    const q = String(query || "").trim().toLowerCase();
    const hits = q
        ? state.videos.filter((v) => [v.title, v.desc, v.uploader, v.category].join(" ").toLowerCase().includes(q))
        : [...state.videos].sort((a, b) => b.views - a.views).slice(0, 6);
    box.innerHTML = hits.length
        ? hits.map((v) => `
            <button type="button" class="search-hit" data-hit="${v.id}">
                <img src="${esc(v.thumbnail)}" alt="">
                <div><strong>${esc(v.title)}</strong><p class="muted" style="margin:0.15rem 0 0;">${esc(v.uploader)}</p></div>
            </button>`).join("")
        : '<div class="empty-state" style="margin:1rem;">No titles match that search.</div>';
    box.querySelectorAll("[data-hit]").forEach((btn) => {
        btn.addEventListener("click", () => {
            closeSearch();
            closeDrop();
            go("player/" + btn.dataset.hit);
        });
    });
}

async function start() {
    applyTheme(state.theme);
    bindShell();
    try {
        await boot();
    } catch (err) {
        pageEl().innerHTML = `
            <div class="content-wrapper">
                <div class="page-masthead">
                    <p class="eyebrow">Kino</p>
                    <h1>Could not start</h1>
                    <p>Refresh the page. Locally, run <code>python server.py</code> and open <code>http://127.0.0.1:5050</code>.</p>
                    <p class="muted">${err.message}</p>
                </div>
            </div>`;
        return;
    }
    window.addEventListener("hashchange", render);
    await render();
}

start();
