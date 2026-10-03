#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_owner_html.py — يجمع تطبيق SB Owner v2.0 من قالب + طبقات التوقيع.
- template.html + vendor_nacl_fast.min.js + sb_license_core2.js
- الناتج: sb-owner/app/src/main/assets/index.html (جاهز للـAPK)
"""
import os, re

ROOT = '/home/z/my-project/fatroa'
TPL = os.path.join(ROOT, 'sb-owner', 'template.html')
NACL = os.path.join(ROOT, 'license-src', 'vendor_nacl_fast.min.js')
CORE2 = os.path.join(ROOT, 'license-src', 'sb_license_core2.js')
OUT = os.path.join(ROOT, 'sb-owner', 'app', 'src', 'main', 'assets', 'index.html')

tpl = open(TPL, encoding='utf-8').read()
nacl = open(NACL, encoding='utf-8').read().strip()
core2 = open(CORE2, encoding='utf-8').read().strip()

assert '/*__NACL__*/' in tpl and '/*__CORE2__*/' in tpl
# core2 UMD يستهلك nacl من root — موجود كمتحول global في السكريبت اللي قبله
html = tpl.replace('/*__NACL__*/', nacl).replace('/*__CORE2__*/', core2)
assert '__NACL__' not in html and '__CORE2__' not in html

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w', encoding='utf-8').write(html)
print('OK ->', OUT, f'({len(html):,} bytes)')
