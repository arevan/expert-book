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

Endpapers share one botanical paper image, 1120x700 print coordinates, with the right page offset by -560px. Keep crease shading on the surfaces so board clones inherit it. The single leather case is shared by endpapers and content: never hide it just because the spread is an endpaper. Hard-board motion clips only the case half represented by the moving board. Match the board rim and static case using renderer geometry.
Paper support is split into left/right pseudo-elements, driven by data-stack-left/right. A pastedown must never have a paper block beneath it. settledPage stays fixed until motion returns to read; onFold hides support under an incoming lining before the first frame (including hover/cancel). Mobile uses one full-width right support. Static print scale and cover geometry use renderer rect, not rounded clientWidth. Material selectors must override mobile .page.left-page styling.
