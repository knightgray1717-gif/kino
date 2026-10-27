/** Pair: pages/settings.html */
import { setField } from "../html.js";

export function fill(root, ctx) {
    const me = ctx.me;
    const theme = ctx.theme || "gold";
    const signedIn = me && !me.isGuest;
    root.querySelectorAll("[data-theme-pick]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.themePick === theme);
    });
    const autoplay = root.querySelector("#settings-autoplay");
    if (autoplay) autoplay.value = me?.autoplay ? "1" : "0";
    const name = root.querySelector("#settings-name");
    if (name) name.value = me?.name || "Guest";
    setField(root, "plan", me?.plan || "Classic");
    const logout = root.querySelector("#logout-btn");
    const login = root.querySelector("#open-login-settings");
    if (logout) logout.hidden = !signedIn;
    if (login) login.hidden = signedIn;
}
