---
"@avodado/core": minor
"@avodado/render": patch
"avodado": patch
---

**Block audit: simpler authoring across the list-shaped blocks.** Six more
blocks now take terse string items (the callout bare-text philosophy):

- `glossary` — `SLO — the target` or unquoted `SLO: the target`
- `faq` — `Why is it fast? — The cache is warm.`
- `takeaways` — `Ship small — five beats one.`
- `list` — `Lead` or `Lead — text`
- `steps` — `Title` or `Title — body`
- `kanban` cards — `Core parser` or `Validation · priority`

Object forms are untouched; unquoted `Key: value` items (the YAML wrinkle) are
rescued when the key isn't a real field. Also refiles `pullquote` and `layers`
from the `api` family to `narrative` where they belong, and the skill's
contract + examples teach the terse forms.
