# Gera public/mapas/bovino.png e os contornos dos cortes (regioes.json) para src/produtos/mapaBovino.ts.
# Uso: python -m venv .venv && .venv/Scripts/pip install numpy opencv-python-headless pillow
#      mkdir ref && .venv/Scripts/python ferramentas/desenho-bovino.py  (saídas em ref/)
# Depois: copiar ref/boi.png para public/mapas/bovino.png e atualizar as regiões em mapaBovino.ts.
# Desenha o boi do Mapa de Cortes (mocho e gordo, inspirado no layout do pôster da Angus) e calcula
# as regiões dos cortes a partir das mesmas linhas do desenho. Saídas: boi.png (fundo transparente),
# cortes.json (contornos em fração da imagem) e conferencia.png (regiões coloridas e rotuladas).
import json
import math
import cv2
import numpy as np
from PIL import Image, ImageDraw

W, H = 1200, 760  # sistema de coordenadas do desenho
S = 3  # supersampling para o traço sair suave


def suavizar(pts, fechado=False, passos=12):
    """Catmull-Rom: curva suave passando pelos pontos."""
    if len(pts) < 3:
        return pts
    p = list(pts)
    if fechado:
        p = [p[-1]] + p + [p[0], p[1]]
    else:
        p = [p[0]] + p + [p[-1]]
    saida = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for t in range(passos):
            t /= passos
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            saida.append((x, y))
    if not fechado:
        saida.append(pts[-1])
    return saida


def elipse(cx, cy, rx, ry, ang=0, n=64):
    a = math.radians(ang)
    return [(cx + rx * math.cos(t) * math.cos(a) - ry * math.sin(t) * math.sin(a), cy + rx * math.cos(t) * math.sin(a) + ry * math.sin(t) * math.cos(a))
            for t in (2 * math.pi * i / n for i in range(n))]


# Contorno do animal (perna dianteira e traseira do lado de cá; as do outro lado ficam atrás).
CORPO = suavizar([
    (150, 182), (175, 168), (250, 158), (400, 152), (550, 156), (700, 152), (790, 140),  # garupa e lombo retos (boi gordo)
    (840, 132), (885, 136), (925, 150), (958, 168),  # cupim baixo e pescoço grosso
    (982, 160), (1012, 158), (1040, 168),  # nuca mocha (sem chifre)
    (1066, 196), (1088, 236), (1106, 278), (1122, 304), (1126, 326), (1114, 344), (1090, 350), (1062, 346), (1036, 334),  # cara larga e focinho
    (1016, 344), (1008, 372), (1010, 410), (1002, 452), (986, 494), (968, 524),  # barbela e peito
    (962, 560), (962, 612), (958, 660), (966, 700), (968, 716), (912, 718), (914, 696), (912, 650), (906, 604), (896, 580),  # perna dianteira
    (872, 576), (820, 588), (700, 598), (580, 600), (470, 594), (420, 588),  # barriga funda
    (395, 594), (378, 624), (366, 664), (370, 700), (372, 718), (310, 718), (312, 696), (306, 652), (296, 616),  # perna traseira
    (268, 582), (226, 540), (186, 476), (160, 392), (147, 300), (144, 226),  # coxa e nádega cheias
], fechado=True, passos=10)

PERNAS_FUNDO = [
    suavizar([(890, 578), (886, 634), (884, 700), (888, 716), (842, 716), (846, 698), (848, 640), (850, 590)], passos=8),
    suavizar([(452, 590), (440, 640), (428, 700), (432, 716), (386, 716), (390, 696), (400, 640), (410, 592)], passos=8),
]
# Orelha horizontal saindo para trás da nuca (Angus mocho), por cima do pescoço.
ORELHA = suavizar([(1018, 196), (1000, 178), (976, 158), (952, 146), (946, 152), (962, 172), (990, 196), (1008, 208)], fechado=True, passos=8)
RABO = suavizar([(152, 186), (136, 214), (126, 280), (124, 360), (127, 440), (131, 488)], passos=10)

