#!/usr/bin/env python3
import argparse
import json
import sys
from collections import defaultdict

try:
    from PIL import Image, ImageOps
except ImportError:
    print("Pillow is required for OCR scanning.", file=sys.stderr)
    sys.exit(2)

try:
    import pytesseract
except ImportError:
    print("pytesseract is required for OCR scanning.", file=sys.stderr)
    sys.exit(2)


def parse_args():
    parser = argparse.ArgumentParser(description="Extract text from an image with Tesseract OCR.")
    parser.add_argument("--image", required=True)
    parser.add_argument("--language", default="kor+eng")
    parser.add_argument("--psm", type=int, default=6)
    parser.add_argument("--max-side", type=int, default=2400)
    parser.add_argument("--tesseract-cmd", default="")
    return parser.parse_args()


def prepare_image(path, max_side):
    image = Image.open(path)
    image = ImageOps.exif_transpose(image).convert("RGB")
    width, height = image.size
    largest = max(width, height)
    if max_side > 0 and largest > max_side:
        scale = max_side / largest
        image = image.resize((round(width * scale), round(height * scale)), Image.Resampling.LANCZOS)

    gray = ImageOps.grayscale(image)
    gray = ImageOps.autocontrast(gray)
    return gray


def confidence_value(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number >= 0 else None


def extract_lines(data):
    grouped = defaultdict(list)
    count = len(data.get("text", []))

    for index in range(count):
        text = str(data["text"][index] or "").strip()
        if not text:
            continue

        key = (
            data["page_num"][index],
            data["block_num"][index],
            data["par_num"][index],
            data["line_num"][index],
        )
        grouped[key].append({
            "text": text,
            "confidence": confidence_value(data["conf"][index]),
            "left": int(data["left"][index]),
            "top": int(data["top"][index]),
            "width": int(data["width"][index]),
            "height": int(data["height"][index]),
        })

    lines = []
    for key in sorted(grouped):
        words = grouped[key]
        left = min(word["left"] for word in words)
        top = min(word["top"] for word in words)
        right = max(word["left"] + word["width"] for word in words)
        bottom = max(word["top"] + word["height"] for word in words)
        confidences = [word["confidence"] for word in words if word["confidence"] is not None]
        confidence = round(sum(confidences) / len(confidences), 2) if confidences else None
        lines.append({
            "text": " ".join(word["text"] for word in words),
            "confidence": confidence,
            "bbox": {
                "x": left,
                "y": top,
                "w": right - left,
                "h": bottom - top,
            },
        })
    return lines


def extract_words(data):
    words = []
    count = len(data.get("text", []))

    for index in range(count):
        text = str(data["text"][index] or "").strip()
        if not text:
            continue

        words.append({
            "text": text,
            "confidence": confidence_value(data["conf"][index]),
            "bbox": {
                "x": int(data["left"][index]),
                "y": int(data["top"][index]),
                "w": int(data["width"][index]),
                "h": int(data["height"][index]),
            },
        })

    return words


def extract_digit_words(image):
    digit_config = "--psm 11 -c tessedit_char_whitelist=0123456789OoIl|"
    data = pytesseract.image_to_data(
        image,
        lang="eng",
        config=digit_config,
        output_type=pytesseract.Output.DICT,
    )
    return extract_words(data)


def main():
    args = parse_args()
    if args.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = args.tesseract_cmd

    image = prepare_image(args.image, args.max_side)
    config = f"--psm {args.psm}"

    try:
        text = pytesseract.image_to_string(image, lang=args.language, config=config).strip()
        data = pytesseract.image_to_data(
            image,
            lang=args.language,
            config=config,
            output_type=pytesseract.Output.DICT,
        )
        digit_words = extract_digit_words(image)
    except pytesseract.TesseractNotFoundError:
        print("Tesseract executable was not found.", file=sys.stderr)
        sys.exit(3)
    except pytesseract.TesseractError as error:
        print(str(error), file=sys.stderr)
        sys.exit(4)

    result = {
        "engine": "tesseract",
        "language": args.language,
        "text": text,
        "lines": extract_lines(data),
        "words": extract_words(data),
        "digitWords": digit_words,
        "image": {
            "width": image.width,
            "height": image.height,
        },
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
