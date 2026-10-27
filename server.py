"""
Kino backend — Flask + SQLite.

Run:
    python -m pip install -r requirements.txt
    python server.py

Then open http://127.0.0.1:5050
Demo login: demo@kino.local / demo
"""

from __future__ import annotations

import atexit
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from flask import Flask, Response, g, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from moderation import scan_upload

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
UPLOAD_DIR = ROOT / "uploads"
DB_PATH = DATA_DIR / "kino.db"

SAMPLE_VIDEO = "https://cdn.coverr.co/videos/coverr-sunset-in-the-city-1610/1080p.mp4"

POSTER_THEMES = [
    ("#c4893a", "#e85d4c", "#1a1208"),
    ("#6fd6c8", "#2a6f6a", "#071614"),
    ("#e8b86d", "#7a4a1e", "#1c1208"),
    ("#d45d6a", "#4a1d2c", "#1a0b10"),
    ("#8eb5e8", "#243552", "#0b1220"),
    ("#d4a054", "#3d2a12", "#1a1308"),
]

app = Flask(__name__, static_folder=None)
app.config.update(
    SECRET_KEY="kino-dev-secret-change-me",
    MAX_CONTENT_LENGTH=80 * 1024 * 1024,
    JSON_SORT_KEYS=False,
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def db() -> sqlite3.Connection:
    if "db" not in g:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def query_all(sql: str, args=()):
    cur = db().execute(sql, args)
    return [dict(row) for row in cur.fetchall()]


def query_one(sql: str, args=()):
    cur = db().execute(sql, args)
    row = cur.fetchone()
    return dict(row) if row else None


def ok(**payload):
    body = {"ok": True}
    body.update(payload)
    return jsonify(body)


def fail(message: str, status: int = 400):
    return jsonify({"ok": False, "error": message}), status


def video_json(row: dict) -> dict:
    vid = row["id"]
    thumb = row.get("thumbnail") or f"/api/poster/{vid}"
    mod_status = row.get("moderation_status") or "pass"
    return {
        "id": vid,
        "title": row.get("title"),
        "desc": row.get("description"),
        "src": row.get("src") or SAMPLE_VIDEO,
        "thumbnail": thumb,
        "category": row.get("category"),
        "uploader": row.get("uploader"),
        "company": row.get("company"),
        "director": row.get("director"),
        "producer": row.get("producer"),
        "videographer": row.get("videographer"),
        "featured": row.get("featured"),
        "format": row.get("format"),
        "runtime": row.get("runtime"),
        "liveSlot": row.get("live_slot"),
        "views": row.get("views") or 0,
        "likes": row.get("likes") or 0,
        "date": row.get("date_label") or "Just now",
        "liveNow": bool(row.get("live_now")),
        "moderationStatus": mod_status,
        "moderationSummary": row.get("moderation_summary") or "",
    }


def public_videos_sql(extra: str = "", order: str = "ORDER BY id") -> str:
    """House catalog: only bot-pass titles. Flagged wait for agent; reject never stored."""
    return f"SELECT * FROM videos WHERE COALESCE(moderation_status, 'pass') = 'pass'{extra} {order}"


def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    row = query_one("SELECT id, name, email, plan, autoplay FROM users WHERE id = ?", (uid,))
    if not row:
        return None
    row["isGuest"] = str(row.get("email") or "").startswith("guest-")
    return row


def require_user():
    user = current_user()
    if user:
        return user, None
    email = f"guest-{uuid.uuid4().hex[:10]}@kino.local"
    cur = db().execute(
        "INSERT INTO users (name, email, password_hash, plan) VALUES (?, ?, ?, ?)",
        ("Guest", email, generate_password_hash(uuid.uuid4().hex), "Classic"),
    )
    db().commit()
    session["user_id"] = cur.lastrowid
    return current_user(), None


def seed_videos():
    return [
        dict(title="Dream Weaver", description="A neon-drenched premiere with cinematic pacing and one sharp visual identity.", category="entertainment", uploader="Kino Team", company="Kino Studios", director="A. Rivera", producer="L. Chen", videographer="J. Malik", featured="Studio Partners", format="film", runtime="18 min", live_slot="Fri at 8:00 PM", views=450212, likes=18220, date_label="2 days ago", live_now=1),
        dict(title="Hyperspace", description="A polished sci-fi launch cut with a brighter palette and a sharper drop schedule.", category="music", uploader="Void Artists", company="Void Media", director="M. Vega", producer="K. Ortiz", videographer="S. Bloom", featured="HoloFX", format="film", runtime="22 min", live_slot="Sat at 9:30 PM", views=198400, likes=9400, date_label="1 week ago", live_now=1),
        dict(title="Neon Nights", description="Fast cuts, bright edges, and a tighter short-form rhythm built for repeat viewing.", category="sports", uploader="City Explorers", company="Urban Frame", director="T. Lin", producer="R. Patel", videographer="C. Gomez", featured="Street Collective", format="clip", runtime="58 sec", live_slot="Sun at 7:00 PM", views=312003, likes=21004, date_label="1 month ago", live_now=0),
        dict(title="Quantum Leap", description="An education drop packaged like a premium premiere instead of a lecture upload.", category="education", uploader="Science Hub", company="Science Hub", director="Dr. L. Yates", producer="A. Kim", videographer="I. Novak", featured="Lab Partners", format="film", runtime="14 min", live_slot="Mon at 6:30 PM", views=50210, likes=2100, date_label="3 hours ago", live_now=0),
        dict(title="Color Study", description="Mood, texture, and motion in one scroll — a design-forward short for late nights.", category="art", uploader="Kino Curators", company="Kino Curators", director="D. Walsh", producer="N. Price", videographer="E. Hart", featured="Palette House", format="clip", runtime="41 sec", live_slot="Tue at 5:45 PM", views=89000, likes=6400, date_label="4 days ago", live_now=0),
        dict(title="Cosmic Reverb", description="Ambient visuals and long-form soundscapes for a premium late-night channel slot.", category="music", uploader="Ambient Sounds", company="Independent", director="S. Vale", producer="R. Moon", videographer="I. North", featured="Night Signal", format="film", runtime="26 min", live_slot="Wed at 10:15 PM", views=24001, likes=1800, date_label="2 weeks ago", live_now=0),
        dict(title="Harbor Lights", description="A slow pan across a working port, scored like a thriller and cut like a travel film.", category="travel", uploader="Northbound", company="Northbound", director="P. Shore", producer="M. Hale", videographer="K. Dunn", featured="Dockside Crew", format="film", runtime="11 min", live_slot="Thu at 8:15 PM", views=67120, likes=3200, date_label="5 days ago", live_now=0),
        dict(title="Afterlight", description="Golden-hour portraits and analog grain — a clip made to be looped, not skipped.", category="art", uploader="Void Artists", company="Void Media", director="M. Vega", producer="K. Ortiz", videographer="S. Bloom", featured="Film Lab", format="clip", runtime="36 sec", live_slot="Fri at 6:00 PM", views=154880, likes=11200, date_label="6 days ago", live_now=0),
        dict(title="Signal Lost", description="A found-footage short about a radio tower, a storm, and a voice that should not be there.", category="entertainment", uploader="City Explorers", company="Urban Frame", director="T. Lin", producer="R. Patel", videographer="C. Gomez", featured="Night Desk", format="film", runtime="9 min", live_slot="Sat at 11:00 PM", views=88012, likes=5400, date_label="8 days ago", live_now=0),
        dict(title="Glasshouse", description="Architecture, plants, and a camera that never sits still — a design essay in motion.", category="education", uploader="Kino Curators", company="Kino Curators", director="D. Walsh", producer="N. Price", videographer="E. Hart", featured="Atrium Studio", format="film", runtime="16 min", live_slot="Sun at 4:00 PM", views=41009, likes=1900, date_label="12 days ago", live_now=0),
        dict(title="Night Market", description="Steam, neon, and street food cut to a beat. The house favorite for Friday scrolls.", category="travel", uploader="Northbound", company="Northbound", director="P. Shore", producer="M. Hale", videographer="K. Dunn", featured="Alley Kitchen", format="clip", runtime="49 sec", live_slot="Fri at 9:45 PM", views=221440, likes=17800, date_label="2 days ago", live_now=0),
        dict(title="Paper Moons", description="Stop-motion folklore with handmade sets — a quiet feature with a loud ending.", category="art", uploader="Ambient Sounds", company="Independent", director="S. Vale", producer="R. Moon", videographer="I. North", featured="Fold & Frame", format="film", runtime="19 min", live_slot="Wed at 7:30 PM", views=33002, likes=2400, date_label="3 weeks ago", live_now=0),
        dict(title="Ember Room", description="A documentary cut about a late-night radio station and the callers who never hang up.", category="entertainment", uploader="Kino Team", company="Kino Studios", director="A. Rivera", producer="L. Chen", videographer="J. Malik", featured="Night Desk", format="film", runtime="21 min", live_slot="Thu at 10:00 PM", views=91004, likes=6100, date_label="9 days ago", live_now=0),
        dict(title="Skyline Cut", description="Rooftop motion study — city lights as a score, not a backdrop.", category="travel", uploader="City Explorers", company="Urban Frame", director="T. Lin", producer="R. Patel", videographer="C. Gomez", featured="Roof Club", format="clip", runtime="33 sec", live_slot="Sat at 8:20 PM", views=176550, likes=9900, date_label="3 days ago", live_now=0),
        dict(title="Soft Static", description="A music feature built from tape hiss, hallway reverb, and one long tracking shot.", category="music", uploader="Ambient Sounds", company="Independent", director="S. Vale", producer="R. Moon", videographer="I. North", featured="Tape Room", format="film", runtime="24 min", live_slot="Sun at 9:10 PM", views=28040, likes=2100, date_label="11 days ago", live_now=0),
    ]


def init_db():
    DATA_DIR.mkdir(exist_ok=True)
    UPLOAD_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            plan TEXT NOT NULL DEFAULT 'Classic',
            autoplay INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            src TEXT,
            thumbnail TEXT,
            category TEXT,
            uploader TEXT,
            company TEXT,
            director TEXT,
            producer TEXT,
            videographer TEXT,
            featured TEXT,
            format TEXT,
            runtime TEXT,
            live_slot TEXT,
            views INTEGER DEFAULT 0,
            likes INTEGER DEFAULT 0,
            date_label TEXT,
            live_now INTEGER DEFAULT 0,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER NOT NULL,
            user_name TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at TEXT,
            FOREIGN KEY(video_id) REFERENCES videos(id)
        );
        CREATE TABLE IF NOT EXISTS saved (
            user_id INTEGER NOT NULL,
            video_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, video_id)
        );
        CREATE TABLE IF NOT EXISTS likes (
            user_id INTEGER NOT NULL,
            video_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, video_id)
        );
        CREATE TABLE IF NOT EXISTS follows (
            user_id INTEGER NOT NULL,
            creator TEXT NOT NULL,
            PRIMARY KEY (user_id, creator)
        );
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            video_id INTEGER NOT NULL,
            watched_at TEXT
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT NOT NULL,
            body TEXT,
            read INTEGER DEFAULT 0,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS series (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT NOT NULL,
            season INTEGER,
            episodes INTEGER,
            description TEXT,
            company TEXT,
            director TEXT,
            producer TEXT,
            dop TEXT,
            featured TEXT
        );
        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT NOT NULL,
            count INTEGER DEFAULT 0,
            updated TEXT
        );
        """
    )
    count = conn.execute("SELECT COUNT(*) FROM videos").fetchone()[0]
    if count == 0:
        for item in seed_videos():
            conn.execute(
                """
                INSERT INTO videos (title, description, src, category, uploader, company, director,
                    producer, videographer, featured, format, runtime, live_slot, views, likes,
                    date_label, live_now, created_at)
                VALUES (:title, :description, :src, :category, :uploader, :company, :director,
                    :producer, :videographer, :featured, :format, :runtime, :live_slot, :views, :likes,
                    :date_label, :live_now, :created_at)
                """,
                {**item, "src": SAMPLE_VIDEO, "created_at": utc_now()},
            )
        conn.execute(
            "INSERT INTO users (name, email, password_hash, plan) VALUES (?, ?, ?, ?)",
            ("Demo Seat", "demo@kino.local", generate_password_hash("demo"), "Plus"),
        )
        demo_id = conn.execute("SELECT id FROM users WHERE email = ?", ("demo@kino.local",)).fetchone()[0]
        for title, count_n, updated in (
            ("Mood: Night Drive", 12, "Today"),
            ("Creator Reels", 8, "Yesterday"),
            ("Saved Inspiration", 15, "This week"),
        ):
            conn.execute(
                "INSERT INTO playlists (user_id, title, count, updated) VALUES (?, ?, ?, ?)",
                (demo_id, title, count_n, updated),
            )
        notes = [
            ("Dream Weaver is live", "The Friday premiere window is open in the house."),
            ("Northbound dropped Night Market", "A new short is looping in Clips."),
            ("Your Plus seat is active", "Downloads and fewer ads are unlocked."),
        ]
        for title, body in notes:
            conn.execute(
                "INSERT INTO notifications (user_id, title, body, created_at) VALUES (?, ?, ?, ?)",
                (demo_id, title, body, utc_now()),
            )
        conn.execute(
            """
            INSERT INTO series (user_id, title, season, episodes, description, company, director, producer, dop, featured)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (demo_id, "Dream Weaver", 1, 8, "Neon folklore across one season of drops.", "Kino Studios", "A. Rivera", "L. Chen", "J. Malik", "Studio Partners"),
        )
        conn.commit()
    conn.close()
    migrate_db()


