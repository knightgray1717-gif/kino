/** Pair: pages/profile.html */
import { grid, setField, slot } from "../html.js";

export function fill(root, ctx) {
    const name = ctx.me?.name || "Guest";
    const mine = ctx.videos.filter((v) => v.uploader === name);
    setField(root, "name", name);
    setField(root, "copy", `${mine.length} titles on this seat · ${ctx.creators.length} curators in the house.`);
    slot(root, "grid", grid(mine));
}
