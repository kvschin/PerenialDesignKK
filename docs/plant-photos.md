# Plant photographs, and the checklist before one ships

The Plant Library draws four seasonal illustrations for every species. Those are
the app's argument — how a plant behaves across a year — and they are original,
procedural, and always available. A **photograph** answers a different question,
which is what the thing actually looks like in a garden, and it is optional
corroboration sitting below them.

It is also the only third-party content in the product, and it arrives with
legal strings attached. This document is what has to happen before one is
committed.

> Compliance research summarised here, not legal advice. Where it says
> **⚠ counsel**, a lawyer should sign off before the first paid binary ships.

## Why this is stricter than a normal web app

Three facts about Pocket Prairie make image licensing sharper than usual:

1. **It is sold** — Steam and the app stores. Every image is a commercial use,
   so NonCommercial licences are permanently out.
2. **It ships offline.** The service worker precaches the app onto the device,
   so every image is *redistributed*, and a copy on somebody's phone cannot be
   recalled if a file is later deleted from Commons.
3. **It makes zero third-party requests** — a privacy-policy claim, a
   store-privacy-label claim, and the reason the typefaces are self-hosted. So
   images are downloaded and self-hosted too. Never hotlink
   `upload.wikimedia.org`.

The consequence worth internalising: **a wrong credit is worse than no
photograph.** The illustrations already carry the Library. Nothing is lost by
skipping a file you are unsure about, and there are millions of files.

## Where images may come from