def migrate_db():
    """Add moderation columns on existing SQLite files without wiping data."""
    conn = sqlite3.connect(DB_PATH)
    cols = {row[1] for row in conn.execute("PRAGMA table_info(videos)").fetchall()}
    alters = []
    if "moderation_status" not in cols:
        alters.append("ALTER TABLE videos ADD COLUMN moderation_status TEXT DEFAULT 'pass'")
    if "moderation_summary" not in cols:
        alters.append("ALTER TABLE videos ADD COLUMN moderation_summary TEXT DEFAULT ''")
    if "moderation_json" not in cols:
        alters.append("ALTER TABLE videos ADD COLUMN moderation_json TEXT DEFAULT ''")
    if "content_hash" not in cols:
        alters.append("ALTER TABLE videos ADD COLUMN content_hash TEXT DEFAULT ''")
    for sql in alters:
        conn.execute(sql)
    if alters:
        conn.execute(
            "UPDATE videos SET moderation_status = 'pass' WHERE moderation_status IS NULL OR moderation_status = ''"
        )
        conn.commit()
    conn.close()


def existing_content_hashes() -> set[str]:
    rows = query_all("SELECT content_hash FROM videos WHERE content_hash IS NOT NULL AND content_hash != ''")
    return {row["content_hash"] for row in rows if row.get("content_hash")}


