#!/usr/bin/env python3
"""SUZURI雑貨屋さん(2.5D)の切り抜きレイヤーを作る。
入力: room_original / room_no_table / room_empty (すべて1536x1024・位置は1ピクセルも動いていない)
出力: layers/*.webp (透明つき・元と同じ大きさ) と layers.json (元画像のピクセル座標での位置)
使い方: python3 make_layers.py <出力フォルダ>
"""
import sys, os, json
import numpy as np, cv2
from scipy import ndimage as ndi
D = os.path.dirname(os.path.abspath(__file__)) + '/'
OUT = sys.argv[1] if len(sys.argv) > 1 else D + 'layers'
os.makedirs(OUT, exist_ok=True)
O = cv2.imread(D + 'room_original.webp'); N = cv2.imread(D + 'room_no_table.webp'); E = cv2.imread(D + 'room_empty.webp')
H, W = O.shape[:2]; SC = 1.0

def dif(a, b, th=30):
    d = np.sqrt(((a.astype(np.float32) - b.astype(np.float32)) ** 2).sum(axis=2))   # 色の距離(白い物と壁のような近い色も拾う)
    return (cv2.GaussianBlur(d, (0, 0), 1.0) > th * .8).astype(np.uint8)
def rect(x0, y0, x1, y1):
    m = np.zeros((H, W), np.uint8); m[y0:y1, x0:x1] = 1; return m
def poly(pts):
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [np.array(pts, np.int32)], 1); return m
def ell(cx, cy, rx, ry):
    m = np.zeros((H, W), np.uint8); cv2.ellipse(m, (cx, cy), (rx, ry), 0, 0, 360, 1, -1); return m
def clean(m, minpx=250, close=5):
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((close, close), np.uint8))
    lab, n = ndi.label(m)
    if n:
        sz = ndi.sum(m, lab, range(1, n + 1)); keep = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s >= minpx]); m = keep.astype(np.uint8)
    return ndi.binary_fill_holes(m).astype(np.uint8)

layers = {}
def D_(a, b, region, th=30): return dif(a, b, th) * region
# --- island table (original vs no_table) ---
body = poly([(648, 583), (1188, 583), (1184, 886), (654, 886)])
above = D_(O, N, rect(690, 400, 1175, 586), 34)
layers['table'] = (O, clean(np.maximum(body, above)), 'table')
# --- counter (no_table vs empty) ---
cbody = rect(472, 466, 1290, 645)
c_items = np.maximum.reduce([D_(N, E, rect(480, 330, 640, 520), 34), D_(N, E, rect(640, 392, 800, 470), 34), D_(N, E, rect(1196, 330, 1300, 470), 34)])
layers['counter'] = (N, clean(np.maximum(cbody, c_items)), 'counter')
# --- niche shelf items / back drawer unit (set back, near the back wall) ---
# アーチ棚の中身と奥の引き出し棚は奥の壁にほぼ貼りついているので、切り抜かず背景に焼き込む
BAKE = [(805, 150, 1192, 470), (640, 200, 785, 392)]
# --- left display rack with bag, boxes, plants, pumpkins and its round rug ---
rack_items = cv2.morphologyEx(D_(N, E, rect(205, 300, 460, 850), 40), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
layers['rack'] = (N, clean(np.maximum(rack_items, ell(280, 788, 172, 52)), 350), 'rack')
# --- wreath on the door / ivy on the right wall ---
wr = np.zeros((H, W), np.uint8); cv2.circle(wr, (113, 345), 74, 1, -1)
layers['wreath'] = (O, clean(D_(O, E, wr, 40), 200), 'wreath')
layers['ivy'] = (N, clean(D_(N, E, rect(1365, 160, 1450, 405), 34), 200), 'ivy')
# --- centre rug (a floor decal) ---
layers['rug'] = (N, poly([(588, 736), (1222, 736), (1379, 962), (436, 962)]), 'rug')

meta = {}
for name, (src, m, kind) in layers.items():
    ys, xs = np.where(m > 0)
    x0, x1, y0, y1 = max(xs.min() - 3, 0), min(xs.max() + 4, W), max(ys.min() - 3, 0), min(ys.max() + 4, H)
    mc = m[y0:y1, x0:x1].astype(np.uint8)
    rgb = src[y0:y1, x0:x1].copy()
    er = cv2.erode(mc, np.ones((3, 3), np.uint8))
    a = cv2.GaussianBlur(er.astype(np.float32), (0, 0), .9)
    rgb = cv2.inpaint(rgb, (1 - er) * 255, 3, cv2.INPAINT_TELEA)   # colour bleed to avoid dark halos
    h, w = rgb.shape[:2]; nw, nh = max(2, int(w * SC)), max(2, int(h * SC))
    rgb = cv2.resize(rgb, (nw, nh), interpolation=cv2.INTER_AREA); a = cv2.resize(a, (nw, nh), interpolation=cv2.INTER_AREA)
    rgba = np.dstack([cv2.cvtColor(rgb, cv2.COLOR_BGR2RGB), (a * 255).astype(np.uint8)])
    from PIL import Image
    Image.fromarray(rgba, 'RGBA').save(f'{OUT}/{name}.webp', quality=80, alpha_quality=85, method=6)
    meta[name] = dict(x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0), kind=kind, file=f'{name}.webp')
    print(name, meta[name], os.path.getsize(f'{OUT}/{name}.webp'))
# base plate (empty room)
from PIL import Image
BASE = E.copy()
for (a, b, c, d) in BAKE: BASE[b:d, a:c] = N[b:d, a:c]
Image.fromarray(cv2.cvtColor(cv2.resize(BASE, (int(W * SC), int(H * SC)), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB)).save(f'{OUT}/room.webp', quality=82, method=6)
print('room', os.path.getsize(f'{OUT}/room.webp'))
json.dump(meta, open(f'{OUT}/layers.json', 'w'), indent=1)
# preview composite at the original camera
comp = BASE.copy().astype(np.float32)
order = ['rug', 'counter', 'ivy', 'wreath', 'rack', 'table']
for n in order:
    src, m, _ = layers[n]
    ys, xs = np.where(m > 0); 
    er = cv2.erode(m.astype(np.uint8), np.ones((3, 3), np.uint8)); a = cv2.GaussianBlur(er.astype(np.float32), (0, 0), .9)[..., None]
    comp = comp * (1 - a) + src.astype(np.float32) * a
cv2.imwrite(OUT + '/_preview.png', comp.astype(np.uint8))
