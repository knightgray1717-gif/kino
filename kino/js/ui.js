export function esc(val) {
    return String(val ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function attr(val) {
    return esc(val);
}

export function titleCase(val) {
    if (!val) return "Featured";
    return String(val).replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function initial(val) {
    return String(val || "K").trim().charAt(0).toUpperCase() || "K";
}

export function compact(number) {
    const n = Number(number) || 0;
    if (n < 1000) return String(n);
    if (n < 1000000) return +(n / 1000).toFixed(1) + "K";
    if (n < 1000000000) return +(n / 1000000).toFixed(1) + "M";
    return +(n / 1000000000).toFixed(1) + "B";
}

export function formatLabel(video) {
    return video?.format === "clip" ? "Clip" : "Feature";
}

export function toast(message) {
    const stack = document.getElementById("toast-stack");
    if (!stack) return;
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    stack.appendChild(node);
    setTimeout(() => node.remove(), 2800);
}

export function dropCard(video) {
    return `
        <article class="drop-card" data-play="${attr(video.id)}">
            <div class="drop-thumb">
                <img src="${attr(video.thumbnail)}" alt="${attr(video.title)}">
                <span class="drop-format">${esc(formatLabel(video))}</span>
                <span class="drop-runtime">${esc(video.runtime)}</span>
                <div class="drop-play"><i class="fas fa-play"></i></div>
            </div>
            <div class="drop-body">
                <div class="user-avatar">${esc(initial(video.uploader))}</div>
                <div>
                    <h3>${esc(video.title)}</h3>
                    <p>${esc(video.uploader)} · ${esc(compact(video.views))} views</p>
                </div>
            </div>
        </article>`;
}

export function dropRail(videos) {
    if (!videos?.length) return `<div class="empty-state">Nothing here yet.</div>`;
    return videos.map(dropCard).join("");
}

export function dropGrid(videos) {
    return `<div class="unified-grid">${dropRail(videos)}</div>`;
}

export function chips(items, active, key = "chip") {
    return items.map((item) => {
        const id = item.id ?? item;
        const label = item.label ?? item;
        const on = String(active) === String(id);
        return `<button type="button" class="tab${on ? " active" : ""}" data-${key}="${attr(id)}">${esc(label)}</button>`;
    }).join("");
}

export function masthead(eyebrow, title, copy, extra = "") {
    return `
        <div class="page-masthead">
            <p class="eyebrow">${esc(eyebrow)}</p>
            <h1>${title}</h1>
            <p>${copy}</p>
            ${extra}
        </div>`;
}
