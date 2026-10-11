#!/usr/bin/env python3
"""Split the generated Mediguard atlases into outline-trimmed transparent PNGs."""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "images" / "mediguard-sprites"


def connected_components(mask: np.ndarray):
    height, width = mask.shape
    labels = np.zeros((height, width), dtype=np.int32)
    components = []
    next_label = 0

    for y, x in np.argwhere(mask):
        if labels[y, x]:
            continue
        next_label += 1
        queue = deque([(int(y), int(x))])
        labels[y, x] = next_label
        pixels = []
        while queue:
            cy, cx = queue.popleft()
            pixels.append((cy, cx))
            for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = next_label
                    queue.append((ny, nx))
        components.append(pixels)
    return labels, components


def dilate(mask: np.ndarray, rounds: int = 3):
    result = mask.copy()
    for _ in range(rounds):
        expanded = result.copy()
        expanded[1:] |= result[:-1]
        expanded[:-1] |= result[1:]
        expanded[:, 1:] |= result[:, :-1]
        expanded[:, :-1] |= result[:, 1:]
        result = expanded
    return result


def extract(atlas_name: str, prefix: str, columns: int, rows: int):
    source = Image.open(ROOT / "images" / atlas_name).convert("RGBA")
    rgba = np.asarray(source).copy()
    alpha = rgba[:, :, 3]
    labels, components = connected_components(alpha >= 64)
    height, width = alpha.shape
    centers = [
        ((column + 0.5) * width / columns, (row + 0.5) * height / rows)
        for row in range(rows)
        for column in range(columns)
    ]
    assigned_labels = [[] for _ in centers]

    for label, pixels in enumerate(components, start=1):
        if len(pixels) < 8:
            continue
        ys = np.fromiter((pixel[0] for pixel in pixels), dtype=np.float32)
        xs = np.fromiter((pixel[1] for pixel in pixels), dtype=np.float32)
        cx, cy = float(xs.mean()), float(ys.mean())
        owner = min(range(len(centers)), key=lambda index: (cx - centers[index][0]) ** 2 + (cy - centers[index][1]) ** 2)
        assigned_labels[owner].append(label)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    for index, owned in enumerate(assigned_labels):
        selection = np.isin(labels, owned)
        selection = dilate(selection, 3) & (alpha > 0)
        ys, xs = np.where(selection)
        if not len(xs):
            raise RuntimeError(f"No visible pixels found for {prefix}-{index}")
        padding = 10
        left = max(0, int(xs.min()) - padding)
        top = max(0, int(ys.min()) - padding)
        right = min(width, int(xs.max()) + padding + 1)
        bottom = min(height, int(ys.max()) + padding + 1)
        isolated = rgba.copy()
        isolated[:, :, 3] = np.where(selection, alpha, 0)
        Image.fromarray(isolated, "RGBA").crop((left, top, right, bottom)).save(OUTPUT / f"{prefix}-{index}.png", optimize=True)


if __name__ == "__main__":
    extract("mediguard-characters.png", "character", 5, 2)
    extract("mediguard-pathogens.png", "pathogen", 6, 2)
