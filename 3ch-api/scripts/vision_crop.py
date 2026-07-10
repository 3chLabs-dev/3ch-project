import argparse
import json
import sys

from PIL import Image, ImageOps
import cv2
import numpy as np


def find_score_table(image):
    pixels = np.array(image)
    gray = cv2.cvtColor(pixels, cv2.COLOR_RGB2GRAY)
    binary = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        31,
        8,
    )

    height, width = gray.shape
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(40, width // 18), 1))
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(30, height // 18)))
    horizontal = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horizontal_kernel)
    vertical = cv2.morphologyEx(binary, cv2.MORPH_OPEN, vertical_kernel)
    grid = cv2.dilate(cv2.add(horizontal, vertical), np.ones((3, 3), dtype=np.uint8), iterations=1)

    contours, _ = cv2.findContours(grid, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    for contour in contours:
        x, y, rect_width, rect_height = cv2.boundingRect(contour)
        area = rect_width * rect_height
        ratio = rect_width / max(1, rect_height)
        if rect_width < width * 0.45 or rect_height < height * 0.12:
            continue
        if not 1.4 <= ratio <= 5.5:
            continue
        candidates.append((area, x, y, rect_width, rect_height))

    if not candidates:
        return None

    _, x, y, rect_width, rect_height = max(candidates)
    padding_x = max(8, round(rect_width * 0.015))
    padding_y = max(8, round(rect_height * 0.025))
    return (
        max(0, x - padding_x),
        max(0, y - padding_y),
        min(width, x + rect_width + padding_x),
        min(height, y + rect_height + padding_y),
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    image = Image.open(args.input)
    image = ImageOps.exif_transpose(image).convert("RGB")
    crop_box = find_score_table(image)
    result = {"cropped": bool(crop_box), "width": image.width, "height": image.height}

    if crop_box:
        image = image.crop(crop_box)
        result["width"] = image.width
        result["height"] = image.height

    image.save(args.output, format="JPEG", quality=95, optimize=True)
    print(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
