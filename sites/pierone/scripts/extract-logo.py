from pathlib import Path

from PIL import Image

SRC = Path(
    r"C:\Users\Owner\.cursor\projects\c-Projects-WorkforceOS\assets\c__Users_Owner_AppData_Roaming_Cursor_User_workspaceStorage_66bc59ca92279e7a29d60040af85cf12_images_Screenshot_6-9-2026_13576_chatgpt.com-b52c711c-8829-4508-b99e-e4d03e053d30.jpg"
)
DEST = Path(r"C:\Projects\WorkforceOS\sites\pierone\public\brand\logo-lockup.png")


def extract(src: Path, dest: Path) -> None:
    im = Image.open(src).convert("RGBA")
    pixels = im.load()
    width, height = im.size
    for y in range(height):
        for x in range(width):
            r, g, b, _a = pixels[x, y]
            if r >= 248 and g >= 248 and b >= 248:
                pixels[x, y] = (255, 255, 255, 0)
    bbox = im.split()[-1].getbbox()
    if bbox:
        pad = 12
        left, top, right, bottom = bbox
        im = im.crop(
            (
                max(0, left - pad),
                max(0, top - pad),
                min(width, right + pad),
                min(height, bottom + pad),
            )
        )
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "PNG")
    print(f"saved {dest} {im.size}")


extract(SRC, DEST)
