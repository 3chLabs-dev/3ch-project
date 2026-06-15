import argparse
import itertools
import json
import sys
from collections import Counter, defaultdict

try:
    from PIL import Image, ImageFilter, ImageOps
except ImportError as exc:
    print(f"Pillow is required: {exc}", file=sys.stderr)
    sys.exit(2)

try:
    import cv2  # type: ignore
    import numpy as np  # type: ignore
    HAS_OPENCV = True
except ImportError:
    cv2 = None
    np = None
    HAS_OPENCV = False

# 촬영/crop 보정 후에도 좌표가 조금 밀릴 수 있어 소폭 이동 후보를 같이 시도함.
COORDINATE_OFFSETS = [
    (-0.018, -0.016),
    (-0.018, -0.008),
    (-0.018, 0),
    (-0.018, 0.008),
    (-0.018, 0.016),
    (-0.009, -0.016),
    (-0.009, -0.008),
    (-0.009, 0),
    (-0.009, 0.008),
    (-0.009, 0.016),
    (0, -0.016),
    (0, -0.008),
    (0, 0),
    (0, 0.008),
    (0, 0.016),
    (0.009, -0.016),
    (0.009, -0.008),
    (0.009, 0),
    (0.009, 0.008),
    (0.009, 0.016),
    (0.018, -0.016),
    (0.018, -0.008),
    (0.018, 0),
    (0.018, 0.008),
    (0.018, 0.016),
]

COORDINATE_TRANSFORMS = [
    {"name": "base", "x_scale": 1.0, "y_scale": 1.0},
    {"name": "compact", "x_scale": 0.988, "y_scale": 0.988},
    {"name": "wide", "x_scale": 1.012, "y_scale": 1.0},
    {"name": "tall", "x_scale": 1.0, "y_scale": 1.012},
    {"name": "large", "x_scale": 1.024, "y_scale": 1.018},
]

MARK_READ_SCALES = (0.55, 0.75)
MARK_SEARCH_OFFSETS = (
    (0.0, 0.0),
    (-0.9, 0.0),
    (0.9, 0.0),
    (0.0, -0.9),
    (0.0, 0.9),
    (-0.45, 0.0),
    (0.45, 0.0),
    (0.0, -0.45),
    (0.0, 0.45),
    (-0.35, -0.35),
    (0.35, -0.35),
    (-0.35, 0.35),
    (0.35, 0.35),
)
MAX_PROCESSING_EDGE = 1800
CONSENSUS_MIN_SUPPORT = 3
CONSENSUS_MIN_SHARE = 0.6
LUMINANCE_CACHE = {}


