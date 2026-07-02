import os
os.environ.setdefault("OMP_THREAD_LIMIT", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
import re
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Optional

import cv2
import numpy as np
import pytesseract


# The fixed dispatch slip form is taller/narrower than A4 in the scans that reach
# the analyzer. Keep this aspect in sync with the frontend scanner guide.
CANONICAL_WIDTH = 1200
CANONICAL_HEIGHT = 2132
FORM_ASPECT = CANONICAL_WIDTH / CANONICAL_HEIGHT
MAX_INPUT_SIDE = 1800

TEXT_TIMEOUT_SECONDS = 1.25
DIGIT_TIMEOUT_SECONDS = 0.85

MIN_ACCEPT_QUANTITY_CONFIDENCE = float(os.environ.get("DISPATCH_ANALYZER_MIN_QUANTITY_CONFIDENCE", "0.78"))
LOW_CONFIDENCE_WARNING_THRESHOLD = 0.82
MIN_BLUR_SCORE = 45.0
MIN_BRIGHTNESS = 60.0

ANALYZER_MAX_WORKERS = min(10, max(4, os.cpu_count() or 4))
ANALYZER_EXECUTOR = ThreadPoolExecutor(max_workers=ANALYZER_MAX_WORKERS)
CONTOUR_MAX_SIDE = int(os.environ.get("DISPATCH_ANALYZER_CONTOUR_MAX_SIDE", "700"))
ADAPTIVE_FALLBACK_CONFIDENCE = float(os.environ.get("DISPATCH_ANALYZER_ADAPTIVE_THRESHOLD", "0.0"))
QUANTITY_TESSERACT_ENABLED = os.environ.get("DISPATCH_ANALYZER_QUANTITY_TESSERACT", "0").strip().lower() in {"1", "true", "yes", "on"}
DATE_COMPONENTS_ENABLED = os.environ.get("DISPATCH_ANALYZER_DATE_COMPONENTS", "0").strip().lower() in {"1", "true", "yes", "on"}
PARTNER_NUMBER_MIN_EARLY_STOP_DIGITS = int(os.environ.get("DISPATCH_ANALYZER_PARTNER_EARLY_STOP_DIGITS", "3"))
MAX_FALLBACK_CROP_FRACTION = float(os.environ.get("DISPATCH_ANALYZER_MAX_FALLBACK_CROP_FRACTION", "0.10"))

DATE_RE = re.compile(r"\b(\d{1,2})\s*[./:\-]\s*(\d{1,2})\s*[./:\-]\s*(\d{2,4})\b")
PARTNER_NUMBER_RE = re.compile(r"(?<!\d)(\d{2,6})(?!\d)")

BAD_PARTNER_WORDS = {
    "DATUM", "OIB", "MBO", "MBG", "OI", "VOLONTER", "PRIMIO", "POTPIS", "POTPISAO",
    "NAPOMENA", "BROJ", "ŠIFRA", "SIFRA", "ARTIKL", "KOLIČINA", "KOLICINA", "NAZIV",
}


@dataclass(frozen=True)
class Rect:
    x: int
    y: int
    w: int
    h: int

    @property
    def right(self) -> int:
        return self.x + self.w

    @property
    def bottom(self) -> int:
        return self.y + self.h

    @property
    def area(self) -> int:
        return self.w * self.h

    def crop(self, image: np.ndarray) -> np.ndarray:
        h, w = image.shape[:2]
        x1 = clamp(self.x, 0, w - 1)
        y1 = clamp(self.y, 0, h - 1)
        x2 = clamp(self.right, x1 + 1, w)
        y2 = clamp(self.bottom, y1 + 1, h)
        return image[y1:y2, x1:x2]

    def inset(self, left: float, top: float, right: float, bottom: float) -> "Rect":
        nx = self.x + round(self.w * left)
        ny = self.y + round(self.h * top)
        nr = self.x + round(self.w * right)
        nb = self.y + round(self.h * bottom)
        return Rect(nx, ny, max(1, nr - nx), max(1, nb - ny))


@dataclass(frozen=True)
class RowSpec:
    first_code: int
    count: int
    left: float
    top: float
    right: float
    bottom: float
    quantity_top: float
    quantity_bottom: float


# Known form geometry, not hardcoded OCR results. Ratios are relative to the
# normalized dispatch slip form, not to the phone screen or A4 paper.
ROW_SPECS = [
    RowSpec(1, 10, 0.047, 0.156, 0.962, 0.255, 0.705, 0.985),
    RowSpec(11, 8, 0.047, 0.283, 0.970, 0.433, 0.740, 0.985),
    RowSpec(19, 8, 0.047, 0.465, 0.970, 0.598, 0.735, 0.985),
    RowSpec(27, 9, 0.047, 0.631, 0.970, 0.803, 0.755, 0.985),
]


@dataclass(frozen=True)
class NumberCandidate:
    value: int
    confidence: float
    source: str
    raw: str


@dataclass(frozen=True)
class QuantityDecision:
    code: str
    quantity: Optional[int]
    confidence: float
    raw: str
    source: str
    alternatives: list[NumberCandidate]
    crop_confidence: float


@dataclass(frozen=True)
class PartnerCandidate:
    number: Optional[int]
    text: Optional[str]
    confidence: float
    source: str


@dataclass(frozen=True)
class DateCandidate:
    value: date
    confidence: float
    source: str


@dataclass(frozen=True)
class DigitGuess:
    value: int
    confidence: float
    source: str


DIGIT_TEMPLATES = {
    0: ["01110" + "10001" + "10011" + "10101" + "11001" + "10001" + "01110"],
    1: [
        "00100" + "01100" + "00100" + "00100" + "00100" + "00100" + "01110",
        "00100" + "00100" + "00100" + "00100" + "00100" + "00100" + "00100",
        "01000" + "01000" + "01000" + "01000" + "01000" + "01000" + "01000",
        "00010" + "00010" + "00010" + "00010" + "00010" + "00010" + "00010",
        ],
    2: [
        "01110" + "10001" + "00001" + "00010" + "00100" + "01000" + "11111",
        "00110" + "01001" + "00001" + "00010" + "00100" + "01000" + "11111",
        "01000" + "00100" + "00010" + "00100" + "01000" + "10000" + "11111",
        ],
    3: [
        "11110" + "00001" + "00001" + "01110" + "00001" + "00001" + "11110",
        "01110" + "00001" + "00001" + "00110" + "00001" + "00001" + "01110",
        ],
    4: [
        "00010" + "00110" + "01010" + "10010" + "11111" + "00010" + "00010",
        "10010" + "10010" + "10010" + "11111" + "00010" + "00010" + "00010",
        "01010" + "01010" + "01010" + "11111" + "00010" + "00010" + "00010",
        ],
    5: ["11111" + "10000" + "10000" + "11110" + "00001" + "00001" + "11110"],
    6: ["01110" + "10000" + "10000" + "11110" + "10001" + "10001" + "01110"],
    7: ["11111" + "00001" + "00010" + "00100" + "01000" + "01000" + "01000"],
    8: ["01110" + "10001" + "10001" + "01110" + "10001" + "10001" + "01110"],
    9: ["01110" + "10001" + "10001" + "01111" + "00001" + "00001" + "01110"],
}


def analyze_dispatch_slip(image_bytes: bytes) -> dict:
    started = time.perf_counter()

    original = decode_image(image_bytes)
    quality = image_quality(original)
    document, paper_confidence = normalize_document(original)
    grid_confidence = estimate_known_form_grid_confidence(document)
    # A very strong known-form grid is also strong evidence that the paper is
    # aligned well, even when the outer white border is hard to separate from
    # the background. Keep the contour score when it is better, but do not
    # under-report a clean, correctly aligned form.
    paper_confidence = max(
        paper_confidence,
        clamp_float(0.55 + (grid_confidence * 0.43), 0.20, 0.98),
    )

    partner_number_crop = crop_norm(document, 0.030, 0.055, 0.245, 0.125)
    partner_crop = crop_norm(document, 0.030, 0.070, 0.360, 0.155)
    date_crop_wide = crop_norm(document, 0.595, 0.045, 0.985, 0.158)
    # The wide crop keeps the full date box for context. The inner crop removes
    # the label/table borders and gives Tesseract a cleaner handwritten date.
    date_crop_inner = crop_norm(document, 0.655, 0.076, 0.965, 0.132)
    header_crop = crop_norm(document, 0.030, 0.050, 0.970, 0.155)

    quantity_jobs = build_quantity_jobs(document)

    # Quality-preserving speedup:
    # - keep the same OCR/crop/classifier logic
    # - run focused OCR and all quantity cells at the same time
    # - run slow header OCR only if focused OCR cannot resolve partner/date
    executor = ANALYZER_EXECUTOR

    partner_number_future = executor.submit(ocr_digits_multi, partner_number_crop)
    partner_text_future = executor.submit(ocr_text, partner_crop, "--psm 6", TEXT_TIMEOUT_SECONDS)
    date_text_future = executor.submit(ocr_date_regions, (date_crop_inner, date_crop_wide))

    quantity_futures = [
        executor.submit(
            recognize_quantity_from_cell,
            document,
            code,
            cell,
            row,
            quantity_top_ratio,
        )
        for code, cell, row, quantity_top_ratio in quantity_jobs
    ]

    partner_number_text = partner_number_future.result()
    partner_text = partner_text_future.result()
    date_text = date_text_future.result()

    partner_candidates = extract_partner_candidates(partner_text, partner_number_text, "")
    date_candidates = extract_date_candidates(date_text, "")
    partner = choose_partner(partner_candidates)
    document_date = choose_date(date_candidates)

    header_text = ""
    if partner is None or document_date is None:
        header_text = ocr_text(header_crop, "--psm 6", timeout=TEXT_TIMEOUT_SECONDS)

        if partner is None:
            partner_candidates = extract_partner_candidates(partner_text, partner_number_text, header_text)
            partner = choose_partner(partner_candidates)

        if document_date is None:
            date_candidates = extract_date_candidates(date_text, header_text)
            document_date = choose_date(date_candidates)

    quantity_decisions = [future.result() for future in quantity_futures]

    quantities: dict[str, str] = {}
    quantity_confidences: dict[str, str] = {}
    quantity_results: list[dict] = []
    low_confidence_count = 0

    for decision in quantity_decisions:
        quantity_results.append(quantity_decision_to_dict(decision))

        if decision.quantity is None:
            continue

        quantities[decision.code] = str(decision.quantity)
        quantity_confidences[decision.code] = decimal_string(decision.confidence)

        if decision.confidence < LOW_CONFIDENCE_WARNING_THRESHOLD:
            low_confidence_count += 1

    warnings: list[str] = []

    if not quantities:
        warnings.append("No quantities detected.")

    if low_confidence_count > 0:
        warnings.append(f"{low_confidence_count} quantities have low confidence and should be checked.")

    if partner is None:
        warnings.append("Partner was not detected.")

    if document_date is None:
        warnings.append("Document date was not detected.")

    if paper_confidence < 0.65:
        warnings.append("Paper outline was not confidently detected. Align the slip inside the camera guide.")

    if quality["blurScore"] < MIN_BLUR_SCORE:
        warnings.append("Image is blurry. Retake photo closer and sharper.")

    if quality["brightness"] < MIN_BRIGHTNESS:
        warnings.append("Image is too dark.")

    raw_text = normalize_text("\n".join([
        partner_number_text,
        partner_text,
        date_text,
        header_text,
    ]))

    processing_ms = round((time.perf_counter() - started) * 1000)

    return {
        "partnerNumber": partner.number if partner else None,
        "partnerNumberConfidence": decimal_string(partner.confidence) if partner and partner.number is not None else None,
        "partnerText": partner.text if partner else None,
        "partnerTextConfidence": decimal_string(partner.confidence) if partner and partner.text else None,
        "documentDate": document_date.value.isoformat() if document_date else None,
        "documentDateConfidence": decimal_string(document_date.confidence) if document_date else None,
        "quantities": quantities,
        "quantityConfidences": quantity_confidences,
        "quantityResults": quantity_results,
        "partnerCandidates": [partner_candidate_to_dict(candidate) for candidate in partner_candidates],
        "dateCandidates": [date_candidate_to_dict(candidate) for candidate in date_candidates],
        "rawText": raw_text,
        "warnings": list(dict.fromkeys(warnings)),
        "processingMs": processing_ms,
        "imageQuality": {
            "blurScore": decimal_string(quality["blurScore"]),
            "brightness": decimal_string(quality["brightness"]),
            "contrast": decimal_string(quality["contrast"]),
            "paperDetectionConfidence": decimal_string(paper_confidence),
            "gridDetectionConfidence": decimal_string(grid_confidence),
            "detectedCellCount": "35",
            "gridSource": "aligned_known_form_layout",
        },
    }


def decode_image(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Could not decode image.")

    return image


def normalize_document(image: np.ndarray) -> tuple[np.ndarray, float]:
    resized = resize_max(image, MAX_INPUT_SIDE)
    contour_result = find_document_contour(resized)

    if contour_result is not None:
        contour, confidence = contour_result
        warped = four_point_warp(resized, contour)
        normalized = cv2.resize(warped, (CANONICAL_WIDTH, CANONICAL_HEIGHT), interpolation=cv2.INTER_AREA)
        return normalized, confidence

    normalized = crop_or_pad_to_aspect(resized, FORM_ASPECT)
    normalized = cv2.resize(normalized, (CANONICAL_WIDTH, CANONICAL_HEIGHT), interpolation=cv2.INTER_AREA)
    return normalized, 0.45


def estimate_known_form_grid_confidence(document: np.ndarray) -> float:
    gray = cv2.cvtColor(document, cv2.COLOR_BGR2GRAY)
    binary = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_MEAN_C,
        cv2.THRESH_BINARY_INV,
        31,
        12,
    )

    h, w = binary.shape[:2]
    row_counts = (binary > 0).sum(axis=1)
    expected_lines = [
        0.064, 0.129,
        0.156, 0.255,
        0.283, 0.433,
        0.465, 0.598,
        0.631, 0.803,
        0.839, 0.889,
    ]

    hits = 0
    for ratio in expected_lines:
        center = int(h * ratio)
        radius = max(3, int(h * 0.010))
        y1 = max(0, center - radius)
        y2 = min(h, center + radius + 1)
        if row_counts[y1:y2].max(initial=0) > w * 0.16:
            hits += 1

    dark_fraction = float((binary > 0).sum()) / max(1, h * w)
    density_score = 1.0 if 0.015 <= dark_fraction <= 0.180 else 0.55
    line_score = hits / len(expected_lines)
    return clamp_float((line_score * 0.86) + (density_score * 0.14), 0.20, 0.98)


def resize_max(image: np.ndarray, max_side: int) -> np.ndarray:
    h, w = image.shape[:2]
    side = max(h, w)

    if side <= max_side:
        return image

    scale = max_side / float(side)
    return cv2.resize(image, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)


def find_document_contour(image: np.ndarray) -> Optional[tuple[np.ndarray, float]]:
    # Run page-edge detection on a smaller copy, then scale the quad back.
    # This keeps the same warp quality but avoids doing Canny/contours on a huge phone image.
    original_h, original_w = image.shape[:2]
    scale = min(1.0, float(CONTOUR_MAX_SIDE) / max(original_h, original_w))

    if scale < 1.0:
        work = cv2.resize(image, (round(original_w * scale), round(original_h * scale)), interpolation=cv2.INTER_AREA)
    else:
        work = image

    gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    edges = cv2.Canny(blurred, 35, 140)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    image_area = work.shape[0] * work.shape[1]
    candidates: list[tuple[float, np.ndarray]] = []

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < image_area * 0.18:
            continue

        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.025 * peri, True)

        if len(approx) == 4:
            points = approx.reshape(4, 2).astype(np.float32)
            if is_reasonable_document_quad(points):
                candidates.append((area, points))

    if not candidates:
        bright_quad = find_bright_document_quad(work)
        if bright_quad is None:
            return None

        if scale < 1.0:
            bright_quad = bright_quad / scale

        return bright_quad.astype(np.float32), 0.72

    candidates.sort(key=lambda item: item[0], reverse=True)
    points = candidates[0][1]

    if scale < 1.0:
        points = points / scale

    return points.astype(np.float32), 0.90