# ── API ──────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return ok(service="kino", time=utc_now())


@app.get("/api/debug")
def debug_dump():
    counts = {
        "users": query_one("SELECT COUNT(*) AS n FROM users")["n"],
        "videos": query_one("SELECT COUNT(*) AS n FROM videos")["n"],
        "comments": query_one("SELECT COUNT(*) AS n FROM comments")["n"],
        "notifications": query_one("SELECT COUNT(*) AS n FROM notifications")["n"],
    }
    return ok(counts=counts, session_user=current_user())


@app.get("/api/boot")
def boot():
    user = current_user()
    videos = [video_json(v) for v in query_all(public_videos_sql())]
    playlists = query_all("SELECT id, title, count, updated FROM playlists ORDER BY id")
    series = query_all("SELECT * FROM series ORDER BY id DESC")
    notes = []
    saved = []
    history = []
    liked = []
    follows = []
    unread = 0
    if user:
        notes = query_all(
            "SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ? ORDER BY id DESC",
            (user["id"],),
        )
        unread = sum(1 for n in notes if not n["read"])
        saved = [row["video_id"] for row in query_all("SELECT video_id FROM saved WHERE user_id = ?", (user["id"],))]
        liked = [row["video_id"] for row in query_all("SELECT video_id FROM likes WHERE user_id = ?", (user["id"],))]
        follows = [row["creator"] for row in query_all("SELECT creator FROM follows WHERE user_id = ?", (user["id"],))]
        history_rows = query_all(
            """
            SELECT h.video_id, h.watched_at, v.*
            FROM history h JOIN videos v ON v.id = h.video_id
            WHERE h.user_id = ?
              AND COALESCE(v.moderation_status, 'pass') = 'pass'
            ORDER BY h.id DESC LIMIT 20
            """,
            (user["id"],),
        )
        history = [{**video_json(row), "watchedAt": row["watched_at"]} for row in history_rows]
    creators = {}
    for video in videos:
        bucket = creators.setdefault(video["uploader"], {"name": video["uploader"], "titles": 0, "views": 0})
        bucket["titles"] += 1
        bucket["views"] += video["views"]
    return ok(
        me=user,
        videos=videos,
        playlists=playlists,
        series=series,
        notifications=notes,
        unread=unread,
        savedIds=saved,
        likedIds=liked,
        follows=follows,
        history=history,
        creators=sorted(creators.values(), key=lambda c: c["views"], reverse=True),
    )


