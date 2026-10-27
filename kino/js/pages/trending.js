/** Pair: pages/trending.html */
import { grid, slot } from "../html.js";

export function fill(root, ctx) {
    slot(root, "grid", grid([...ctx.videos].sort((a, b) => b.views - a.views)));
}
