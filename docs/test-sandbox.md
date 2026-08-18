# The test sandbox, and what it will not tell you

`tests/sandbox.js` loads the real browser modules under Node with light stubs.
Everything it fakes is a place a test can pass for the wrong reason, so this is
the record of which stubs answer honestly, which decline, and which were caught
lying.

## Caught lying (all fixed)

Three stubs reported a convenient fiction, and each made a real assertion pass
without testing anything:

| Stub | The lie | What it hid |
| --- | --- | --- |
| `crypto.getRandomValues` | `a => a` — returned the buffer unfilled | Every id came out all-zeros and identical. Six scheme tests failed only once the ids were *supposed* to be unique. |
| `localStorage.key` / `.length` | `() => null` and `0` | Storage looked empty however much you wrote. The localStorage→IndexedDB migration was untestable, and an orphan check written against `Object.keys(localStorage)` compared an empty list to zero. |
| `document.getElementById` | a fresh element every call | Nothing written could be read back. "The button is not disabled" passed trivially, and `showCoachTip`'s `hasAttribute` fallback — its behaviour when localStorage throws — was permanently dead. |

Four more were the same shape, found by audit rather than by a failing test:

- **`setAttribute` was a no-op** against a `getAttribute` that always returned
  `null`, which is what made memoising `getElementById` pointless on its own.
- **Unknown element properties answer with a no-op function, which is truthy** —
  so `if (el.hidden)` and `if (el.disabled)` were *always taken*. Any data
  property real code branches on is now declared falsy explicitly.
- **`performance.now()` returned a constant `0`**, so every elapsed-time
  computation was zero: throttles never elapsed and "took under N ms" passed
  without measuring.
- **Timer handles were `0`**, i.e. falsy, so `if (myTimer)` read false for a
  timer just armed — the opposite of the truth.
- **`matchMedia` answered `false` to everything**, putting every responsive
  branch on the desktop path. `SHEET_UI_MQ` — the string CLAUDE.md requires to
  match the stylesheet verbatim — could not be exercised at all.

`tests/game.test.js` now pins all of this in three tests under "the harness
itself". Each was verified by reintroducing the lie and confirming exactly one
test fails.

## Declines honestly — verify these in the browser

These cannot answer without a layout engine, a selector engine or a rasteriser,
and they are documented rather than faked:

| Stub | Returns | Do this instead |
| --- | --- | --- |
| `getBoundingClientRect` | all zeros | Inject your own rect. Several tests already do — that is the pattern. |
| `querySelectorAll` | `[]` | Count rendered nodes in the browser. "No invalid rows exist" would pass here without testing anything. |
| `getImageData` | 4 zero bytes, whatever region you ask for | Measure pixels in the browser. |
| `requestAnimationFrame` | never fires | Deliberate: `loop` re-arms itself, so a firing rAF would spin forever. |
| `setTimeout` | truthy handle, never fires | Replace it in the test if you need the callback; several tests do. |
| `fetch` | rejects | There is no network. `openDemoGarden` is browser-verified. |
| `getComputedStyle` | `''` for every property | Resolve real values in the browser; `uiInk()` would cache the empty string here. |

## Answers honestly

`localStorage` (a real Map, enumerable), `crypto.getRandomValues`,
`performance.now` (real monotonic), attributes, `classList`, `matchMedia` for
`min-width` / `max-width` / `orientation` including comma alternatives,
`measureText` (scales with the string — an approximation, not a zero).

## Auditing again

```bash
node dev/audit-stubs.js
```

Probes each stub and prints what it actually does. Run it after touching
`sandbox.js`; a stub that starts answering something plausible-but-wrong is the
failure mode this whole document exists for.