@app.get("/api/videos")
def list_videos():
    q = (request.args.get("q") or "").strip().lower()
    fmt = (request.args.get("format") or "").strip().lower()
    category = (request.args.get("category") or "").strip().lower()
    extra = ""
    args = []
    if q:
        extra += " AND (lower(title) LIKE ? OR lower(description) LIKE ? OR lower(uploader) LIKE ? OR lower(category) LIKE ?)"
        like = f"%{q}%"
        args.extend([like, like, like, like])
    if fmt in ("clip", "film"):
        extra += " AND format = ?"
        args.append(fmt)
    if category and category != "all":
        extra += " AND lower(category) = ?"
        args.append(category)
    order = "ORDER BY views DESC" if request.args.get("sort") == "trending" else "ORDER BY id"
    return ok(videos=[video_json(v) for v in query_all(public_videos_sql(extra, order), args)])


@app.get("/api/videos/<int:video_id>")
def get_video(video_id: int):
    row = query_one("SELECT * FROM videos WHERE id = ?", (video_id,))
    if not row:
        return fail("Title not found.", 404)
    if (row.get("moderation_status") or "pass") != "pass":
        return fail("Title is held for review.", 404)
    comments = query_all(
        "SELECT user_name AS user, text, created_at AS time FROM comments WHERE video_id = ? ORDER BY id DESC",
        (video_id,),
    )
    up_next = [
        video_json(v)
        for v in query_all(
            public_videos_sql(" AND id != ?", "ORDER BY views DESC LIMIT 6"),
            (video_id,),
        )
    ]
    user = current_user()
    liked = False
    saved = False
    followed = False
    if user:
        liked = bool(query_one("SELECT 1 FROM likes WHERE user_id = ? AND video_id = ?", (user["id"], video_id)))
        saved = bool(query_one("SELECT 1 FROM saved WHERE user_id = ? AND video_id = ?", (user["id"], video_id)))
        followed = bool(query_one("SELECT 1 FROM follows WHERE user_id = ? AND creator = ?", (user["id"], row["uploader"])))
    return ok(video=video_json(row), comments=comments, upNext=up_next, liked=liked, saved=saved, followed=followed)


