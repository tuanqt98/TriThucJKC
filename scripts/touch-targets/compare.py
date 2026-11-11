"""Pixel Before/After comparison for decision D. Writes compare.json and a red-highlight diff image per changed screen."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageChops

root = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/reports/touch-targets")
out = root / "diff"
out.mkdir(exist_ok=True)
rows = []
for before in sorted((root / "before").glob("*.png")):
    after = root / "after" / before.name
    a, b = Image.open(before).convert("RGB"), Image.open(after).convert("RGB")
    if a.size != b.size:
        rows.append({"screen": before.stem, "changed_pct": None, "note": f"size {a.size} -> {b.size}"})
        continue
    diff = ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v > 16 else 0)
    changed = sum(1 for v in diff.getdata() if v)
    box = diff.getbbox()
    rows.append({"screen": before.stem, "changed_px": changed, "changed_pct": round(100 * changed / (a.size[0] * a.size[1]), 3), "bbox": box})
    if changed:
        red = Image.new("RGB", a.size, (230, 30, 60))
        Image.composite(red, b, diff).save(out / before.name)
(root / "compare.json").write_text(json.dumps(rows, indent=2) + "\n")
for r in rows:
    print(f"{r['screen']:40s} {r.get('changed_pct')}% {r.get('bbox') or r.get('note', '')}")
