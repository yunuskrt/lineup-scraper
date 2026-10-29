import pytest

from extract.images import (
    RefusedImageError,
    check_name,
    image_from_url,
    name_id,
    save_as,
    sniff,
)

IMG = "https://img.a.transfermarkt.technology"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("27_1400571853.png", ("crest", "27")),
        ("206-1663667692.jpg", ("photo", "206")),
        ("s_7573_123_2012_10_23_1.jpg", ("photo", "7573")),
        ("crest-36.png", ("crest", "36")),
        ("PHOTO-206.JPG", ("photo", "206")),
        ("36.png", None),
        ("oliver-kahn.jpg", None),
    ],
)
def test_reads_the_id_from_a_file_name(
    name: str, expected: tuple[str, str] | None
) -> None:
    assert name_id(name) == expected


def test_reads_kind_and_id_from_an_image_url() -> None:
    assert image_from_url(f"{IMG}/wappen/normquad/36.png?lm=1") == ("crest", "36")
    assert image_from_url(f"{IMG}/portrait/header/206-1.jpg") == ("photo", "206")
    assert image_from_url(f"{IMG}/flagge/tiny/50.png") is None
    assert image_from_url("https://www.transfermarkt.com/x") is None


def test_saves_under_the_browser_name_unless_it_is_ambiguous() -> None:
    assert save_as("crest", "27", f"{IMG}/wappen/normquad/27_14.png?lm=1") == (
        "27_14.png"
    )
    assert save_as("crest", "36", f"{IMG}/wappen/normquad/36.png?lm=1") == (
        "crest-36.png"
    )


@pytest.mark.parametrize(
    ("data", "suffix"),
    [
        (PNG, "png"),
        (b"\xff\xd8\xff\xe0rest", "jpg"),
        (b"RIFF\x00\x00\x00\x00WEBPVP8 ", "webp"),
        (b'<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>', "svg"),
    ],
)
def test_knows_a_format_by_its_first_bytes(data: bytes, suffix: str) -> None:
    assert sniff(data) == suffix


@pytest.mark.parametrize(
    ("data", "reason"),
    [
        (b"", "empty file"),
        (b"<!DOCTYPE html><html><body>challenge</body></html>", "an HTML page"),
        (b"GIF89a....", "not a PNG, JPEG, WebP or SVG"),
    ],
)
def test_refuses_what_is_not_an_image(data: bytes, reason: str) -> None:
    with pytest.raises(RefusedImageError, match=reason):
        sniff(data)


def test_names_the_fix_for_a_bare_name() -> None:
    assert check_name("crest-36.png") == ("crest", "36")
    with pytest.raises(RefusedImageError, match="crest-36 or photo-36"):
        check_name("36.png")
    with pytest.raises(RefusedImageError, match="unknown image name"):
        check_name("image.png")


def test_reads_an_svg_with_a_doctype() -> None:
    svg = b'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"><svg/>'
    assert sniff(svg) == "svg"