@app.post("/api/videos")
def create_video():
    user = current_user()
    src = SAMPLE_VIDEO
    saved_path = None
    filename = ""
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        title = (payload.get("title") or "").strip()
        description = payload.get("desc") or payload.get("description") or ""
        fmt = payload.get("format") or "film"
        category = payload.get("category") or "featured"
        src = payload.get("src") or SAMPLE_VIDEO
    else:
        title = (request.form.get("title") or "").strip()
        description = request.form.get("desc") or request.form.get("description") or ""
        fmt = request.form.get("format") or "film"
        category = request.form.get("category") or "featured"
        file = request.files.get("file")
        if file and file.filename:
            filename = file.filename
            name = f"{uuid.uuid4().hex[:10]}_{secure_filename(file.filename)}"
            saved_path = UPLOAD_DIR / name
            file.save(saved_path)
            src = f"/uploads/{name}"
    if not title:
        return fail("Give the title a name.")

    report = scan_upload(
        title=title,
        description=description,
        filename=filename,
        path=saved_path,
        existing_hashes=existing_content_hashes(),
    )
    if report["status"] == "reject":
        if saved_path and saved_path.is_file():
            try:
                saved_path.unlink()
            except OSError:
                pass
        return fail(f"Kino bot rejected this upload: {report['summary']}", 400)

    fmt = "clip" if str(fmt).lower() in ("clip", "clips") else "film"
    uploader = user["name"] if user else "Kino Guest"
    mod_status = report["status"]
    mod_summary = report["summary"]
    mod_json = json.dumps(report)
    file_hash = report.get("hash") or ""
    cur = db().execute(
        """
        INSERT INTO videos (title, description, src, category, uploader, company, format, runtime,
            live_slot, views, likes, date_label, live_now, created_at,
            moderation_status, moderation_summary, moderation_json, content_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'Just now', 0, ?, ?, ?, ?, ?)
        """,
        (title, description, src, category, uploader, f"{uploader} Studio", fmt,
         "45 sec" if fmt == "clip" else "12 min", "Fri at 8:00 PM", utc_now(),
         mod_status, mod_summary, mod_json, file_hash),
    )
    db().commit()
    row = query_one("SELECT * FROM videos WHERE id = ?", (cur.lastrowid,))
    payload = {"video": video_json(row), "moderation": report}
    if mod_status == "flag":
        payload["held"] = True
        return ok(
            message="Held for agent review — possible copyright or originality concern.",
            **payload,
        )
    return ok(video=video_json(row), moderation=report)