def read_payload(payload_path: str):
    # Node 브리지에서 임시 파일로 넘긴 좌표/임계값 설정 읽음.
    with open(payload_path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def prepare_with_pillow(image: Image.Image) -> Image.Image:
    # OpenCV가 없을 때도 최소 판독 가능하도록 Pillow만으로 명암 정리함.
    grayscale = ImageOps.grayscale(image)
    grayscale = ImageOps.autocontrast(grayscale)
    grayscale = grayscale.filter(ImageFilter.MedianFilter(size=3))
    return grayscale


def prepare_with_opencv(image: Image.Image) -> Image.Image:
    # 촬영 환경마다 밝기가 달라서 정규화와 적응형 threshold로 마킹 대비 끌어올림.
    rgb = np.array(image)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    normalized = clahe.apply(blurred)
    filtered = cv2.medianBlur(normalized, 3)
    return Image.fromarray(filtered)


def prepare_image(image_path: str):
    # 휴대폰 사진의 EXIF 회전값 반영 후 사용 가능한 엔진으로 전처리함.
    image = Image.open(image_path)
    image = ImageOps.exif_transpose(image).convert("RGB")
    image.thumbnail((MAX_PROCESSING_EDGE, MAX_PROCESSING_EDGE), Image.Resampling.LANCZOS)
    if HAS_OPENCV:
        return prepare_with_opencv(image), "opencv"
    return prepare_with_pillow(image), "pillow"


def build_image_variants(image):
    # 일부 모바일 브라우저는 EXIF 없이 픽셀 자체가 회전된 이미지를 올림.
    # 직각 회전 후보를 모두 시도하고 점수 일관성이 가장 좋은 방향을 선택함.
    return [
        ("rot0", image),
        ("rot90", image.rotate(90, expand=True)),
        ("rot180", image.rotate(180, expand=True)),
        ("rot270", image.rotate(270, expand=True)),
    ]


def clamp(value, low, high):
    return max(low, min(high, value))


def read_luminance_stats(image, left, top, right, bottom):
    width, height = image.size
    left = clamp(round(left), 0, width - 1)
    right = clamp(round(right), 0, width - 1)
    top = clamp(round(top), 0, height - 1)
    bottom = clamp(round(bottom), 0, height - 1)
    if right < left or bottom < top:
        return {"count": 0, "mean": 255.0, "dark": 0.0}

    if HAS_OPENCV:
        cache_key = id(image)
        cached = LUMINANCE_CACHE.get(cache_key)
        if cached is None or cached["image"] is not image:
            pixels = np.array(image)
            if len(pixels.shape) == 3:
                pixels = cv2.cvtColor(pixels, cv2.COLOR_RGB2GRAY)
            cached = {
                "image": image,
                "luminance": cv2.integral(pixels.astype(np.float64)),
                "dark": cv2.integral((pixels < 150).astype(np.uint8)),
            }
            LUMINANCE_CACHE[cache_key] = cached

        def rect_sum(integral):
            return (
                integral[bottom + 1, right + 1]
                - integral[top, right + 1]
                - integral[bottom + 1, left]
                + integral[top, left]
            )

        total = (right - left + 1) * (bottom - top + 1)
        luminance_sum = float(rect_sum(cached["luminance"]))
        dark = float(rect_sum(cached["dark"]))
        return {
            "count": total,
            "mean": luminance_sum / total if total else 255.0,
            "dark": (dark / total) * 100 if total else 0.0,
        }

    pixels = image.load()
    total = 0
    dark = 0
    luminance_sum = 0.0
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            luminance = pixels[x, y]
            luminance_sum += luminance
            if luminance < 150:
                dark += 1
            total += 1

    return {
        "count": total,
        "mean": luminance_sum / total if total else 255.0,
        "dark": (dark / total) * 100 if total else 0.0,
    }


def read_darkness_rect(image, center_x, center_y, width_ratio, height_ratio, scale=0.65):
    # 각 점수 박스 주변의 어두운 픽셀 비율 계산해 실제 마킹 여부 판단함.
    width, height = image.size
    # 인쇄된 사각형 안쪽 위주로 읽음. 촬영으로 마킹 영역이 흐려지거나
    # 작게 잡히는 경우를 대비해 여러 크기 후보를 함께 시도함.
    box_width = max(4, round(width * width_ratio * scale))
    box_height = max(4, round(height * height_ratio * scale))
    start_x = max(0, round(center_x - box_width / 2))
    end_x = min(width - 1, round(center_x + box_width / 2))
    start_y = max(0, round(center_y - box_height / 2))
    end_y = min(height - 1, round(center_y + box_height / 2))

    inner = read_luminance_stats(image, start_x, start_y, end_x, end_y)
    outer_width = max(box_width + 2, round(width * width_ratio * 1.8))
    outer_height = max(box_height + 2, round(height * height_ratio * 1.8))
    outer = read_luminance_stats(
        image,
        center_x - outer_width / 2,
        center_y - outer_height / 2,
        center_x + outer_width / 2,
        center_y + outer_height / 2,
    )
    contrast = max(0.0, outer["mean"] - inner["mean"])
    return inner["dark"] + contrast * 0.35


def read_best_darkness(image, center_x, center_y, width_ratio, height_ratio):
    width, height = image.size
    mark_width = max(4, width * width_ratio)
    mark_height = max(4, height * height_ratio)
    # 촬영 각도/종이 휘어짐으로 중심 좌표가 조금 어긋나도 같은 칸 안에서 재탐색함.
    return max(
        read_darkness_rect(
            image,
            center_x + dx * mark_width,
            center_y + dy * mark_height,
            width_ratio,
            height_ratio,
            scale,
        )
        for dx, dy in MARK_SEARCH_OFFSETS
        for scale in MARK_READ_SCALES
    )


def crop_image(image, rect, padding=4):
    # 감지한 표 경계가 살짝 타이트할 수 있어 약간의 여백 포함해 자름.
    width, height = image.size
    x, y, w, h = rect
    left = max(0, x - padding)
    top = max(0, y - padding)
    right = min(width, x + w + padding)
    bottom = min(height, y + h + padding)
    return image.crop((left, top, right, bottom))


def order_quad_points(points):
    # perspective 보정용 네 꼭짓점을 좌상, 우상, 우하, 좌하 순서로 정렬함.
    points = np.array(points, dtype="float32")
    ordered = np.zeros((4, 2), dtype="float32")
    sums = points.sum(axis=1)
    diffs = np.diff(points, axis=1)
    ordered[0] = points[np.argmin(sums)]
    ordered[2] = points[np.argmax(sums)]
    ordered[1] = points[np.argmin(diffs)]
    ordered[3] = points[np.argmax(diffs)]
    return ordered


def warp_quad(image, points):
    # 비스듬히 촬영된 표를 정면 직사각형 이미지로 펴줌.
    ordered = order_quad_points(points)
    top_left, top_right, bottom_right, bottom_left = ordered
    width_top = np.linalg.norm(top_right - top_left)
    width_bottom = np.linalg.norm(bottom_right - bottom_left)
    height_right = np.linalg.norm(bottom_right - top_right)
    height_left = np.linalg.norm(bottom_left - top_left)
    target_width = max(1, int(max(width_top, width_bottom)))
    target_height = max(1, int(max(height_right, height_left)))
    destination = np.array(
        [
            [0, 0],
            [target_width - 1, 0],
            [target_width - 1, target_height - 1],
            [0, target_height - 1],
        ],
        dtype="float32",
    )
    matrix = cv2.getPerspectiveTransform(ordered, destination)
    warped = cv2.warpPerspective(np.array(image), matrix, (target_width, target_height))
    return Image.fromarray(warped)


def detect_l_alignment_marker_images(image):
    # 새 출력물은 점수 영역 모서리에 방향이 서로 다른 L자 기준점 4개가 있음.
    # 점수 마킹 사각형과 구별하기 위해 L자의 방향까지 확인함.
    if not HAS_OPENCV:
        return []

    gray = np.array(image)
    if len(gray.shape) == 3:
        gray = cv2.cvtColor(gray, cv2.COLOR_RGB2GRAY)

    inverted = cv2.bitwise_not(gray)
    _, binary = cv2.threshold(inverted, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    height, width = binary.shape[:2]
    min_edge = min(width, height)
    min_side = max(8, round(min_edge * 0.006))
    max_side = max(min_side + 1, round(min_edge * 0.06))
    contours, _hierarchy = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    l_candidates = []

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w < min_side or h < min_side or w > max_side or h > max_side:
            continue
        aspect = w / h if h else 0
        if aspect < 0.72 or aspect > 1.38:
            continue
        rect_area = w * h
        if not rect_area:
            continue
        fill_ratio = cv2.contourArea(contour) / rect_area
        if fill_ratio < 0.3 or fill_ratio > 0.72:
            continue
        roi = binary[y:y + h, x:x + w]
        half_w = max(1, w // 2)
        half_h = max(1, h // 2)
        corner_scores = {
            "top-left": cv2.countNonZero(roi[:half_h, :half_w]),
            "top-right": cv2.countNonZero(roi[:half_h, half_w:]),
            "bottom-left": cv2.countNonZero(roi[half_h:, :half_w]),
            "bottom-right": cv2.countNonZero(roi[half_h:, half_w:]),
        }
        orientation = max(corner_scores, key=corner_scores.get)
        l_candidates.append((x + w / 2, y + h / 2, rect_area, orientation))

    l_candidates.sort(key=lambda item: item[2], reverse=True)
    l_candidates = l_candidates[:40]
    best = None

    for combination in itertools.combinations(l_candidates, 4):
        points = np.array([[x, y] for x, y, _area, _orientation in combination], dtype="float32")
        top_left, top_right, bottom_right, bottom_left = order_quad_points(points)
        ordered_points = [top_left, top_right, bottom_right, bottom_left]
        expected_orientations = ["top-left", "top-right", "bottom-right", "bottom-left"]
        orientations = []
        for ordered_point in ordered_points:
            nearest = min(
                combination,
                key=lambda item: np.linalg.norm(ordered_point - np.array(item[:2], dtype="float32")),
            )
            orientations.append(nearest[3])
        if orientations != expected_orientations:
            continue
        span_width = max(
            np.linalg.norm(top_right - top_left),
            np.linalg.norm(bottom_right - bottom_left),
        )
        span_height = max(
            np.linalg.norm(bottom_left - top_left),
            np.linalg.norm(bottom_right - top_right),
        )
        if span_width < width * 0.45 or span_height < height * 0.15:
            continue
        layout_aspect = span_width / span_height if span_height else 0
        if layout_aspect < 1.35 or layout_aspect > 8:
            continue

        alignment_error = (
            abs(top_left[0] - bottom_left[0])
            + abs(top_right[0] - bottom_right[0])
            + abs(top_left[1] - top_right[1])
            + abs(bottom_left[1] - bottom_right[1])
        ) / max(1, span_width + span_height)
        if alignment_error > 0.32:
            continue

        score = (span_width * span_height) / (1 + alignment_error * 8)
        if best is None or score > best[0]:
            best = (score, points)

    return [warp_quad(image, best[1])] if best else []


def detect_alignment_marker_images(image):
    # 이전 출력물의 사각형 기준점도 계속 인식함.
    l_marker_images = detect_l_alignment_marker_images(image)
    if l_marker_images:
        return l_marker_images
    if not HAS_OPENCV:
        return []

    gray = np.array(image)
    if len(gray.shape) == 3:
        gray = cv2.cvtColor(gray, cv2.COLOR_RGB2GRAY)

    inverted = cv2.bitwise_not(gray)
    _, binary = cv2.threshold(inverted, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    height, width = binary.shape[:2]
    min_edge = min(width, height)
    min_side = max(8, round(min_edge * 0.006))
    max_side = max(min_side + 1, round(min_edge * 0.06))
    contours, _hierarchy = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    square_candidates = []

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w < min_side or h < min_side or w > max_side or h > max_side:
            continue
        aspect = w / h if h else 0
        if aspect < 0.72 or aspect > 1.38:
            continue
        rect_area = w * h
        if not rect_area or cv2.contourArea(contour) / rect_area < 0.72:
            continue
        square_candidates.append((x + w / 2, y + h / 2, rect_area))

    square_candidates.sort(key=lambda item: item[2], reverse=True)
    square_candidates = square_candidates[:40]
    best = None

    for combination in itertools.combinations(square_candidates, 4):
        points = np.array([[x, y] for x, y, _area in combination], dtype="float32")
        top_left, top_right, bottom_right, bottom_left = order_quad_points(points)
        span_width = max(
            np.linalg.norm(top_right - top_left),
            np.linalg.norm(bottom_right - bottom_left),
        )
        span_height = max(
            np.linalg.norm(bottom_left - top_left),
            np.linalg.norm(bottom_right - top_right),
        )
        if span_width < width * 0.45 or span_height < height * 0.15:
            continue
        layout_aspect = span_width / span_height if span_height else 0
        if layout_aspect < 1.35 or layout_aspect > 8:
            continue

        alignment_error = (
            abs(top_left[0] - bottom_left[0])
            + abs(top_right[0] - bottom_right[0])
            + abs(top_left[1] - top_right[1])
            + abs(bottom_left[1] - bottom_right[1])
        ) / max(1, span_width + span_height)
        if alignment_error > 0.32:
            continue

        score = (span_width * span_height) / (1 + alignment_error * 8)
        if best is None or score > best[0]:
            best = (score, points)

    return [warp_quad(image, best[1])] if best else []


def detect_table_images(image):
    # 화면 좌표는 표 영역 기준이므로 사진 안에서 표 후보 찾아 별도 판독 후보로 만듦.
    if not HAS_OPENCV:
        return []

    gray = np.array(image)
    if len(gray.shape) == 3:
        gray = cv2.cvtColor(gray, cv2.COLOR_RGB2GRAY)

    # 전처리된 이미지는 흰 배경과 검은 선/글자 구조임.
    # 반전 후 긴 가로/세로선만 남겨 표 격자 후보 찾음.
    inverted = cv2.bitwise_not(gray)
    _, binary = cv2.threshold(inverted, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    height, width = binary.shape[:2]

    # 작은 글자나 숫자는 지우고 표 선처럼 긴 구조만 보존함.
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(30, width // 18), 1))
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(20, height // 20)))
    horizontal = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horizontal_kernel, iterations=1)
    vertical = cv2.morphologyEx(binary, cv2.MORPH_OPEN, vertical_kernel, iterations=1)
    grid = cv2.dilate(cv2.add(horizontal, vertical), np.ones((3, 3), dtype=np.uint8), iterations=1)

    table_images = detect_alignment_marker_images(image)

    # 메인 대진표는 사진 폭 대부분을 차지하는 긴 가로선들이 모여 있음.
    # 경기순서 작은 표와 섞이지 않도록 긴 선 좌표로 메인 표 crop 후보를 별도로 만듦.
    horizontal_contours, _ = cv2.findContours(horizontal, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    long_lines = []
    for contour in horizontal_contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w >= width * 0.55:
            long_lines.append((x, y, w, h))
    if len(long_lines) >= 2:
        x_min = min(x for x, _y, _w, _h in long_lines)
        x_max = max(x + w for x, _y, w, _h in long_lines)
        y_centers = sorted(y + h / 2 for _x, y, _w, h in long_lines)
        y_min = y_centers[0]
        y_max = y_centers[-1]
        if (x_max - x_min) >= width * 0.55 and (y_max - y_min) >= height * 0.15:
            table_images.append(crop_image(
                image,
                (
                    int(x_min),
                    int(y_min),
                    int(x_max - x_min),
                    int(y_max - y_min),
                ),
                padding=0,
            ))
            table_images.append(crop_image(
                image,
                (
                    int(x_min),
                    int(y_min),
                    int(x_max - x_min),
                    int(y_max - y_min),
                ),
                padding=max(6, width // 180),
            ))

    vertical_contours, _ = cv2.findContours(vertical, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    tall_lines = []
    for contour in vertical_contours:
        x, y, w, h = cv2.boundingRect(contour)
        if h >= height * 0.18:
            tall_lines.append((x, y, w, h))
    if len(long_lines) >= 2 and len(tall_lines) >= 2:
        x_centers = sorted(x + w / 2 for x, _y, w, _h in tall_lines)
        y_centers = sorted(y + h / 2 for _x, y, _w, h in long_lines)
        x_min = x_centers[0]
        x_max = x_centers[-1]
        y_min = y_centers[0]
        y_max = y_centers[-1]
        if (x_max - x_min) >= width * 0.55 and (y_max - y_min) >= height * 0.15:
            table_images.append(crop_image(
                image,
                (
                    int(x_min),
                    int(y_min),
                    int(x_max - x_min),
                    int(y_max - y_min),
                ),
                padding=max(2, width // 360),
            ))

    contours, _hierarchy = cv2.findContours(grid, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    image_area = width * height
    for contour in contours:
        # 너무 작거나 표 비율에서 많이 벗어난 윤곽은 후보에서 제외함.
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        if area < image_area * 0.08:
            continue
        if w < width * 0.45 or h < height * 0.18:
            continue
        aspect = w / h if h else 0
        if aspect < 1.4 or aspect > 8:
            continue
        candidates.append((area, contour, (x, y, w, h)))

    candidates.sort(reverse=True, key=lambda item: item[0])
    for _area, contour, rect in candidates[:3]:
        # 네 꼭짓점이 잡히면 그대로 펴고, 아니면 최소 회전 사각형으로 보정함.
        epsilon = 0.02 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        if len(approx) == 4:
            table_images.append(warp_quad(image, approx.reshape(4, 2)))
        else:
            rotated_rect = cv2.minAreaRect(contour)
            box = cv2.boxPoints(rotated_rect)
            table_images.append(warp_quad(image, box))
        table_images.append(crop_image(image, rect))
    return table_images


def transform_mark_position(mark, transform, x_offset, y_offset):
    x_scale = transform.get("x_scale", 1.0)
    y_scale = transform.get("y_scale", 1.0)
    x = 0.5 + (mark["x"] - 0.5) * x_scale + x_offset
    y = 0.5 + (mark["y"] - 0.5) * y_scale + y_offset
    return min(1, max(0, x)), min(1, max(0, y))


def scan_scenario(image, marks, darkness_threshold, margin_threshold, x_offset=0, y_offset=0, transform=None):
    # 하나의 이미지 후보에서 모든 OMR 마크 읽고, 선수별 가장 진한 점수 고름.
    grouped = defaultdict(list)
    width, height = image.size

    for mark in marks:
        transform = transform or COORDINATE_TRANSFORMS[0]
        mark_x, mark_y = transform_mark_position(mark, transform, x_offset, y_offset)
        center_x = mark_x * width
        center_y = mark_y * height
        darkness = read_best_darkness(
            image,
            center_x,
            center_y,
            mark["w"],
            mark["h"],
        )
        key = (mark["matchId"], mark["playerId"])
        grouped[key].append({"score": mark["score"], "darkness": darkness})

    result = {}
    choices = []
    recognized = 0
    confidence = 0.0
    for (match_id, player_id), items in grouped.items():
        # 가장 진한 칸이 충분히 진하고 2등 칸과 차이가 있을 때만 확정함.
        ranked = sorted(items, key=lambda item: item["darkness"], reverse=True)
        if len(ranked) < 2:
            continue

        winner = ranked[0]
        runner_up = ranked[1]
        if winner["darkness"] < darkness_threshold:
            continue
        if winner["darkness"] - runner_up["darkness"] < margin_threshold:
            continue

        result.setdefault(match_id, {})[player_id] = winner["score"]
        choices.append({
            "matchId": match_id,
            "playerId": player_id,
            "score": winner["score"],
            "darkness": winner["darkness"],
            "margin": winner["darkness"] - runner_up["darkness"],
        })
        recognized += 1
        confidence += winner["darkness"] - runner_up["darkness"]

    complete_matches, valid_matches = count_complete_valid_matches(result, marks)

    return {
        "result": result,
        "choices": choices,
        "recognizedCount": recognized,
        "completeMatchCount": complete_matches,
        "validMatchCount": valid_matches,
        "confidence": confidence,
    }


def scan_detected_filled_marks(image, marks, x_offset=0, y_offset=0, transform=None, contour_cache=None):
    # 실제로 칠해진 검은 사각형을 먼저 찾고, 예상 OMR 칸 안쪽에 들어온 것만 매칭함.
    if not HAS_OPENCV or not marks:
        return {
            "result": {},
            "choices": [],
            "recognizedCount": 0,
            "completeMatchCount": 0,
            "validMatchCount": 0,
            "confidence": 0,
        }

    transform = transform or COORDINATE_TRANSFORMS[0]
    width, height = image.size
    mark_positions = []
    mark_widths = []
    mark_heights = []
    for mark in marks:
        mark_x, mark_y = transform_mark_position(mark, transform, x_offset, y_offset)
        mark_width = max(4, width * mark["w"])
        mark_height = max(4, height * mark["h"])
        mark_positions.append({
            "mark": mark,
            "x": mark_x * width,
            "y": mark_y * height,
            "w": mark_width,
            "h": mark_height,
        })
        mark_widths.append(mark_width)
        mark_heights.append(mark_height)

    typical_width = float(np.median(mark_widths))
    typical_height = float(np.median(mark_heights))
    if contour_cache is None:
        gray = np.array(image)
        if len(gray.shape) == 3:
            gray = cv2.cvtColor(gray, cv2.COLOR_RGB2GRAY)
        mask = cv2.inRange(gray, 0, 125)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), dtype=np.uint8), iterations=1)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    else:
        mask, contours = contour_cache

    grouped = defaultdict(list)
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w < typical_width * 0.35 or h < typical_height * 0.35:
            continue
        if w > typical_width * 2.8 or h > typical_height * 2.8:
            continue
        aspect = w / h if h else 0
        if aspect < 0.55 or aspect > 1.8:
            continue

        roi = mask[y:y + h, x:x + w]
        fill_ratio = cv2.countNonZero(roi) / float(max(1, w * h))
        if fill_ratio < 0.35:
            continue

        center_x = x + w / 2
        center_y = y + h / 2
        best_mark = None
        best_distance = None
        for item in mark_positions:
            dx = abs(center_x - item["x"])
            dy = abs(center_y - item["y"])
            if dx > item["w"] * 6.0 or dy > item["h"] * 4.0:
                continue
            normalized_distance = (dx / item["w"]) + (dy / item["h"])
            if best_distance is None or normalized_distance < best_distance:
                best_distance = normalized_distance
                best_mark = item

        if best_mark is None:
            continue
        if best_distance is None or best_distance > 7.5:
            continue

        mark = best_mark["mark"]
        confidence = fill_ratio * 100 + max(0, 45 - best_distance * 10)
        grouped[(mark["matchId"], mark["playerId"])].append({
            "score": mark["score"],
            "darkness": confidence,
        })

    result = {}
    choices = []
    for (match_id, player_id), items in grouped.items():
        ranked = sorted(items, key=lambda item: item["darkness"], reverse=True)
        winner = ranked[0]
        result.setdefault(match_id, {})[player_id] = winner["score"]
        choices.append({
            "matchId": match_id,
            "playerId": player_id,
            "score": winner["score"],
            "darkness": winner["darkness"],
            "margin": winner["darkness"],
        })

    complete_matches, valid_matches = count_complete_valid_matches(result, marks)
    return {
        "result": result,
        "choices": choices,
        "recognizedCount": sum(len(scores) for scores in result.values()),
        "completeMatchCount": complete_matches,
        "validMatchCount": valid_matches,
        "confidence": sum(choice["margin"] for choice in choices),
    }


def count_complete_valid_matches(result, marks):
    expected_players = defaultdict(set)
    for mark in marks:
        expected_players[mark["matchId"]].add(mark["playerId"])

    complete_matches = 0
    valid_matches = 0
    for match_id, players in expected_players.items():
        match_result = result.get(match_id) or {}
        if not players.issubset(match_result.keys()):
            continue

        complete_matches += 1
        scores = [match_result[player_id] for player_id in players]
        if len(scores) == 2 and scores.count(3) == 1 and all(0 <= score <= 3 for score in scores):
            valid_matches += 1

    return complete_matches, valid_matches


def filter_valid_match_results(result, marks):
    expected_players = defaultdict(set)
    for mark in marks:
        expected_players[mark["matchId"]].add(mark["playerId"])

    filtered = {}
    for match_id, players in expected_players.items():
        match_result = result.get(match_id) or {}
        if not players.issubset(match_result.keys()):
            continue

        scores = [match_result[player_id] for player_id in players]
        if len(scores) == 2 and scores.count(3) == 1 and all(0 <= score <= 3 for score in scores):
            filtered[match_id] = {player_id: match_result[player_id] for player_id in players}

    return filtered


def summarize_result(result, choices, marks):
    complete_matches, valid_matches = count_complete_valid_matches(result, marks)
    return {
        "result": result,
        "choices": choices,
        "recognizedCount": sum(len(scores) for scores in result.values()),
        "completeMatchCount": complete_matches,
        "validMatchCount": valid_matches,
        "confidence": sum(choice.get("margin", 0) for choice in choices),
    }


def merge_scan_summaries(summaries, marks):
    # 여러 좌표 보정 후보가 서로 다른 칸을 읽은 경우, 선수별 가장 신뢰도 높은 값만 병합함.
    best_choices = {}
    for summary in summaries:
        for choice in summary.get("choices", []):
            key = (choice["matchId"], choice["playerId"])
            previous = best_choices.get(key)
            current_quality = (choice.get("margin", 0), choice.get("darkness", 0))
            previous_quality = (
                previous.get("margin", 0),
                previous.get("darkness", 0),
            ) if previous else None
            if previous is None or current_quality > previous_quality:
                best_choices[key] = choice

    result = {}
    choices = []
    for (match_id, player_id), choice in best_choices.items():
        result.setdefault(match_id, {})[player_id] = choice["score"]
        choices.append(choice)

    return summarize_result(result, choices, marks)


def merge_valid_matches_from_summaries(summaries, marks):
    # 한 경기의 양쪽 점수는 같은 좌표 후보에서 나온 경우만 인정하고,
    # 경기별로 가장 신뢰도 높은 후보를 골라 종이 휘어짐에 대응함.
    best_matches = {}
    for summary in summaries:
        valid_result = filter_valid_match_results(summary.get("result") or {}, marks)
        if not valid_result:
            continue

        choice_map = {
            (choice["matchId"], choice["playerId"]): choice
            for choice in summary.get("choices", [])
        }
        for match_id, match_scores in valid_result.items():
            match_choices = [
                choice_map.get((match_id, player_id))
                for player_id in match_scores.keys()
            ]
            confidence = sum(choice.get("margin", 0) for choice in match_choices if choice)
            previous = best_matches.get(match_id)
            if previous is None or confidence > previous["confidence"]:
                best_matches[match_id] = {
                    "scores": match_scores,
                    "choices": [choice for choice in match_choices if choice],
                    "confidence": confidence,
                }

    result = {}
    choices = []
    for match_id, item in best_matches.items():
        result[match_id] = item["scores"]
        choices.extend(item["choices"])

    return summarize_result(result, choices, marks)


def merge_complete_matches_from_summaries(summaries, marks):
    best_matches = {}
    for summary in summaries:
        result = summary.get("result") or {}
        choice_map = {
            (choice["matchId"], choice["playerId"]): choice
            for choice in summary.get("choices", [])
        }
        for match_id, match_scores in result.items():
            if len(match_scores) < 2:
                continue
            match_choices = [
                choice_map.get((match_id, player_id))
                for player_id in match_scores.keys()
            ]
            confidence = sum(choice.get("margin", 0) for choice in match_choices if choice)
            previous = best_matches.get(match_id)
            if previous is None or confidence > previous["confidence"]:
                best_matches[match_id] = {
                    "scores": match_scores,
                    "choices": [choice for choice in match_choices if choice],
                    "confidence": confidence,
                }

    result = {}
    choices = []
    for match_id, item in best_matches.items():
        result[match_id] = item["scores"]
        choices.extend(item["choices"])

    return summarize_result(result, choices, marks)


def merge_consensus_valid_matches_from_summaries(summaries, marks):
    expected_players = defaultdict(set)
    for mark in marks:
        expected_players[mark["matchId"]].add(mark["playerId"])

    observations = defaultdict(list)
    for summary in summaries:
        valid_result = filter_valid_match_results(summary.get("result") or {}, marks)
        choice_map = {
            (choice["matchId"], choice["playerId"]): choice
            for choice in summary.get("choices", [])
        }
        for match_id, scores in valid_result.items():
            players = sorted(expected_players[match_id])
            signature = tuple((player_id, scores[player_id]) for player_id in players)
            confidence = sum(
                choice_map.get((match_id, player_id), {}).get("margin", 0)
                for player_id in players
            )
            observations[match_id].append((signature, confidence))

    result = {}
    choices = []
    consensus = {}
    for match_id, match_observations in observations.items():
        counts = Counter(signature for signature, _confidence in match_observations)
        signature, support = counts.most_common(1)[0]
        total = sum(counts.values())
        share = support / total if total else 0
        if support < CONSENSUS_MIN_SUPPORT or share < CONSENSUS_MIN_SHARE:
            continue

        scores = dict(signature)
        result[match_id] = scores
        consensus[match_id] = {
            "support": support,
            "observations": total,
            "share": round(share, 4),
        }
        for player_id, score in signature:
            matching_confidences = [
                confidence
                for observed_signature, confidence in match_observations
                if observed_signature == signature
            ]
            choices.append({
                "matchId": match_id,
                "playerId": player_id,
                "score": score,
                "darkness": 0,
                "margin": sum(matching_confidences) / max(1, len(matching_confidences)),
            })

    summary = summarize_result(result, choices, marks)
    summary["consensus"] = consensus
    return summary


def is_better_scan(summary, best):
    if best is None:
        return True
    current_quality = (
        summary["validMatchCount"],
        summary["completeMatchCount"],
        summary["recognizedCount"],
        summary["confidence"],
    )
    best_quality = (
        best["validMatchCount"],
        best["completeMatchCount"],
        best["recognizedCount"],
        best["confidence"],
    )
    return current_quality > best_quality


def scan_scenario_candidates(base_image, scenario, darkness_threshold, margin_threshold, table_images):
    # sheet/table 좌표 기준별로 여러 이미지 후보 시도하고 가장 많이 읽힌 결과 선택함.
    scenario_name = scenario.get("name") or "unnamed"
    marks = scenario.get("marks") or []
    candidates = []

    if scenario_name == "table":
        candidates.extend((f"table-crop-{index + 1}", image) for index, image in enumerate(table_images))
    candidates.append(("full-image", base_image))

    best = None
    candidate_summaries = []
    all_summaries = []
    for candidate_name, candidate_image in candidates:
        contour_cache = None
        if HAS_OPENCV:
            gray = np.array(candidate_image)
            if len(gray.shape) == 3:
                gray = cv2.cvtColor(gray, cv2.COLOR_RGB2GRAY)
            mask = cv2.inRange(gray, 0, 125)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), dtype=np.uint8), iterations=1)
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            contour_cache = (mask, contours)
        offset_summaries = []
        for transform in COORDINATE_TRANSFORMS:
            for x_offset, y_offset in COORDINATE_OFFSETS:
                scan_summaries = [
                    scan_scenario(
                        candidate_image,
                        marks,
                        darkness_threshold,
                        margin_threshold,
                        x_offset,
                        y_offset,
                        transform,
                    ),
                    scan_detected_filled_marks(
                        candidate_image,
                        marks,
                        x_offset,
                        y_offset,
                        transform,
                        contour_cache,
                    ),
                ]
                summary = max(scan_summaries, key=lambda item: (
                    item["validMatchCount"],
                    item["completeMatchCount"],
                    item["recognizedCount"],
                    item["confidence"],
                ))
                all_summaries.append(summary)
                offset_summary = {
                    "transform": transform["name"],
                    "xOffset": x_offset,
                    "yOffset": y_offset,
                    "recognizedCount": summary["recognizedCount"],
                    "completeMatchCount": summary["completeMatchCount"],
                    "validMatchCount": summary["validMatchCount"],
                    "confidence": summary["confidence"],
                }
                offset_summaries.append(offset_summary)
                if is_better_scan(summary, best):
                    best = {
                        "candidate": candidate_name,
                        "transform": transform["name"],
                        "xOffset": x_offset,
                        "yOffset": y_offset,
                        "recognizedCount": summary["recognizedCount"],
                        "completeMatchCount": summary["completeMatchCount"],
                        "validMatchCount": summary["validMatchCount"],
                        "confidence": summary["confidence"],
                        "result": summary["result"],
                        "choices": summary["choices"],
                    }

        best_offset = max(
            offset_summaries,
            key=lambda item: (
                item["validMatchCount"],
                item["completeMatchCount"],
                item["recognizedCount"],
                item["confidence"],
            ),
            default={
                "recognizedCount": 0,
                "completeMatchCount": 0,
                "validMatchCount": 0,
                "confidence": 0,
                "xOffset": 0,
                "yOffset": 0,
            },
        )
        candidate_summaries.append({
            "name": candidate_name,
            "recognizedCount": best_offset["recognizedCount"],
            "completeMatchCount": best_offset["completeMatchCount"],
            "validMatchCount": best_offset["validMatchCount"],
            "confidence": best_offset["confidence"],
            "transform": best_offset.get("transform", "base"),
            "xOffset": best_offset["xOffset"],
            "yOffset": best_offset["yOffset"],
        })

    merged_valid = merge_valid_matches_from_summaries(all_summaries, marks)
    if is_better_scan(merged_valid, best):
        best = {
            "candidate": "valid-match-merged",
            "transform": "per-match",
            "xOffset": 0,
            "yOffset": 0,
            "recognizedCount": merged_valid["recognizedCount"],
            "completeMatchCount": merged_valid["completeMatchCount"],
            "validMatchCount": merged_valid["validMatchCount"],
            "confidence": merged_valid["confidence"],
            "result": merged_valid["result"],
            "choices": merged_valid["choices"],
        }

    merged_complete = merge_complete_matches_from_summaries(all_summaries, marks)
    if is_better_scan(merged_complete, best):
        best = {
            "candidate": "complete-match-merged",
            "transform": "per-match",
            "xOffset": 0,
            "yOffset": 0,
            "recognizedCount": merged_complete["recognizedCount"],
            "completeMatchCount": merged_complete["completeMatchCount"],
            "validMatchCount": merged_complete["validMatchCount"],
            "confidence": merged_complete["confidence"],
            "result": merged_complete["result"],
            "choices": merged_complete["choices"],
        }

    consensus = merge_consensus_valid_matches_from_summaries(all_summaries, marks)
    if consensus["validMatchCount"] > 0:
        best = {
            "candidate": "consensus-valid-matches",
            "transform": "consensus",
            "xOffset": 0,
            "yOffset": 0,
            "recognizedCount": consensus["recognizedCount"],
            "completeMatchCount": consensus["completeMatchCount"],
            "validMatchCount": consensus["validMatchCount"],
            "confidence": consensus["confidence"],
            "result": consensus["result"],
            "choices": consensus["choices"],
            "consensus": consensus["consensus"],
        }

    return {
        "name": scenario_name,
        "recognizedCount": best["recognizedCount"] if best else 0,
        "completeMatchCount": best["completeMatchCount"] if best else 0,
        "validMatchCount": best["validMatchCount"] if best else 0,
        "confidence": best["confidence"] if best else 0,
        "candidate": best["candidate"] if best else None,
        "transform": best.get("transform", "base") if best else "base",
        "xOffset": best["xOffset"] if best else 0,
        "yOffset": best["yOffset"] if best else 0,
        "result": best["result"] if best else {},
        "consensus": best.get("consensus", {}) if best else {},
        "candidates": candidate_summaries,
    }


def main():
    # 입력 파일 경로와 payload 경로는 Node 서비스가 임시 파일로 넘김.
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()

    payload = read_payload(args.payload)
    scenarios = payload.get("scenarios") or []
    darkness_threshold = float(payload.get("darknessThreshold", 18))
    margin_threshold = float(payload.get("marginThreshold", 5))

    if not scenarios:
        raise ValueError("At least one OMR scenario is required.")

    image, engine_name = prepare_image(args.image)
    image_variants = build_image_variants(image)
    # 회전 방향별로 표 후보를 만들고 sheet/table 좌표계와 함께 비교함.
    scenario_summaries = []
    best = None
    variant_scenarios = []
    for image_variant, variant_image in image_variants:
        table_images = detect_table_images(variant_image)
        for scenario in scenarios:
            variant_scenarios.append((image_variant, variant_image, table_images, scenario))

    for image_variant, image, table_images, scenario in variant_scenarios:
        # 프론트가 보낸 sheet/table 좌표계 중 실제 사진에 가장 잘 맞는 것 찾음.
        summary = scan_scenario_candidates(
            image,
            scenario,
            darkness_threshold,
            margin_threshold,
            table_images,
        )
        scenario_summaries.append({
            "name": summary["name"],
            "imageVariant": image_variant,
            "recognizedCount": summary["recognizedCount"],
            "completeMatchCount": summary["completeMatchCount"],
            "validMatchCount": summary["validMatchCount"],
            "confidence": summary["confidence"],
            "candidate": summary["candidate"],
            "transform": summary["transform"],
            "xOffset": summary["xOffset"],
            "yOffset": summary["yOffset"],
            "candidates": summary["candidates"],
        })
        if (
            best is None
                or (
                    summary["validMatchCount"],
                    summary["completeMatchCount"],
                    summary["recognizedCount"],
                    summary["confidence"],
                )
                > (
                    best["validMatchCount"],
                    best["completeMatchCount"],
                    best["recognizedCount"],
                    best["confidence"],
                )
        ):
            best = {
                "name": summary["name"],
                "imageVariant": image_variant,
                "candidate": summary["candidate"],
                "transform": summary["transform"],
                "xOffset": summary["xOffset"],
                "yOffset": summary["yOffset"],
                "recognizedCount": summary["recognizedCount"],
                "completeMatchCount": summary["completeMatchCount"],
                "validMatchCount": summary["validMatchCount"],
                "confidence": summary["confidence"],
                "result": summary["result"],
                "consensus": summary["consensus"],
            }

    # 프론트/로그에서 튜닝 가능하도록 선택된 시나리오와 후보별 인식 개수 함께 반환함.
    output = {
        "engine": f"python-{engine_name}",
        "scenario": best["name"],
        "imageVariant": best["imageVariant"],
        "candidate": best["candidate"],
        "transform": best["transform"],
        "xOffset": best["xOffset"],
        "yOffset": best["yOffset"],
        "recognizedCount": best["recognizedCount"],
        "completeMatchCount": best["completeMatchCount"],
        "validMatchCount": best["validMatchCount"],
        "confidence": best["confidence"],
        "result": best["result"],
        "consensus": best["consensus"],
        "scenarios": scenario_summaries,
    }
    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
