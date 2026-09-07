---
'avodado': minor
'@avodado/core': patch
---

CLI safety: no silent data loss, no stale site, no unreadable document called clean, no anonymous render crash.

**A command never destroys a file you wrote.** `avo sync openapi|csv|sql|dbml|prisma --out` used to overwrite the target and print a checkmark; it now refuses, names the file, and names `--force`. The same rule covers every command that writes to a path you named: `avo new -o`, `avo block -o`, `avo template -o`, `avo design <slug> -o`, and `avo skill -o` never replace an existing file, while the export commands (`avo html|slides|pdf|pptx`, and the gallery writers `demo` / `catalog` / `compare` / `design -p -o`) replace a file only when the path already carries the extension they produce — re-exporting `report.html` is the normal loop, writing HTML over `notes.md` is not. Each of those commands gained a `--force` flag. `avo init` already skipped existing files and is unchanged; `avo build` owns its output directory and is covered by the manifest below.

**`avo build` prunes.** It records what it generated in `dist/.avodado-build.json` and, on the next build, removes exactly the files that manifest lists and this build no longer generates — so a doc deleted from `docs/` stops being served. Nothing else is touched: a `CNAME`, an `assets/` folder, or any other file you placed in the output directory was never in the manifest. An output directory with no manifest (built by an older Avodado) is left completely alone, with a one-line note; pruning starts from the next build.

**A file that is not UTF-8 is reported, not validated.** `avo check` used to pass invalid bytes and UTF-16 files clean, silently validating replacement characters. It now emits `E_ENCODING` naming the file and the line. A UTF-8 byte order mark is stripped instead of pushing the first fence off line 1. Symlinks under the docs root are no longer followed, and the same file reached by two paths loads once — a `docs/loop -> .` cycle used to invent dozens of duplicate-id errors.

**A renderer crash names its document.** `avo build` reported a renderer throw as a bare `Invalid string length` with no file, line, or block type. Every render is now guarded per document: the failure becomes an `E_RENDER` error that names the file, the line, and the block (found by re-rendering each block on its own), the failed document gets a placeholder page so its URL keeps working, every other document still builds, and the build exits 1. `avo html|slides|pdf|pptx` prefix the same attribution onto their error. `@avodado/core` adds the `E_ENCODING` and `E_RENDER` codes to the diagnostic taxonomy.
