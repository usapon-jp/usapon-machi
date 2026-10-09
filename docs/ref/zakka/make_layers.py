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
# --- island table: ChatGPTで作った「グッズ入りの島テーブル」(goods_table.webp, 背景透明)を元の位置に重ねる(後で追加) ---
# --- counter (no_table vs empty) ---
cbody = rect(472, 466, 1290, 645)
c_items = np.maximum.reduce([D_(N, E, rect(480, 330, 640, 520), 34), D_(N, E, rect(640, 392, 800, 470), 34), D_(N, E, rect(1196, 330, 1300, 470), 34)])
layers['counter'] = (N, clean(np.maximum(cbody, c_items)), 'counter')
# --- niche shelf items / back drawer unit (set back, near the back wall) ---
# 奥の引き出し棚は奥の壁にほぼ貼りついているので、切り抜かず背景に焼き込む。アーチ棚は、グッズ入りの新しい棚(goods_shelf.webp)を重ねて焼き込む
BAKE = [(640, 200, 785, 392)]
# --- left display rack with bag, boxes, plants, pumpkins and its round rug ---
rack_items = cv2.morphologyEx(D_(N, E, rect(205, 300, 460, 850), 40), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
layers['rack'] = (N, clean(np.maximum(rack_items, ell(280, 788, 172, 52)), 350), 'rack')
# --- wreath on the door / ivy on the right wall ---
# リース: 扉の面に貼りついているので切り抜かず、元の絵から円形に(縁をなだらかに)背景へ焼き込む。下の WREATH_BAKE を参照
layers['ivy'] = (N, clean(D_(N, E, rect(1365, 160, 1450, 405), 34), 200), 'ivy')
# --- centre rug (a floor decal) ---
layers['rug'] = (N, poly([(588, 736), (1222, 736), (1379, 962), (436, 962)]), 'rug')

from PIL import Image
def fit(path, bbox, width, dst_x, dst_bottom=None, dst_y=None):
    im = Image.open(D + path).convert('RGBA').crop(bbox); s_ = width / im.width
    im = im.resize((round(im.width * s_), round(im.height * s_)), Image.LANCZOS)
    a = np.asarray(im).copy(); a[..., 3] = np.where(a[..., 3] > 40, np.minimum(255, a[..., 3].astype(int) * 2), 0).astype(np.uint8)  # にじみ消し
    im = Image.fromarray(a, 'RGBA'); return im, (dst_x, (dst_bottom - im.height) if dst_bottom else dst_y)
SHELF = fit('goods_shelf.webp', (622, 166, 1409, 831), 393, 805, dst_y=150)
TABLE = fit('goods_table.webp', (208, 56, 1365, 960), 550, 643, dst_bottom=872)
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
_m = np.zeros((H, W), np.float32); cv2.circle(_m, (113, 345), 84, 1.0, -1); _m = cv2.GaussianBlur(_m, (0, 0), 5)[..., None]   # WREATH_BAKE
BASE = (BASE.astype(np.float32) * (1 - _m) + O.astype(np.float32) * _m).astype(np.uint8)
_b = Image.fromarray(cv2.cvtColor(BASE, cv2.COLOR_BGR2RGB)).convert('RGBA'); _b.alpha_composite(SHELF[0], SHELF[1]); BASE = cv2.cvtColor(np.asarray(_b.convert('RGB')), cv2.COLOR_RGB2BGR)
Image.fromarray(cv2.cvtColor(cv2.resize(BASE, (int(W * SC), int(H * SC)), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB)).save(f'{OUT}/room.webp', quality=82, method=6)
print('room', os.path.getsize(f'{OUT}/room.webp'))
tim, tpos = TABLE; tim.save(f'{OUT}/table.webp', quality=88, alpha_quality=92, method=6)
meta['table'] = dict(x=tpos[0], y=tpos[1], w=tim.width, h=tim.height, kind='table', file='table.webp'); print('table', meta['table'])
json.dump(meta, open(f'{OUT}/layers.json', 'w'), indent=1)
# preview composite at the original camera
comp = BASE.copy().astype(np.float32)
order = ['rug', 'counter', 'ivy', 'wreath', 'rack']
for n in order:
    src, m, _ = layers[n]
    ys, xs = np.where(m > 0); 
    er = cv2.erode(m.astype(np.uint8), np.ones((3, 3), np.uint8)); a = cv2.GaussianBlur(er.astype(np.float32), (0, 0), .9)[..., None]
    comp = comp * (1 - a) + src.astype(np.float32) * a
_p = Image.fromarray(cv2.cvtColor(comp.astype(np.uint8), cv2.COLOR_BGR2RGB)).convert('RGBA'); _p.alpha_composite(TABLE[0], TABLE[1]); _p.convert('RGB').save(OUT + '/_preview.png')