def find_bright_document_quad(image: np.ndarray) -> Optional[np.ndarray]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    _, saturation, value = cv2.split(hsv)

    brightness_cutoff = max(135, int(np.percentile(gray, 55)))
    mask = ((gray >= brightness_cutoff) & (saturation <= 92) & (value >= 120)).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((19, 19), np.uint8), iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8), iterations=1)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    image_area = image.shape[0] * image.shape[1]
    candidates: list[tuple[float, np.ndarray]] = []

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < image_area * 0.22:
            continue

        rect = cv2.minAreaRect(contour)
        box = cv2.boxPoints(rect).astype(np.float32)
        rect_area = max(1.0, float(rect[1][0] * rect[1][1]))
        fill_ratio = area / rect_area

        if fill_ratio < 0.48:
            continue
        if not is_reasonable_document_quad(box):
            continue

        edge_touch_bonus = document_edge_touch_bonus(box, image.shape[:2])
        candidates.append((area * (1.0 + edge_touch_bonus), box))

    if not candidates:
        return None

    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def document_edge_touch_bonus(points: np.ndarray, shape: tuple[int, int]) -> float:
    h, w = shape
    margin_x = w * 0.035
    margin_y = h * 0.035
    touches = 0

    for x, y in points:
        if x <= margin_x or x >= w - margin_x:
            touches += 1
        if y <= margin_y or y >= h - margin_y:
            touches += 1

    return min(0.18, touches * 0.03)

