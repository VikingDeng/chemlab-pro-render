#!/usr/bin/env python3
"""Download real reagent/sample photographs for the ChemLab shelf.

Images are pulled from Wikimedia Commons and stored locally so the demo,
Render deployment, and Electron builds do not depend on hotlinked assets.
"""

from __future__ import annotations

import hashlib
import html
import time
import urllib.parse
import urllib.request
from pathlib import Path

OUTPUT_DIR = Path("public/reagents")
WIDTH = 960
DELAY_SECONDS = 3.0
USER_AGENT = "ChemLabProDemo/1.0 (educational local asset downloader; contact: local demo maintainer)"

PHOTOS = [
    {
        "slug": "unknown-a",
        "title": "A laboratory apparatus 11.jpg",
        "label": "Unknown sample bottle A",
        "author": "Goodymeraj",
        "license": "CC0 1.0",
    },
    {
        "slug": "unknown-b",
        "title": "A laboratory reagent 01.jpg",
        "label": "Unknown reagent bottle B",
        "author": "Goodymeraj",
        "license": "CC0 1.0",
    },
    {
        "slug": "unknown-c",
        "title": "Laboratory reagents.jpg",
        "label": "Unknown reagent set C",
        "author": "Goodymeraj",
        "license": "CC0 1.0",
    },
    {
        "slug": "unknown-d",
        "title": "A laboratory reagent 02.jpg",
        "label": "Unknown reagent bottle D",
        "author": "Goodymeraj",
        "license": "CC0 1.0",
    },
    {
        "slug": "unknown-e",
        "title": "A laboratory apparatus 08.jpg",
        "label": "Unknown lab sample E",
        "author": "Goodymeraj",
        "license": "CC0 1.0",
    },
    {
        "slug": "unknown-f",
        "title": "A laboratory apparatus for holding reagents.jpg",
        "label": "Unknown lab sample F",
        "author": "Goodymeraj",
        "license": "CC0 1.0",
    },
    {
        "slug": "hcl",
        "title": "Hydrochloric Acid ( Hcl).jpg",
        "label": "Hydrochloric acid bottle",
        "author": "Stephanie cheks",
        "license": "CC BY-SA 4.0",
    },
    {
        "slug": "h2so4",
        "title": "Bottle-H2SO4.jpg",
        "label": "Sulfuric acid bottle",
        "author": "Hugo",
        "license": "CC BY-SA 4.0",
    },
    {
        "slug": "hno3",
        "title": "Nitric acid 70 WarChem.jpg",
        "label": "Nitric acid bottle",
        "author": "Aleksander Sobolewski",
        "license": "CC BY-SA 4.0",
    },
    {
        "slug": "naoh",
        "title": "SodiumHydroxide.jpg",
        "label": "Sodium hydroxide pellets",
        "author": "Walkerma",
        "license": "Public domain",
    },
    {
        "slug": "nh3",
        "title": "A laboratory reagent 02.jpg",
        "label": "Ammonia solution reagent bottle",
        "author": "Goodymeraj",
        "license": "CC0 1.0",
        "note": "generic reagent-bottle photo used because a clean open-license ammonia-water bottle photo was not available",
    },
    {
        "slug": "cuso4",
        "title": "Copper(II)-sulfate-pentahydrate-sample.jpg",
        "label": "Copper(II) sulfate sample",
        "author": "Benjah-bmm27",
        "license": "Public domain",
    },
    {
        "slug": "agno3",
        "title": "Sample of silver nitrate (AgNO3).jpg",
        "label": "Silver nitrate sample",
        "author": "Leiem",
        "license": "CC BY-SA 4.0",
    },
    {
        "slug": "fecl3",
        "title": "Iron(III) chloride 2.JPG",
        "label": "Iron(III) chloride sample",
        "author": "Chemicalinterest",
        "license": "Public domain",
    },
    {
        "slug": "feso4",
        "title": "Iron(II)-sulfate-heptahydrate-sample.jpg",
        "label": "Iron(II) sulfate sample",
        "author": "Benjah-bmm27",
        "license": "Public domain",
    },
    {
        "slug": "bacl2",
        "title": "Barium chloride dihydrate.jpg",
        "label": "Barium chloride dihydrate sample",
        "author": "Walkerma",
        "license": "Public domain",
    },
    {
        "slug": "na2co3",
        "title": "Natriumcarbonat 01.jpg",
        "label": "Sodium carbonate crystals",
        "author": "Geoprofi Lars",
        "license": "CC BY-SA 4.0",
    },
    {
        "slug": "kscn",
        "title": "Crystals of Potassium Thiocyanate.jpg",
        "label": "Potassium thiocyanate crystals",
        "author": "ERS ROHU",
        "license": "CC0 1.0",
    },
    {
        "slug": "kmno4",
        "title": "Potassium permanganate sample.jpg",
        "label": "Potassium permanganate sample",
        "author": "Adam Rędzikowski",
        "license": "CC BY-SA 4.0",
    },
    {
        "slug": "h2o2",
        "title": "Hydrogen peroxide.jpg",
        "label": "Hydrogen peroxide bottle",
        "author": "Yanachka",
        "license": "Public domain",
    },
    {
        "slug": "oxalic",
        "title": "Oxalic acid dihydrate crystals.jpg",
        "label": "Oxalic acid dihydrate crystals",
        "author": "Amethyst80",
        "license": "CC BY-SA 4.0",
    },
    {
        "slug": "glucose",
        "title": "Microscopic Glucose.jpg",
        "label": "Microscopic glucose crystals",
        "author": "Pyre42",
        "license": "CC BY-SA 4.0",
    },
    {
        "slug": "ccl4",
        "title": "A laboratory reagent 01.jpg",
        "label": "Organic solvent reagent bottle",
        "author": "Goodymeraj",
        "license": "CC0 1.0",
        "note": "generic reagent-bottle photo used because a clean open-license carbon-tetrachloride bottle photo was not available",
    },
    {
        "slug": "hexane",
        "title": "N-Hexane by Danny S. - 001.JPG",
        "label": "n-Hexane bottle",
        "author": "Danny S.",
        "license": "CC BY-SA 3.0",
    },
    {
        "slug": "i2-aq",
        "title": "A laboratory reagent 01.jpg",
        "label": "Iodine solution reagent bottle",
        "author": "Goodymeraj",
        "license": "CC0 1.0",
        "note": "generic reagent-bottle photo used for iodine solution",
    },
    {
        "slug": "i2-solid",
        "title": "Iodine sample.jpg",
        "label": "Iodine sample",
        "author": "Nefronus",
        "license": "CC0 1.0",
    },
    {
        "slug": "phenolphthalein",
        "title": "Phenolphthalein solution.jpg",
        "label": "Phenolphthalein solution",
        "author": "Andyman1125",
        "license": "CC BY-SA 3.0",
    },
    {
        "slug": "methyl-orange",
        "title": "Methyl-orange-sample.jpg",
        "label": "Methyl orange sample",
        "author": "Benjah-bmm27 / Ben Mills",
        "license": "Public domain",
    },
]


