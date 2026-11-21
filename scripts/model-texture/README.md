# Model texture edits

The scan's texture originally carried the Mitutoyo wordmark, a gray body and
the digits that were on the LCD when it was photographed. These scripts turn it
into the Angle Lens version. Run them in order from a folder that holds the
extracted texture as `tex0_x.jpeg` and `mark.png` (rasterise `mark.svg` at 580×500):

1. `1_badge.py` — paints out "Mitutoyo / MADE IN JAPAN" on the round badge and
   draws the Angle Lens mark, "Angle Lens" and "ANGLE FINDER" →  `tex_rebadged.png`
2. `2_blank_lcd.py` — erases the photographed digits from the LCD windows; the
   app draws the live reading there → `tex_lcd.png`
3. `3_gold.py` — maps the neutral gray body to metallic gold (badge, LCD, black
   and coloured parts untouched) → `tex_final.jpg`

Then downscale `tex_final.jpg` to 4096×4096 (JPEG q90; 8192² costs ~256 MB of GPU memory on a phone)
and run `node scripts/replace-model-texture.mjs tex_final_4k.jpg`.
Needs Python 3 with Pillow, numpy and scipy (Segoe UI fonts on Windows).
Presentation only: nothing here touches the measurement.