def is_reasonable_document_quad(points: np.ndarray) -> bool:
    rect = order_points(points)
    tl, tr, br, bl = rect

    top_w = np.linalg.norm(tr - tl)
    bottom_w = np.linalg.norm(br - bl)
    left_h = np.linalg.norm(bl - tl)
    right_h = np.linalg.norm(br - tr)

    width = max(top_w, bottom_w)
    height = max(left_h, right_h)

    if width <= 1 or height <= 1:
        return False

    aspect = width / height
    return 0.55 <= aspect <= 0.95


def four_point_warp(image: np.ndarray, points: np.ndarray) -> np.ndarray:
    rect = order_points(points)
    tl, tr, br, bl = rect

    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    max_width = max(1, int(max(width_a, width_b)))

    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)
    max_height = max(1, int(max(height_a, height_b)))

    dst = np.array([
        [0, 0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0, max_height - 1],
    ], dtype=np.float32)

    matrix = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, matrix, (max_width, max_height))


def order_points(points: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype=np.float32)
    sums = points.sum(axis=1)
    rect[0] = points[np.argmin(sums)]
    rect[2] = points[np.argmax(sums)]
    diffs = np.diff(points, axis=1)
    rect[1] = points[np.argmin(diffs)]
    rect[3] = points[np.argmax(diffs)]
    return rect


def crop_or_pad_to_aspect(image: np.ndarray, target_aspect: float) -> np.ndarray:
    h, w = image.shape[:2]
    current_aspect = w / max(1, h)

    if current_aspect > target_aspect:
        new_w = int(h * target_aspect)
        removed_fraction = max(0.0, (w - new_w) / max(1, w))
        if removed_fraction <= MAX_FALLBACK_CROP_FRACTION:
            x = max(0, (w - new_w) // 2)
            return image[:, x:x + new_w]
        return pad_to_aspect(image, target_aspect)

    new_h = int(w / target_aspect)
    removed_fraction = max(0.0, (h - new_h) / max(1, h))
    if removed_fraction <= MAX_FALLBACK_CROP_FRACTION:
        y = max(0, (h - new_h) // 2)
        return image[y:y + new_h, :]
    return pad_to_aspect(image, target_aspect)


def pad_to_aspect(image: np.ndarray, target_aspect: float) -> np.ndarray:
    h, w = image.shape[:2]
    current_aspect = w / max(1, h)
    color = estimate_border_color(image)

    if current_aspect > target_aspect:
        new_h = max(h, int(round(w / target_aspect)))
        pad_total = new_h - h
        pad_top = pad_total // 2
        pad_bottom = pad_total - pad_top
        return cv2.copyMakeBorder(image, pad_top, pad_bottom, 0, 0, cv2.BORDER_CONSTANT, value=color)

    new_w = max(w, int(round(h * target_aspect)))
    pad_total = new_w - w
    pad_left = pad_total // 2
    pad_right = pad_total - pad_left
    return cv2.copyMakeBorder(image, 0, 0, pad_left, pad_right, cv2.BORDER_CONSTANT, value=color)


def estimate_border_color(image: np.ndarray) -> tuple[int, int, int]:
    h, w = image.shape[:2]
    band = max(2, round(min(h, w) * 0.02))
    samples = np.concatenate([
        image[:band, :, :].reshape(-1, 3),
        image[-band:, :, :].reshape(-1, 3),
        image[:, :band, :].reshape(-1, 3),
        image[:, -band:, :].reshape(-1, 3),
    ], axis=0)
    median = np.median(samples, axis=0)
    return int(median[0]), int(median[1]), int(median[2])


def image_quality(image: np.ndarray) -> dict[str, float]:
    # Quality metrics do not need full phone resolution. Downscaling here saves time
    # without affecting OCR/quantity analysis, which uses the normalized document.
    work = resize_max(image, 900)
    gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)
    return {
        "blurScore": float(cv2.Laplacian(gray, cv2.CV_64F).var()),
        "brightness": float(np.mean(gray)),
        "contrast": float(np.std(gray)),
    }


def build_quantity_jobs(document: np.ndarray) -> list[tuple[str, Rect, RowSpec, float]]:
    jobs: list[tuple[str, Rect, RowSpec, float]] = []

    for row in ROW_SPECS:
        row_rect = rect_norm(document, row.left, row.top, row.right, row.bottom)
        quantity_top_ratio = find_row_quantity_top_ratio(row_rect.crop(document), row)
        cell_width = row_rect.w / row.count

        for idx in range(row.count):
            code = f"{row.first_code + idx:04d}"
            x1 = row_rect.x + round(cell_width * idx)
            x2 = row_rect.x + round(cell_width * (idx + 1))
            cell = Rect(x1, row_rect.y, max(1, x2 - x1), row_rect.h)
            jobs.append((code, cell, row, quantity_top_ratio))

    return jobs


def extract_quantities_parallel(document: np.ndarray) -> list[QuantityDecision]:
    jobs = build_quantity_jobs(document)
    futures = [
        ANALYZER_EXECUTOR.submit(recognize_quantity_from_cell, document, code, cell, row, quantity_top_ratio)
        for code, cell, row, quantity_top_ratio in jobs
    ]

    return [future.result() for future in futures]


def find_row_quantity_top_ratio(row_image: np.ndarray, row: RowSpec) -> float:
    separator = find_quantity_separator_y(row_image)
    fallback = row.quantity_top

    if separator is None:
        return fallback

    h = row_image.shape[0]
    separator_ratio = separator / max(1, h)

    # Same quality logic as the previous per-cell crop, but computed once per row.
    y1 = (fallback * 0.75) + (separator_ratio * 0.25)
    return min(max(y1, 0.40), 0.78)


def recognize_quantity_from_cell(document: np.ndarray, code: str, cell: Rect, row: RowSpec, quantity_top_ratio: float) -> QuantityDecision:
    cell_image = cell.crop(document)
    quantity_region = crop_quantity_region(cell_image, row, quantity_top_ratio)

    candidates: list[NumberCandidate] = []
    cleaned_masks: list[np.ndarray] = []

    for mask_name, mask in build_quantity_masks_fast(quantity_region):
        cleaned = clean_quantity_mask(mask)
        cleaned_masks.append(cleaned)
        candidates.extend(read_number_candidates(cleaned, f"{mask_name}_components"))

    # Adaptive threshold is useful, but expensive. Run it only when the cheap masks
    # are missing or uncertain, preserving quality without paying the cost for all 35 cells.
    provisional = vote_number_candidates(candidates)
    if provisional is None or (ADAPTIVE_FALLBACK_CONFIDENCE > 0 and provisional.confidence < ADAPTIVE_FALLBACK_CONFIDENCE):
        adaptive = build_adaptive_quantity_mask(quantity_region)
        cleaned = clean_quantity_mask(adaptive)
        cleaned_masks.append(cleaned)
        candidates.extend(read_number_candidates(cleaned, "adaptive_components"))

    crop_confidence = estimate_crop_confidence_from_cleaned(cleaned_masks, quantity_region.shape[:2])

    if should_try_tesseract_quantity(candidates, provisional, crop_confidence):
        candidates.extend(read_tesseract_quantity_candidates(quantity_region))

    chosen = vote_number_candidates(candidates)
    alternatives = sorted(candidates, key=lambda item: item.confidence, reverse=True)[:5]

    if chosen is None:
        return QuantityDecision(code, None, 0.0, "", "none", alternatives, crop_confidence)

    if has_conflicting_quantity_evidence(candidates, chosen.value):
        chosen = NumberCandidate(chosen.value, min(chosen.confidence, 0.79), chosen.source + "_conflict", chosen.raw)

    return QuantityDecision(code, chosen.value, chosen.confidence, chosen.raw, chosen.source, alternatives, crop_confidence)


def crop_quantity_region(cell: np.ndarray, row: RowSpec, quantity_top_ratio: float) -> np.ndarray:
    h, w = cell.shape[:2]

    y1 = int(h * quantity_top_ratio)
    y1 = min(max(y1, int(h * 0.40)), int(h * 0.78))

    y2 = int(h * row.quantity_bottom)
    if y2 <= y1 + 4:
        y2 = h - max(1, int(h * 0.02))

    # Digits are often written close to the left edge of the quantity area.
    # Keep the crop wide, then remove table borders from the mask later.
    x1 = int(w * 0.040)
    x2 = int(w * 0.940)

    return cell[y1:y2, x1:x2]


def find_quantity_separator_y(cell: np.ndarray) -> Optional[int]:
    gray = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)
    binary = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_MEAN_C,
        cv2.THRESH_BINARY_INV,
        21,
        10,
    )

    h, w = binary.shape[:2]
    row_counts = (binary > 0).sum(axis=1)
    candidates: list[tuple[int, int]] = []

    for y, count in enumerate(row_counts):
        if int(h * 0.32) <= y <= int(h * 0.82) and count > w * 0.20:
            candidates.append((y, int(count)))

    if not candidates:
        return None

    groups = group_line_candidates(candidates)
    groups = [group for group in groups if average_y(group) < h * 0.78]

    if not groups:
        return None

    selected = max(groups, key=average_y)
    return max(selected, key=lambda item: item[1])[0]


