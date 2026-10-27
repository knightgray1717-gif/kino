"""
Kino upload bot — safety + sanity + soft originality signals.

Decides: pass | flag | reject
- Auto reject: explicit sex, extreme gore/violence, empty/broken spam
- Auto pass: clean original-looking drops (kissing / romance allowed)
- Flag for agent: possible copyright rip, duplicate on Kino, uncertain signals

Does not claim full Content ID or craft-quality judgment.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path

# ── House policy ──────────────────────────────────────────────────────────────

POLICY = {
    "allow": [
        "kissing",
        "kiss",
        "romance",
        "romantic",
        "intimacy",
        "makeout",
        "make-out",
        "affection",
        "dating",
        "couple",
    ],
    "reject_sexual": [
        "porn",
        "porno",
        "xxx",
        "onlyfans",
        "nsfw",
        "nude",
        "nudes",
        "naked",
        "nudity",
        "sex tape",
        "sextape",
        "blowjob",
        "handjob",
        "deepthroat",
        "cumshot",
        "orgasm",
        "masturbat",
        "hentai",
        "explicit sex",
        "hardcore",
        "striptease",
        "camgirl",
        "rule34",
        "gore porn",
    ],
    "reject_violence": [
        "decapitat",
        "dismember",
        "snuff",
        "torture porn",
        "extreme gore",
        "gutting",
        "bloodbath",
        "execution video",
        "beheading",
        "real murder",
        "graphic autopsy",
    ],
    "flag_copyright": [
        "bluray",
        "blu-ray",
        "bdrip",
        "brrip",
        "dvdrip",
        "hdtv",
        "webrip",
        "web-dl",
        "camrip",
        "hdcam",
        "tsrip",
        "yify",
        "rarbg",
        "scene release",
        "full movie",
        "watch online free",
        "cam recording",
    ],
    "flag_slop": [
        "ai generated transcript",
        "stock footage dump",
        "not my content",
        "reuploaded",
        "stolen from",
        "credit to owner",
    ],
    "min_bytes": 8_000,
    "max_bytes": 80 * 1024 * 1024,
    "min_seconds": 0.4,
    "max_seconds": 3 * 60 * 60,
    "video_ext": {".mp4", ".mov", ".webm", ".mkv", ".m4v"},
    "image_ext": {".jpg", ".jpeg", ".png", ".webp", ".gif"},
}

_WORD = re.compile(r"[a-z0-9][a-z0-9\-\.']*")


def _tokens(text: str) -> str:
    return " ".join(_WORD.findall((text or "").lower()))


def _hits(haystack: str, needles: list[str]) -> list[str]:
    found = []
    for needle in needles:
        if needle in haystack:
            found.append(needle)
    return found


def content_hash(path: Path | None, fallback: bytes = b"") -> str:
    h = hashlib.sha256()
    if path and path.is_file():
        with path.open("rb") as fh:
            while True:
                chunk = fh.read(65536)
                if not chunk:
                    break
                h.update(chunk)
    else:
        h.update(fallback)
    return h.hexdigest()


def _ffprobe_duration(path: Path) -> float | None:
    if not shutil.which("ffprobe"):
        return None
    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        if proc.returncode != 0:
            return None
        data = json.loads(proc.stdout or "{}")
        dur = float((data.get("format") or {}).get("duration") or 0)
        return dur if dur > 0 else None
    except (OSError, ValueError, json.JSONDecodeError, subprocess.TimeoutExpired):
        return None


def _blank_frame_ratio(path: Path) -> float | None:
    """Sample a few frames; return share that look near-black / near-white. Needs ffmpeg."""
    if not shutil.which("ffmpeg"):
        return None
    try:
        proc = subprocess.run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-i",
                str(path),
                "-vf",
                "fps=1/8,scale=64:36,signalstats,metadata=print:file=-",
                "-frames:v",
                "24",
                "-f",
                "null",
                "-",
            ],
            capture_output=True,
            text=True,
            timeout=45,
            check=False,
        )
        text = (proc.stderr or "") + (proc.stdout or "")
        ys = [float(m) for m in re.findall(r"YAVG:\s*([0-9.]+)", text)]
        if len(ys) < 3:
            return None
        blank = sum(1 for y in ys if y < 8 or y > 247)
        return blank / len(ys)
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return None


def scan_upload(
    *,
    title: str = "",
    description: str = "",
    filename: str = "",
    path: Path | None = None,
    existing_hashes: set[str] | None = None,
) -> dict:
    """
    Returns:
      status: pass | flag | reject
      reasons: list[str]
      checks: dict of signal details
      hash: content hash when file present
    """
    reasons: list[str] = []
    flags: list[str] = []
    checks: dict = {"engine": "kino-bot-v1", "policy": "kissing-ok / explicit-no / extreme-gore-no"}
    status = "pass"
    file_hash = ""

    text = _tokens(f"{title} {description} {filename}")
    allow_hits = _hits(text, POLICY["allow"])
    sex_hits = _hits(text, POLICY["reject_sexual"])
    gore_hits = _hits(text, POLICY["reject_violence"])
    rip_hits = _hits(text, POLICY["flag_copyright"])
    slop_hits = _hits(text, POLICY["flag_slop"])

    # Allowed intimacy wording should not be treated as sexual rejection.
    if sex_hits and allow_hits and not any(s in text for s in ("porn", "xxx", "onlyfans", "nude", "naked", "hentai")):
        sex_hits = [s for s in sex_hits if s not in ("nsfw",)]

    if sex_hits:
        status = "reject"
        reasons.append(f"Explicit sexual content signals: {', '.join(sex_hits[:4])}")
    if gore_hits:
        status = "reject"
        reasons.append(f"Extreme violence / gore signals: {', '.join(gore_hits[:4])}")

    if rip_hits:
        flags.append(f"Possible copyright / rip naming: {', '.join(rip_hits[:4])}")
    if slop_hits:
        flags.append(f"Originality concern: {', '.join(slop_hits[:3])}")
    if allow_hits:
        checks["allowed_intimacy"] = allow_hits[:5]

    if path is not None:
        if not path.is_file():
            status = "reject"
            reasons.append("Upload file missing or unreadable.")
        else:
            size = path.stat().st_size
            checks["bytes"] = size
            ext = path.suffix.lower()
            checks["ext"] = ext
            if size < POLICY["min_bytes"]:
                status = "reject"
                reasons.append("File too small — looks empty or broken.")
            if size > POLICY["max_bytes"]:
                status = "reject"
                reasons.append("File exceeds house upload limit.")
            if ext and ext not in POLICY["video_ext"] | POLICY["image_ext"]:
                status = "reject"
                reasons.append(f"Unsupported file type ({ext}).")

            file_hash = content_hash(path)
            checks["hash"] = file_hash[:16]
            if existing_hashes and file_hash in existing_hashes:
                flags.append("Exact duplicate of a title already on Kino.")

            if ext in POLICY["video_ext"]:
                duration = _ffprobe_duration(path)
                if duration is not None:
                    checks["duration_sec"] = round(duration, 2)
                    if duration < POLICY["min_seconds"]:
                        status = "reject"
                        reasons.append("Video duration too short to be real content.")
                    if duration > POLICY["max_seconds"]:
                        status = "reject"
                        reasons.append("Video exceeds maximum allowed length.")
                blank = _blank_frame_ratio(path)
                if blank is not None:
                    checks["blank_frame_ratio"] = round(blank, 2)
                    if blank >= 0.85:
                        status = "reject"
                        reasons.append("Most sampled frames are blank — spam / broken upload.")
                    elif blank >= 0.55:
                        flags.append("Many near-blank frames — possible low-effort or broken cut.")
    else:
        checks["file"] = "none"
        # Metadata-only publish (demo sample) — still run text policy.
        if not title.strip():
            status = "reject"
            reasons.append("Missing title.")

    if status != "reject" and flags:
        status = "flag"
        reasons.extend(flags)
    elif flags and status == "reject":
        reasons.extend(flags)

    if status == "pass" and not reasons:
        reasons.append("Cleared house checks (safety + sanity). Kissing / romance allowed.")

    return {
        "status": status,
        "reasons": reasons,
        "checks": checks,
        "hash": file_hash,
        "summary": "; ".join(reasons[:3]),
    }


def scan_text_only(title: str = "", description: str = "", filename: str = "") -> dict:
    return scan_upload(title=title, description=description, filename=filename, path=None)
