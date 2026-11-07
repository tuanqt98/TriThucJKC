"""Build reference boards from screenshots; never use mockup crops in the app."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

root = Path(__file__).resolve().parents[2]
out = root / "docs/reports/ui-04"
reference = Image.open(root / "design/approved_screens/03_document_detail.png").convert(
    "RGB"
)
for name, width, height in [
    ("desktop", 720, 460),
    ("tablet", 420, 570),
    ("mobile390", 390, 854),
    ("mobile375", 375, 822),
]:
    mobile = name.startswith("mobile")
    crop = (1300, 144, 1608, 784) if mobile else (44, 120, 1254, 795)
    canvas = Image.new("RGB", (width * 3, height + 44), "#e8ecf3")
    draw = ImageDraw.Draw(canvas)
    frames = [
        reference.crop(crop),
        Image.open(out / f"before-{name}.png"),
        Image.open(out / f"after-{name}.png"),
    ]
    labels = [
        "Mockup (desktop reference)"
        if name == "tablet"
        else "Mockup (application crop)",
        "Before",
        "After",
    ]
    for i, (frame, label) in enumerate(zip(frames, labels)):
        draw.text((width * i + 12, 15), label, fill="#173c65")
        resized = ImageOps.contain(
            frame.convert("RGB"), (width - 8, height - 8), Image.Resampling.LANCZOS
        )
        canvas.paste(resized, (width * i + (width - resized.width) // 2, 44))
    canvas.save(out / f"comparison-{name}.png")
print("Saved four Mockup / Before / After boards, preserving image aspect ratios.")