@app.get("/api/moderation/queue")
def moderation_queue():
    rows = query_all(
        "SELECT * FROM videos WHERE moderation_status = 'flag' ORDER BY id DESC LIMIT 100"
    )
    return ok(items=[video_json(v) for v in rows], count=len(rows))


@app.post("/api/moderation/<int:video_id>/resolve")
def moderation_resolve(video_id: int):
    """Agent override: pass (publish) or reject (remove from house)."""
    row = query_one("SELECT * FROM videos WHERE id = ?", (video_id,))
    if not row:
        return fail("Title not found.", 404)
    payload = request.get_json(silent=True) or {}
    decision = (payload.get("decision") or "").strip().lower()
    note = (payload.get("note") or "").strip()
    if decision not in ("pass", "reject"):
        return fail("decision must be pass or reject.")
    if decision == "reject":
        src = row.get("src") or ""
        if src.startswith("/uploads/"):
            disk = UPLOAD_DIR / Path(src).name
            if disk.is_file():
                try:
                    disk.unlink()
                except OSError:
                    pass
        db().execute("DELETE FROM comments WHERE video_id = ?", (video_id,))
        db().execute("DELETE FROM likes WHERE video_id = ?", (video_id,))
        db().execute("DELETE FROM saved WHERE video_id = ?", (video_id,))
        db().execute("DELETE FROM history WHERE video_id = ?", (video_id,))
        db().execute("DELETE FROM videos WHERE id = ?", (video_id,))
        db().commit()
        return ok(removed=True, decision="reject")
    summary = note or "Cleared by house agent."
    db().execute(
        "UPDATE videos SET moderation_status = 'pass', moderation_summary = ? WHERE id = ?",
        (summary, video_id),
    )
    db().commit()
    row = query_one("SELECT * FROM videos WHERE id = ?", (video_id,))
    return ok(video=video_json(row), decision="pass")


@app.post("/api/videos/<int:video_id>/view")
def view_video(video_id: int):
    db().execute("UPDATE videos SET views = views + 1 WHERE id = ?", (video_id,))
    user, _ = require_user()
    if user:
        db().execute(
            "INSERT INTO history (user_id, video_id, watched_at) VALUES (?, ?, ?)",
            (user["id"], video_id, utc_now()),
        )
    db().commit()
    return ok()


