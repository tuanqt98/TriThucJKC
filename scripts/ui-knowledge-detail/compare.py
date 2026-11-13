"""UI-05B boards per viewport: Before / PROPOSAL, and Mockup (PO-approved proposal) / Before / After."""

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
# Final hand-over: the PO-approved proposal plays the mockup role (no separate approved mockup exists).
for view, w, h in [
    ("desktop", 720, 450),
    ("tablet", 420, 560),
    ("mobile390", 390, 844),
    ("mobile375", 375, 812),
]:
    if (out / f"after-{view}.png").exists():
        board(
            f"final-{view}",
            [f"proposal-{view}.png", f"before-{view}.png", f"after-{view}.png"],
            ["Mockup (de xuat PO duyet)", "Before", "After"],
            w,
            h,
        )
for view, w, h in [("mobile390", 390, 844), ("mobile375", 375, 812)]:
    if (out / f"after-{view}-files-full.png").exists():
        board(
            f"after-{view}-tabs",
            [
                f"after-{view}-full.png",
                f"after-{view}-files-full.png",
                f"after-{view}-approval-full.png",
            ],
            ["Tab Noi dung (toan trang)", "Tab Anh & tep", "Tab Phe duyet"],
            w,
            2600,
        )
# Round 2 (PO): mobile cover moved into the "Nội dung" tab, tabs right after the title block.
for view, w, h in [("mobile390", 390, 844), ("mobile375", 375, 812)]:
    if (out / f"round2/before-{view}.png").exists():
        board(
            f"round2/compare-{view}",
            [f"round2/before-{view}.png", f"after-{view}.png"],
            ["Before (c741eac)", "After"],
            w,
            h,
        )
        board(
            f"round2/compare-{view}-tabs",
            [f"round2/before-{view}-tabs.png", f"after-{view}-tabs.png"],
            ["Before (c741eac): 3 tab", "After: 3 tab"],
            w * 3,
            2600,
        )
print("Saved UI-05B comparison boards.")
