export async function request(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    let body = opts.body;
    if (body && typeof body === "object" && !(body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(body);
    }
    const res = await fetch(path, {
        credentials: "same-origin",
        ...opts,
        headers,
        body
    });
    let data = {};
    try {
        data = await res.json();
    } catch {
        data = { ok: false, error: `Bad response (${res.status})` };
    }
    if (!res.ok || data.ok === false) {
        throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
}

const SAMPLE = "https://cdn.coverr.co/videos/coverr-sunset-in-the-city-1610/1080p.mp4";
const STORE = "kinoStore";
const THEMES = [
    ["#c4893a", "#e85d4c"],
    ["#6fd6c8", "#2a6f6a"],
    ["#3B82F6", "#1D4ED8"],
    ["#d45d6a", "#4a1d2c"],
    ["#8eb5e8", "#243552"],
    ["#94a3b8", "#334155"]
];

let live = null;

function abortAfter(ms) {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        return AbortSignal.timeout(ms);
    }
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), ms);
    return ctrl.signal;
}

async function liveApi() {
    if (live != null) return live;
    try {
        const res = await fetch("/api/health", { credentials: "same-origin", signal: abortAfter(2500) });
        const data = await res.json();
        live = Boolean(res.ok && data && data.ok && data.service === "kino");
    } catch {
        live = false;
    }
    return live;
}

