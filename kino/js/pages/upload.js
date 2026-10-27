/** Pair: pages/upload.html — drop + series in one studio screen */
import { esc, fill as fillTpl, slot, tpl } from "../html.js";

export function fill(root, ctx) {
    const schedule = (ctx.series || []).length
        ? ctx.series.map((item) => fillTpl(tpl("schedule-item"), {
            season: esc(item.season),
            company: esc(item.company || "Independent"),
            director: esc(item.director || "TBD"),
            title: esc(item.title)
        })).join("")
        : '<div class="empty-state">No series yet — save one above.</div>';
    slot(root, "schedule", schedule);
}

export function bind(root, extras) {
    const state = extras.state;
    const drop = root.querySelector("#upload-drop");
    const input = root.querySelector("#upload-file");
    const meta = root.querySelector("#upload-preview");
    const pick = () => input?.click();
    drop?.addEventListener("click", pick);
    const onKey = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } };
    drop?.addEventListener("keydown", onKey);
    drop?.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-hot"); });
    drop?.addEventListener("dragleave", () => drop.classList.remove("is-hot"));
    drop?.addEventListener("drop", (e) => {
        e.preventDefault();
        drop.classList.remove("is-hot");
        const file = e.dataTransfer?.files?.[0];
        if (file) {
            state.uploadFile = file;
            if (meta) meta.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
        }
    });
    input?.addEventListener("change", () => {
        const file = input.files?.[0];
        state.uploadFile = file || null;
        if (meta) meta.textContent = file ? `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB` : "";
    });
    return () => {};
}
