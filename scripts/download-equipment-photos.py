#!/usr/bin/env python3
"""Download real equipment photographs for the ChemLab shelf.

These thumbnails are stored locally so the app stays stable in Render and
Electron builds. The download list mirrors the equipment rail art direction.
"""

from __future__ import annotations

from pathlib import Path
import subprocess
import time

from PIL import Image, ImageOps

OUTPUT_DIR = Path("public/equipment")
WIDTH = 720
DELAY_SECONDS = 1.5
USER_AGENT = "ChemLabProDemo/1.0 (educational local asset downloader)"

EQUIPMENT = [
    {
        "slug": "beaker",
        "title": "50 ml beaker.JPG",
        "url": "https://upload.wikimedia.org/wikipedia/commons/c/c9/50_ml_beaker.JPG",
        "label": "烧杯",
        "author": "Cjp24",
        "license": "CC BY-SA 3.0",
        "note": "inventory thumbnail only",
    },
    {
        "slug": "glassrod",
        "title": "Glass rod.jpg",
        "url": "https://upload.wikimedia.org/wikipedia/commons/1/1d/Glass_rod.jpg",
        "label": "玻璃棒",
        "author": "TarnPraewan",
        "license": "CC BY-SA 4.0",
        "note": "inventory thumbnail only",
    },
    {
        "slug": "testtube",
        "title": "Test tube with plastic stopper.JPG",
        "url": "https://upload.wikimedia.org/wikipedia/commons/2/2c/Test_tube_with_plastic_stopper.JPG",
        "label": "试管",
        "author": "Cjp24",
        "license": "CC BY-SA 3.0",
        "note": "inventory thumbnail only",
    },
    {
        "slug": "flask",
        "title": "250 mL Erlenmeyer flask.jpg",
        "url": "https://upload.wikimedia.org/wikipedia/commons/7/78/250_mL_Erlenmeyer_flask.jpg",
        "label": "锥形瓶",
        "author": "Pilarbini",
        "license": "CC BY-SA 4.0",
        "note": "inventory thumbnail only",
    },
    {
        "slug": "alcohol-lamp",
        "title": "Glass alcohol burner.jpg",
        "url": "https://upload.wikimedia.org/wikipedia/commons/8/8d/Glass_alcohol_burner.jpg",
        "label": "酒精灯",
        "author": "Trisawan",
        "license": "CC BY-SA 4.0",
        "note": "inventory thumbnail only",
    },
    {
        "slug": "burette",
        "title": "Burette stand and burette .jpg",
        "url": "https://upload.wikimedia.org/wikipedia/commons/0/02/Burette_stand_and_burette_.jpg",
        "label": "滴定管",
        "author": "Chanunchida.suthi",
        "license": "CC BY-SA 4.0",
        "note": "inventory thumbnail only",
    },
    {
        "slug": "funnel",
        "title": "Small glass funnel.jpg",
        "url": "https://upload.wikimedia.org/wikipedia/commons/2/29/Small_glass_funnel.jpg",
        "label": "过滤漏斗",
        "author": "Lilly_M",
        "license": "CC BY-SA 3.0",
        "note": "inventory thumbnail only",
    },
    {
        "slug": "tube",
        "title": "LiebigCondenser.jpg",
        "url": "https://upload.wikimedia.org/wikipedia/commons/f/ff/LiebigCondenser.jpg",
        "label": "蒸馏导管",
        "author": "Unknown",
        "license": "CC BY-SA 3.0",
        "note": "inventory thumbnail only",
    },
    {
        "slug": "testtube-rack",
        "title": "Plastic Test Tube Rack.JPG",
        "url": "https://upload.wikimedia.org/wikipedia/commons/5/55/Plastic_Test_Tube_Rack.JPG",
        "label": "试管架",
        "author": "Sth.niv",
        "license": "CC BY-SA 4.0",
        "note": "inventory thumbnail only",
    },
    {
        "slug": "pipette",
        "title": "Pipette 1.jpg",
        "url": "https://upload.wikimedia.org/wikipedia/commons/8/80/Pipette_1.jpg",
        "label": "移液管",
        "author": "Anisa Ghogar",
        "license": "CC BY-SA 4.0",
        "note": "inventory thumbnail only",
    },
]


def fetch_image(entry: dict[str, str], dest: Path) -> None:
    if dest.exists():
        return

    tmp = dest.with_suffix(dest.suffix + ".tmp")
    subprocess.run(
        [
            "curl",
            "--fail",
            "--location",
            "--silent",
            "--show-error",
            "--retry",
            "4",
            "--retry-delay",
            "3",
            "--connect-timeout",
            "30",
            "--max-time",
            "180",
            "--user-agent",
            USER_AGENT,
            entry["url"],
            "--output",
            str(tmp),
        ],
        check=True,
    )
    with Image.open(tmp) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((WIDTH, WIDTH), Image.Resampling.LANCZOS)
        image.save(dest, "JPEG", quality=86, optimize=True)
    tmp.unlink(missing_ok=True)


def write_attribution() -> None:
    rows = []
    for entry in EQUIPMENT:
        rows.append(
            f'| `{entry["slug"]}.jpg` | {entry["label"]} | [{entry["title"]}]({entry["url"]}) | {entry["author"]} | {entry["license"]} | {entry["note"]} |'
        )

    content = "\n".join(
        [
            "# Equipment photo attributions",
            "",
            "These local thumbnails are real photographs downloaded from Wikimedia Commons by `scripts/download-equipment-photos.py`.",
            "They are bundled locally so Render deployment and Electron packaging do not depend on hotlinked images.",
            "",
            "| Local file | Shown as | Source | Author | License | Notes |",
            "| --- | --- | --- | --- | --- | --- |",
            *rows,
            "",
        ]
    )
    (OUTPUT_DIR / "ATTRIBUTION.md").write_text(content, encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for entry in EQUIPMENT:
        dest = OUTPUT_DIR / f'{entry["slug"]}.jpg'
        print(f'{entry["slug"]}: {entry["title"]}', flush=True)
        fetch_image(entry, dest)
        time.sleep(DELAY_SECONDS)
    write_attribution()
    print(f"Downloaded {len(EQUIPMENT)} equipment thumbnails to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