function poster(id) {
    const [a, b] = THEMES[id % THEMES.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540">
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/>
      </linearGradient></defs>
      <rect width="960" height="540" fill="#070b12"/>
      <rect width="960" height="540" fill="url(#g)" opacity="0.92"/>
    </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function now() {
    return new Date().toISOString();
}

function seedCatalog() {
    const rows = [
        ["Dream Weaver", "A neon-drenched premiere with cinematic pacing and one sharp visual identity.", "entertainment", "Kino Team", "film", "18 min", 450212, 18220, 1],
        ["Hyperspace", "A polished sci-fi launch cut with a brighter palette and a sharper drop schedule.", "music", "Void Artists", "film", "22 min", 198400, 9400, 1],
        ["Neon Nights", "Fast cuts, bright edges, and a tighter short-form rhythm built for repeat viewing.", "sports", "City Explorers", "clip", "58 sec", 312003, 21004, 0],
        ["Quantum Leap", "An education drop packaged like a premium premiere instead of a lecture upload.", "education", "Science Hub", "film", "14 min", 50210, 2100, 0],
        ["Color Study", "Mood, texture, and motion in one scroll — a design-forward short for late nights.", "art", "Kino Curators", "clip", "41 sec", 89000, 6400, 0],
        ["Cosmic Reverb", "Ambient visuals and long-form soundscapes for a premium late-night channel slot.", "music", "Ambient Sounds", "film", "26 min", 24001, 1800, 0],
        ["Harbor Lights", "A slow pan across a working port, scored like a thriller and cut like a travel film.", "travel", "Northbound", "film", "11 min", 67120, 3200, 0],
        ["Afterlight", "Golden-hour portraits and analog grain — a clip made to be looped, not skipped.", "art", "Void Artists", "clip", "36 sec", 154880, 11200, 0],
        ["Signal Lost", "A found-footage short about a radio tower, a storm, and a voice that should not be there.", "entertainment", "City Explorers", "film", "9 min", 88012, 5400, 0],
        ["Glasshouse", "Architecture, plants, and a camera that never sits still — a design essay in motion.", "education", "Kino Curators", "film", "16 min", 41009, 1900, 0],
        ["Night Market", "Steam, neon, and street food cut to a beat. The house favorite for Friday scrolls.", "travel", "Northbound", "clip", "49 sec", 221440, 17800, 0],
        ["Paper Moons", "Stop-motion folklore with handmade sets — a quiet feature with a loud ending.", "art", "Ambient Sounds", "film", "19 min", 33002, 2400, 0],
        ["Ember Room", "A documentary cut about a late-night radio station and the callers who never hang up.", "entertainment", "Kino Team", "film", "21 min", 91004, 6100, 0],
        ["Skyline Cut", "Rooftop motion study — city lights as a score, not a backdrop.", "travel", "City Explorers", "clip", "33 sec", 176550, 9900, 0],
        ["Soft Static", "A music feature built from tape hiss, hallway reverb, and one long tracking shot.", "music", "Ambient Sounds", "film", "24 min", 28040, 2100, 0]
    ];
    return rows.map((row, i) => {
        const id = i + 1;
        return {
            id,
            title: row[0],
            desc: row[1],
            src: SAMPLE,
            thumbnail: poster(id),
            category: row[2],
            uploader: row[3],
            company: row[3],
            format: row[4],
            runtime: row[5],
            views: row[6],
            likes: row[7],
            date: "Just now",
            liveNow: Boolean(row[8]),
            liveSlot: "Fri at 8:00 PM"
        };
    });
}

function blankStore() {
    const videos = seedCatalog();
    return {
        me: { id: 1, name: "Guest", email: "guest@kino.local", plan: "Classic", autoplay: true, isGuest: true },
        users: [{ email: "demo@kino.local", password: "demo", name: "Demo Seat", plan: "Plus" }],
        videos,
        comments: {},
        savedIds: [],
        likedIds: [],
        follows: [],
        history: [],
        series: [{ id: 1, title: "Dream Weaver", season: 1, episodes: 8, company: "Kino Studios", director: "A. Rivera" }],
        playlists: [
            { id: 1, title: "Mood: Night Drive", count: 12, updated: "Today" },
            { id: 2, title: "Creator Reels", count: 8, updated: "Yesterday" },
            { id: 3, title: "Saved Inspiration", count: 15, updated: "This week" }
        ],
        notifications: [
            { id: 1, title: "Dream Weaver is live", body: "The Friday premiere window is open in the house.", read: 0 },
            { id: 2, title: "Northbound dropped Night Market", body: "A new short is looping in Clips.", read: 0 },
            { id: 3, title: "Your Plus seat is active", body: "Downloads and fewer ads are unlocked.", read: 0 }
        ],
        nextId: videos.length + 1
    };
}

const sessionSrc = Object.create(null);

function hydrate(video) {
    if (!video) return video;
    const src = sessionSrc[video.id];
    const thumbnail = video.thumbnail || poster(video.id);
    const moderationStatus = video.moderationStatus || "pass";
    const base = { ...video, thumbnail, moderationStatus };
    return src ? { ...base, src } : base;
}

function publicVideos(list) {
    return (list || []).filter((v) => (v.moderationStatus || "pass") === "pass");
}

/** Local mirror of moderation.py text policy (deep file probes need the Flask bot). */
function localScan({ title = "", desc = "", filename = "", size = 0 } = {}) {
    const text = `${title} ${desc} ${filename}`.toLowerCase();
    const reasons = [];
    const flags = [];
    const rejectSexual = ["porn", "xxx", "onlyfans", "nude", "naked", "hentai", "blowjob", "hardcore", "sextape"];
    const rejectGore = ["decapitat", "snuff", "beheading", "extreme gore", "dismember"];
    const flagRip = ["bluray", "bdrip", "dvdrip", "hdtv", "webrip", "camrip", "yify", "rarbg", "full movie"];
    const allow = ["kiss", "kissing", "romance", "romantic", "intimacy", "couple"];
    const hardSex = ["porn", "xxx", "onlyfans", "nude", "naked", "hentai"];
    const sexHits = rejectSexual.filter((w) => text.includes(w));
    const goreHits = rejectGore.filter((w) => text.includes(w));
    const ripHits = flagRip.filter((w) => text.includes(w));
    const allowHits = allow.filter((w) => text.includes(w));
    const softOnly = sexHits.length && allowHits.length && !sexHits.some((s) => hardSex.includes(s));
    if (sexHits.length && !softOnly) reasons.push(`Explicit sexual content signals: ${sexHits.slice(0, 4).join(", ")}`);
    if (goreHits.length) reasons.push(`Extreme violence / gore signals: ${goreHits.slice(0, 4).join(", ")}`);
    if (size > 0 && size < 8000) reasons.push("File too small — looks empty or broken.");
    if (ripHits.length) flags.push(`Possible copyright / rip naming: ${ripHits.slice(0, 4).join(", ")}`);
    if (reasons.length) {
        return { status: "reject", reasons, summary: reasons.slice(0, 3).join("; "), checks: { engine: "kino-bot-local" } };
    }
    if (flags.length) {
        return { status: "flag", reasons: flags, summary: flags.slice(0, 3).join("; "), checks: { engine: "kino-bot-local", allowed_intimacy: allowHits } };
    }
    return {
        status: "pass",
        reasons: ["Cleared house checks (safety + sanity). Kissing / romance allowed."],
        summary: "Cleared house checks (safety + sanity). Kissing / romance allowed.",
        checks: { engine: "kino-bot-local", allowed_intimacy: allowHits }
    };
}

function scrubSrc(video) {
    if (!video) return video;
    if (String(video.src || "").startsWith("blob:")) video.src = SAMPLE;
    if (!video.thumbnail) video.thumbnail = poster(video.id);
    return video;
}

function load() {
    const fresh = blankStore();
    try {
        const raw = localStorage.getItem(STORE);
        if (raw) {
            const data = JSON.parse(raw);
            const merged = { ...fresh, ...data };
            for (const key of ["videos", "users", "savedIds", "likedIds", "follows", "history", "series", "playlists", "notifications"]) {
                if (!Array.isArray(merged[key])) merged[key] = fresh[key];
            }
            if (!merged.me || typeof merged.me !== "object") merged.me = fresh.me;
            if (!merged.comments || typeof merged.comments !== "object") merged.comments = {};
            if (!merged.videos.length) merged.videos = fresh.videos;
            merged.videos = merged.videos.map(scrubSrc);
            merged.history = merged.history.map(scrubSrc);
            const maxId = merged.videos.reduce((n, video) => Math.max(n, Number(video.id) || 0), 0);
            if (!merged.nextId || merged.nextId <= maxId) merged.nextId = maxId + 1;
            return merged;
        }
    } catch { /* use seed */ }
    save(fresh);
    return fresh;
}

function save(data) {
    try {
        const copy = JSON.parse(JSON.stringify({
            ...data,
            videos: data.videos.map((video) => ({
                ...video,
                src: String(video.src || "").startsWith("blob:") ? SAMPLE : video.src
            }))
        }));
        localStorage.setItem(STORE, JSON.stringify(copy));
    } catch { /* quota */ }
}

function creatorsOf(videos) {
    const map = {};
    for (const video of videos) {
        const bucket = map[video.uploader] || (map[video.uploader] = { name: video.uploader, titles: 0, views: 0 });
        bucket.titles += 1;
        bucket.views += video.views || 0;
    }
    return Object.values(map).sort((a, b) => b.views - a.views);
}

function bootPayload(db) {
    return {
        ok: true,
        me: db.me,
        videos: publicVideos(db.videos).map(hydrate),
        playlists: db.playlists,
        series: db.series,
        notifications: db.me?.isGuest ? [] : db.notifications,
        unread: db.me?.isGuest ? 0 : db.notifications.filter((n) => !n.read).length,
        savedIds: db.savedIds,
        likedIds: db.likedIds,
        follows: db.follows,
        history: db.history.map(hydrate),
        creators: creatorsOf(db.videos)
    };
}

const local = {
    boot: async () => bootPayload(load()),
    health: async () => ({ ok: true, service: "kino-local" }),
    debug: async () => ({ ok: true }),
    videos: async () => ({ ok: true, videos: publicVideos(load().videos).map(hydrate) }),
    video: async (id) => {
        const db = load();
        const video = db.videos.find((v) => v.id === Number(id));
        if (!video || (video.moderationStatus || "pass") !== "pass") throw new Error("Title not found.");
        const key = String(id);
        return {
            ok: true,
            video: hydrate(video),
            comments: db.comments[key] || [],
            upNext: publicVideos(db.videos).filter((v) => v.id !== video.id).sort((a, b) => b.views - a.views).slice(0, 6).map(hydrate),
            liked: db.likedIds.includes(video.id),
            saved: db.savedIds.includes(video.id),
            followed: db.follows.includes(video.uploader)
        };
    },
    createVideo: async (payload) => {
        const db = load();
        let title = "";
        let desc = "";
        let format = "film";
        let src = SAMPLE;
        let filename = "";
        let size = 0;
        if (payload instanceof FormData) {
            title = String(payload.get("title") || "").trim();
            desc = String(payload.get("desc") || "");
            format = payload.get("format") || "film";
            const file = payload.get("file");
            if (file instanceof File && file.size) {
                src = URL.createObjectURL(file);
                filename = file.name || "";
                size = file.size;
            }
        } else {
            title = String(payload.title || "").trim();
            desc = payload.desc || "";
            format = payload.format || "film";
            src = payload.src || SAMPLE;
        }
        if (!title) throw new Error("Give the title a name.");
        const moderation = localScan({ title, desc, filename, size });
        if (moderation.status === "reject") {
            throw new Error(`Kino bot rejected this upload: ${moderation.summary}`);
        }
        const id = db.nextId++;
        const video = {
            id,
            title,
            desc,
            src,
            thumbnail: poster(id),
            category: "featured",
            uploader: db.me?.name || "Guest",
            company: (db.me?.name || "Guest") + " Studio",
            format: String(format).toLowerCase().includes("clip") ? "clip" : "film",
            runtime: String(format).toLowerCase().includes("clip") ? "45 sec" : "12 min",
            views: 0,
            likes: 0,
            date: "Just now",
            liveNow: false,
            liveSlot: "Fri at 8:00 PM",
            moderationStatus: moderation.status,
            moderationSummary: moderation.summary
        };
        db.videos.push(video);
        if (String(src).startsWith("blob:")) sessionSrc[id] = src;
        save(db);
        const held = moderation.status === "flag";
        return {
            ok: true,
            video: hydrate(video),
            moderation,
            held,
            message: held ? "Held for agent review — possible copyright or originality concern." : undefined
        };
    },
    view: async (id) => {
        const db = load();
        const video = db.videos.find((v) => v.id === Number(id));
        if (video) {
            video.views = (video.views || 0) + 1;
            db.history = [{ ...video, watchedAt: now() }, ...db.history.filter((h) => h.id !== video.id)].slice(0, 20);
            save(db);
        }
        return { ok: true };
    },
    like: async (id) => {
        const db = load();
        const vid = Number(id);
        const video = db.videos.find((v) => v.id === vid);
        const on = db.likedIds.includes(vid);
        db.likedIds = on ? db.likedIds.filter((n) => n !== vid) : [...db.likedIds, vid];
        if (video) video.likes = Math.max((video.likes || 0) + (on ? -1 : 1), 0);
        save(db);
        return { ok: true, liked: !on, likes: video?.likes || 0 };
    },
    save: async (id) => {
        const db = load();
        const vid = Number(id);
        const on = db.savedIds.includes(vid);
        db.savedIds = on ? db.savedIds.filter((n) => n !== vid) : [...db.savedIds, vid];
        save(db);
        return { ok: true, saved: !on };
    },
    comment: async (id, text) => {
        const db = load();
        const note = String(text || "").trim();
        if (!note) throw new Error("Write a note first.");
        const list = db.comments[String(id)] || [];
        list.unshift({ user: db.me?.name || "Guest", text: note, time: now() });
        db.comments[String(id)] = list;
        save(db);
        return { ok: true, comments: list };
    },
    follow: async (creator) => {
        const db = load();
        const on = db.follows.includes(creator);
        db.follows = on ? db.follows.filter((n) => n !== creator) : [...db.follows, creator];
        save(db);
        return { ok: true, followed: !on, creator };
    },
    signup: async (body) => {
        const db = load();
        const email = String(body.email || "").trim().toLowerCase();
        const name = String(body.name || "").trim() || "Member";
        if (db.users.some((u) => u.email === email)) throw new Error("That email already has a seat.");
        db.users.push({ email, password: body.password, name, plan: "Classic" });
        db.me = { id: Date.now(), name, email, plan: "Classic", autoplay: true, isGuest: false };
        save(db);
        return { ok: true, me: db.me };
    },
    login: async (body) => {
        const db = load();
        const email = String(body.email || "").trim().toLowerCase();
        const user = db.users.find((u) => u.email === email && u.password === body.password);
        if (!user) throw new Error("Email or password did not match.");
        db.me = { id: 2, name: user.name, email: user.email, plan: user.plan, autoplay: true, isGuest: false };
        save(db);
        return { ok: true, me: db.me };
    },
    logout: async () => {
        const db = load();
        db.me = { id: 1, name: "Guest", email: "guest@kino.local", plan: "Classic", autoplay: true, isGuest: true };
        save(db);
        return { ok: true };
    },
    updateMe: async (body) => {
        const db = load();
        if (body.name) db.me.name = body.name;
        if (body.plan) db.me.plan = body.plan;
        if (body.autoplay != null) db.me.autoplay = body.autoplay;
        const user = db.users.find((u) => u.email === db.me.email);
        if (user) {
            if (body.name) user.name = body.name;
            if (body.plan) user.plan = body.plan;
        }
        save(db);
        return { ok: true, me: db.me };
    },
    saveSeries: async (body) => {
        const db = load();
        db.series.unshift({
            id: Date.now(),
            title: body.title || "Untitled",
            season: Number(body.season) || 1,
            episodes: Number(body.episodes) || 8,
            description: body.description || "",
            company: body.company || "",
            director: body.director || ""
        });
        save(db);
        return { ok: true, series: db.series };
    },
    readNote: async (id) => {
        const db = load();
        const note = db.notifications.find((n) => n.id === Number(id));
        if (note) note.read = 1;
        save(db);
        return { ok: true };
    }
};

function liveCall(name, args) {
    if (name === "videos") {
        const params = args[0] || {};
        const q = new URLSearchParams(params).toString();
        return request("/api/videos" + (q ? `?${q}` : ""));
    }
    if (name === "video") return request(`/api/videos/${args[0]}`);
    if (name === "createVideo") return request("/api/videos", { method: "POST", body: args[0] });
    if (name === "view") return request(`/api/videos/${args[0]}/view`, { method: "POST" });
    if (name === "like") return request(`/api/videos/${args[0]}/like`, { method: "POST" });
    if (name === "save") return request(`/api/videos/${args[0]}/save`, { method: "POST" });
    if (name === "comment") return request(`/api/videos/${args[0]}/comments`, { method: "POST", body: { text: args[1] } });
    if (name === "follow") return request("/api/follow", { method: "POST", body: { creator: args[0] } });
    if (name === "signup") return request("/api/auth/signup", { method: "POST", body: args[0] });
    if (name === "login") return request("/api/auth/login", { method: "POST", body: args[0] });
    if (name === "logout") return request("/api/auth/logout", { method: "POST" });
    if (name === "updateMe") return request("/api/me", { method: "POST", body: args[0] });
    if (name === "saveSeries") return request("/api/series", { method: "POST", body: args[0] });
    if (name === "readNote") return request(`/api/notifications/${args[0]}/read`, { method: "POST" });
    return request("/api/" + name);
}

function wrap(name) {
    return async (...args) => {
        if (await liveApi()) {
            try {
                return await liveCall(name, args);
            } catch (err) {
                if (name === "boot") {
                    live = false;
                    return local.boot();
                }
                throw err;
            }
        }
        return local[name](...args);
    };
}

export const api = {
    health: wrap("health"),
    debug: wrap("debug"),
    boot: wrap("boot"),
    videos: wrap("videos"),
    video: wrap("video"),
    createVideo: wrap("createVideo"),
    view: wrap("view"),
    like: wrap("like"),
    save: wrap("save"),
    comment: wrap("comment"),
    follow: wrap("follow"),
    signup: wrap("signup"),
    login: wrap("login"),
    logout: wrap("logout"),
    updateMe: wrap("updateMe"),
    saveSeries: wrap("saveSeries"),
    readNote: wrap("readNote")
};