@app.post("/api/videos/<int:video_id>/like")
def like_video(video_id: int):
    user, err = require_user()
    if err:
        return err
    existing = query_one("SELECT 1 FROM likes WHERE user_id = ? AND video_id = ?", (user["id"], video_id))
    if existing:
        db().execute("DELETE FROM likes WHERE user_id = ? AND video_id = ?", (user["id"], video_id))
        db().execute("UPDATE videos SET likes = MAX(likes - 1, 0) WHERE id = ?", (video_id,))
        liked = False
    else:
        db().execute("INSERT INTO likes (user_id, video_id) VALUES (?, ?)", (user["id"], video_id))
        db().execute("UPDATE videos SET likes = likes + 1 WHERE id = ?", (video_id,))
        liked = True
    db().commit()
    row = query_one("SELECT likes FROM videos WHERE id = ?", (video_id,))
    return ok(liked=liked, likes=row["likes"] if row else 0)


@app.post("/api/videos/<int:video_id>/save")
def save_video(video_id: int):
    user, err = require_user()
    if err:
        return err
    existing = query_one("SELECT 1 FROM saved WHERE user_id = ? AND video_id = ?", (user["id"], video_id))
    if existing:
        db().execute("DELETE FROM saved WHERE user_id = ? AND video_id = ?", (user["id"], video_id))
        saved = False
    else:
        db().execute("INSERT INTO saved (user_id, video_id) VALUES (?, ?)", (user["id"], video_id))
        saved = True
    db().commit()
    return ok(saved=saved)


@app.post("/api/videos/<int:video_id>/comments")
def add_comment(video_id: int):
    user, err = require_user()
    if err:
        return err
    payload = request.get_json(silent=True) or {}
    text = (payload.get("text") or "").strip()
    if not text:
        return fail("Write a note first.")
    db().execute(
        "INSERT INTO comments (video_id, user_name, text, created_at) VALUES (?, ?, ?, ?)",
        (video_id, user["name"], text, utc_now()),
    )
    db().commit()
    comments = query_all(
        "SELECT user_name AS user, text, created_at AS time FROM comments WHERE video_id = ? ORDER BY id DESC",
        (video_id,),
    )
    return ok(comments=comments)


@app.post("/api/follow")
def follow_creator():
    user, err = require_user()
    if err:
        return err
    creator = ((request.get_json(silent=True) or {}).get("creator") or "").strip()
    if not creator:
        return fail("Missing creator.")
    existing = query_one("SELECT 1 FROM follows WHERE user_id = ? AND creator = ?", (user["id"], creator))
    if existing:
        db().execute("DELETE FROM follows WHERE user_id = ? AND creator = ?", (user["id"], creator))
        followed = False
    else:
        db().execute("INSERT INTO follows (user_id, creator) VALUES (?, ?)", (user["id"], creator))
        followed = True
    db().commit()
    return ok(followed=followed, creator=creator)


@app.post("/api/auth/signup")
def signup():
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    if not email or not password:
        return fail("Email and password are required.")
    if not name:
        name = email.split("@")[0].replace(".", " ").replace("_", " ").title()
    if query_one("SELECT id FROM users WHERE email = ?", (email,)):
        return fail("That email already has a seat.")
    cur = db().execute(
        "INSERT INTO users (name, email, password_hash, plan) VALUES (?, ?, ?, ?)",
        (name, email, generate_password_hash(password), "Classic"),
    )
    db().commit()
    session["user_id"] = cur.lastrowid
    return ok(me=current_user())


@app.post("/api/auth/login")
def login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    row = query_one("SELECT * FROM users WHERE email = ?", (email,))
    if not row or not check_password_hash(row["password_hash"], password):
        return fail("Email or password did not match.", 401)
    session["user_id"] = row["id"]
    return ok(me=current_user())


@app.post("/api/auth/logout")
def logout():
    session.clear()
    return ok()


@app.get("/api/me")
def me():
    return ok(me=current_user())


@app.post("/api/me")
def update_me():
    user, err = require_user()
    if err:
        return err
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or user["name"]).strip()
    plan = payload.get("plan") or user["plan"]
    autoplay = 1 if payload.get("autoplay", user["autoplay"]) else 0
    if plan not in ("Classic", "Plus", "Premium"):
        plan = user["plan"]
    db().execute("UPDATE users SET name = ?, plan = ?, autoplay = ? WHERE id = ?", (name, plan, autoplay, user["id"]))
    db().commit()
    return ok(me=current_user())