# Linhas de separação dos cortes (as pontas passam um pouco do contorno, que corta o excesso).
SEP = {
    "picanha": [(170, 150), (205, 205), (245, 232), (290, 222), (318, 182), (322, 145)],
    "lagarto": [(198, 188), (192, 260), (195, 350), (210, 440), (240, 510), (250, 582)],
    "alcatra_tras": [(262, 232), (268, 300), (276, 380), (285, 450), (304, 532)],
    "coxao_duro": [(182, 298), (282, 320)],
    "coxao_mole": [(222, 505), (312, 528)],
    "alcatra_baixo": [(262, 356), (275, 355), (340, 345), (400, 322), (445, 300)],
    "maminha": [(276, 451), (285, 452), (330, 455), (385, 470)],
    "maminha_vazio": [(385, 470), (440, 430), (497, 386)],
    "patinho": [(385, 470), (392, 525), (400, 600)],
    "patinho_baixo": [(301, 525), (340, 560), (385, 600), (404, 616)],
    "ossobuco_cima": [(280, 620), (390, 614)],
    "ossobuco_baixo": [(295, 666), (380, 662)],
    "lombo": [(445, 140), (445, 300)],
    "file": [(445, 232), (640, 232)],
    "costela_meio": [(640, 140), (640, 300), (644, 483)],
    "capa": [(640, 230), (820, 224)],
    "costela_cima": [(445, 300), (820, 300)],
    "vazio": [(445, 300), (500, 390), (560, 482), (578, 610)],
    "minga": [(562, 486), (700, 482), (820, 470)],
    "dianteiro": [(822, 130), (820, 300), (820, 470), (848, 600)],
    "acem_pescoco": [(915, 135), (944, 222), (956, 300), (960, 345)],
    "cabeca": [(985, 145), (1000, 240), (1026, 345)],
    "acem": [(812, 284), (970, 292)],
    "raquete": [(812, 398), (978, 404)],
    "coracao": [(812, 472), (982, 476)],
    "pescoco_baixo": [(952, 340), (1032, 342)],
    "peito": [(960, 336), (968, 430), (962, 500), (978, 548)],
    "canela_dianteira": [(895, 606), (975, 604)],
}
BIFE_DE_VAZIO = elipse(507, 528, 34, 17, ang=-35)

# Um ponto dentro de cada região, com o nome dela (as sem nome são cabeça, pernas etc.).
SEMENTES = {
    "Picanha": (250, 190), "Lagarto": (170, 330), "Coxão duro": (230, 260), "Coxão mole": (240, 420),
    "Alcatra": (350, 230), "Maminha": (340, 410), "Patinho": (340, 500), "Vazio": (450, 540), "Bife de vazio": (507, 528),
    "Ossobuco": (325, 640), "Filé mignon": (540, 190), "Contrafilé": (540, 265), "Capa de filé": (730, 190),
    "Filé de costela": (730, 265), "Costela do traseiro": (560, 400), "Costela do dianteiro": (730, 390), "Costela minga": (700, 540),
    "Acém": (880, 220), "Pescoço": (972, 280), "Raquete da paleta": (890, 350), "Coração da paleta": (890, 440),
    "Peixinho": (880, 530), "Peito": (988, 440),
}


def desenhar_separadores_raster(escala, larg):
    img = np.zeros((H * escala, W * escala), np.uint8)
    for linha in list(SEP.values()):
        pts = np.array([(x * escala, y * escala) for x, y in suavizar(linha)], np.int32)
        cv2.polylines(img, [pts], False, 255, larg)
    cv2.polylines(img, [np.array([(x * escala, y * escala) for x, y in BIFE_DE_VAZIO], np.int32)], True, 255, larg)
    return img


