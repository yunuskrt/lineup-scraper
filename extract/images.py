import re
from pathlib import Path
from typing import Final, Literal

from extract.parsers.transfermarkt.common import CREST_ID, IMAGE_HOST, PHOTO_ID, id_in

type ImageKind = Literal["crest", "photo"]
type ImageId = tuple[ImageKind, str]

IMAGE_KINDS: Final[tuple[ImageKind, ...]] = ("crest", "photo")
IMAGE_SUFFIXES: Final = frozenset({".png", ".jpg", ".jpeg", ".webp", ".svg"})
# The list's names: `crest-36.png`, `photo-206.jpg`
LIST_NAME: Final = re.compile(r"^(crest|photo)-([0-9]+)\.[a-z]+$")
# The browser's names, from the image URL
CREST_NAME: Final = re.compile(r"^([0-9]+)_[0-9]+\.[a-z]+$")
PHOTO_NAME: Final = re.compile(r"^(?:([0-9]+)-[0-9]+|s_([0-9]+)_[0-9_]+)\.[a-z]+$")
BARE_NAME: Final = re.compile(r"^[0-9]+\.[a-z]+$")


class RefusedImageError(ValueError):
    pass


def image_from_url(url: str) -> ImageId | None:
    if not url.startswith(IMAGE_HOST):
        return None
    if (club_id := id_in(url, CREST_ID)) is not None:
        return ("crest", club_id)
    if (player_id := id_in(url, PHOTO_ID)) is not None:
        return ("photo", player_id)
    return None


def name_id(filename: str) -> ImageId | None:
    name = filename.lower()
    if found := LIST_NAME.match(name):
        return ("crest" if found.group(1) == "crest" else "photo", found.group(2))
    if found := CREST_NAME.match(name):
        return ("crest", found.group(1))
    if found := PHOTO_NAME.match(name):
        return ("photo", found.group(1) or found.group(2))
    return None


# The browser's name if it reads back, else ours
def save_as(kind: ImageKind, key: str, url: str) -> str:
    name = url.split("?")[0].rsplit("/", 1)[-1].lower()
    if name_id(name) == (kind, key):
        return name
    suffix = Path(name).suffix or ".png"
    return f"{kind}-{key}{suffix}"


# The format by its first bytes, never by its name
def sniff(data: bytes) -> str:
    if not data:
        raise RefusedImageError("empty file")
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    head = data[:1024].lstrip(b"\xef\xbb\xbf \t\r\n").lower()
    if b"<html" in head or head.startswith(b"<!doctype html"):
        raise RefusedImageError("an HTML page, not an image: save the image itself")
    if b"<svg" in head:
        return "svg"
    raise RefusedImageError("not a PNG, JPEG, WebP or SVG image")


def check_name(filename: str) -> ImageId:
    found = name_id(filename)
    if found is not None:
        return found
    if BARE_NAME.match(filename.lower()):
        stem = Path(filename).stem
        raise RefusedImageError(
            f"name doesn't say crest or photo: rename it crest-{stem} or photo-{stem}"
        )
    raise RefusedImageError("unknown image name: save it under the list's name")


def images_root(images_dir: Path) -> Path:
    return images_dir / "transfermarkt"


def image_files(inbox: Path) -> list[Path]:
    if not inbox.is_dir():
        return []
    return sorted(p for p in inbox.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)


def stored_image(images_dir: Path, image: ImageId) -> Path | None:
    kind, key = image
    found = sorted((images_root(images_dir) / kind).glob(f"{key}.*"))
    return found[0] if found else None


def stored_images(images_dir: Path) -> dict[ImageId, Path]:
    found: dict[ImageId, Path] = {}
    for kind in IMAGE_KINDS:
        for path in sorted((images_root(images_dir) / kind).glob("*.*")):
            found[(kind, path.stem)] = path
    return found
