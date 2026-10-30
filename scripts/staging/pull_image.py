"""Host-side Docker Hub pull for isolated Docker engines without registry egress.
Downloads official layers over TLS, verifies sha256 and loads a docker archive.
No registry tokens or credentials are written to disk/logs.
"""

import argparse
import hashlib
import io
import json
import os
import subprocess
import tarfile
from pathlib import Path

import requests

parser = argparse.ArgumentParser()
parser.add_argument(
    "image", help="Official Docker Hub repository:tag, e.g. caddy:2.10.2"
)
parser.add_argument("--architecture", default="arm64", choices=["arm64", "amd64"])
args = parser.parse_args()
repo, tag = args.image.rsplit(":", 1)
if "/" not in repo:
    repo = "library/" + repo
assert all(c.isalnum() or c in "/_-" for c in repo)
base = "https://registry-1.docker.io/v2/" + repo
session = requests.Session()
token = session.get(
    "https://auth.docker.io/token",
    params={"service": "registry.docker.io", "scope": f"repository:{repo}:pull"},
    timeout=30,
)
token.raise_for_status()
headers = {
    "Authorization": "Bearer " + token.json()["token"],
    "Accept": "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json",
}
response = session.get(base + "/manifests/" + tag, headers=headers, timeout=60)
response.raise_for_status()
manifest = response.json()
if "manifests" in manifest:
    match = next(
        m
        for m in manifest["manifests"]
        if m.get("platform", {}).get("os") == "linux"
        and m["platform"].get("architecture") == args.architecture
    )
    response = session.get(
        base + "/manifests/" + match["digest"], headers=headers, timeout=60
    )
    response.raise_for_status()
    assert hashlib.sha256(response.content).hexdigest() == match["digest"].split(":")[1]
    manifest = response.json()
work = Path(".local/image-cache")
work.mkdir(parents=True, exist_ok=True)
files = []
for blob in [manifest["config"], *manifest["layers"]]:
    digest = blob["digest"].removeprefix("sha256:")
    path = work / digest
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        print("Downloading", args.image, digest[:12], flush=True)
        result = session.get(
            base + "/blobs/" + blob["digest"],
            headers=headers,
            stream=True,
            timeout=(30, 180),
        )
        result.raise_for_status()
        check = hashlib.sha256()
        with path.with_suffix(f".{os.getpid()}.part").open("wb") as stream:
            for chunk in result.iter_content(1024 * 1024):
                stream.write(chunk)
                check.update(chunk)
        assert check.hexdigest() == digest, "Layer digest mismatch"
        path.with_suffix(f".{os.getpid()}.part").replace(path)
    files.append(path)
archive = work / (repo.replace("/", "_") + "_" + tag + ".tar")
with tarfile.open(archive, "w") as tar:
    config = files[0].name + ".json"
    tar.add(files[0], arcname=config)
    layernames = []
    for layer in files[1:]:
        # Docker archive uses uncompressed tar layers.
        import gzip

        target = layer.with_suffix(".layer.tar")
        with layer.open("rb") as src:
            magic = src.read(2)
        if magic == b"\x1f\x8b":
            with gzip.open(layer, "rb") as src, target.open("wb") as dest:
                import shutil

                shutil.copyfileobj(src, dest)
        else:
            target = layer
        name = layer.name + "/layer.tar"
        tar.add(target, arcname=name)
        layernames.append(name)
    metadata = json.dumps(
        [{"Config": config, "RepoTags": [args.image], "Layers": layernames}]
    ).encode()
    info = tarfile.TarInfo("manifest.json")
    info.size = len(metadata)
    tar.addfile(info, io.BytesIO(metadata))
subprocess.run(["docker", "load", "-i", str(archive)], check=True)
print("Verified and loaded", args.image, flush=True)