# ---- regiões (segmentação pelas linhas do próprio desenho) ----
E = 2
corpo = np.zeros((H * E, W * E), np.uint8)
cv2.fillPoly(corpo, [np.array([(x * E, y * E) for x, y in CORPO], np.int32)], 255)
seps = desenhar_separadores_raster(E, 3)
interior = cv2.bitwise_and(corpo, cv2.bitwise_not(seps))
n, rot = cv2.connectedComponents(interior, connectivity=4)
regioes = {}
for nome, (sx, sy) in SEMENTES.items():
    r = rot[sy * E, sx * E]
    assert r > 0, f"semente de {nome} caiu numa linha"
    assert r not in regioes.values(), f"{nome} caiu na mesma região que outra semente"
    regioes[nome] = int(r)


def contorno(mascara):
    m = cv2.dilate(mascara, np.ones((3, 3), np.uint8))  # cobre a metade da linha de cada lado
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    c = cv2.approxPolyDP(c, 1.2, True)
    return [[round(float(p[0][0]) / (W * E), 4), round(float(p[0][1]) / (H * E), 4)] for p in c]


poligonos = {nome: contorno((rot == r).astype(np.uint8) * 255) for nome, r in regioes.items()}
uniao = lambda *nomes: contorno(cv2.dilate(np.isin(rot, [regioes[n] for n in nomes]).astype(np.uint8) * 255, np.ones((5, 5), np.uint8)))
poligonos["Filé mignon + Contrafilé"] = uniao("Filé mignon", "Contrafilé")
poligonos["Costelas"] = uniao("Costela do traseiro", "Costela do dianteiro")
json.dump(poligonos, open("ref/regioes.json", "w", encoding="utf-8"), ensure_ascii=False)

# Conferência: cada região com uma cor e o nome.
conf = np.zeros((H * E, W * E, 3), np.uint8)
rng = np.random.default_rng(7)
for nome, r in regioes.items():
    conf[rot == r] = rng.integers(70, 230, 3)
conf[seps > 0] = 255
for nome, (sx, sy) in SEMENTES.items():
    cv2.putText(conf, nome, (sx * E - 40, sy * E), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 2)
cv2.imwrite("ref/conferencia.png", cv2.resize(conf, (W, H)))

# ---- desenho final (fundo transparente) ----
FUNDO_CORPO = (29, 35, 66, 255)
FUNDO_PERNAS = (20, 25, 50, 255)
LINHA = (190, 198, 214, 255)
img = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
esc = lambda pts: [(x * S, y * S) for x, y in pts]
for perna in PERNAS_FUNDO:
    d.polygon(esc(perna), fill=FUNDO_PERNAS, outline=LINHA)
    d.line(esc(perna), fill=LINHA, width=int(2.2 * S), joint="curve")
d.line(esc(RABO), fill=LINHA, width=int(5 * S), joint="curve")
d.ellipse([122 * S, 478 * S, 140 * S, 520 * S], fill=LINHA)  # vassoura do rabo
d.polygon(esc(CORPO), fill=FUNDO_CORPO)
d.line(esc(CORPO + CORPO[:1]), fill=LINHA, width=int(3 * S), joint="curve")
d.polygon(esc(ORELHA), fill=FUNDO_CORPO)
d.line(esc(ORELHA + ORELHA[:1]), fill=LINHA, width=int(2.5 * S), joint="curve")


def pontilhado(pts, traco=9, vao=7, larg=2.4):
    # percorre a linha marcando traços de comprimento fixo (o mesmo padrão em qualquer direção)
    acum, desenhando, atual = 0.0, True, [pts[0]]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        pos = 0.0
        while pos < seg:
            limite = (traco if desenhando else vao) - acum
            passo = min(limite, seg - pos)
            pos += passo
            acum += passo
            p = (x0 + (x1 - x0) * pos / seg, y0 + (y1 - y0) * pos / seg)
            if desenhando:
                atual.append(p)
            if acum >= (traco if desenhando else vao) - 1e-9:
                if desenhando and len(atual) > 1:
                    d.line(esc(atual), fill=LINHA, width=int(larg * S))
                desenhando, acum, atual = not desenhando, 0.0, [p]
    if desenhando and len(atual) > 1:
        d.line(esc(atual), fill=LINHA, width=int(larg * S))