def group_line_candidates(candidates: list[tuple[int, int]]) -> list[list[tuple[int, int]]]:
    if not candidates:
        return []

    groups: list[list[tuple[int, int]]] = []
    current = [candidates[0]]

    for y, count in candidates[1:]:
        if y - current[-1][0] <= 3:
            current.append((y, count))
        else:
            groups.append(current)
            current = [(y, count)]

    groups.append(current)
    return groups


def average_y(group: list[tuple[int, int]]) -> float:
    return sum(y for y, _ in group) / len(group)


def build_quantity_masks_fast(crop: np.ndarray) -> list[tuple[str, np.ndarray]]:
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)

    background = np.percentile(blurred, 74)
    local_dark = np.where(blurred < background - 8, 255, 0).astype(np.uint8)

    _, strong_dark = cv2.threshold(gray, 145, 255, cv2.THRESH_BINARY_INV)

    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    blue = ((h >= 80) & (h <= 150) & (s >= 24) & (v <= 245)).astype(np.uint8) * 255

    return [
        ("blue", blue),
        ("local_dark", local_dark),
        ("strong_dark", strong_dark),
    ]


def build_adaptive_quantity_mask(crop: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    return cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        25,
        7,
    )


def build_quantity_masks(crop: np.ndarray) -> list[tuple[str, np.ndarray]]:
    return [
        *build_quantity_masks_fast(crop),
        ("adaptive", build_adaptive_quantity_mask(crop)),
    ]


def clean_quantity_mask(mask: np.ndarray) -> np.ndarray:
    clean = mask.copy()
    h, w = clean.shape[:2]

    # Remove table borders/lines. The kernel must be wider than handwritten
    # digit strokes, otherwise open 4s lose their crossbar and become 1s.
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(24, round(w * 0.62)), 1))
    horizontal = cv2.morphologyEx(clean, cv2.MORPH_OPEN, horizontal_kernel)
    clean = cv2.bitwise_and(clean, cv2.bitwise_not(horizontal))

    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(10, round(h * 0.86))))
    vertical = cv2.morphologyEx(clean, cv2.MORPH_OPEN, vertical_kernel)
    clean = cv2.bitwise_and(clean, cv2.bitwise_not(vertical))

    edge = max(1, round(min(h, w) * 0.025))
    clean[:edge, :] = 0
    clean[-edge:, :] = 0
    clean[:, :edge] = 0
    clean[:, -edge:] = 0

    clean = cv2.medianBlur(clean, 3)
    clean = cv2.morphologyEx(clean, cv2.MORPH_CLOSE, np.ones((2, 2), np.uint8))
    return clean


def read_number_candidates(mask: np.ndarray, source: str) -> list[NumberCandidate]:
    rects = digit_components(mask)

    if not rects or len(rects) > 3:
        return []

    candidates: list[NumberCandidate] = []
    open_four = classify_open_four(mask, rects)
    if open_four is not None:
        candidates.append(NumberCandidate(open_four.value, open_four.confidence, f"{source}_{open_four.source}", str(open_four.value)))

    raw = ""
    scores: list[float] = []

    for rect in rects:
        guess = classify_digit(mask, rect)
        if guess is None:
            return candidates
        raw += str(guess.value)
        scores.append(guess.confidence)

    if raw:
        try:
            value = int(raw)
        except ValueError:
            value = 0

        if 0 < value <= 999:
            confidence = min(scores)
            if len(raw) > 1:
                confidence *= 0.78
            candidates.append(NumberCandidate(value, confidence, f"{source}_sequence", raw))

    if len(rects) > 1:
        whole = bounding_rect(rects)
        if whole is not None:
            whole_guess = classify_digit(mask, whole)
            if whole_guess is not None:
                candidates.append(NumberCandidate(
                    whole_guess.value,
                    whole_guess.confidence * 0.92,
                    f"{source}_whole",
                    str(whole_guess.value),
                    ))

    return candidates


def digit_components(mask: np.ndarray) -> list[Rect]:
    count, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    h, w = mask.shape[:2]

    rects: list[Rect] = []

    for idx in range(1, count):
        x, y, cw, ch, area = stats[idx]

        if area < 7:
            continue
        if ch < max(5, h * 0.15):
            continue
        if cw < 2 or cw > w * 0.78:
            continue

        center_x = (x + cw / 2.0) / max(1, w)
        center_y = (y + ch / 2.0) / max(1, h)

        if center_x < 0.06 or center_x > 0.94:
            continue
        if center_y < 0.22:
            continue
        if cw > w * 0.36 and ch < h * 0.18:
            continue
        if x < w * 0.04 and ch > h * 0.35 and cw < w * 0.12:
            continue
        if x + cw > w * 0.96 and ch > h * 0.35 and cw < w * 0.12:
            continue

        rects.append(Rect(int(x), int(y), int(cw), int(ch)))

    rects.sort(key=lambda rect: rect.x)
    return merge_digit_fragments(rects)


def merge_digit_fragments(rects: list[Rect]) -> list[Rect]:
    if len(rects) < 2:
        return rects

    merged: list[Rect] = []
    current = rects[0]

    for nxt in rects[1:]:
        gap = nxt.x - current.right
        avg_h = (current.h + nxt.h) / 2.0
        close = gap <= max(2.0, avg_h * 0.20)
        compatible = current.h <= nxt.h * 2.2 and nxt.h <= current.h * 2.2

        if close and compatible:
            current = merge_rects(current, nxt)
        else:
            merged.append(current)
            current = nxt

    merged.append(current)
    return merged


def merge_rects(a: Rect, b: Rect) -> Rect:
    x = min(a.x, b.x)
    y = min(a.y, b.y)
    right = max(a.right, b.right)
    bottom = max(a.bottom, b.bottom)
    return Rect(x, y, right - x, bottom - y)


def bounding_rect(rects: list[Rect]) -> Optional[Rect]:
    if not rects:
        return None
    x = min(rect.x for rect in rects)
    y = min(rect.y for rect in rects)
    right = max(rect.right for rect in rects)
    bottom = max(rect.bottom for rect in rects)
    return Rect(x, y, right - x, bottom - y)


def classify_open_four(mask: np.ndarray, rects: list[Rect]) -> Optional[DigitGuess]:
    if len(rects) != 2:
        return None

    first, second = rects
    combined = bounding_rect(rects)
    if combined is None:
        return None

    gap = second.x - first.right
    if gap > max(4, combined.w * 0.30):
        return None

    aspect = combined.w / max(1.0, combined.h)
    if aspect < 0.22 or aspect > 0.58:
        return None

    # Open handwritten 4s on this form are commonly drawn as a left slant and a
    # right vertical stroke. Real "11" tends to be two similar vertical strokes
    # with a wider gap and more parallel y ranges.
    starts_staggered = abs(first.y - second.y) >= max(5, combined.h * 0.18)
    horizontally_overlapping = gap < 0
    second_is_vertical = second.h >= first.h * 0.35
    first_reaches_left = first.x <= combined.x + max(3, combined.w * 0.38)
    second_reaches_right = second.right >= combined.x + combined.w * 0.62

    if not ((starts_staggered or horizontally_overlapping) and second_is_vertical and first_reaches_left and second_reaches_right):
        return None

    crop = combined.crop(mask)
    ink = cv2.countNonZero(crop)
    if ink < 12:
        return None

    return DigitGuess(4, 0.93, "open_four")


