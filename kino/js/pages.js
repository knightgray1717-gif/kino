/**
 * Maps a route name to pages/<name>.html + js/pages/<name>.js
 * HTML = layout. JS = fill data + bind clicks. Python = real backend.
 */
import { loadFile, parsePage, ready } from "./html.js";
import * as home from "./pages/home.js";
import * as discovery from "./pages/discovery.js";
import * as clips from "./pages/clips.js";
import * as live from "./pages/live.js";
import * as library from "./pages/library.js";
import * as history from "./pages/history.js";
import * as upload from "./pages/upload.js";
import * as membership from "./pages/membership.js";
import * as player from "./pages/player.js";
import * as profile from "./pages/profile.js";
import * as creators from "./pages/creators.js";
import * as channel from "./pages/channel.js";
import * as settings from "./pages/settings.js";
import * as notifications from "./pages/notifications.js";

const screens = {
    home,
    discovery,
    clips,
    live,
    library,
    history,
    upload,
    series: upload,
    membership,
    player,
    profile,
    creators,
    channel,
    settings,
    notifications
};

export function screenName(name) {
    if (name === "series" || name === "studio") return "upload";
    if (name === "trending") return "discovery";
    return screens[name] ? name : "home";
}

export async function renderPage(name, ctx) {
    await ready();
    const file = screenName(name);
    const root = parsePage(await loadFile("pages/" + file + ".html"));
    screens[file].fill?.(root, ctx);
    return root.innerHTML;
}

export function bindScreen(name, root, extras) {
    const screen = screens[screenName(name)];
    return screen.bind?.(root, extras) || null;
}
