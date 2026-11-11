"""UI-08 boards: Mockup 07 (application crop) / Before / After per viewport; never used as app UI."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

root = Path(__file__).resolve().parents[2]
out = root / "docs/reports/ui-08"
reference = Image.open(root / "design/approved_screens/07_my_courses.png").convert(
    "RGB"
)


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
        "Mockup 07 (desktop reference)"
        if view == "tablet"
        else "Mockup 07 (application crop)"
    )
    board(
        f"comparison-{view}",
        [crop, f"before-{view}.png", f"after-{view}.png"],
        [label, "Before", "After"],
        w,
        h,
    )
    if (out / f"after-{view}-course-full.png").exists():
        board(
            f"comparison-{view}-course",
            [f"before-{view}-course-full.png", f"after-{view}-course-full.png"],
            ["Before: /learning/[id]", "After: /learning/[id] (khong co mockup rieng)"],
            w,
            2000 if mobile else 1100,
        )
# Final acceptance (PO 11/11/2026): course page in each learning state, per viewport.
STATES = [
    ("not-started", "Chua hoc"),
    ("in-progress", "Dang hoc"),
    ("quiz", "Dang lam kiem tra"),
    ("passed", "Dat"),
    ("failed", "Khong dat"),
]
for view, w, h in [
    ("desktop", 520, 900),
    ("tablet", 420, 1100),
    ("mobile390", 300, 1400),
    ("mobile375", 290, 1400),
]:
    frames = [f"final-{view}-{k}-full.png" for k, _ in STATES]
    if all((out / f).exists() for f in frames):
        board(f"final-{view}-states", frames, [label for _, label in STATES], w, h)
print("Saved UI-08 comparison boards.")
