# מסגרת טלפון: PNG אטום עם "חור" שקוף במקום המסך.
# הווידאו מונח מתחתיו, ולכן הפינות המעוגלות והמסגרת מתקבלות בחינם.
from PIL import Image, ImageDraw
import os

S = r"C:/Users/NOAM~1.EDE/AppData/Local/Temp/claude/E--noamdev-SportDle/bd05242f-ddf7-4745-b778-63ae95662b09/scratchpad"

W, H = 1080, 1920
BODY = (66, 110, 1014, 1860)        # גוף המכשיר
SCREEN = (90, 170, 990, 1810)       # אזור המסך — 900x1640
BG = (14, 14, 17, 255)
BEZEL = (28, 28, 33, 255)
EDGE = (58, 58, 66, 255)

img = Image.new("RGBA", (W, H), BG)
d = ImageDraw.Draw(img)

# גוף המכשיר
d.rounded_rectangle(BODY, radius=78, fill=BEZEL, outline=EDGE, width=3)

# שורת הסטטוס — שעה משמאל, אייקונים מימין
d.text((SCREEN[0] + 34, 128), "9:41", fill=(238, 238, 242, 255))
bx = SCREEN[2] - 40
d.rounded_rectangle((bx - 46, 130, bx, 152), radius=6, outline=(210, 210, 216, 255), width=3)
d.rounded_rectangle((bx - 43, 133, bx - 12, 149), radius=3, fill=(210, 210, 216, 255))
d.rectangle((bx + 3, 136, bx + 7, 146), fill=(210, 210, 216, 255))
for i, hgt in enumerate((8, 13, 18, 23)):
    x = bx - 118 + i * 13
    d.rectangle((x, 152 - hgt, x + 8, 152), fill=(210, 210, 216, 255))

# פס הבית התחתון
d.rounded_rectangle((W // 2 - 105, 1826, W // 2 + 105, 1836), radius=5,
                    fill=(120, 120, 128, 255))

# חור המסך — שקוף לגמרי
hole = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(hole).rounded_rectangle(SCREEN, radius=46, fill=(0, 0, 0, 255))
img.paste((0, 0, 0, 0), (0, 0), hole)

img.save(os.path.join(S, "phone.png"))
print("phone.png", img.size, "screen", SCREEN[2] - SCREEN[0], "x", SCREEN[3] - SCREEN[1])
