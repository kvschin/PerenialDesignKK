# Pocket Prairie: launch checklist

Written 17 September 2026 against v0.8.97. This is the **operational** checklist —
forming the company, opening the accounts, and getting onto three storefronts.
[app-store-launch-plan.md](app-store-launch-plan.md) already covers the *product*
work for an iOS release in real depth (pricing rationale, storage durability,
purchase handling, beta design, listing copy). This doc does not repeat it; it
points at it and fills the three gaps it leaves: **the business, Steam, and the
order to do things in.**

Every fee, form name and size limit below was checked against the live docs on
17 Sep 2026. Stores change these constantly. Anything marked **⟳** is worth
re-checking the week you actually do it.

---

## Where you actually stand

Verified in the repo today, not assumed:

| | |
| --- | --- |
| Tests | **631 passed, 0 failed** (`node tests/run.js`) |
| Version | 0.8.97, consistent across `js/core.js`, `package.json`, `sw.js` |
| Legal pages | `privacy.html`, `terms.html`, `credits.html` — all exist, all already name Apple, Google and Steam |
| Icons | 1024px master, 512, 192, apple-touch, favicon-32 |
| Fonts | Fraunces + IBM Plex Sans, OFL licences shipped alongside |
| Offline | Full precache, zero third-party requests, verified |
| Accessibility | WCAG AA verified in both themes; 44px touch targets swept |
| Photos | **None shipped.** `photos/` holds only a README |
| Premium | `PREMIUM_ENABLED = false`; purchase/restore are placeholder stubs |
| Native | **No iOS, Android or desktop project exists** |
| Business | **None** |
| Public URL | `kvschin.github.io/PerenialDesignKK` — note the misspelling |

Three of those are better news than they look:

- **No photos shipped** means you have no CC BY-SA attribution surface to defend
  at review time, and no per-image licence audit before each release. Keep it
  that way through launch. Adding the photo collection is the single easiest way
  to turn a clean submission into a messy one.
- **The legal pages already assume a paid store product** and already name all
  three storefronts. They need *qualification*, not rewriting.
- **Zero data collection is verified, not aspirational.** Apple's App Privacy
  answers and Google's Data Safety form are the two forms most likely to get an
  app rejected or pulled later. You can answer both honestly with "none" — that
  is a genuine competitive asset in a category full of ad-supported apps, and it
  belongs in your store listing, not just in the form.

---

## Decide these four things first

Do these in one sitting this week. Each is cheap now and expensive to reverse.

### 1. The legal name of the business

**This is the name customers see on the App Store.** Apple verifies your D-U-N-S
against a real legal entity and will not accept DBAs, fictitious business names,
trade names or branches. So the LLC name *is* the publisher name.

- [ ] Pick a name you are happy to see under "Pocket Prairie Garden Design" on a
      store listing forever. `Pocket Prairie LLC`, `Pocket Prairie Software LLC`,
      or a studio name you can put other products under later.
