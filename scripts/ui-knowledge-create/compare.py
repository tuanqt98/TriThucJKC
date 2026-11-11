"""UI-07 boards: Mockup 06 (application crop) / Before / After per viewport; never used as app UI."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

root = Path(__file__).resolve().parents[2]
out = root / "docs/reports/ui-07"
reference = Image.open(
    root / "design/approved_screens/06_create_knowledge.png"
).convert("RGB")


def board(name, frames, labels, width, height):
    canvas = Image.new(
        "RGB", (width * len(frames) + 16 * (len(frames) - 1), height + 44), "#e8ecf3"
    )
    draw = ImageDraw.Draw(canvas)
    for i, (frame, label) in enumerate(zip(frames, labels)):
        x = i * (width + 16)
        image = (
            frame
            if isinstance(frame, Image.Image)
            else Image.open(out / frame).convert("RGB")
        )
        canvas.paste(ImageOps.contain(image, (width, height)), (x, 44))
        draw.text((x + 8, 14), label, fill="#102b50")
    canvas.save(out / f"{name}.png", optimize=True)


for view, w, h in [
    ("desktop", 720, 460),
    ("tablet", 420, 570),
    ("mobile390", 390, 854),
    ("mobile375", 375, 822),
]:
    mobile = view.startswith("mobile")
    crop = reference.crop((1300, 100, 1625, 800) if mobile else (44, 120, 1254, 795))
    label = (
        "Mockup 06 (desktop reference)"
        if view == "tablet"
        else "Mockup 06 (application crop)"
    )
    board(
        f"comparison-{view}",
        [crop, f"before-{view}.png", f"after-{view}-filled.png"],
        [label, "Before", "After (da nhap, chua luu)"],
        w,
        h,
    )
for view, w in [("mobile390", 390), ("mobile375", 375)]:
    board(
        f"after-{view}-steps",
        [
            f"after-{view}-filled.png",
            f"after-{view}-files.png",
            f"after-{view}-preview.png",
        ],
        ["Buoc 1: Noi dung", "Buoc 2: Dinh kem", "Buoc 3: Xem truoc"],
        w,
        844,
    )
print("Saved UI-07 comparison boards.")
