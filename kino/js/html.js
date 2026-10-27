/** Load page HTML and fill repeating cards. Pair: pages/*.html */

import { attr, compact, esc, formatLabel, initial, titleCase } from "./ui.js";

let tplMap = null;

export async function loadFile(path) {
    const url = new URL(path, document.baseURI);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load " + path);
    return res.text();
}

export async function ready() {
    if (tplMap) return;
    const html = await loadFile("pages/cards.html");
    const doc = new DOMParser().parseFromString(html, "text/html");
    tplMap = {};
    doc.querySelectorAll("template[id]").forEach((node) => {
        tplMap[node.id] = node.innerHTML;
    });
}

export function tpl(id) {
    return tplMap?.[id] || "";
}

export function fill(html, data) {
    return html.replace(/\{\{(\w+)\}\}/g, (_, key) => (data[key] == null ? "" : String(data[key])));
}

export function parsePage(html) {
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    return wrap;
}

export function slot(root, name, html) {
    const el = root.querySelector(`[data-slot="${name}"]`);
    if (el) el.innerHTML = html;
}

export function text(root, sel, value) {
    const el = root.querySelector(sel);
    if (el) el.textContent = value;
}

export function setField(root, name, value) {
    const el = root.querySelector(`[data-field="${name}"]`);
    if (el) el.textContent = value;
}

export function card(video) {
    return fill(tpl("drop-card"), {
        id: video.id,
        thumbnail: attr(video.thumbnail),
        title: esc(video.title),
        uploader: esc(video.uploader),
        views: compact(video.views),
        runtime: esc(video.runtime),
        format: esc(formatLabel(video)),
        initial: esc(initial(video.uploader))
    });
}

export function grid(videos) {
    if (!videos?.length) return '<div class="empty-state">Nothing here yet.</div>';
    return videos.map(card).join("");
}

export function rail(title, href, videos) {
    if (!videos?.length) return "";
    return fill(tpl("rail"), { title: esc(title), href: attr(href || "#"), cards: videos.map(card).join("") });
}

export function chips(items, active, key) {
    return items.map((item) => {
        const id = item.id ?? item;
        const label = item.label ?? item;
        const on = String(active) === String(id);
        return fill(tpl("chip"), {
            active: on ? "active" : "",
            attr: `data-${key}="${attr(id)}"`,
            label: esc(label)
        });
    }).join("");
}

export { attr, compact, esc, formatLabel, initial, titleCase };
