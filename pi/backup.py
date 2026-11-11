#!/usr/bin/env python3

import argparse
import json
import sqlite3
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

base = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("--simulate", action="store_true")
args = parser.parse_args()
mode = "demo" if args.simulate else "garden"
source = base/"data"/(mode+".sqlite3")
if not source.is_file():
    raise SystemExit("No database yet. Start the application first.")
stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
destination = base/"backups"/f"{mode}_{stamp}.zip"
destination.parent.mkdir(exist_ok=True)
with TemporaryDirectory() as temp:
    snapshot = Path(temp)/(mode+".sqlite3")
    with sqlite3.connect(f"file:{source}?mode=ro", uri=True) as original:
        with sqlite3.connect(snapshot) as copied:
            original.backup(copied)
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.write(snapshot, snapshot.name)
        if (base/"config.json").exists():
            archive.write(base/"config.json", "config.json")
        archive.writestr("BACKUP_INFO.json", json.dumps({
            "created_utc": stamp, "mode": mode,
            "note": "Consistent SQLite snapshot. Dashboard password excluded."
        }, indent=2))
print(destination)