def commons_file_url(title: str) -> str:
    return "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(title.replace(" ", "_"), safe="()%-_")


def media_filename(title: str) -> str:
    return title.replace(" ", "_")


def media_hash(title: str) -> str:
    return hashlib.md5(media_filename(title).encode("utf-8")).hexdigest()


def original_url(title: str) -> str:
    filename = media_filename(title)
    digest = media_hash(title)
    encoded = urllib.parse.quote(filename)
    return f"https://upload.wikimedia.org/wikipedia/commons/{digest[0]}/{digest[:2]}/{encoded}"


def thumb_url(title: str) -> str:
    filename = media_filename(title)
    digest = media_hash(title)
    encoded = urllib.parse.quote(filename)
    return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{digest[0]}/{digest[:2]}/{encoded}/{WIDTH}px-{encoded}"


def candidate_urls(title: str) -> tuple[str, str]:
    # Prefer a Commons-generated 960px thumbnail for fast deployment.
    # If the original is smaller than 960px, Wikimedia returns 404 for the
    # thumbnail path; fall back to the original file path.
    return (thumb_url(title), original_url(title))


def is_jpeg(data: bytes) -> bool:
    return data.startswith(b"\xff\xd8\xff") and data.endswith(b"\xff\xd9")


def fetch_image(entry: dict[str, str], dest: Path) -> None:
    if dest.exists() and is_jpeg(dest.read_bytes()):
        print(f"    kept existing {dest.name}", flush=True)
        return

    headers = {"User-Agent": USER_AGENT}
    last_error: Exception | None = None
    for url in candidate_urls(entry["title"]):
        for attempt in range(1, 5):
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=60) as response:
                    content_type = response.headers.get("content-type", "")
                    data = response.read()
                if not content_type.startswith("image/") or not is_jpeg(data):
                    raise RuntimeError(f"unexpected response for {entry['title']}: {content_type}, {len(data)} bytes")
                tmp = dest.with_suffix(dest.suffix + ".tmp")
                tmp.write_bytes(data)
                tmp.replace(dest)
                return
            except urllib.error.HTTPError as exc:
                last_error = exc
                if exc.code == 404:
                    break
                if exc.code == 429:
                    time.sleep(20 * attempt)
                elif attempt < 4:
                    time.sleep(1.5 * attempt)
            except Exception as exc:  # noqa: BLE001 - command-line retry wrapper
                last_error = exc
                if attempt < 4:
                    time.sleep(1.5 * attempt)
        # Try the next URL candidate, usually original file after thumbnail miss.
    raise RuntimeError(f"failed to download {entry['title']}: {last_error}")


def write_attribution() -> None:
    rows = []
    for entry in PHOTOS:
        source = commons_file_url(entry["title"])
        note = entry.get("note", "")
        rows.append(
            "| `{slug}.jpg` | {label} | [{title}]({source}) | {author} | {license} | {note} |".format(
                slug=entry["slug"],
                label=html.escape(entry["label"]),
                title=html.escape(entry["title"]),
                source=source,
                author=html.escape(entry["author"]),
                license=html.escape(entry["license"]),
                note=html.escape(note),
            )
        )
    content = "\n".join(
        [
            "# Reagent photo attributions",
            "",
            "These local demo thumbnails are real photographs downloaded from Wikimedia Commons by `scripts/download-reagent-photos.py`.",
            "They are bundled locally so Render deployment and Electron packaging do not depend on hotlinked images.",
            "Images are used as small educational UI thumbnails; chemistry behavior remains driven by the simulator state, not by labels visible in the photos.",
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
    for pattern in ("*.svg", "*.jpg.tmp"):
        for path in OUTPUT_DIR.glob(pattern):
            path.unlink()
    for index, entry in enumerate(PHOTOS, start=1):
        dest = OUTPUT_DIR / f"{entry['slug']}.jpg"
        print(f"[{index:02d}/{len(PHOTOS)}] {entry['slug']}: {entry['title']}", flush=True)
        fetch_image(entry, dest)
        time.sleep(DELAY_SECONDS)
    write_attribution()
    print(f"Downloaded {len(PHOTOS)} real photos to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
