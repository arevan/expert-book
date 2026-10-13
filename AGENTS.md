# Expert book

Read docs/heroine-continuity.txt before any illustration work.
The canonical heroine is the upper angel in dist/assets/virtues-engraving-v1.png, not the woman at the table below. Preserve her face and hair in future clothes and armor. Wings/halo apply only to chapter II.
Use dist/assets/tinkoff-coat-of-arms-reference.png for knight shields.
Keep the title engraving and chapter I map unchanged. Keep development on localhost; do not deploy without a new user request.
The app is static HTML/CSS/JS in dist. Run: python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
Preserve the page-turn behavior and the spine inside .stf__block, below turning pages.

Chapter III is accepted: dist/assets/roundtable-engraving-v1.png.
Chapter IV: both duel frames are accepted. The first, dist/assets/studies/duel-windup-v1.png, is now active in the book by the user's request. Preserve dist/assets/studies/duel-strike-v1.png for later use; the gallery links to it. Woman knight on the right has the historic Tinkoff crest; black knight on the left has a shaggy wide-eyed demon emblem. The bridge illustration is a retained earlier alternative.
Chapter V: user selected the defense itself, not knighting. Active image is dist/assets/council-engraving-v2.png: the heroine stands with her back to the viewer, facing three council members behind a raised examination desk on a dais. No shield or coat of arms in this plate. This back-view revision was selected by the user.
Generate chapter illustrations one at a time. Discuss new scenes with the user before generating them; follow the latest explicit user selection.

The reader has physical endpapers: lining0, flyleaf1, content2..13, flyleaf14, lining15. Keep six content spreads and their original folios. Desktop boundaries0/14; mobile boundaries1/14. A turning board exposes only the stationary flyleaf; never clone a content page as its inner face. Closed state hides the renderer and spread-sized stack. Outside uses antique-cover-v3.png without text; title running headers say T DESIGN.
