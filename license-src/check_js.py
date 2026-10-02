#!/usr/bin/env python3
"""Extract inline <script> blocks from index.html and syntax-check them with node."""
import re, subprocess, sys, tempfile, os

HTML = '/home/z/my-project/fatroa/index.html'
src = open(HTML, encoding='utf-8').read()

# Match inline scripts (no src=)
blocks = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', src, re.S | re.I)
print(f"Found {len(blocks)} inline script blocks")
fail = 0
for i, b in enumerate(blocks):
    if not b.strip():
        continue
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(b)
        path = f.name
    r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
    if r.returncode != 0:
        fail += 1
        print(f"--- BLOCK {i} SYNTAX ERROR ---")
        print(r.stderr[:1500])
        first = b.strip().split('\n')[0][:100]
        print(f"first line: {first}")
    os.unlink(path)
print("RESULT:", "FAIL" if fail else "ALL OK")
sys.exit(1 if fail else 0)
