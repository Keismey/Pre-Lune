#!/usr/bin/env python3
"""Découpe des planches Gemini (lots A et B : chaumières, ateliers, créatures, herbe, chemin).

Usage : python3 tools/decoupe_assets.py DOSSIER_DES_PLANCHES [DOSSIER_DU_DEPOT]

Le dossier contient planche1.jpg à planche6.jpg (numéros du GDD, section Assets) + herbe.jpg + chemin.jpg.

Produit :
  img/buildings.webp   atlas des 12 bâtiments (6 chaumières, 6 ateliers), fond transparent
  img/creatures.webp   atlas des 6 créatures, fond ET socle d'herbe retirés
  img/grass.webp       tuile d'herbe sans couture (256 px)
  img/path.webp        tuile de chemin sans couture (128 px)
  data/sprites.json    découpe : position de chaque sprite dans l'atlas + point d'ancrage

Le fond des planches a un léger dégradé : il est modélisé localement (bg_model), pas par une couleur unique.
Rien n'est tiré au hasard : le script est déterministe.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

COLORS = ["blue", "red", "yellow", "green", "purple", "orange"]

# fichier de planche -> (rôle, couleurs de gauche à droite)
SHEETS = {
    "planche1.jpg": ("house", ["blue", "red", "yellow"]),
    "planche2.jpg": ("house", ["green", "purple", "orange"]),
    "planche3.jpg": ("work", ["blue", "red", "yellow"]),
    "planche4.jpg": ("work", ["green", "purple", "orange"]),
    "planche5.jpg": ("crea", ["blue", "red", "yellow"]),
    "planche6.jpg": ("crea", ["green", "purple", "orange"]),
}
GRASS_FILE = "herbe.jpg"
PATH_FILE = "chemin.jpg"

ANCHOR_UP = 0.58  # hauteur du point d'ancrage au-dessus du bas du bâtiment, en largeur du corps
BUILDING_SCALE = 0.4  # planche (px) -> atlas (px) ; environ 380 px de jardin sur la planche = 152 px
CREATURE_SCALE = 0.40
PAD = 12  # marge ajoutée autour d'un sprite pendant le calcul
GAP = 4  # espace entre sprites dans l'atlas

# Zone de la planche où la croûte d'herbe de la créature peut être retirée par la couleur (le golem a de la mousse
# partout : on borne le retrait au socle). (x0, y0, x1, y1) en pixels de planche, None = partout.
PATCH_ZONE = {"green": (150, 300, 415, 535)}


def load(path):
    return np.array(Image.open(path).convert("RGB")).astype(np.float32)


def bg_model(im):
    """Fond de la planche, pixel par pixel : moyenne locale des pixels de fond (le fond a un dégradé de 20 niveaux)."""
    med = np.median(np.concatenate([im[:20].reshape(-1, 3), im[-20:].reshape(-1, 3)]), axis=0)
    mask = np.sqrt(((im - med) ** 2).sum(2)) < 45
    bg = np.empty_like(im)
    for _ in range(3):
        w = ndi.gaussian_filter(mask.astype(np.float32), 40)
        for c in range(3):
            bg[..., c] = ndi.gaussian_filter(im[..., c] * mask, 40) / np.maximum(w, 1e-3)
        bg[w < 0.02] = med  # loin de tout fond (cœur d'un sprite) : sans importance
        mask = np.sqrt(((im - bg) ** 2).sum(2)) < 24
    return bg


def find_sprites(im, bg):
    """3 sprites par planche, de gauche à droite : boîtes (x0, y0, x1, y1)."""
    d = np.sqrt(((im - bg) ** 2).sum(2))
    fg = ndi.binary_opening(ndi.binary_closing(d > 28, iterations=6), iterations=2)
    lab, n = ndi.label(fg)
    sizes = ndi.sum(fg, lab, range(1, n + 1))
    boxes = []
    for i, o in enumerate(ndi.find_objects(lab)):
        if sizes[i] > 3000:
            boxes.append((o[1].start, o[0].start, o[1].stop, o[0].stop))
    boxes.sort()
    assert len(boxes) == 3, f"3 sprites attendus, {len(boxes)} trouvés"
    return boxes


def padded_crop(im, bgm, box, grow=8):
    """Découpe élargie de `grow` px (le fond de la planche entoure chaque sprite) + marge de fond (modèle de fond)."""
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0 - grow), max(0, y0 - grow)
    x1, y1 = min(im.shape[1], x1 + grow), min(im.shape[0], y1 + grow)
    pad = ((PAD, PAD), (PAD, PAD), (0, 0))
    return np.pad(im[y0:y1, x0:x1], pad, mode="edge"), np.pad(bgm[y0:y1, x0:x1], pad, mode="edge"), x0, y0


def flood_from_border(passable):
    lab, _ = ndi.label(passable)
    border = np.zeros_like(passable)
    border[0] = border[-1] = True
    border[:, 0] = border[:, -1] = True
    ids = np.unique(lab[border & passable])
    ids = ids[ids > 0]
    return np.isin(lab, ids)


def soft(mask, sigma=0.7):
    """Bord adouci : alpha entre 0 et 1."""
    a = ndi.gaussian_filter(mask.astype(np.float32), sigma)
    return np.clip((a - 0.35) / 0.4, 0, 1)


def bleed(rgb, alpha):
    """Étend la couleur des bords vers les pixels transparents (évite le liseré clair au redimensionnement)."""
    solid = alpha > 0.5
    idx = ndi.distance_transform_edt(~solid, return_distances=False, return_indices=True)
    return rgb[idx[0], idx[1]]


def to_rgba(rgb, alpha):
    rgb = bleed(rgb, alpha)
    out = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha, 0, 1) * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def cut_building(im, bgm, box):
    """Fond retiré par remplissage depuis les bords : ce qui est enfermé par un contour (intérieur d'un nuage de fumée,
    verre d'une serre) reste opaque, ce qui touche le bord de la planche part."""
    crop, bg, x0, y0 = padded_crop(im, bgm, box)
    d = np.sqrt(((crop - bg) ** 2).sum(2))
    fg = ~flood_from_border(d < 22)
    fg = ndi.binary_erosion(fg, iterations=1)  # le liseré clair du fond disparaît
    return crop, soft(fg)


def cut_creature(im, bgm, box, color):
    crop, bg, x0, y0 = padded_crop(im, bgm, box)
    r, g, b = crop[..., 0], crop[..., 1], crop[..., 2]
    mx, mn = crop.max(2), crop.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    luma = 0.3 * r + 0.59 * g + 0.11 * b
    d = np.sqrt(((crop - bg) ** 2).sum(2))
    bg_like = d < 30
    # herbe du socle : vert clair peu saturé (la mousse du golem est plus saturée ; son socle est borné par la zone)
    grass = (g > r + 4) & (g > b + 22) & (b > 0.40 * g) & (sat < 0.68) & (luma > 55)
    zone = PATCH_ZONE.get(color)
    if zone is not None:
        zx0, zy0, zx1, zy1 = zone
        inside = np.zeros_like(grass)
        inside[max(0, zy0 - y0 + PAD): zy1 - y0 + PAD, max(0, zx0 - x0 + PAD): zx1 - x0 + PAD] = True
        grass &= inside
    removed = flood_from_border(bg_like | grass)
    fg = ~removed
    # liseré vert-olive (mélange herbe / contour) : on retire les pixels verdâtres clairs collés au retrait
    if color != "green":
        near = ndi.binary_dilation(removed, iterations=3)
        fringe = near & (g > b + 6) & (g > r * 0.9) & (luma > 80)
        fg &= ~fringe
    fg = ndi.binary_erosion(fg, iterations=1)
    # on garde la plus grande pièce et ce qui la touche (3 px) : fini les cailloux, brins d'herbe et fleurs du socle
    lab, n = ndi.label(fg)
    if n > 1:
        sizes = ndi.sum(fg, lab, range(1, n + 1))
        main = int(np.argmax(sizes)) + 1
        grown = ndi.binary_dilation(lab == main, iterations=3)
        keep_ids = np.unique(lab[grown & fg])
        fg = np.isin(lab, keep_ids[keep_ids > 0])
    fg = ndi.binary_fill_holes(fg)
    return crop, soft(fg)


def trim(img, margin=2):
    box = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    box = (max(0, box[0] - margin), max(0, box[1] - margin), min(img.width, box[2] + margin), min(img.height, box[3] + margin))
    return img.crop(box), box


def body_box(rgb, alpha):
    """Boîte du bâtiment sans la fumée : pixels opaques et colorés."""
    mx, mn = rgb.max(2), rgb.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    ys, xs = np.where((alpha > 0.5) & (sat > 0.22))
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def pack(items, width):
    """Rangées successives : items = [(nom, Image)]. Retourne (atlas, {nom: (x, y)})."""
    x = y = row_h = 0
    pos = {}
    for name, im in items:
        if x + im.width + GAP > width:
            x, y, row_h = 0, y + row_h + GAP, 0
        pos[name] = (x + GAP // 2, y + GAP // 2)
        x += im.width + GAP
        row_h = max(row_h, im.height)
    height = y + row_h + GAP
    atlas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for name, im in items:
        atlas.alpha_composite(im, pos[name])
    return atlas, pos


def seamless_crop(im, n):
    """Sous-carré n x n dont les bords se raccordent le mieux (écart de bord minimal)."""
    best = None
    for oy in range(0, im.shape[0] - n + 1, 4):
        for ox in range(0, im.shape[1] - n + 1, 4):
            c = im[oy: oy + n, ox: ox + n]
            s = np.abs(c[:, 0] - c[:, -1]).mean() + np.abs(c[0] - c[-1]).mean()
            if best is None or s < best[0]:
                best = (s, ox, oy)
    _, ox, oy = best
    return im[oy: oy + n, ox: ox + n], (ox, oy)


def save_webp(img, path, q=90):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "WEBP", quality=q, alpha_quality=100, method=6)
    print(f"{path}: {img.width}x{img.height}, {os.path.getsize(path) / 1024:.0f} Ko")


def main():
    src = sys.argv[1]
    repo = sys.argv[2] if len(sys.argv) > 2 else "."
    sprites = {}
    items = {"buildings": [], "creatures": []}
    meta = {}
    for fname, (role, cols) in SHEETS.items():
        im = load(os.path.join(src, fname))
        bgm = bg_model(im)
        boxes = find_sprites(im, bgm)
        for box, color in zip(boxes, cols):
            if role == "crea":
                rgb, alpha = cut_creature(im, bgm, box, color)
                scale, atlas = CREATURE_SCALE, "creatures"
            else:
                rgb, alpha = cut_building(im, bgm, box)
                scale, atlas = BUILDING_SCALE, "buildings"
            bx0, by0, bx1, by1 = body_box(rgb, alpha)
            full = to_rgba(rgb, alpha)
            trimmed, tb = trim(full)
            # ancrage : centre au sol du bâtiment ; centre de la créature (pivot de rotation)
            if role == "crea":
                cx, cy = (tb[0] + tb[2]) / 2 - tb[0], (tb[1] + tb[3]) / 2 - tb[1]
                body = (0, 0, trimmed.width, trimmed.height)
            else:
                # centre au sol : milieu du corps en largeur, bas du corps moins ANCHOR_UP fois sa largeur
                # (la hauteur des bâtiments varie beaucoup avec la fumée, le sol non)
                cx, cy = (bx0 + bx1) / 2 - tb[0], by1 - ANCHOR_UP * (bx1 - bx0) - tb[1]
                body = (bx0 - tb[0], by0 - tb[1], bx1 - tb[0], by1 - tb[1])
            small = trimmed.resize((max(1, round(trimmed.width * scale)), max(1, round(trimmed.height * scale))), Image.LANCZOS)
            key = f"{role}.{color}"
            items[atlas].append((key, small))
            meta[key] = {
                "atlas": atlas, "ax": round(cx * scale, 1), "ay": round(cy * scale, 1),
                "body": [round(v * scale, 1) for v in body],
            }
    atlases = {}
    for name, width in (("buildings", 768), ("creatures", 512)):
        atlas, pos = pack(items[name], width)
        save_webp(atlas, os.path.join(repo, "img", f"{name}.webp"))
        atlases[name] = {"file": f"img/{name}.webp", "w": atlas.width, "h": atlas.height}
        for key, im in items[name]:
            m = meta[key]
            m["x"], m["y"] = pos[key]
            m["w"], m["h"] = im.width, im.height
            sprites[key] = m

    # largeur de référence d'un jardin de chaumière (pour que tous les bâtiments gardent la même échelle)
    ref_w = round(float(np.median([sprites[f"house.{c}"]["body"][2] - sprites[f"house.{c}"]["body"][0] for c in COLORS])), 1)

    # textures
    for fname, name, n_out in ((GRASS_FILE, "grass", 256), (PATH_FILE, "path", 128)):
        a = load(os.path.join(src, fname))
        tile, off = seamless_crop(a, 512)
        img = Image.fromarray(tile.astype(np.uint8)).resize((n_out, n_out), Image.LANCZOS)
        save_webp(img.convert("RGB"), os.path.join(repo, "img", f"{name}.webp"), 88)
        atlases[name] = {"file": f"img/{name}.webp", "w": n_out, "h": n_out, "crop": off}

    out = {"version": 1, "ref_house_w": ref_w, "atlases": atlases, "sprites": sprites}
    os.makedirs(os.path.join(repo, "data"), exist_ok=True)
    with open(os.path.join(repo, "data", "sprites.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("data/sprites.json écrit,", len(sprites), "sprites, ref_house_w =", ref_w)


if __name__ == "__main__":
    main()
