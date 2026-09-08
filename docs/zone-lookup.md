# Offline ZIP-zone lookup

Implemented for 0.8.67, September 7, 2026. The former hand-authored three-digit
ZIP bands have been replaced with 40,502 five-digit ZIP/half-zone pairs from
the 2023 listings published by [OSU PRISM](https://prism.oregonstate.edu/phzm/).
The four downloaded files cover the contiguous US, Alaska, Hawaii, and Puerto
Rico. Coverage follows those files; it does not imply every postal code is listed.

## Source and reproduction

The bundled file, `data/zip-zones-2023.json`, records the edition, retrieval
date, owner, row counts, source URLs, and SHA-256 hashes of the raw downloads:

| Listing | Rows | Source |
| --- | ---: | --- |
| Contiguous US | 39,921 | [CSV](https://prism.oregonstate.edu/phzm/data/2023/phzm_us_zipcode_2023.csv) |
| Alaska | 272 | [CSV](https://prism.oregonstate.edu/phzm/data/2023/phzm_ak_zipcode_2023.csv) |
| Hawaii | 133 | [CSV](https://prism.oregonstate.edu/phzm/data/2023/phzm_hi_zipcode_2023.csv) |
| Puerto Rico | 176 | [CSV](https://prism.oregonstate.edu/phzm/data/2023/phzm_pr_zipcode_2023.csv) |

OSU owns these source datasets; redistribution is subject to the
[published terms](https://prism.oregonstate.edu/phzm/). The generator retains
every published ZIP/half-zone pair, grouped by half-zone and packed as sorted
five-character ZIP strings. No map graphic is reproduced. The lookup is
explicitly identified as not being the official USDA Plant Hardiness Zone Map
in Credits, alongside links to the original provider and official map.
Setup keeps the ZIP field free of introductory and attribution text; its status
line appears only for lookup progress, results, or errors.

Download the four source CSVs unchanged into one local directory, then run:

```sh
node dev/build-zip-zones.cjs <csv-directory> 2026-09-07
```

Use the actual retrieval date for a new review. The generator makes no network
requests. It rejects duplicates, unexpected headers, malformed ZIP/zone fields,
and temperature/title fields inconsistent with the published zone scale before
writing output. Identical files and date produce identical output. Record
changed source hashes when updating; do not hand-edit individual ZIP results.
Review a new map edition before changing the fixed 2023 edition contract.

## Runtime and user behavior

- `sw.js` precaches the 203,897-byte JSON file. `loadZipZones()` fetches that
  fixed same-origin path only when a full ZIP is entered, shares an in-flight
  request, validates the data once, and retains successful results in memory.
  No ZIP is included in a request, stored in a garden, or sent to USDA/OSU.
- `halfZoneFromZip` uses bounded binary searches of the packed groups;
  `zoneFromZip` returns the corresponding whole number. Leading zeros matter.
  Partial codes, junk, and absent codes return no match; there is no prefix guess.
- Setup displays the source half-zone and explicitly selects the corresponding
  whole zone for the existing plant-filter contract. For example, 90210 is
  listed as 10b and uses filter Zone 10; 78520 is 10a and also uses Zone 10.
  These are ZIP-list results, not an assessment of a particular property.
- Catalog coverage remains derived from plants, currently zones 2–11. A listed
  result outside that range is displayed without clamping. Next stays disabled
  until another ZIP or a manual supported-zone choice resolves it. Failed or
  unavailable lookups also offer manual selection. A late response cannot
  replace a manual choice or a newly opened setup form.
- The official map link stays visible in both setup views and opens only when
  clicked, without forwarding the entered ZIP. The form panel scrolls within
  the viewport, including when ZIP help changes its height.
- Winter captions show the zone's temperature interval in the selected units,
  described as an average annual winter minimum. Approximate winter-choice
  chips show their ranges. Zone matches do not establish summer, soil, or local
  native suitability. See [USDA's explanation](https://planthardiness.ars.usda.gov/pages/how-to-use-the-maps).

Existing gardens keep their chosen zones. Save schema, plant eligibility, and
script order are unchanged. App/package/worker versions advance together to
0.8.67 so an existing installation gets the new cached asset and matching code.

## Verification

Node tests cover known source results, missing/invalid input, extreme half-zones,
packed-data validation, loading/retry behavior, unsupported zones, and stale
response protection. Browser release checks exercise setup at desktop and phone
sizes, official-link attributes, real offline data loading, saved gardens, and
service-worker updates. See [release checks](browser-release-checks.md).

Verified September 7, 2026: all 534 Node tests and all 21 browser checks passed
(Edge 152.0.4191.66; desktop, 390-pixel phone, and 320-pixel phone viewports).
An additional full-data check compared all 40,502 runtime lookup results with
the four raw downloads and verified every recorded source hash. Physical-device
acceptance remains separate readiness work.
