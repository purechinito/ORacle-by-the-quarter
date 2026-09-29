#!/usr/bin/env python3
"""Install the checksum-pinned official Lima binary into this project only."""
import hashlib
import json
from pathlib import Path
import platform
import tarfile
import urllib.request

root = Path(__file__).resolve().parents[1]
if platform.system() != "Darwin" or platform.machine() != "arm64":
    raise SystemExit("This local runtime bootstrap targets Apple Silicon macOS.")
version = json.loads((root / "infra/versions.json").read_text())["lima"]
name = "lima-" + version["version"] + "-Darwin-arm64.tar.gz"
archive = root / ".runtime/downloads" / name
archive.parent.mkdir(parents=True, exist_ok=True)
if not archive.exists():
    urllib.request.urlretrieve(
        "https://github.com/lima-vm/lima/releases/download/v" + version["version"] + "/" + name,
        archive,
    )
if hashlib.sha256(archive.read_bytes()).hexdigest() != version["darwin_arm64_sha256"]:
    raise SystemExit("Runtime archive checksum mismatch; nothing extracted.")
target = (root / ".runtime/tools").resolve()
target.mkdir(parents=True, exist_ok=True)
with tarfile.open(archive) as bundle:
    for member in bundle.getmembers():
        if not (target / member.name).resolve().is_relative_to(target):
            raise SystemExit("Archive contains an invalid path; nothing extracted.")
    bundle.extractall(target)
print("Verified Lima " + version["version"] + " is available in .runtime/tools.")