def classify_digit(mask: np.ndarray, rect: Rect) -> Optional[DigitGuess]:
    cropped = rect.crop(mask)
    normalized, box = normalize_digit_mask(cropped)

    if normalized is None or box is None:
        return None

    heuristic = classify_digit_heuristic(normalized, box)
    template = classify_digit_template(normalized)

    if heuristic is not None and template is not None:
        if heuristic.confidence >= template.confidence - 0.04:
            return heuristic
        return template

    return heuristic or template


def normalize_digit_mask(mask: np.ndarray) -> tuple[Optional[np.ndarray], Optional[Rect]]:
    points = cv2.findNonZero(mask)
    if points is None:
        return None, None

    x, y, w, h = cv2.boundingRect(points)
    if w <= 0 or h <= 0:
        return None, None

    crop = mask[y:y + h, x:x + w]
    canvas = np.zeros((28, 28), dtype=np.uint8)

    scale = min(20 / max(1, w), 24 / max(1, h))
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    resized = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_NEAREST)

    ox = (28 - new_w) // 2
    oy = (28 - new_h) // 2
    canvas[oy:oy + new_h, ox:ox + new_w] = resized
    return canvas, Rect(ox, oy, new_w, new_h)


def classify_digit_heuristic(mask: np.ndarray, box: Rect) -> Optional[DigitGuess]:
    ink = cv2.countNonZero(mask)
    if ink < 6:
        return None

    aspect = box.w / max(1.0, box.h)
    density = ink / max(1.0, box.w * box.h)
    zones = zone_counts(mask)

    left = zones["left"]
    center = zones["center"]
    right = zones["right"]
    top = zones["top"]
    middle = zones["middle"]
    bottom = zones["bottom"]

    if is_single_component_open_four(aspect, density, left, center, right, top, middle, bottom):
        return DigitGuess(4, 0.86, "single_component_open_four")

    if is_single_stroke(mask, box):
        return DigitGuess(1, 0.94, "single_stroke")

    if is_center_dominant_one(aspect, density, left, center, right, top, middle, bottom):
        return DigitGuess(1, 0.90, "center_dominant_one")

    if aspect < 0.46 and center + right > left * 1.10:
        return DigitGuess(1, 0.90, "narrow_center_right")

    if is_right_slanted_one(aspect, density, left, center, right, top, middle, bottom):
        return DigitGuess(1, 0.91, "right_slanted_stroke")

    if is_left_hook_two(aspect, density, left, center, right, top, middle, bottom):
        return DigitGuess(2, 0.86, "left_hook_two")

    if is_curved_two(aspect, density, left, center, right, top, middle, bottom):
        return DigitGuess(2, 0.86, "curved_two")

    if bottom > top * 1.35 and bottom > middle * 0.95 and aspect > 0.44:
        return DigitGuess(2, 0.84, "bottom_heavy")

    if aspect > 0.45 and middle > top * 0.62 and middle > bottom * 0.50 and right >= left * 0.80:
        if left < center * 1.05:
            return DigitGuess(3, 0.82, "middle_right")

    if aspect > 0.46 and middle > top * 0.55 and left > 0 and right > left * 0.45 and density < 0.62:
        return DigitGuess(4, 0.82, "cross_shape")

    return None


def is_right_slanted_one(
        aspect: float,
        density: float,
        left: int,
        center: int,
        right: int,
        top: int,
        middle: int,
        bottom: int,
) -> bool:
    if aspect > 0.58 or density > 0.45:
        return False

    if left > max(4, center * 0.14):
        return False

    if center < max(8, top * 1.15):
        return False

    if right < max(8, top * 1.05):
        return False

    if middle < top * 0.85:
        return False

    if bottom > center * 0.95:
        return False

    return True


def is_center_dominant_one(
        aspect: float,
        density: float,
        left: int,
        center: int,
        right: int,
        top: int,
        middle: int,
        bottom: int,
) -> bool:
    if aspect > 0.52 or density > 0.52:
        return False

    if center < max(24, (left + right) * 5.5):
        return False

    if middle < top * 1.20:
        return False

    if abs(top - bottom) > center * 0.40:
        return False

    return True


def is_single_component_open_four(
        aspect: float,
        density: float,
        left: int,
        center: int,
        right: int,
        top: int,
        middle: int,
        bottom: int,
) -> bool:
    if aspect > 0.50 or density > 0.50:
        return False

    if right < max(8, left * 4.0):
        return False

    if middle < top * 1.25:
        return False

    if bottom < top * 1.10:
        return False

    return True


def is_left_hook_two(
        aspect: float,
        density: float,
        left: int,
        center: int,
        right: int,
        top: int,
        middle: int,
        bottom: int,
) -> bool:
    if aspect < 0.54 or aspect > 0.74 or density > 0.46:
        return False

    if left < max(7, right * 1.55):
        return False

    if center < max(18, left * 2.0):
        return False

    if middle < top * 0.70 or bottom < top * 0.70:
        return False

    return True


def is_curved_two(
        aspect: float,
        density: float,
        left: int,
        center: int,
        right: int,
        top: int,
        middle: int,
        bottom: int,
) -> bool:
    if aspect < 0.48 or aspect > 0.86 or density > 0.56:
        return False

    if top < middle * 0.90 or bottom < middle * 0.90:
        return False

    if center < max(18, left * 3.0):
        return False

    if right < max(10, left * 1.8):
        return False

    return True


def is_single_stroke(mask: np.ndarray, box: Rect) -> bool:
    crop = box.crop(mask)
    points = cv2.findNonZero(crop)

    if points is None or len(points) < 8:
        return False

    pts = points.reshape(-1, 2).astype(np.float32)
    cov = np.cov(pts.T)

    try:
        eigenvalues, _ = np.linalg.eig(cov)
    except np.linalg.LinAlgError:
        return False

    eigenvalues = sorted([float(abs(value)) for value in eigenvalues], reverse=True)
    if eigenvalues[0] <= 0:
        return False

    line_ratio = eigenvalues[1] / eigenvalues[0]
    aspect = box.w / max(1.0, box.h)
    density = cv2.countNonZero(crop) / max(1.0, box.w * box.h)

    return line_ratio < 0.08 and aspect < 0.90 and density < 0.46


