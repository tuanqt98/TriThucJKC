"""UI-05B boards: Before (current /knowledge/<id>) next to the design PROPOSAL, per viewport."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

out = Path(__file__).resolve().parents[2] / "docs/reports/ui-05b"


def board(name, frames, labels, width, height):
    canvas = Image.new(
        "RGB", (width * len(frames) + 16 * (len(frames) - 1), height + 44), "#e8ecf3"
    )
    draw = ImageDraw.Draw(canvas)
    for i, (frame, label) in enumerate(zip(frames, labels)):
        x = i * (width + 16)
        canvas.paste(
            ImageOps.contain(Image.open(out / frame).convert("RGB"), (width, height)),
            (x, 44),
        )
        draw.text((x + 8, 14), label, fill="#102b50")
    canvas.save(out / f"{name}.png", optimize=True)


for view, w, h in [
    ("desktop", 960, 600),
    ("tablet", 540, 720),
    ("mobile390", 390, 844),
    ("mobile375", 375, 812),
]:
    board(
        f"comparison-{view}",
        [f"before-{view}.png", f"proposal-{view}.png"],
        ["Before (hien tai)", "De xuat UI-05B"],
        w,
        h,
    )
for view, w, h in [("mobile390", 390, 844), ("mobile375", 375, 812)]:
    board(
        f"proposal-{view}-tabs",
        [
            f"proposal-{view}-full.png",
            f"proposal-{view}-files-full.png",
            f"proposal-{view}-version-full.png",
        ],
        ["Tab Noi dung (toan trang)", "Tab Anh & tep", "Tab Phe duyet"],
        w,
        2400,
    )
print("Saved UI-05B comparison boards.")
