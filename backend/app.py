"""Velnixor server. Usage: python backend/app.py"""
import atexit
import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import uuid
import webbrowser
import zipfile

from flask import Flask, Response, abort, jsonify, request, send_file
from werkzeug.utils import secure_filename

from screener import SUPPORTED, screen

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
UPLOADS = tempfile.mkdtemp(prefix="velnixor-")
atexit.register(shutil.rmtree, UPLOADS, ignore_errors=True)
FILES = {}  # file id -> (path, original name); in-memory, cleared on restart

app = Flask(__name__, static_folder=os.path.join(ROOT, "frontend"), static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024


@app.before_request
def local_only():
    # The API reads local folders, so it only answers its own page on localhost.
    # Host check blocks DNS rebinding; Origin check blocks other websites posting to the API.
    if request.host.rsplit(":", 1)[0] not in ("127.0.0.1", "localhost"):
        abort(403)
    origin = request.headers.get("Origin")
    if origin and origin.split("://", 1)[-1] != request.host:
        abort(403)


@app.get("/")
def index():
    return app.send_static_file("index.html")


def collect(path):
    path = os.path.expanduser(path.strip().strip('"'))
    if os.path.isfile(path) and path.lower().endswith(SUPPORTED):
        yield path, os.path.basename(path)
    for root, _, names in os.walk(path):
        for n in sorted(names):
            if n.lower().endswith(SUPPORTED) and not n.startswith("~$"):
                yield os.path.join(root, n), n


@app.post("/api/scan")
def scan():
    path = str((request.get_json(silent=True) or {}).get("path", ""))
    if not path.strip() or not os.path.exists(os.path.expanduser(path.strip().strip('"'))):
        return jsonify(error="That path doesn't exist on this computer."), 404
    return jsonify(count=sum(1 for _ in collect(path)))


@app.post("/api/browse")
def browse():
    # Run Tk in its own process: it must own the main thread (macOS aborts otherwise).
    code = ("import tkinter as t, tkinter.filedialog as f; r = t.Tk(); r.withdraw(); r.attributes('-topmost', 1);"
            "print(f.askdirectory(title='Select resume folder'))")
    try:
        out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=600)
    except Exception:
        out = None
    if not out or out.returncode:
        return jsonify(error="The folder picker isn't available here. Type the path instead."), 500
    return jsonify(path=out.stdout.strip())


def _strings(value, limit=200):
    return [s.strip() for s in value if isinstance(s, str) and s.strip()][:limit] if isinstance(value, list) else []


@app.post("/api/screen")
def screen_route():
    try:
        cfg = json.loads(request.form.get("config", "{}"))
    except ValueError:
        return jsonify(error="Malformed request."), 400

    batch = os.path.join(UPLOADS, uuid.uuid4().hex)
    os.makedirs(batch)
    files = []
    for i, f in enumerate(request.files.getlist("files")):
        name = os.path.basename(f.filename or "")
        if name.lower().endswith(SUPPORTED):
            path = os.path.join(batch, f"{i}_{secure_filename(name) or 'resume' + os.path.splitext(name)[1]}")
            f.save(path)
            files.append((path, name))
    for p in _strings(cfg.get("paths")):
        files.extend(collect(p))

    unique, seen = [], set()
    for path, name in files:
        with open(path, "rb") as fh:
            digest = hashlib.file_digest(fh, "sha1").hexdigest()
        if digest not in seen:
            seen.add(digest)
            unique.append((path, name))
    if not unique:
        return jsonify(error="No PDF, DOCX or TXT files found."), 400

    jd, keywords, skills = str(cfg.get("jd", ""))[:50000], _strings(cfg.get("keywords")), _strings(cfg.get("skills"))

    def events():
        for event in screen(unique, jd, keywords, skills):
            if event["type"] == "done":
                for (path, name), r in zip(unique, event["results"]):
                    r["id"] = uuid.uuid4().hex
                    FILES[r["id"]] = (path, name)
                event["duplicates"] = len(files) - len(unique)
            yield json.dumps(event) + "\n"

    return Response(events(), mimetype="application/x-ndjson")


@app.get("/api/files/<fid>")
def get_file(fid):
    if fid not in FILES:
        abort(404)
    path, name = FILES[fid]
    return send_file(path, as_attachment=request.args.get("download") == "1", download_name=name)


@app.post("/api/zip")
def zip_route():
    ids = _strings((request.get_json(silent=True) or {}).get("ids"), limit=10000)
    buf, used = io.BytesIO(), set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for fid in ids:
            if fid in FILES:
                path, name = FILES[fid]
                arc, n = name, 1
                while arc in used:
                    arc, n = f"{n}_{name}", n + 1
                used.add(arc)
                z.write(path, arc)
    buf.seek(0)
    return send_file(buf, mimetype="application/zip", as_attachment=True, download_name="shortlisted-resumes.zip")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    url = f"http://127.0.0.1:{port}"
    print(f"\n  Velnixor is running at {url}\n")
    threading.Timer(1.2, webbrowser.open, [url]).start()
    app.run(host="127.0.0.1", port=port, threaded=True)