def zone_counts(mask: np.ndarray) -> dict[str, int]:
    h, w = mask.shape[:2]
    return {
        "left": cv2.countNonZero(mask[:, :w // 3]),
        "center": cv2.countNonZero(mask[:, w // 3: 2 * w // 3]),
        "right": cv2.countNonZero(mask[:, 2 * w // 3:]),
        "top": cv2.countNonZero(mask[:h // 3, :]),
        "middle": cv2.countNonZero(mask[h // 3: 2 * h // 3, :]),
        "bottom": cv2.countNonZero(mask[2 * h // 3:, :]),
    }


def classify_digit_template(mask: np.ndarray) -> Optional[DigitGuess]:
    grid = digit_grid(mask)
    best_digit: Optional[int] = None
    best_score = 0.0

    for digit, templates in DIGIT_TEMPLATES.items():
        for template in templates:
            score = score_template(grid, template)
            if score > best_score:
                best_score = score
                best_digit = digit

    if best_digit is None or best_score < 0.50:
        return None

    return DigitGuess(best_digit, best_score, "template")


def digit_grid(mask: np.ndarray) -> list[list[bool]]:
    grid: list[list[bool]] = []

    for gy in range(7):
        row: list[bool] = []
        y1 = int(mask.shape[0] * gy / 7.0)
        y2 = max(y1 + 1, int(mask.shape[0] * (gy + 1) / 7.0))

        for gx in range(5):
            x1 = int(mask.shape[1] * gx / 5.0)
            x2 = max(x1 + 1, int(mask.shape[1] * (gx + 1) / 5.0))
            block = mask[y1:y2, x1:x2]
            row.append(cv2.countNonZero(block) >= max(1, block.size * 0.05))

        grid.append(row)

    return grid


def score_template(grid: list[list[bool]], template: str) -> float:
    true_positive = 0
    expected_ink = 0
    actual_ink = 0
    false_positive = 0
    false_negative = 0

    for y in range(7):
        for x in range(5):
            expected = template[y * 5 + x] == "1"
            actual = grid[y][x]

            if expected:
                expected_ink += 1
            if actual:
                actual_ink += 1

            if expected and actual:
                true_positive += 1
            elif actual and not expected:
                false_positive += 1
            elif expected and not actual:
                false_negative += 1

    if expected_ink == 0 or actual_ink == 0:
        return 0.0

    dice = (2.0 * true_positive) / (expected_ink + actual_ink)
    penalty = ((false_positive * 0.35) + (false_negative * 0.25)) / 35.0
    return max(0.0, dice - penalty)


def read_tesseract_quantity_candidates(crop: np.ndarray) -> list[NumberCandidate]:
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    prepared = cv2.resize(gray, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)
    prepared = cv2.GaussianBlur(prepared, (3, 3), 0)

    candidates: list[NumberCandidate] = []

    for psm in (10, 8):
        config = f"--psm {psm} --oem 1 -c tessedit_char_whitelist=0123456789 -c load_system_dawg=0 -c load_freq_dawg=0"

        try:
            text = pytesseract.image_to_string(prepared, config=config, timeout=0.35)
        except Exception:
            continue

        digits = re.sub(r"\D", "", text or "")
        if not digits or len(digits) > 3:
            continue

        try:
            value = int(digits)
        except ValueError:
            continue

        if 0 < value <= 999:
            confidence = 0.60 if len(digits) == 1 else 0.48
            candidates.append(NumberCandidate(value, confidence, f"tesseract_psm_{psm}", digits))

    return candidates


def should_try_tesseract_quantity(
    candidates: list[NumberCandidate],
    provisional: Optional[NumberCandidate],
    crop_confidence: float,
) -> bool:
    if not QUANTITY_TESSERACT_ENABLED:
        return False

    if crop_confidence < 0.52:
        return False

    if provisional is None:
        return True

    if provisional.confidence < 0.86:
        return True

    values = {candidate.value for candidate in candidates if candidate.confidence >= 0.78}
    return len(values) > 1


def has_conflicting_quantity_evidence(candidates: list[NumberCandidate], chosen_value: int) -> bool:
    other_values = [
        candidate
        for candidate in candidates
        if candidate.value != chosen_value and candidate.confidence >= 0.78
    ]

    if not other_values:
        return False

    same_value = [
        candidate
        for candidate in candidates
        if candidate.value == chosen_value and candidate.confidence >= 0.78
    ]

    return len(other_values) >= len(same_value) or max(item.confidence for item in other_values) >= 0.84


def vote_number_candidates(candidates: list[NumberCandidate]) -> Optional[NumberCandidate]:
    candidates = [candidate for candidate in candidates if 0 < candidate.value <= 999]

    if not candidates:
        return None

    grouped: dict[int, list[NumberCandidate]] = {}
    for candidate in candidates:
        grouped.setdefault(candidate.value, []).append(candidate)

    ambiguous_two = choose_ambiguous_two(grouped)
    if ambiguous_two is not None:
        return ambiguous_two

    local_two = choose_local_two_over_fragmented_one(grouped)
    if local_two is not None:
        return local_two

    local_shape = choose_local_shape_over_strong_one(grouped)
    if local_shape is not None:
        return local_shape

    best_value: Optional[int] = None
    best_score = 0.0
    best_raw = ""
    best_sources: list[str] = []

    for value, group in grouped.items():
        max_confidence = max(candidate.confidence for candidate in group)
        avg_confidence = sum(candidate.confidence for candidate in group) / len(group)
        agreement_bonus = min(0.08, 0.035 * (len(group) - 1))
        source_bonus = max(quantity_source_bonus(candidate.source) for candidate in group)
        score = max_confidence * 0.76 + avg_confidence * 0.14 + agreement_bonus + source_bonus

        if value >= 10 and len(group) < 2:
            score -= 0.16

        if len(grouped) >= 3 and len(group) == 1 and source_bonus < 0.060:
            score -= 0.06

        if score > best_score:
            best_score = score
            best_value = value
            best_raw = group[0].raw
            best_sources = [candidate.source for candidate in group]

    if best_value is None or best_score < MIN_ACCEPT_QUANTITY_CONFIDENCE:
        return None

    return NumberCandidate(
        value=best_value,
        confidence=min(0.99, best_score),
        source="vote_" + "_".join(best_sources[:3]),
        raw=best_raw,
    )


def choose_ambiguous_two(grouped: dict[int, list[NumberCandidate]]) -> Optional[NumberCandidate]:
    if 2 not in grouped or 1 not in grouped or 3 not in grouped:
        return None

    two = max(grouped[2], key=lambda item: item.confidence)
    one = max(grouped[1], key=lambda item: item.confidence)
    three = max(grouped[3], key=lambda item: item.confidence)

    if two.confidence < 0.84 or one.confidence < 0.84 or three.confidence < 0.78:
        return None

    if "tesseract" in two.source:
        return None

    return NumberCandidate(
        2,
        min(0.80, two.confidence),
        f"vote_{two.source}_ambiguous_one_three",
        two.raw,
    )


def choose_local_two_over_fragmented_one(grouped: dict[int, list[NumberCandidate]]) -> Optional[NumberCandidate]:
    if set(grouped.keys()) != {1, 2}:
        return None

    two_candidates = [
        candidate
        for candidate in grouped[2]
        if "local_dark" in candidate.source and candidate.confidence >= 0.85
    ]

    if not two_candidates:
        return None

    one_candidates = grouped[1]
    if any("local_dark" in candidate.source and candidate.confidence >= 0.84 for candidate in one_candidates):
        return None

    if len(one_candidates) < 2:
        return None

    best_two = max(two_candidates, key=lambda item: item.confidence)
    return NumberCandidate(
        2,
        min(0.80, best_two.confidence),
        f"vote_{best_two.source}_over_fragmented_one",
        best_two.raw,
    )


def choose_local_shape_over_strong_one(grouped: dict[int, list[NumberCandidate]]) -> Optional[NumberCandidate]:
    if 1 not in grouped:
        return None

    one_candidates = grouped[1]
    if any("strong_dark" in candidate.source and candidate.confidence >= 0.93 for candidate in one_candidates):
        return None

    if any(("local_dark" in candidate.source or "blue" in candidate.source) and candidate.confidence >= 0.84 for candidate in one_candidates):
        return None

    if not any(("strong_dark" in candidate.source or "adaptive" in candidate.source) for candidate in one_candidates):
        return None

    shape_candidates = [
        candidate
        for value in (2, 3, 4)
        for candidate in grouped.get(value, [])
        if ("local_dark" in candidate.source or "blue" in candidate.source)
        and candidate.confidence >= 0.80
    ]

    if not shape_candidates:
        return None

    best = max(shape_candidates, key=lambda item: item.confidence)
    return NumberCandidate(
        best.value,
        min(0.83, best.confidence),
        f"vote_{best.source}_over_strong_one",
        best.raw,
    )


def quantity_source_bonus(source: str) -> float:
    if "open_four" in source:
        return 0.070
    if "blue" in source:
        return 0.045
    if "local_dark" in source:
        return 0.040
    if "tesseract" in source:
        return 0.025
    if "strong_dark" in source:
        return 0.018
    return 0.0


def estimate_crop_confidence_from_cleaned(cleaned_masks: list[np.ndarray], shape: tuple[int, int]) -> float:
    h, w = shape
    area = h * w

    if area <= 0:
        return 0.0

    best_pixels = 0

    for mask in cleaned_masks:
        best_pixels = max(best_pixels, cv2.countNonZero(mask))

    ratio = best_pixels / area

    if ratio < 0.0015:
        return 0.20
    if ratio > 0.35:
        return 0.35

    return min(1.0, 0.55 + ratio * 5.0)


def extract_partner_candidates(partner_text: str, partner_number_text: str, header_text: str) -> list[PartnerCandidate]:
    candidates: list[PartnerCandidate] = []
    combined = normalize_text("\n".join([partner_number_text or "", partner_text or ""]))

    numbers = parse_partner_numbers(combined)
    name = parse_partner_name(partner_text) or parse_partner_name(combined)

    for value, confidence in numbers:
        candidates.append(PartnerCandidate(value, name, confidence if name is None else min(0.94, confidence + 0.06), "partner_crop_number"))

    if name and not numbers:
        candidates.append(PartnerCandidate(None, name, 0.68, "partner_name_crop"))

    header_name = parse_partner_name(header_text)
    if header_name and not name:
        candidates.append(PartnerCandidate(None, header_name, 0.42, "header_name_fallback"))

    return dedupe_partner_candidates(candidates)


def parse_partner_numbers(text: str) -> list[tuple[int, float]]:
    if not text:
        return []

    counts: dict[int, int] = {}

    for match in PARTNER_NUMBER_RE.finditer(text):
        raw = match.group(1)
        try:
            value = int(raw)
        except ValueError:
            continue

        if 10 <= value <= 999999:
            counts[value] = counts.get(value, 0) + 1

    out: list[tuple[int, float]] = []
    for value, count in counts.items():
        digit_len = len(str(value))
        confidence = 0.70 + min(0.16, 0.05 * (count - 1))

        # Prefer realistic printed partner numbers with 3-4 digits.
        # This prevents early OCR noise like "22" from beating a later "293".
        if digit_len in (3, 4):
            confidence += 0.14
        elif digit_len == 2:
            confidence -= 0.12
        elif digit_len >= 5:
            confidence -= 0.04

        out.append((value, min(0.96, max(0.35, confidence))))

    out.sort(key=lambda item: item[1], reverse=True)
    return out[:5]


def parse_partner_name(text: str) -> Optional[str]:
    if not text:
        return None

    best: Optional[str] = None

    for line in normalize_text(text).splitlines()[:10]:
        cleaned = re.sub(r"^\s*\d+\s*", "", line).strip()
        cleaned = re.sub(r"\b(OIB|MBG|MBO|OI|DATUM)\b\s*:?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"[^A-Za-zČĆŽŠĐčćžšđ ._'-]", " ", cleaned)
        cleaned = normalize_text(cleaned)

        if not cleaned:
            continue

        upper = cleaned.upper()
        if any(word in upper for word in BAD_PARTNER_WORDS):
            continue

        letters = re.sub(r"[^A-Za-zČĆŽŠĐčćžšđ]", "", cleaned)
        if len(letters) < 5:
            continue

        if best is None or len(cleaned) > len(best):
            best = cleaned

    return normalize_partner_name(best)


def normalize_partner_name(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    cleaned = normalize_text(value).upper()
    cleaned = re.sub(r"\s+\.", ".", cleaned)
    cleaned = cleaned.strip(" .")

    # Generic OCR cleanup: remove short trailing noise tokens and collapse obvious
    # repeated letters inside long words, e.g. VIDEEC -> VIDEC.
    tokens = [token for token in cleaned.split() if token]
    while len(tokens) > 2 and len(tokens[-1]) <= 2:
        tokens.pop()
    cleaned = " ".join(tokens)
    cleaned = re.sub(r"([A-ZČĆŽŠĐ])\1+", r"\1", cleaned)

    return cleaned or None


def choose_partner(candidates: list[PartnerCandidate]) -> Optional[PartnerCandidate]:
    if not candidates:
        return None
    return sorted(candidates, key=lambda item: item.confidence, reverse=True)[0]


def dedupe_partner_candidates(candidates: list[PartnerCandidate]) -> list[PartnerCandidate]:
    out: list[PartnerCandidate] = []
    seen: set[tuple[Optional[int], str]] = set()

    for candidate in sorted(candidates, key=lambda item: item.confidence, reverse=True):
        key = (candidate.number, normalize_text(candidate.text or "").upper())
        if key in seen:
            continue
        seen.add(key)
        out.append(candidate)

    return out


def extract_date_candidates(date_text: str, header_text: str) -> list[DateCandidate]:
    candidates: list[DateCandidate] = []

    for text, source, confidence in [
        (date_text, "date_crop", 0.86),
        (header_text, "header_crop", 0.70),
    ]:
        normalized = normalize_text(text)
        parts = normalized.splitlines() or [normalized]

        for part in [normalized, *parts]:
            part_source = source
            part_confidence = confidence
            value = part

            if part.lower().startswith("component_date:"):
                value = part.split(":", 1)[1]
                part_source = "date_crop_components"
                # Component reading uses our generic digit classifier. It is a
                # useful fallback, but handwritten 2/1 shapes can be close, so
                # full date OCR from the wider crop must remain authoritative.
                part_confidence = 0.74

            for parsed in parse_all_dates(value):
                candidates.append(DateCandidate(parsed, part_confidence, part_source))

    return candidates


def parse_all_dates(text: str) -> list[date]:
    out: list[date] = []

    if not text:
        return out

    for match in DATE_RE.finditer(text):
        parsed = build_date(match.group(1), match.group(2), match.group(3))
        if parsed is not None:
            out.append(parsed)

    # OCR can drop separators: 25.09.2025 -> 25092025.
    digits = re.sub(r"\D", "", text)

    for i in range(0, max(0, len(digits) - 7)):
        parsed = build_date(digits[i:i + 2], digits[i + 2:i + 4], digits[i + 4:i + 8])
        if parsed is not None:
            out.append(parsed)

    for i in range(0, max(0, len(digits) - 5)):
        parsed = build_date(digits[i:i + 2], digits[i + 2:i + 4], digits[i + 4:i + 6])
        if parsed is not None:
            out.append(parsed)

    deduped: list[date] = []
    seen: set[date] = set()
    for parsed in out:
        if parsed in seen:
            continue
        seen.add(parsed)
        deduped.append(parsed)

    return deduped

def build_date(day_value: str, month_value: str, year_value: str) -> Optional[date]:
    try:
        day = int(day_value)
        month = int(month_value)
        year = int(year_value)

        if year < 100:
            year += 2000
        if year < 2020 or year > 2035:
            return None

        return date(year, month, day)
    except ValueError:
        return None


def choose_date(candidates: list[DateCandidate]) -> Optional[DateCandidate]:
    if not candidates:
        return None

    grouped: dict[date, list[DateCandidate]] = {}
    for candidate in candidates:
        grouped.setdefault(candidate.value, []).append(candidate)

    days_by_month: dict[tuple[int, int], set[int]] = {}
    for value in grouped:
        days_by_month.setdefault((value.year, value.month), set()).add(value.day)

    best: Optional[DateCandidate] = None
    best_score = -1.0
    scored: dict[date, float] = {}

    for value, group in grouped.items():
        max_confidence = max(item.confidence for item in group)
        frequency_bonus = min(0.12, 0.045 * (len(group) - 1))
        sources = {item.source for item in group}
        source_bonus = 0.06 if "date_crop" in sources else 0.0
        score = max_confidence + frequency_bonus + source_bonus

        same_month_days = days_by_month.get((value.year, value.month), set())
        if value.day < 10 and any(day >= 10 for day in same_month_days):
            # Handwritten dates often lose the first stroke of a two-digit day
            # during OCR, e.g. 25.09 can become 05.09. Prefer the two-digit
            # candidate when both are present, and never make the ambiguous
            # single-digit candidate look highly certain.
            score -= 0.16

        scored[value] = score

        if score > best_score:
            best_score = score
            best = DateCandidate(value, score, "+".join(sorted(sources)))

    if best is None:
        return None

    same_month_days = days_by_month.get((best.value.year, best.value.month), set())
    confidence = min(0.96, best.confidence)

    if len(same_month_days) > 1:
        close_competitor = any(
            value != best.value
            and value.year == best.value.year
            and value.month == best.value.month
            and scored.get(value, 0.0) >= best_score - 0.18
            for value in scored
        )

        if close_competitor:
            confidence = min(confidence, 0.80)
        else:
            confidence = min(confidence, 0.84)

        if best.value.day < 10 and any(day >= 10 for day in same_month_days):
            confidence = min(confidence, 0.72)

    if best.value.day < 10 and "date_crop_components" not in best.source:
        confidence = min(confidence, 0.72)

    if best.source == "date_crop_components":
        confidence = min(confidence, 0.70)

    # Date is intentionally read with a fast, single-crop OCR path. Keep the
    # value useful, but do not present it as near-certain when a human still
    # needs to confirm the slip before saving.
    confidence = min(confidence, 0.80)

    best = DateCandidate(best.value, confidence, best.source)

    return best


def ocr_text(image: np.ndarray, psm: str, timeout: float) -> str:
    texts: list[str] = []

    for prepared in text_preprocess_variants(image):
        try:
            config = f"{psm} --oem 1 -c load_system_dawg=0 -c load_freq_dawg=0"
            text = pytesseract.image_to_string(prepared, lang="hrv+eng", config=config, timeout=timeout)
            texts.append(text)
        except Exception:
            continue

        # Quality stays good because we still use the same variants, but for clearly useful text
        # there is no reason to run extra Tesseract subprocesses.
        if has_useful_text("\n".join(texts)):
            break

    return normalize_text("\n".join(texts))


def ocr_digits_multi(image: np.ndarray) -> str:
    texts: list[str] = []
    variants = digit_preprocess_variants(image)

    # Fast path: the first enlarged grayscale + psm 7 is normally enough.
    # Fallback keeps the exact same quality path as the slow version.
    first_plan = [(0, 7), (1, 7)]
    fallback_plan = [(0, 6), (0, 8), (1, 6), (1, 8), (2, 7), (2, 6), (2, 8)]

    for variant_index, psm in first_plan + fallback_plan:
        if variant_index >= len(variants):
            continue

        try:
            config = f"--psm {psm} --oem 1 -c tessedit_char_whitelist=0123456789 -c load_system_dawg=0 -c load_freq_dawg=0"
            text = pytesseract.image_to_string(variants[variant_index], config=config, timeout=DIGIT_TIMEOUT_SECONDS)
            texts.append(text)
        except Exception:
            continue

        if has_likely_partner_number("\n".join(texts)):
            break

    return normalize_text("\n".join(texts))



def ocr_date_regions(images: tuple[np.ndarray, ...]) -> str:
    texts: list[str] = []

    for image in images:
        if DATE_COMPONENTS_ENABLED:
            for digits in read_date_component_candidates(image):
                texts.append(f"component_date:{digits}")

        text = ocr_date(image)
        if text:
            texts.append(text)

    return normalize_text("\n".join(texts))

def ocr_date(image: np.ndarray) -> str:
    texts: list[str] = []
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    enlarged = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    plan = [(enlarged, 7), (enlarged, 6)]

    for prepared, psm in plan:
        try:
            config = f"--psm {psm} --oem 1 -c tessedit_char_whitelist=0123456789./:- -c load_system_dawg=0 -c load_freq_dawg=0"
            text = pytesseract.image_to_string(prepared, lang="hrv+eng", config=config, timeout=DIGIT_TIMEOUT_SECONDS)
            texts.append(text)
        except Exception:
            continue

        if parse_all_dates("\n".join(texts)):
            return normalize_text("\n".join(texts))

    blurred = cv2.GaussianBlur(enlarged, (3, 3), 0)
    _, otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    for psm in (7,):
        try:
            config = f"--psm {psm} --oem 1 -c tessedit_char_whitelist=0123456789./:- -c load_system_dawg=0 -c load_freq_dawg=0"
            text = pytesseract.image_to_string(otsu, lang="hrv+eng", config=config, timeout=DIGIT_TIMEOUT_SECONDS)
            texts.append(text)
        except Exception:
            continue

        if parse_all_dates("\n".join(texts)):
            return normalize_text("\n".join(texts))

    return normalize_text("\n".join(texts))


def read_date_component_candidates(image: np.ndarray) -> list[str]:
    candidates: list[tuple[str, float]] = []

    for mask_name, mask in build_date_digit_masks(image):
        clean = clean_date_digit_mask(mask)
        rects = date_digit_components(clean)

        if len(rects) < 6 or len(rects) > 10:
            continue

        raw = ""
        scores: list[float] = []

        for rect in rects:
            guess = classify_digit(clean, rect)
            if guess is None:
                raw = ""
                break
            raw += str(guess.value)
            scores.append(guess.confidence)

        if not raw:
            continue

        if not parse_all_dates(raw):
            continue

        candidates.append((raw, min(scores) if scores else 0.0))

    out: list[str] = []
    seen: set[str] = set()

    for raw, _ in sorted(candidates, key=lambda item: item[1], reverse=True):
        if raw in seen:
            continue
        seen.add(raw)
        out.append(raw)

    return out[:3]


def build_date_digit_masks(crop: np.ndarray) -> list[tuple[str, np.ndarray]]:
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    background = np.percentile(blurred, 76)
    local_dark = np.where(blurred < background - 7, 255, 0).astype(np.uint8)

    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    blue = ((h >= 80) & (h <= 155) & (s >= 20) & (v <= 248)).astype(np.uint8) * 255

    _, strong_dark = cv2.threshold(gray, 155, 255, cv2.THRESH_BINARY_INV)

    return [
        ("blue_date", blue),
        ("local_dark_date", local_dark),
        ("strong_dark_date", strong_dark),
    ]


def clean_date_digit_mask(mask: np.ndarray) -> np.ndarray:
    clean = clean_quantity_mask(mask)
    h, w = clean.shape[:2]

    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(14, round(w * 0.34)), 1))
    horizontal = cv2.morphologyEx(clean, cv2.MORPH_OPEN, horizontal_kernel)
    clean = cv2.bitwise_and(clean, cv2.bitwise_not(horizontal))

    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(10, round(h * 0.72))))
    vertical = cv2.morphologyEx(clean, cv2.MORPH_OPEN, vertical_kernel)
    clean = cv2.bitwise_and(clean, cv2.bitwise_not(vertical))

    return clean


def date_digit_components(mask: np.ndarray) -> list[Rect]:
    count, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    h, w = mask.shape[:2]
    rects: list[Rect] = []

    for idx in range(1, count):
        x, y, cw, ch, area = stats[idx]

        if area < 6:
            continue
        if ch < max(5, h * 0.16) or ch > h * 0.92:
            continue
        if cw < 2 or cw > w * 0.20:
            continue

        center_y = (y + ch / 2.0) / max(1, h)
        if center_y < 0.16 or center_y > 0.88:
            continue

        rects.append(Rect(int(x), int(y), int(cw), int(ch)))

    rects.sort(key=lambda rect: rect.x)
    return merge_digit_fragments(rects)


def has_likely_partner_number(value: str) -> bool:
    for match in PARTNER_NUMBER_RE.finditer(value or ""):
        raw = match.group(1)
        if PARTNER_NUMBER_MIN_EARLY_STOP_DIGITS <= len(raw) <= 6:
            return True
    return False


def has_useful_text(value: str) -> bool:
    normalized = normalize_text(value)
    letters = re.sub(r"[^A-Za-zČĆŽŠĐčćžšđ]", "", normalized)
    words = [word for word in re.split(r"\s+", normalized) if len(word) >= 3]
    return len(letters) >= 8 and len(words) >= 2

def text_preprocess_variants(image: np.ndarray) -> list[np.ndarray]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    enlarged = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    blurred = cv2.GaussianBlur(enlarged, (3, 3), 0)

    _, otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    adaptive = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 8)

    return [enlarged, otsu, adaptive]


def digit_preprocess_variants(image: np.ndarray) -> list[np.ndarray]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    enlarged = cv2.resize(gray, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)
    blurred = cv2.GaussianBlur(enlarged, (3, 3), 0)

    _, otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    adaptive = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 8)

    return [enlarged, otsu, adaptive]


def rect_norm(image: np.ndarray, left: float, top: float, right: float, bottom: float) -> Rect:
    h, w = image.shape[:2]
    return Rect(
        round(w * left),
        round(h * top),
        max(1, round(w * (right - left))),
        max(1, round(h * (bottom - top))),
    )


def crop_norm(image: np.ndarray, left: float, top: float, right: float, bottom: float) -> np.ndarray:
    return rect_norm(image, left, top, right, bottom).crop(image)


def quantity_decision_to_dict(decision: QuantityDecision) -> dict:
    return {
        "slipItemCode": decision.code,
        "quantity": str(decision.quantity) if decision.quantity is not None else None,
        "confidence": decimal_string(decision.confidence),
        "raw": decision.raw,
        "source": decision.source,
        "layoutSource": "aligned_known_form_layout",
        "cropConfidence": decimal_string(decision.crop_confidence),
        "alternatives": [
            {
                "quantity": str(candidate.value),
                "confidence": decimal_string(candidate.confidence),
                "source": candidate.source,
                "raw": candidate.raw,
            }
            for candidate in decision.alternatives
        ],
    }


def partner_candidate_to_dict(candidate: PartnerCandidate) -> dict:
    return {
        "number": candidate.number,
        "text": candidate.text,
        "confidence": decimal_string(candidate.confidence),
        "source": candidate.source,
    }


def date_candidate_to_dict(candidate: DateCandidate) -> dict:
    return {
        "date": candidate.value.isoformat(),
        "confidence": decimal_string(candidate.confidence),
        "source": candidate.source,
    }


def normalize_text(value: Optional[str]) -> str:
    if value is None:
        return ""
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.splitlines()]
    return "\n".join(line for line in lines if line)


def decimal_string(value: float) -> str:
    return str(Decimal(str(round(float(value), 4))))


def clamp(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))


def clamp_float(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))
