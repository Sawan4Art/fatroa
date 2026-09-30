#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StoneBill v1.9 — circular glass-theme logo generator (owner request).
Design: circular badge with a violet→purple gradient ring (glass skin identity
#7c3aed → #a855f7), a light frosted-glass disc (glass-light body gradient
#eef2ff → #dbeafe → #fce7f3), a soft top-left gloss, and a bold "S" monogram
filled with a violet→pink gradient (#7c3aed → #ec4899).

Rule 7 compliance: NO compression / NO palette quantization — full 8-bit RGBA
PNGs at native sizes, LANCZOS downsampling only.

Regenerates (same dimensions as the files being replaced):
  assets/icons/icon-{512,256,192}.png, favicon-32.png, icon-512-maskable.png
  assets/icon-only.png, icon-foreground.png, icon-background.png
  android .../mipmap-*/ic_launcher{,_round,_foreground,_background}.png
  ios AppIcon-512@2x.png
And rewrites mipmap-anydpi-v26 XMLs to the standard full-bleed adaptive form.
"""
import os, re
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SS = 2048  # supersample master size

# ---------- palette (glass skin) ----------
VIOLET = (124, 58, 237)    # #7c3aed  primary
PURPLE = (168, 85, 247)    # #a855f7  secondary
PINK   = (236, 72, 153)    # #ec4899  accent hint
G_TOP  = (238, 242, 255)   # #eef2ff  glass disc light
G_MID  = (219, 234, 254)   # #dbeafe
G_BOT  = (252, 231, 243)   # #fce7f3

FONT = '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def diag_gradient(size, stops):
    """135° diagonal multi-stop gradient image (RGB). stops = [(t, rgb), ...]"""
    w = h = size
    img = Image.new('RGB', (w, h))
    px = img.load()
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


def circle_mask(size, outer=1.0, inner=0.0):
    """L mask: filled circle (outer diameter fraction) minus inner hole fraction."""
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


def build_badge(S):
    """Circular glass badge on transparent RGBA, S×S."""
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))

    ring_w = S * 0.052          # gradient ring thickness
    ring_grad = diag_gradient(S, [(0.0, VIOLET), (0.55, PURPLE), (1.0, PINK)])
    img.paste(ring_grad, (0, 0), circle_mask(S, 1.0, (S - 2 * ring_w) / S))

    # glass disc
    disc_frac = (S - 2 * ring_w) / S
    disc_mask = circle_mask(S, disc_frac)
    disc_grad = diag_gradient(S, [(0.0, G_TOP), (0.55, G_MID), (1.0, G_BOT)])
    img.paste(disc_grad, (0, 0), disc_mask)

    # frosted gloss: soft white highlight top-left, clipped to the disc (variable alpha)
    gloss = Image.new('L', (S, S), 0)
    gd = ImageDraw.Draw(gloss)
    gr = S * 0.40
    gd.ellipse([S * 0.04, S * 0.02, S * 0.04 + 2 * gr, S * 0.02 + 2 * gr], fill=90)
    gloss = gloss.filter(ImageFilter.GaussianBlur(S * 0.09))
    gloss = Image.composite(gloss, Image.new('L', (S, S), 0), disc_mask)
    gloss_layer = Image.new('RGBA', (S, S), (255, 255, 255, 0))
    gloss_layer.putalpha(gloss)
    img = Image.alpha_composite(img, gloss_layer)

    # subtle inner white rim (glass edge) just inside the ring
    rim = Image.new('L', (S, S), 0)
    rd = ImageDraw.Draw(rim)
    rR = S * disc_frac / 2
    rd.ellipse([S / 2 - rR, S / 2 - rR, S / 2 + rR, S / 2 + rR], outline=255, width=max(2, int(S * 0.006)))
    rim = rim.filter(ImageFilter.GaussianBlur(S * 0.004))
    rim_layer = Image.new('RGBA', (S, S), (255, 255, 255, 0))
    rim_layer.putalpha(rim.point(lambda v: int(v * 0.75)))
    img = Image.alpha_composite(img, rim_layer)

    # ---- "S" monogram with violet→pink gradient + soft shadow ----
    fscale = 0.52  # cap-height relative to badge
    fpath = FONT
    # find font size so text height ≈ fscale*S
    probe = ImageFont.truetype(fpath, 100)
    bb = probe.getbbox('S')
    ph = bb[3] - bb[1]
    size_px = int(100 * (fscale * S) / ph)
    font = ImageFont.truetype(fpath, size_px)
    bbox = font.getbbox('S')
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

    tx = (S - tw) / 2 - bbox[0]
    ty = (S - th) / 2 - bbox[1] + S * 0.012  # optical center nudge

    # shadow
    tmask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(tmask).text((tx, ty), 'S', font=font, fill=255)
    shadow = Image.new('RGBA', (S, S), (46, 16, 101, 110))
    img.paste(shadow, (0, int(S * 0.012)), tmask.filter(ImageFilter.GaussianBlur(S * 0.012)))

    # gradient text
    tgrad = diag_gradient(S, [(0.0, VIOLET), (0.6, PURPLE), (1.0, PINK)])
    img.paste(tgrad, (0, 0), tmask)

    return img


def paste_center(base, overlay, frac):
    """Paste overlay (RGBA) centered into base scaled to frac of base size."""
    S = base.size[0]
    ov = overlay.resize((int(S * frac), int(S * frac)), Image.LANCZOS)
    off = ((S - ov.size[0]) // 2, (S - ov.size[1]) // 2)
    base.alpha_composite(ov, off)
    return base


def full_bleed_bg(S):
    return diag_gradient(S, [(0.0, G_TOP), (0.5, G_MID), (1.0, G_BOT)]).convert('RGBA')


def save(img, path):
    path = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, format='PNG')  # full quality, no quantize (Rule 7)
    print('  wrote', os.path.relpath(path, ROOT), img.size)


def main():
    print('Building master badge %dpx …' % SS)
    badge = build_badge(SS)
    bg_ss = full_bleed_bg(SS)

    # ---------- assets/icons ----------
    save(badge.resize((512, 512), Image.LANCZOS), 'assets/icons/icon-512.png')
    save(badge.resize((256, 256), Image.LANCZOS), 'assets/icons/icon-256.png')
    save(badge.resize((192, 192), Image.LANCZOS), 'assets/icons/icon-192.png')
    save(badge.resize((32, 32), Image.LANCZOS), 'assets/icons/favicon-32.png')

    # maskable: full-bleed gradient + badge at 70% (safe zone)
    mk = bg_ss.copy()
    paste_center(mk, badge, 0.70)
    save(mk.resize((512, 512), Image.LANCZOS), 'assets/icons/icon-512-maskable.png')

    # PWA
    save(badge.resize((512, 512), Image.LANCZOS), 'assets/icon-only.png')
    fg = Image.new('RGBA', (SS, SS), (0, 0, 0, 0))
    paste_center(fg, badge, 0.68)
    save(fg.resize((432, 432), Image.LANCZOS), 'assets/icon-foreground.png')
    save(bg_ss.resize((432, 432), Image.LANCZOS), 'assets/icon-background.png')

    # ---------- android mipmaps (match existing dimensions) ----------
    legacy = {'ldpi': 36, 'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    layers = {'ldpi': 81, 'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
    for d, s in legacy.items():
        # legacy square: full-bleed gradient + badge 82% (opaque, RGB)
        sq = full_bleed_bg(s)
        b = badge.resize((int(s * 0.82), int(s * 0.82)), Image.LANCZOS)
        sq.alpha_composite(b, ((s - b.size[0]) // 2, (s - b.size[1]) // 2))
        save(sq.convert('RGB'), 'android/app/src/main/res/mipmap-%s/ic_launcher.png' % d)
        # round: the circular badge itself
        save(badge.resize((s, s), Image.LANCZOS), 'android/app/src/main/res/mipmap-%s/ic_launcher_round.png' % d)
    for d, s in layers.items():
        save(badge.resize((s, s), Image.LANCZOS),
             'android/app/src/main/res/mipmap-%s/ic_launcher_foreground.png' % d)
        save(full_bleed_bg(s), 'android/app/src/main/res/mipmap-%s/ic_launcher_background.png' % d)

    # ---------- adaptive icon XMLs: standard full-bleed (no inset) ----------
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
    ios = full_bleed_bg(1024)
    b = badge.resize((int(1024 * 0.86), int(1024 * 0.86)), Image.LANCZOS)
    ios.alpha_composite(b, ((1024 - b.size[0]) // 2, (1024 - b.size[1]) // 2))
    save(ios.convert('RGB'), 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')

    print('DONE — circular glass logo generated (no compression, Rule 7).')


if __name__ == '__main__':
    main()