- [ ] Check it is free in your state's business registry (free, instant, online).
- [ ] Search the [USPTO trademark database](https://tmsearch.uspto.gov/) for both
      the company name and "Pocket Prairie" in software/games classes (009, 042).
- [ ] Check the App Store, Google Play and Steam for an existing "Pocket Prairie".
- [ ] Buy the matching domain before you file anything.

> **Recommendation:** name the LLC after the product, not after yourself. One
> product today, but a studio name ages better if there is ever a second — and
> "Kevin Schin" as the publisher line makes a $20 app look like a hobby project.

### 2. Paid up front, or free with an in-app unlock

**This is the biggest scope lever in the entire launch.** The existing plan
recommends free + a $19.99 non-consumable unlock, and lists "sell the complete
app up front" as the simpler alternative.

> **Recommendation: sell it paid up front, at one price, on all three stores.**

The case is stronger than it was when that plan was written, for four reasons:

1. **You already have the free trial.** The public web build is a complete,
   offline, free version of the app. That is exactly what a free tier would be
   for, it already exists, and it costs you nothing to run. "Try the whole thing
   in your browser, buy it for your phone" is an honest and complete funnel.
2. **It deletes the riskiest code in the launch.** Step 8 of the existing plan —
   StoreKit entitlement, offline verification, restore, revocation, pending
   approval, interrupted purchase — is the highest-defect-density work here, and
   it has to be written *twice* (StoreKit and Play Billing) and then not at all
   for Steam. Offline entitlement checking in particular is genuinely hard to get
   right, and this app's whole promise is that it works with no network.
3. **Steam effectively requires it.** Free-to-play with an unlock is a poor fit
   for a Steam store page and gets reviewed harshly there. Paid up front is the
   native idiom.
4. **One price, three stores, one story**, and `PREMIUM_ENABLED` can stay `false`
   forever — the premium system simply never ships.

**The honest trade-off:** paid-up-front converts materially worse on mobile than
free-download-plus-unlock, so you will get fewer installs, fewer reviews and less
feedback in month one. If your goal at launch is *learning* rather than revenue,
free + unlock is the better instrument. If it is a clean, shippable v1 that earns
from day one, take the simpler path.

- [ ] Decide, write it down, and do not revisit it mid-build.
- [ ] Set the price. $19.99 is a reasonable opening hypothesis per the existing
      plan's market comparison. Steam buyers are more price-sensitive than App
      Store buyers for tools — consider $14.99 there.

### 3. Which storefronts, and in what order

> **Recommendation: Apple and Google together, Steam third but with its store
> page up first.** iOS and Android come from one Capacitor project, so doing them
> together costs far less than twice one. Steam needs a separate desktop shell
> *and* has a mandatory waiting period, so its store page should go up early even
> though the build ships last.

- [ ] Confirm the order. Note the Steam page-first exception below.

### 4. Whether you are buying a Mac

You are on Windows. iOS builds, signing, TestFlight and Xcode require macOS, and
there is no legitimate way around it.

> **Recommendation: buy a refurbished Apple-silicon Mac mini (~$500–600).** Cloud
> Mac rental runs $50–100/month and you will be building and debugging for
> months; CI-only macOS runners cannot do interactive device debugging, which is
> exactly what you will need for WKWebView storage and touch behaviour.

- [ ] Decide. If buying, order it this week — it is on the critical path.
- [ ] Confirm you have or can borrow a physical iPhone and Android phone for
      testing. Simulators will not surface the performance, storage-eviction or
      thermal behaviour this app's renderer cares about.

---

## The critical path

Four items have lead times you cannot compress, and three of them chain. Start
the chain this week; everything else can happen alongside it.

```
LLC name -> file LLC -> EIN -> D-U-N-S -+-> Apple org enrollment
  (1 day)   (1-3 wk)  (same day)  (5-10 business days)
                                        +-> Google Play org enrollment
                                             (skips the 12-tester rule)

Steam Direct fee ---------------------> 30-day minimum before release
Steam store page ---------------------> 2-week minimum public before launch
```

| Item | Lead time | Blocks |
| --- | --- | --- |
| LLC formation | 1–3 weeks ⟳ (state-dependent) | EIN, D-U-N-S, everything |
| EIN | Same day, online, free | Bank account, D-U-N-S |
| **D-U-N-S number** | **Up to 5 business days**, often longer | **Apple *and* Google org enrollment** |
| Apple org enrollment | Days to weeks (identity verification) | Any iOS build leaving your device |
| Steam Direct fee | **30 days minimum** before you may release | Steam launch date |
| Steam store page | **2 weeks minimum** public before launch | Steam launch date |
| Mac mini delivery | Days | All iOS work |

**The D-U-N-S is the keystone.** It is free and it gates both mobile stores.
Apply the day your LLC is registered.

**Forming the LLC before opening the Play account saves you a 14-day closed
test.** Google requires *personal* developer accounts created after 13 Nov 2023
to run a closed test with 12 testers opted in for 14 continuous days before
production access. **Organization accounts are exempt.** Opening a personal Play
account now and converting later does not retroactively clear it.

### Working backwards from a seasonal launch

Gardeners plan in late winter, and the natural window is **late January to early
March 2027** — after the holidays, when seed catalogues land and people start
planning beds.

Targeting **the first week of February 2027** from today (17 Sep 2026):

| When | What |
| --- | --- |
| Late Sep 2026 | Name, LLC filed, EIN, D-U-N-S applied for, Mac ordered |
| Mid Oct 2026 | Apple + Google org accounts open; domain and support site live |
| **Nov 2026** | **Steam Coming Soon page live** — start collecting wishlists |
| Nov 2026 | Capacitor shell running on real iOS and Android hardware |
| Dec 2026 | Electron/Steam build; store assets; compliance forms |
| Dec–early Jan | TestFlight + Play closed beta with real gardeners |
| Mid Jan 2027 | Submit to Apple and Google; freeze the release candidate |
| **Early Feb 2027** | **Launch all three** |

That is comfortable rather than tight, which is the right shape given none of the
native work has started and none of it is your day job.

---

## Phase 1 — Form the business

- [ ] **Choose the state.** File in the state you live in. Wyoming and Delaware
      are marketed heavily to software founders and are the wrong answer for a
      single-member LLC selling apps: you would still have to register as a
      foreign entity in your home state, paying both. ⟳
- [ ] **File the LLC.** Do it directly with the Secretary of State, not through
      LegalZoom or similar — it is the same form for a fraction of the price.
      Typically $50–$300 ⟳.
- [ ] **Be your own registered agent** if your state allows it and you are
      comfortable with your address being public. Otherwise budget ~$50–150/year.
- [ ] **Get an EIN** free from [irs.gov](https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online).
      Online, instant, no third party needed. Never pay for this.
- [ ] **Write a one-page operating agreement.** Most states do not require it for
      a single-member LLC; banks often ask, and it is what keeps the liability
      shield credible.
- [ ] **Open a business bank account** with the EIN and formation documents.
      Keep every business dollar out of your personal account — commingling is
      the most common way solo owners lose the LLC's liability protection.
- [ ] **Apply for the D-U-N-S number** the day the LLC is registered, free, at
      [D&B](https://www.dnb.com/duns-number/get-a-duns.html) or through
      [Apple's request form](https://developer.apple.com/enroll/duns-lookup/).
      Register it to the **LLC's exact legal name and address**, not your
      personal name — a D-U-N-S in your own name will not pass Apple's check.
- [ ] **Set up bookkeeping** before the first dollar arrives. A spreadsheet is
      fine at this volume; the thing that matters is starting on day one.
- [ ] **Understand your sales-tax position.** Apple, Google and Steam all act as
      merchant of record for store sales — they collect and remit sales tax and
      VAT worldwide, and you receive net revenue. You do not register for VAT
      anywhere. **This changes the moment you sell directly from your own site**,
      which is a strong reason not to, at least at first. If you ever do, use a
      merchant of record (Paddle, Lemon Squeezy) rather than raw Stripe. ⟳
- [ ] **Talk to an accountant once**, before year end, about the LLC's tax
      treatment and quarterly estimated payments. One hour, once.

---

## Phase 2 — Open the developer accounts

### Apple — $99/year ⟳

- [ ] Enroll as an **organization**, not an individual, using the LLC and its
      D-U-N-S. Individual enrollment publishes under your personal legal name.
- [ ] Complete identity verification, the Paid Applications Agreement, banking
      and tax forms. **You cannot sell anything until the Paid Apps agreement is
      active and banking is complete** — do this early, not at submission.
- [ ] Apply for the [Small Business Program](https://developer.apple.com/app-store/small-business-program/).
      15% commission instead of 30% under $1M/year. Enrollment is not automatic
      and takes effect the following month — apply immediately. ⟳
- [ ] Reserve the app name and bundle identifier in App Store Connect. Something
      like `com.pocketprairie.garden`. It is permanent.
- [ ] Turn on two-factor and record recovery access somewhere durable. Losing
      access to this account means losing the app.

### Google Play — $25 one-time ⟳

- [ ] Register as an **organization** using the LLC and its D-U-N-S. This is what
      exempts you from the 12-tester / 14-day closed testing requirement.
- [ ] Complete identity and payments-profile verification.
- [ ] Create the app record and reserve the package name — also permanent.
- [ ] Generate an upload key, enroll in **Play App Signing**, and back the key up
      somewhere you will still have it in five years.

### Steam — $100 per title, recoupable ⟳

- [ ] Create a Steamworks account for the LLC, complete the tax interview
      (W-9 for a US entity) and banking.
- [ ] Pay the [Steam Direct fee](https://partner.steamgames.com/doc/gettingstarted/appfee):
      $100 per product, recouped in the payment after the title clears $1,000
      adjusted gross revenue.
- [ ] Note the two clocks: **30 days minimum between paying the fee and
      releasing**, and **the store page must be public for at least 2 weeks
      before launch.**
- [ ] **Put the Coming Soon page up as early as you reasonably can** — months,
      not the two-week minimum. Wishlists accumulated before launch are the main
      input to Steam's launch visibility, and a page with art and a trailer can
      go up long before the build is finished.

> **A note on Steam specifically.** Steam's audience buys games, and Pocket
> Prairie's framing ("a 2.5D perennial-gardening game in the spirit of Piet
> Oudolf") gives you a genuine cozy-game pitch. But it is a *planner* at heart,
> and cozy-game buyers expect progression and play. Expect Steam to be the
> weakest of the three storefronts for this product unless the store page leans
> hard into the cozy-garden framing rather than the professional-tool one. It is
> still worth $100 and a Coming Soon page.

---

## Phase 3 — Public infrastructure

- [ ] **Buy a domain.** `pocketprairie.app` or similar, ~$15/year.
- [ ] **Move the web app onto it.** The current URL contains a misspelling
      (`PerenialDesignKK` — one `n`) and will otherwise end up in store listings,
      privacy policy links and press. GitHub Pages supports custom domains free;
      it is a `CNAME` file and a DNS record.
- [ ] **Set up a real support address** — `support@` your domain, forwarding to
      your inbox. Apple and Google both require a working support URL or address,
      and `kvschin@gmail.com` currently appears in both legal pages.
- [ ] **Build a one-page marketing site**: what it is, a few screenshots, the
      three store buttons, "try it free in your browser", and links to privacy,
      terms and credits.
- [ ] **Add a support page** covering backing up a garden, moving gardens between
      devices, restoring a purchase, and how offline/local storage works. Apple
      review reads this.
- [ ] **Move `privacy.html`, `terms.html` and `credits.html` to the domain** and
      keep those URLs stable — they go into store metadata and should not move.
- [ ] **Name the LLC as the responsible entity in both legal pages.** They
      currently name no legal entity at all, which is a problem for a paid
      product and for the limitation-of-liability clause in `terms.html`.

---

## Phase 4 — Package the app

The web app is the product; these are shells around it. Nothing here requires
rewriting the renderer.

### Shared

- [ ] **Use [Capacitor](https://capacitorjs.com/docs) for both iOS and Android.**
      One project, native WebView runtime, assets bundled locally — which matches
      this app's zero-network design. Record the deliberate exception to the
      "no npm dependencies, no build step" architecture in CLAUDE.md, because it
      is a real one.
- [ ] **Disable the service worker in native builds.** `sw.js` is a caching layer
      in front of assets that the native shell already bundles — two caches that
      can disagree about which build is running, and an update bar offering an
      update the store controls. This is the single most likely source of a
      "why is my phone showing an old version" bug, and this project has already
      shipped that bug twice on the web.
- [ ] **Add the native version/build number as a fifth version copy.** CLAUDE.md
      documents three (`core.js`, `package.json`, `sw.js`) plus the menu footer;
      native adds `CFBundleShortVersionString` / `versionName`. Extend the
      existing version test to cover it, or this will drift immediately.
- [ ] Verify the app **starts in airplane mode on first launch**, from the
      bundle, on a device that has never seen it.
- [ ] Keep `dev/`, `tests/`, and the review harnesses out of the shipped bundle.
      **`_config.yml`'s `exclude` list already is this manifest** — its own
      comment says to keep it in step with the packaging file list when the store
      builds are set up. Derive the bundle's exclusions from it rather than
      writing a second list that can disagree.
- [ ] Work through **steps 6, 7 and 9 of [app-store-launch-plan.md](app-store-launch-plan.md)**
      — storage durability in WKWebView, native-usable exports, and mobile
      usability. Those three are the real engineering risk and that document
      covers them properly.

### iOS

- [ ] Icons, launch screen, safe areas, orientation, supported devices, signing.
- [ ] Build with the **current required SDK** — Xcode 26 / iOS 26 SDK or later as
      of 28 April 2026. ⟳
- [ ] Add the **privacy manifest** (`PrivacyInfo.xcprivacy`) with required-reason
      API declarations for whatever actually ships. ⟳
- [ ] Set `ITSAppUsesNonExemptEncryption` — almost certainly `false`, since the
      app uses no encryption beyond HTTPS. Verify against the final bundle. ⟳
- [ ] Write **reviewer notes** that pre-empt Guideline 4.2 (minimum
      functionality). The app is a substantial offline editor, not a website
      wrapper, but say so: give exact steps to create a garden, change season,
      export a planting list, and confirm it works with networking off.

### Android

- [ ] Android App Bundle, Play App Signing, upload key backed up.
- [ ] Target the **current required API level** — Android 16 / API 36 as of
      31 August 2026. ⟳
- [ ] Adaptive icon (foreground + background layers) — your current square icons
      are not enough.
- [ ] Test the **hardware Back button** explicitly. This app has modals, sheets,
      drill-ins and overlays with no Back concept; Android users will press it
      constantly and the default behaviour will close the app mid-garden.
- [ ] Test on a low-end device, not just a flagship. The renderer's sprite
      governor and glass governor are exactly what a weak GPU exercises.

### Steam / desktop

- [ ] **Use Electron, not Tauri.** Tauri is smaller but uses the system WebView
      (WebView2 on Windows, WebKitGTK on Linux), so the rasteriser varies per
      machine. Every performance number in CLAUDE.md was measured against
      specific engines; Electron bundles Chromium, so what you benchmarked is
      what ships.
- [ ] Windows build first. Add macOS and Linux only if you want them — each is a
      separate support surface. ⟳
- [ ] Wire up SteamPipe for uploads and test a depot update.
- [ ] Steam integration beyond "it launches" is optional. Achievements and cloud
      saves are nice; neither is required for release.
- [ ] **Declare no controller support and do not claim Steam Deck compatibility.**
      This is a mouse-and-touch app with no gamepad input at all. Claiming Deck
      support you do not have earns refunds and negative reviews.
- [ ] Make sure window resizing works across the full range — the responsive
      tiers were designed for phones and browser windows, and a 3440px ultrawide
      or a 1280x720 window are both reachable on desktop.

---

## Phase 5 — Store assets

- [ ] **App icon** — you have the 1024px master. Check it reads at 60px.
- [ ] **Screenshots**, current required sizes ⟳, showing in this order: a
      finished garden, the same garden in another season, the planting plan, the
      planting list, site-photo tracing.
- [ ] **Play feature graphic** — 1024x500. ⟳ You do not have one.
- [ ] **Steam capsules** — several sizes, all different from the mobile ones. ⟳
- [ ] **A 20–30 second screen recording.** Worth more than any screenshot for
      this product, because the season crossfade is the pitch and a still cannot
      show it. One capture serves App Store preview, Play, Steam and the website.
- [ ] **Listing copy**: name, subtitle, description, keywords (Apple: 100 chars),
      short description (Play: 80 chars), category.
- [ ] Lead with what is actually differentiating: **works completely offline,
      collects nothing, 554 species, see your planting across the seasons, take a
      real planting list to the nursery.**
- [ ] Do not promise photographs, cloud sync, AR, survey accuracy or plant
      identification. None of those ship.

---

## Phase 6 — Compliance forms

- [ ] **Apple App Privacy** — "Data Not Collected", but audit the final binary
      first. If you add any crash reporting or analytics SDK, this answer changes.
- [ ] **Google Play Data Safety** — same answer, same caveat.
- [ ] **Age ratings** — Apple 4+, Play "Everyone" / IARC questionnaire, Steam
      content survey. Nothing in the app complicates this.
- [ ] **Export compliance** declarations on all three.
- [ ] **EU trader status** — required for App Store distribution in the EU; have
      the LLC's registered address and contact details ready. ⟳
- [ ] **Update `privacy.html` before submitting.** It currently states the app
      "makes no network requests to us or to anyone else." That stops being true
      the moment a store SDK is linked, even for a paid-up-front app with no IAP.
      The fix is a sentence qualifying store communication — not deleting the
      claim, which is still the app's best privacy property and is genuinely
      unusual.
- [ ] **Re-check `credits.html`** covers everything in the final bundle: the two
      OFL fonts, the OSU PRISM zone data, and any native dependency Capacitor or
      Electron pulls in.
- [ ] **Keep the photo collection out of v1.** Shipping CC BY-SA images adds a
      per-image attribution obligation, a licence-compatibility question against
      store DRM, and a re-verification step before every release. Add it in a
      point release once the launch is behind you.

---

## Phase 7 — Beta

- [ ] TestFlight (iOS) and a Play closed track (Android), run together.
- [ ] **15–30 testers who actually garden.** Friends who will say it is nice are
      not useful. Nursery staff and garden club members are.
- [ ] Give them a task, not an app: *design a real bed you are actually planning,
      come back another day, and bring me the planting list.*
- [ ] **Ship one update mid-beta** and confirm everyone's gardens survive it.
      This is the test most likely to find a launch-blocking bug.
- [ ] Fix every reproducible data-loss, crash or blocked-workflow issue. Ship
      with cosmetic bugs if you must; never ship with a save bug.
- [ ] Run `npm test` and `npm run test:browser` on the exact release candidate.

---

## Phase 8 — Submit

- [ ] Freeze the release candidate. Tag it in git.
- [ ] Bump the version in all four (soon five) places and confirm the test that
      pins them passes.
- [ ] Submit to Apple and Google. Choose **manual release** on both so you
      control the date.
- [ ] Set the Steam release date, satisfying both the 30-day and 2-week clocks.
- [ ] Expect at least one rejection. It is routine, not a verdict. Read the
      guideline cited, fix, resubmit.
- [ ] Have the marketing site, support page and legal pages live **before**
      approval, not after.

---

## Phase 9 — Launch and after

- [ ] Release all three within a few days of each other.
- [ ] **Buy your own app on each store**, fresh install, on a device that has
      never had it. This is the only way to find a broken purchase flow.
- [ ] Verify the listing, the links, the support address, and a first-run
      experience with no network.
- [ ] Tell the people who tested it, the gardening communities that allow it, and
      local nurseries. Never tie anything to a positive review.
- [ ] Watch crash reports and support mail closely for two weeks. Keep a
      reproducible build and a patch procedure ready.
- [ ] Renew the Apple membership annually or the app is removed.

---

## What this costs before you earn anything

| Item | Cost |
| --- | --- |
| LLC filing | $50–300 ⟳ (state-dependent) |
| Registered agent | $0–150/year |
| EIN | Free |
| D-U-N-S | Free |
| Apple Developer Program | $99/year |
| Google Play | $25 once |
| Steam Direct | $100 per title (recouped at $1,000 revenue) |
| Domain | ~$15/year |
| **Subtotal** | **~$290–690 first year** |
| Refurbished Mac mini | ~$500–600 |
| **With a Mac** | **~$790–1,290** |

At $19.99 with Apple's Small Business rate, you clear roughly $17 per sale before
tax. **Break-even is around 50 sales.** That is arithmetic, not a forecast.

---

## Things specific to this app that will bite you

1. **The version footgun gets worse.** CLAUDE.md documents that the version lives
   in three files plus the menu footer, and that shipping a mismatch has already
   stranded two releases. Native adds a fifth copy, and a mismatch there means
   the store shows one version and the app reports another in bug reports.
2. **The service worker has no business in a native build.** See Phase 4.
3. **`privacy.html`'s central claim needs qualifying**, and it is a document
   Apple reads during review. See Phase 6.
4. **IndexedDB durability in WKWebView is the real risk.** Step 6 of the existing
   plan is right to lead with it. The app holds a garden in memory for a whole
   session and autosaves on a settle timer; iOS can evict web storage under
   pressure. Test eviction deliberately, not incidentally.
5. **Android's Back button has no handler.** See Phase 4.
6. **Steam Deck and controllers: claim neither.** See Phase 4.
7. **Keep the photo collection out of v1.** See Phase 6.
8. **The public repo URL is misspelled** and will propagate into store metadata,
   privacy links and press if you do not move to a real domain first.
9. **Personal email in shipped legal pages.** See Phase 3.
10. **No legal entity is named in the terms**, which weakens the limitation of
    liability clause that is there precisely to protect you.

---

## What this checklist deliberately does not cover

The *product* work for the iOS release — pricing validation with real users, the
free/premium boundary, storage durability, native-usable exports, purchase
implementation, mobile accessibility, beta design and listing copy — is covered
properly in **[app-store-launch-plan.md](app-store-launch-plan.md)**, steps 1–14.
Read that alongside this. Where the two disagree, this document is newer on the
business and Steam; that one is more thorough on iOS product work.
