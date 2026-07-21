---
"@avodado/render": patch
"avodado": patch
---

Slides: title cards center properly and title themselves.

- The cover's title + subtitle sit at the true vertical center (trailing doc
  margins no longer skew the flex centering).
- A slide that is only a `divider` is its own title card: no stale section
  heading above the PART band, and the jump menu lists it by the band's title.
- Untitled leading-prose slides drop the meaningless "Slide" header.