# Os pontilhados só aparecem dentro do corpo: desenha numa camada e recorta pelo contorno.
camada = Image.new("RGBA", img.size, (0, 0, 0, 0))
d_final = d
d = ImageDraw.Draw(camada)
def aparar(nome):
    # trecho da linha entre o primeiro e o último ponto em que ela encosta em outra linha ou sai do corpo
    outras = np.zeros((H * E, W * E), np.uint8)
    for k, l in SEP.items():
        if k != nome:
            cv2.polylines(outras, [np.array([(x * E, y * E) for x, y in suavizar(l)], np.int32)], False, 255, 3)
    cv2.polylines(outras, [np.array([(x * E, y * E) for x, y in BIFE_DE_VAZIO], np.int32)], True, 255, 3)
    bloqueio = cv2.bitwise_or(outras, cv2.bitwise_not(cv2.erode(corpo, np.ones((3, 3), np.uint8))))
    pts = []
    for (x0, y0), (x1, y1) in zip(suavizar(SEP[nome]), suavizar(SEP[nome])[1:]):
        n = max(1, int(math.hypot(x1 - x0, y1 - y0) * E))
        pts += [(x0 + (x1 - x0) * t / n, y0 + (y1 - y0) * t / n) for t in range(n)]
    toca = [i for i, (x, y) in enumerate(pts) if 0 <= int(y * E) < H * E and 0 <= int(x * E) < W * E and bloqueio[int(y * E), int(x * E)]]
    if not toca:
        return pts
    ini = toca[0] if toca[0] < len(pts) // 2 else 0
    fim = toca[-1] if toca[-1] > len(pts) // 2 else len(pts) - 1
    return pts[ini:fim + 1]


for nome in SEP:
    pontilhado(aparar(nome))
pontilhado(BIFE_DE_VAZIO + BIFE_DE_VAZIO[:1])
mascara = Image.new("L", img.size, 0)
ImageDraw.Draw(mascara).polygon(esc(CORPO), fill=255)
img.paste(camada, (0, 0), Image.composite(camada.split()[3], Image.new("L", img.size, 0), mascara))
d = d_final
# Detalhes da cabeça e cascos
d.ellipse([1040 * S, 208 * S, 1052 * S, 220 * S], fill=LINHA)  # olho
d.ellipse([1104 * S, 293 * S, 1114 * S, 303 * S], fill=LINHA)  # narina
d.line(esc(suavizar([(1078, 322), (1098, 320), (1112, 316)])), fill=LINHA, width=int(2 * S))  # boca
for x0, x1, y in [(914, 957, 690), (302, 348, 690), (842, 880, 690), (380, 418, 690)]:
    d.line([(x0 * S, y * S), (x1 * S, y * S)], fill=LINHA, width=int(2 * S))  # casco
img = img.resize((W * 3 // 2, H * 3 // 2), Image.LANCZOS)  # 1800 x 1140
img.save("ref/boi.png")
print("regioes:", len(regioes), "| png:", img.size)

# ---- recorte rente ao desenho (sem margem transparente) e contornos no novo enquadramento ----
alfa = np.array(Image.open("ref/boi.png").split()[3])
ys, xs = np.nonzero(alfa > 0)
m = 12
x0, y0 = max(0, xs.min() - m), max(0, ys.min() - m)
x1, y1 = min(alfa.shape[1], xs.max() + m), min(alfa.shape[0], ys.max() + m)
Image.open("ref/boi.png").crop((x0, y0, x1, y1)).save("ref/boi.png")
fw, fh = alfa.shape[1], alfa.shape[0]
cw, ch = x1 - x0, y1 - y0
recortado = {nome: [[round((x * fw - x0) / cw, 4), round((y * fh - y0) / ch, 4)] for x, y in pts] for nome, pts in poligonos.items()}
json.dump(recortado, open("ref/regioes.json", "w", encoding="utf-8"), ensure_ascii=False)
print("recorte:", (cw, ch))
