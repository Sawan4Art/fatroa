#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StoneBill v1.11 — "SB tilted invoice on marble stone" app icon (owner request).

Design: a polished light-marble slab (white/grey-blue base with soft veins and a
single violet accent vein that matches the app identity), with a tilted white
invoice/receipt sheet lying on it. The sheet carries a violet header pill, grey
text lines, a dashed separator, a total row — and the bold "SB" monogram filled
with the app gradient (#7c3aed → #a855f7 → #ec4899).

Rule 7 compliance: NO compression / NO palette quantization — full 8-bit RGBA
PNGs at native sizes, LANCZOS downsampling only.

Regenerates (same dimensions as the files being replaced):
  assets/icons/icon-{512,256,192}.png, favicon-32.png, icon-512-maskable.png
  assets/icon-only.png, icon-foreground.png, icon-background.png
  android .../mipmap-*/ic_launcher{,_round,_foreground,_background}.png
  ios AppIcon-512@2x.png
And rewrites mipmap-anydpi-v26 XMLs to the standard full-bleed adaptive form.
"""
import os, random, math
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SS = 2048  # supersample master size

# ---------- palette (app identity: glass-skin violet family on marble stone) ----------
VIOLET = (124, 58, 237)    # #7c3aed  primary
PURPLE = (168, 85, 247)    # #a855f7  secondary
PINK   = (236, 72, 153)    # #ec4899  accent hint
MARBLE_TOP = (248, 249, 253)
MARBLE_MID = (231, 235, 243)
MARBLE_BOT = (210, 217, 231)
VEIN_GREY  = (151, 163, 191)
VEIN_DARK  = (111, 124, 158)
VEIN_VIOLET = (167, 139, 250)
ACCENT_VIOLET = (124, 58, 237)

FONT = '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'
TILT_DEG = 12  # invoice tilt ("فاتورة منحوتة")


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def diag_gradient(size, stops):
    """135° diagonal multi-stop gradient image (RGB). stops = [(t, rgb), ...]"""
    w = h = size
    small = 512
    grad = Image.new('RGB', (small, small))
    gp = grad.load()
    for y in range(small):
        for x in range(small):
            t = (x + y) / (2 * (small - 1))
            for i in range(len(stops) - 1):
                t0, c0 = stops[i]; t1, c1 = stops[i + 1]
                if t0 <= t <= t1:
                    tt = 0 if t1 == t0 else (t - t0) / (t1 - t0)
                    gp[x, y] = lerp(c0, c1, tt)
                    break
    return grad.resize((w, h), Image.LANCZOS)


def v_gradient(w, h, c0, c1):
    w, h = int(w), int(h)
    strip = Image.new('RGB', (1, max(2, h)))
    sp = strip.load()
    for y in range(max(2, h)):
        sp[0, y] = lerp(c0, c1, y / (max(2, h) - 1))
    return strip.resize((w, h), Image.BILINEAR)


def circle_mask(size, outer=1.0, inner=0.0):
    S = size
    m = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(m)
    R = S * outer / 2
    cx = cy = S / 2
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=255)
    if inner > 0:
        r = S * inner / 2
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=0)
    return m


# ---------------------------------------------------------------- marble slab
def marble_bg(S):
    """Full-bleed polished marble slab (RGBA)."""
    img = diag_gradient(S, [(0.0, MARBLE_TOP), (0.5, MARBLE_MID), (1.0, MARBLE_BOT)]).convert('RGBA')

    rnd = random.Random(20251104)

    # natural marble veins: each vein = 3 soft tapered passes (wide → spine)
    def draw_vein(pts, col, base_w):
        passes = [(1.0, 14, 0.030), (0.45, 26, 0.014), (0.18, 48, 0.005)]
        for wf, af, bf in passes:
            lay = Image.new('RGBA', (S, S), (0, 0, 0, 0))
            ld = ImageDraw.Draw(lay)
            ld.line(pts, fill=col + (af,), width=max(2, int(base_w * wf)), joint='curve')
            lay = lay.filter(ImageFilter.GaussianBlur(S * bf))
            yield lay

    n = 5
    y_seeds = [0.12, 0.32, 0.50, 0.68, 0.88]
    for i in range(n):
        x0 = -S * 0.05
        y0 = S * (y_seeds[i] + rnd.uniform(-0.05, 0.05))
        slope = rnd.uniform(-0.34, 0.26)
        A = rnd.uniform(0.02, 0.055) * S
        T = rnd.uniform(0.35, 0.75) * S
        ph = rnd.uniform(0, 6.2832)
        pts = []
        x = x0
        while x < S * 1.05:
            y = y0 + slope * (x - x0) + A * math.sin((x - x0) / T + ph)
            pts.append((x, y))
            x += S * 0.02
        accent = (i == 2)
        col = VEIN_VIOLET if accent else VEIN_GREY
        for lay in draw_vein(pts, col, S * rnd.uniform(0.05, 0.08)):
            img = Image.alpha_composite(img, lay)
        # a short fork (marble branch)
        if i in (1, 3):
            k = int(len(pts) * rnd.uniform(0.35, 0.6))
            bx, by = pts[k]
            bslope = slope + rnd.uniform(0.28, 0.5) * (1 if rnd.random() > 0.5 else -1)
            branch = []
            xx = bx
            while xx < S * (0.75 + rnd.uniform(0, 0.2)):
                yy = by + bslope * (xx - bx) + 0.018 * S * math.sin((xx - bx) / (0.3 * S))
                branch.append((xx, yy))
                xx += S * 0.02
            for lay in draw_vein(branch, VEIN_GREY, S * rnd.uniform(0.035, 0.05)):
                img = Image.alpha_composite(img, lay)

    # polished diagonal light streaks
    streak = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    st = ImageDraw.Draw(streak)
    for k in range(3):
        off = S * (0.10 + 0.30 * k)
        st.polygon([(off, -S * 0.1), (off + S * 0.14, -S * 0.1),
                    (off - S * 0.45, S * 1.1), (off - S * 0.59, S * 1.1)],
                   fill=(255, 255, 255, 16))
    streak = streak.filter(ImageFilter.GaussianBlur(S * 0.05))
    img = Image.alpha_composite(img, streak)

    # very subtle edge darkening (slab depth)
    vig = Image.new('L', (S, S), 30)
    ImageDraw.Draw(vig).ellipse([-S * 0.18, -S * 0.18, S * 1.18, S * 1.18], fill=0)
    vig = vig.filter(ImageFilter.GaussianBlur(S * 0.08))
    dark = Image.new('RGBA', (S, S), (44, 52, 74, 255))
    img = Image.composite(dark, img, vig)
    return img


# ------------------------------------------------------------- tilted invoice
def _grad_text(target, center_xy, text, font, stops, shadow_alpha=70):
    """Draw text filled with a diagonal gradient + soft shadow onto target RGBA."""
    S = max(target.size)
    tmask = Image.new('L', target.size, 0)
    ImageDraw.Draw(tmask).text(center_xy, text, font=font, fill=255, anchor='mm')
    bbox = tmask.getbbox()
    if not bbox:
        return
    grad = diag_gradient(S, stops).resize(target.size, Image.LANCZOS)
    # soft shadow
    sh = tmask.filter(ImageFilter.GaussianBlur(S * 0.006)).point(lambda v: int(v * (shadow_alpha / 255.0)))
    shl = Image.new('RGBA', target.size, (46, 16, 101, 0))
    shl.putalpha(sh)
    target.alpha_composite(shl, (0, int(S * 0.004)))
    gl = Image.new('RGBA', target.size, (0, 0, 0, 0))
    gl.paste(grad, (0, 0), tmask)
    target.alpha_composite(gl)


def build_invoice(S, frac=1.0):
    """Tilted invoice sheet with SB monogram, on transparent RGBA canvas S×S.

    frac: scale of the invoice relative to canvas (applied after build at 1.0
    via the caller passing canvas size — here built natively at S)."""
    W, H = S * 0.56, S * 0.72
    sheet = Image.new('RGBA', (int(W), int(H)), (0, 0, 0, 0))

    # paper with vertical gradient + rounded corners
    paper = v_gradient(W, H, (255, 255, 255), (236, 240, 248)).convert('RGBA')
    rmask = Image.new('L', (int(W), int(H)), 0)
    ImageDraw.Draw(rmask).rounded_rectangle([0, 0, W - 1, H - 1], radius=S * 0.045, fill=255)
    sheet.paste(paper, (0, 0), rmask)

    d = ImageDraw.Draw(sheet)
    grey_line = (176, 184, 202, 255)
    grey_soft = (203, 209, 223, 255)

    # violet header pill + two short header lines
    d.rounded_rectangle([W * 0.30, H * 0.075, W * 0.70, H * 0.135], radius=H * 0.030, fill=ACCENT_VIOLET + (255,))
    d.rounded_rectangle([W * 0.16, H * 0.175, W * 0.84, H * 0.205], radius=H * 0.014, fill=grey_line)
    d.rounded_rectangle([W * 0.24, H * 0.235, W * 0.76, H * 0.262], radius=H * 0.012, fill=grey_soft)

    # SB monogram — the app identity, filled with the brand gradient
    fpath = FONT
    target_w = W * 0.66
    probe = ImageFont.truetype(fpath, 100)
    bb = probe.getbbox('SB')
    pw = bb[2] - bb[0]
    size_px = int(100 * target_w / pw)
    font = ImageFont.truetype(fpath, size_px)
    _grad_text(sheet, (W / 2, H * 0.475), 'SB', font,
               [(0.0, VIOLET), (0.6, PURPLE), (1.0, PINK)], shadow_alpha=80)

    # dashed separator
    y_dash = H * 0.66
    x0, x1 = W * 0.12, W * 0.88
    step = W * 0.052
    xx = x0
    while xx < x1:
        d.line([(xx, y_dash), (min(xx + step * 0.55, x1), y_dash)], fill=(158, 167, 188, 220), width=max(2, int(S * 0.004)))
        xx += step

    # total row: label line + violet amount line
    d.rounded_rectangle([W * 0.40, H * 0.735, W * 0.88, H * 0.765], radius=H * 0.014, fill=grey_line)
    d.rounded_rectangle([W * 0.12, H * 0.805, W * 0.50, H * 0.875], radius=H * 0.020, fill=ACCENT_VIOLET + (255,))
    d.rounded_rectangle([W * 0.58, H * 0.815, W * 0.88, H * 0.865], radius=H * 0.014, fill=(120, 130, 155, 235))

    # tiny footer line
    d.rounded_rectangle([W * 0.34, H * 0.925, W * 0.66, H * 0.948], radius=H * 0.010, fill=grey_soft)

    rot = sheet.rotate(TILT_DEG, resample=Image.BICUBIC, expand=True)

    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    # drop shadow of the sheet on the marble
    alpha = rot.split()[3]
    sh = alpha.filter(ImageFilter.GaussianBlur(S * 0.020)).point(lambda v: int(v * 0.38))
    shl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    black = Image.new('RGBA', rot.size, (28, 34, 52, 255))
    shl.paste(black, (0, 0), sh)
    off_x = (S - rot.size[0]) // 2
    off_y = (S - rot.size[1]) // 2 + int(S * 0.016)
    canvas.alpha_composite(shl, (max(0, off_x), max(0, off_y)))
    canvas.alpha_composite(rot, ((S - rot.size[0]) // 2, (S - rot.size[1]) // 2))
    return canvas


def paste_center(base, overlay, frac):
    S = base.size[0]
    ov = overlay.resize((int(S * frac), int(S * frac)), Image.LANCZOS)
    off = ((S - ov.size[0]) // 2, (S - ov.size[1]) // 2)
    base.alpha_composite(ov, off)
    return base


def full_art(S, frac=0.82):
    """Complete square artwork: marble slab + tilted SB invoice."""
    art = marble_bg(S)
    inv = build_invoice(S)
    return paste_center(art, inv, frac)


def save(img, path):
    path = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, format='PNG')  # full quality, no quantize (Rule 7)
    print('  wrote', os.path.relpath(path, ROOT), img.size)


def main():
    print('Building master artwork %dpx …' % SS)
    art = full_art(SS, 0.82)               # marble + invoice (full square)
    marble = marble_bg(SS)                 # background layer only

    # ---------- assets/icons ----------
    save(art.resize((512, 512), Image.LANCZOS), 'assets/icons/icon-512.png')
    save(art.resize((256, 256), Image.LANCZOS), 'assets/icons/icon-256.png')
    save(art.resize((192, 192), Image.LANCZOS), 'assets/icons/icon-192.png')
    save(art.resize((32, 32), Image.LANCZOS), 'assets/icons/favicon-32.png')

    # maskable: full-bleed marble + invoice at 62% (safe zone)
    mk = marble_bg(SS)
    mk = paste_center(mk, build_invoice(SS), 0.62)
    save(mk.resize((512, 512), Image.LANCZOS), 'assets/icons/icon-512-maskable.png')

    # PWA
    save(art.resize((512, 512), Image.LANCZOS), 'assets/icon-only.png')
    fg = Image.new('RGBA', (SS, SS), (0, 0, 0, 0))
    paste_center(fg, build_invoice(SS), 0.64)
    save(fg.resize((432, 432), Image.LANCZOS), 'assets/icon-foreground.png')
    save(marble.resize((432, 432), Image.LANCZOS), 'assets/icon-background.png')

    # ---------- android mipmaps (match existing dimensions) ----------
    legacy = {'ldpi': 36, 'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    layers = {'ldpi': 81, 'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
    for dname, s in legacy.items():
        # legacy square: full artwork (marble + invoice), opaque
        save(art.resize((s, s), Image.LANCZOS).convert('RGB'),
             'android/app/src/main/res/mipmap-%s/ic_launcher.png' % dname)
        # round: same artwork masked to a circle (transparent corners)
        sq = art.resize((s, s), Image.LANCZOS)
        m = circle_mask(s, 0.985)
        round_img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        round_img.paste(sq, (0, 0), m)
        save(round_img, 'android/app/src/main/res/mipmap-%s/ic_launcher_round.png' % dname)
    for dname, s in layers.items():
        # adaptive foreground: invoice only (transparent), inside safe zone
        fgS = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        inv = build_invoice(s)
        f = 0.78
        ovi = inv.resize((int(s * f), int(s * f)), Image.LANCZOS)
        fgS.alpha_composite(ovi, ((s - ovi.size[0]) // 2, (s - ovi.size[1]) // 2))
        save(fgS, 'android/app/src/main/res/mipmap-%s/ic_launcher_foreground.png' % dname)
        save(marble.resize((s, s), Image.LANCZOS), 'android/app/src/main/res/mipmap-%s/ic_launcher_background.png' % dname)

    # ---------- adaptive icon XMLs: standard full-bleed ----------
    xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
           '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
           '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
           '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
           '</adaptive-icon>\n')
    for f in ('ic_launcher.xml', 'ic_launcher_round.xml'):
        p = os.path.join(ROOT, 'android/app/src/main/res/mipmap-anydpi-v26', f)
        with open(p, 'w', encoding='utf-8') as fh:
            fh.write(xml)
        print('  wrote', os.path.relpath(p, ROOT))

    # ---------- iOS app icon (opaque, square) ----------
    ios = full_art(1024, 0.84)
    save(ios.convert('RGB'), 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')

    print('DONE — SB tilted-invoice-on-marble icon generated (no compression, Rule 7).')


if __name__ == '__main__':
    main()