**Wikimedia Commons only** (or Kevin's own camera).

**Images on a Wikipedia article are not automatically reusable.** English
Wikipedia hosts non-free files *locally* under a fair-use rationale —
deliberately low-resolution, justified per-article, no free licence at all.
They appear in articles and are not on Commons.

The rule, stated so it can be checked: click through from the article to the
file page. The host must be exactly `commons.wikimedia.org`. If it is
`en.wikipedia.org`, **reject, no exceptions.** `photoRecordProblems` in
`js/photos.js` enforces this, and a test pins it.

## Licences

The allowlist lives in `PHOTO_LICENSES` (`js/photos.js`) and is machine-enforced
— a human's aesthetic judgment cannot overrule it, which matters because **the
best-looking file in a Commons category is disproportionately likely to be one
you may not use.** The most decorated *Echinacea purpurea* image on Commons —
Featured Picture, Picture of the Day, Picture of the Year — is GFDL 1.2 only.

**Prefer, in this order:** CC0 → public domain → CC BY → CC BY-SA.

That order is not fussiness. CC BY and CC0 carry no ShareAlike question at all,
and their exposure to the unresolved DRM problem (below) is far weaker. CC 4.0
also has a 30-day cure period; **CC 2.0 and 3.0 have none** — they terminate
automatically on breach with no reinstatement, and for a shipped binary the cure
path is an app-store review cycle rather than a website edit. Commons is mostly
BY-SA in practice, so treat this as advice about which file to pick out of a
category.

**Never accepted:** anything NonCommercial or NoDerivatives, GFDL (including
GFDL-only legacy files), the Free Art License, CC 1.0, and anything non-free.
`PHOTO_LICENSES_REFUSED` says why for each.

**Dual-licensed files** (typically GFDL *or* CC BY-SA) are usable on the CC arm
only. Record which arm you took in `licenseElected` — that is the defence
against a GFDL claim later.

## ShareAlike does not reach the app, and here is why it must not

A CC BY-SA photograph displayed unmodified inside the app makes the app a
*collection* of separately-licensed works, not an *adaptation*. ShareAlike
applies only if you share **Adapted Material you produce**, and re-encoding or
downscaling for display is expressly not that. So the app's code stays
proprietary — **provided we never produce an adapted version.**

That is why two rules in `js/photos.js` are load-bearing rather than stylistic:

- **Never write a modified derivative to disk.** Downscale and re-encode only.
  All framing is `aspect-ratio` + `object-fit: cover` in `styles.css`, done at
  render time, so the stored file remains the licensor's own. A stored crop is
  the one operation that is genuinely arguable — route around it rather than
  litigate it.
- **Never draw a photograph to the game canvas** — not as a texture, not into
  the sprite cache, not into `takePhoto()`'s exported PNG. A test enforces this
  by grepping the renderer modules.

| Operation | Adapts it? | Do it? |
| --- | --- | --- |
| Re-encode, downscale, strip EXIF | No — technical | ✅ |
| Crop and save the cropped file | Arguable | ❌ use CSS |
| Recolour, composite, canvas texture | Yes | ❌ never |
| Overlay UI chrome at runtime | No — file untouched | ✅ |

## The per-image checklist

Every box, every image, by a person. Roughly three minutes each; this is the
rate-limiting step and it is supposed to be. Start with
`node dev/commons-photo.js <plantKey> "File:Something.jpg"`, which fetches the
metadata, maps the licence, and refuses anything off the allowlist — but it can
only repeat what the uploader typed. **It cannot tell you the licence is true.**

**Provenance**
1. The file page host is exactly `commons.wikimedia.org`. `en.wikipedia.org` → stop.
2. Save the file page (single-file HTML) into `photo-evidence/` *before* anything else.

**Licence**
3. Read the **Licensing** box on the file page — not the description prose.
4. The tag is on the allowlist. Multiple tags → confirm they are alternatives, take the CC arm, record `licenseElected`.
5. No extra condition bolted on in prose ("please notify me", "not for use in apps", "credit must appear on the image"). A licence plus a condition is not that licence.
6. Check the `Permission` field for over-claims.

**Authorship — the part that actually fails**
7. Identify the **author**, not the uploader. Read `Artist`/`Author`, not the upload log.
8. For an "own work" claim: does the account have a consistent body of similar photography? Does EXIF name a different person? **Reverse-image-search it.** A match on a stock site or an earlier-dated blog → reject.
9. Prefer files with a licence-review template or a VRT permission ticket.
10. Check the file's history and talk page for deletion nominations or licence disputes.
11. If the author specified a credit string, record it in `attributionOverride` — it is reproduced verbatim and supersedes our generated wording.

**Content — things no copyright licence clears**
12. **No identifiable people.** A free licence is the photographer's copyright, not a model release. Any recognisable face → reject. Garden photography is full of incidental people.
13. No sculpture, garden art or distinctive modern architecture as the subject (freedom of panorama varies by country).
14. **No brand logos or legible nursery tags/pots.** Endemic in plant photography and a trademark exposure. Reject it — do not crop it out.
15. The `Restrictions` field is empty.

**Technical**
16. Check EXIF for GPS before processing. It is common, and redistributing a photographer's home-garden coordinates onto thousands of devices is a privacy harm *we* would be creating.
17. Strip all EXIF on ingest, and carry any `copyrightNotice` forward into the record — you just removed it from the bytes.
18. Downscale and re-encode only (`resize-photos.ps1`). No crop written to disk.
19. Add the file to `PRECACHE` in `sw.js`. A test fails until you do: the credit is only complete offline if the picture is there offline too.
20. `node tests/run.js` passes.

**Records — keep for the life of the product plus seven years.** The metadata
record, the archived file page, the original unmodified download, and who
checked it when. Apple's guidelines let a reviewer ask you to *produce*
authorization, which means retrievable on their timeline rather than
reconstructible.

## Before every release

```bash
node dev/commons-photo.js --verify
```

Re-queries Commons for every declared photograph and diffs the live answer
against the stored record — licence changes, creator changes, a newly specified
attribution string, new `Restrictions`, and **files that have been deleted**.
That last one is the risk that cannot be eliminated: Commons removes files when
a copyright problem surfaces, sometimes years later, and we are still shipping
ours offline. Catching it before the next release is the whole mitigation.

## Adding a photograph, end to end

```bash
node dev/commons-photo.js bluestem "File:Some Little Bluestem.jpg"
```

1. Work the checklist above against the file page it prints.
2. Download the display copy it names, save as `photos/<key>.jpg`.
3. `powershell -ExecutionPolicy Bypass -File .\resize-photos.ps1`
4. Paste the printed `photo:{…}` block into that species in `js/plants.js`.
5. Add `'./photos/<key>.jpg'` to `PRECACHE` in `sw.js`.
6. `node tests/run.js`
7. Bump `APP_VERSION`, `package.json` and `sw.js`'s `VERSION` together.

The Credits page picks it up automatically — it is generated from `PLANTS`,
so there is no second list to update and none to forget.

## Open questions for counsel

1. **⚠** Does shipping CC BY-SA images inside a DRM-wrapped store binary breach
   the anti-technological-measures clause, and does parallel un-DRM'd
   distribution cure it? We already publish the identical files unmodified via
   GitHub Pages and say so on the Credits page (`PHOTO_PARALLEL_SOURCE`), which
   is the standard mitigation and costs nothing. This is the only finding that
   could force a design change — and sourcing CC0/CC BY instead of BY-SA
   sidesteps it almost entirely.
2. Is a per-image `ⓘ` disclosure plus a full Credits page sufficient? The
   licences allow satisfying the conditions "in any reasonable manner based on
   the medium", and both surfaces render the complete credit offline, so this
   reads as comfortably yes.
3. Is life-of-product-plus-seven-years the right retention for our territories?
