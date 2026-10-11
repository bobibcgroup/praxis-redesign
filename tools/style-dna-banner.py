import sys, math, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops
src = Image.open("public/images/wedding_relaxed_01.jpg").convert("RGB")
S = 2  # work at 2x
src = src.resize((1024*S, 1024*S), Image.LANCZOS)
def build(W, H, man_x, top, scale):
    # crop region of source scaled
    s = src.resize((int(src.width*scale), int(src.height*scale)), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H))
    # wall colour sampled from source right edge band
    band = s.crop((s.width-40, int(top), s.width, int(top)+H)).resize((1, H), Image.LANCZOS)
    wall = band.resize((W, H))
    canvas.paste(wall, (0, 0))
    ox = int(man_x - s.width*0.5)
    piece = s.crop((0, int(top), s.width, int(top)+H))
    # fade the right edge of the photo into the wall
    mask = Image.new("L", piece.size, 255)
    d = ImageDraw.Draw(mask)
    fade = int(piece.width*0.18)
    for i in range(fade):
        d.line([(piece.width-fade+i, 0), (piece.width-fade+i, piece.height)], fill=int(255*(1-i/fade)))
    lf = int(piece.width*0.12)
    for i in range(lf):
        d.line([(i,0),(i,piece.height)], fill=min(255,int(255*i/lf)) if ox>0 else 255)
    canvas.paste(piece, (ox, 0), mask)
    # warm grade
    r,g,b = canvas.split()
    canvas = Image.merge("RGB",(r.point(lambda v:min(255,int(v*1.02+4))), g.point(lambda v:int(v*0.995+1)), b.point(lambda v:int(v*0.95))))
    # palm shadows on the right
    random.seed(7)
    sh = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(sh)
    def frond(cx, cy, length, ang, n=15, leaf=0.5):
        for i in range(n):
            t = i/n
            px = cx + math.cos(ang)*length*t
            py = cy + math.sin(ang)*length*t + (t*t)*length*0.25
            for side in (-1,1):
                a2 = ang + side*(1.05 - 0.4*t)
                ll = length*leaf*(1-t*0.7)
                ex = px + math.cos(a2)*ll; ey = py + math.sin(a2)*ll + ll*0.35
                w = max(4, int(length*0.03*(1-t*0.6)))
                d.line([(px,py),(ex,ey)], fill=255, width=w)
        d.line([(cx,cy),(cx+math.cos(ang)*length, cy+math.sin(ang)*length+length*0.25)], fill=255, width=max(2,int(length*0.012)))
    for (fx, fy, L, a) in [(W*1.03, H*-0.08, H*0.9, math.radians(155)), (W*1.04, H*0.62, H*0.75, math.radians(190)), (W*0.96, H*1.1, H*0.6, math.radians(235)), (W*-0.03, H*0.9, H*0.55, math.radians(-40))]:
        frond(fx, fy, L, a)
    sh = sh.filter(ImageFilter.GaussianBlur(H*0.011))
    shade = Image.new("RGB", (W,H), (120, 96, 70))
    canvas = Image.composite(Image.blend(canvas, shade, 0.2), canvas, sh)
    # subtle sun gradient from upper left
    grad = Image.new("L",(W,H))
    gd = ImageDraw.Draw(grad)
    for x in range(W):
        gd.line([(x,0),(x,H)], fill=int(26*(1-x/W)))
    canvas = Image.composite(Image.new("RGB",(W,H),(255,240,215)), canvas, grad)
    # film grain
    noise = Image.effect_noise((W,H), 5).convert("L")
    canvas = ImageChops.add(canvas, Image.merge("RGB",(noise,noise,noise)), scale=1.0, offset=-128)
    return canvas
out = sys.argv[1]
# desktop panorama 2400x840 (2.86:1); man centred at 24% from left, head near top
d = build(2400, 840, 2400*0.22, 0, 1.08)
d.save(out+"-wide.png")
# phone: 4:3 crop with man centred-left
m = build(1200, 900, 1200*0.34, 0, 0.95)
m.save(out+"-phone.png")
