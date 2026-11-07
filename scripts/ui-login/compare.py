"""Compose evidence only; never modify approved assets or application images."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/reports/ui-01"
mockup = Image.open(ROOT / "design/approved_screens/09_login.png").convert("RGB")
for name, crop, width, height in [
    ("desktop", (76, 168, 1215, 730), 720, 470),
    ("mobile390", (1282, 162, 1584, 760), 390, 844),
    ("mobile375", (1282, 162, 1584, 760), 375, 812),
]:
    board = Image.new("RGB", (width * 3, height + 48), "#e8ecf3")
    draw = ImageDraw.Draw(board)
    frames = [
        Image.open(OUT / f"before-{name}.png"),
        mockup.crop(crop),
        Image.open(OUT / f"after-{name}.png"),
    ]
    for index, (label, frame) in enumerate(
        zip(["Before", "Mockup (application crop)", "After"], frames)
    ):
        draw.text((index * width + 16, 16), label, fill="#20267b")
        fitted = ImageOps.contain(
            frame.convert("RGB"), (width - 8, height - 8), Image.Resampling.LANCZOS
        )
        board.paste(
            fitted,
            (
                index * width + (width - fitted.width) // 2,
                48 + (height - fitted.height) // 2,
            ),
        )
    board.save(OUT / f"comparison-{name}.png")

assets = []
for source, target in [("bgr.jpg", "background.jpg"), ("logo.jpg", "logo.jpg")]:
    original = ROOT / "design/approved_screens/logo" / source
    public = ROOT / "starter/apps/web/public/images/login-approved" / target
    digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    assert digest(original) == digest(public), "Approved source asset was changed"
    assets.append(
        {
            "source": str(original.relative_to(ROOT)),
            "public": str(public.relative_to(ROOT)),
            "sha256": digest(public),
            "unchanged": True,
        }
    )
(OUT / "asset-integrity.json").write_text(json.dumps(assets, indent=2) + "\n")
print("Created three Before / Mockup / After boards; source asset SHA-256 matches.")