@app.post("/api/series")
def save_series():
    user, err = require_user()
    if err:
        return err
    p = request.get_json(silent=True) or {}
    title = (p.get("title") or "").strip()
    if not title:
        return fail("Series needs a title.")
    db().execute(
        """
        INSERT INTO series (user_id, title, season, episodes, description, company, director, producer, dop, featured)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user["id"], title, int(p.get("season") or 1), int(p.get("episodes") or 8),
            p.get("description") or "", p.get("company") or "", p.get("director") or "",
            p.get("producer") or "", p.get("dop") or "", p.get("featured") or "",
        ),
    )
    db().commit()
    series = query_all("SELECT * FROM series ORDER BY id DESC")
    return ok(series=series)


@app.post("/api/notifications/<int:note_id>/read")
def read_notification(note_id: int):
    user, err = require_user()
    if err:
        return err
    db().execute("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?", (note_id, user["id"]))
    db().commit()
    return ok()


@app.get("/api/poster/<int:video_id>")
def poster(video_id: int):
    start, end, _ink = POSTER_THEMES[video_id % len(POSTER_THEMES)]
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540">
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="{start}"/><stop offset="100%" stop-color="{end}"/>
      </linearGradient></defs>
      <rect width="960" height="540" fill="#0b0907"/>
      <rect width="960" height="540" fill="url(#g)" opacity="0.92"/>
      <circle cx="820" cy="90" r="180" fill="#fff8ec" opacity="0.14"/>
      <circle cx="80" cy="480" r="220" fill="#000" opacity="0.18"/>
    </svg>"""
    return Response(svg, mimetype="image/svg+xml")


# ── Static ───────────────────────────────────────────────────────────────────

@app.get("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.get("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)


@app.get("/<path:filename>")
def public_file(filename):
    allowed = filename.startswith("js/") or filename.startswith("pages/") or filename in {
        "styles.css",
        "storyboard.html",
        "upload-series-modal.html",
        "app.js",
    }
    if not allowed:
        return fail("Not found.", 404)
    target = ROOT / filename
    if not target.exists() or not target.is_file():
        return fail("Not found.", 404)
    return send_from_directory(ROOT, filename)


init_db()


def _browser_exe() -> str | None:
    env = os.environ.get("KINO_BROWSER")
    if env and Path(env).is_file():
        return env
    local = os.environ.get("LOCALAPPDATA", "")
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        str(Path(local) / "Google" / "Chrome" / "Application" / "chrome.exe") if local else "",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    ]
    for path in candidates:
        if path and Path(path).is_file():
            return path
    return None


def watch_debug_browser(url: str) -> None:
    """Open a dedicated Chrome/Edge window. Closing it exits this process."""
    exe = _browser_exe()
    if not exe:
        print("  No Chrome/Edge found — open the URL yourself.")
        return
    profile = tempfile.mkdtemp(prefix="kino-browser-")
    creationflags = 0
    if sys.platform == "win32":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP
    proc = subprocess.Popen(
        [
            exe,
            f"--user-data-dir={profile}",
            "--no-first-run",
            "--no-default-browser-check",
            "--new-window",
            url,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=creationflags,
    )

    def stop_browser():
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()

    atexit.register(stop_browser)

    def wait_then_exit():
        time.sleep(1.2)
        if proc.poll() is not None:
            return
        proc.wait()
        os._exit(0)

    threading.Thread(target=wait_then_exit, daemon=True).start()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5050"))
    # Debugger attach (Cursor / VS Code) cannot follow Flask's reloader child process.
    use_reloader = os.environ.get("KINO_RELOADER", "1") == "1"
    print("\n  Kino is running")
    print(f"  Open  http://127.0.0.1:{port}")
    print(f"  API   http://127.0.0.1:{port}/api/health")
    print(f"  Debug http://127.0.0.1:{port}/api/debug")
    print("  Demo  demo@kino.local / demo\n")
    if os.environ.get("KINO_DEBUG_BROWSER") == "1":
        watch_debug_browser(f"http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=True, use_reloader=use_reloader)
