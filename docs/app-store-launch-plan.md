# Pocket Prairie: App Store launch and pricing proposal

Prepared September 5, 2026 (America/Chicago), against local version 0.8.63. Apple App Store first is the working assumption; Google Play is covered at the end. This is a planning proposal, not an adopted change to the product specification or authorization to introduce payments or dependencies.

The core product is substantial enough to validate with paying customers. The largest remaining work is native packaging, purchase handling, reliable mobile exports and storage, beta testing, and the store submission. Completing the entire feature backlog is not a prerequisite.

**What was verified:** the repository contains 545 plant catalog entries; the planner, seasonal views, planting schemes, site-photo reference, bloom calendar, CSV planting list, PNG plan export, offline web support, privacy page, terms, credits, and app icon assets. `node tests/run.js` returned **505 passed, 0 failed**. No native iOS/Android project or real store purchase integration was found. `PREMIUM_ENABLED` is false, entitlement is a local placeholder, and purchase/restore functions return placeholder messages. The photo infrastructure exists, but no catalog entries currently include a photograph. A printable PDF packet is a proposed addition; the existing plan export is PNG and the planting-list print action calls the browser's print function.

This review did not test a physical phone, access developer accounts, verify the live deployment, or establish App Review approval. Some older README/backlog descriptions lag behind implemented features; use current code and CLAUDE.md when preparing claims.

1. **Choose the first customer and the launch promise.**

   - [ ] Start with homeowners planning perennial, native, or naturalistic beds. Select an initial region whose plant coverage you can confidently demonstrate.
   - [ ] Use a concrete promise: “See your garden through the seasons and take a planting plan to the nursery.”
   - [ ] Freeze the first release around create → plant → compare seasons → save → export. Define supported phones/tablets, operating-system versions, language, and countries.
   - [ ] Keep broad catalog expansion, multiplayer, AI, cloud accounts, and additional decorative systems outside this launch scope.

   **Done when:** the audience, promise, and exact first-release feature list fit on one page.

2. **Validate what customers will pay for before implementing the paywall.**

   - [ ] Recruit 10–15 prospective users with an actual garden project. Include a few nursery staff or designers who can judge exported plans.
   - [ ] Watch them design a real bed, inspect another season, reopen their work, and find their plant quantities. Avoid guiding them through every control.
   - [ ] Ask what they would use the output for, what they currently use, what is missing, and whether they would buy a clearly described $19.99 package today.
   - [ ] Show an example premium PDF packet. Record which feature drives interest: a shopping list, seasonal confidence, tracing their site, or comparing alternatives.
   - [ ] Treat stated willingness as preliminary evidence; actual purchases after release are stronger evidence. TestFlight purchases do not establish real willingness to pay.

   **Done when:** the recurring obstacle and most valuable outcome are clear. If users cannot complete a bed, fix that before interpreting price resistance.

3. **Set the purchase model and the exact free/premium boundary.**

   **Recommendation:** free download, one useful garden, and a **$19.99 USD one-time Premium unlock** as the initial hypothesis. Test $14.99 or $29.99 only when user feedback justifies a different package or price. Avoid launching several tiers at once.

   | Proposed new-customer offering | Free | Premium |
   | --- | --- | --- |
   | Plant library and seasonal garden views | Yes | Yes |
   | A useful first garden, editing, autosave, undo | Yes | Yes |
   | Backup/export of the user's garden data | Yes | Yes |
   | Multiple saved gardens and planting alternatives | Limited | Unlocked |
   | Calibrated site-photo tracing and advanced planning workflows | Demo/preview | Unlocked |
   | Polished printable PDF packet: plan, quantities, spacing, seasonal calendar | Sample preview | Export |

   - [ ] Finalize this table before coding gates; it is a recommendation, not the current behavior.
   - [ ] Preserve existing users' access and existing gardens. The current source explicitly says existing features stay free; resolve grandfathering and update the specification before changing that convention.
   - [ ] Decide the public web version's role: demo, continuing free edition, or equivalent free tier for new users. Explain the reason to buy the native edition if the website continues to offer the same tools free.
   - [ ] Explain that a restored store purchase unlocks Premium; it does not restore locally stored gardens. Do not promise an Apple purchase also unlocks Android or the web without implementing it.
   - [ ] Replace “One purchase, this device” with accurate store-account language once the integration exists. State exactly what the purchase includes; avoid promises of every future service forever.

   Apple calls a permanent one-time unlock a **non-consumable in-app purchase**. Use StoreKit for the standard Apple launch flow. [Apple purchase types](https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-types)

   **Simpler alternative:** charge $14.99–$19.99 upfront for the complete app. This removes the in-app paywall and IAP integration work, but users cannot try the store app before buying. The existing web app can provide the trial experience. Choose one approach before the native integration work.

   **Pricing context, not proof of demand:** GrowVeg lists $35/year for its recurring plan; iScape's US listing includes Pro at $29.99/month. These serve different gardening/design needs. They make a $19.99 experiment plausible, not validated. [GrowVeg pricing](https://www.growveg.com/subscribeinfo.aspx), [iScape US listing](https://apps.apple.com/us/app/iscape-landscape-design/id439688430)

4. **Arrange the developer account and access to a Mac.**

   - [ ] Check whether you already have an Apple Developer membership and a compatible Mac, borrowed Mac, or hosted Mac build environment. This workspace is on Windows.
   - [ ] Choose individual or organization enrollment. Individuals use their legal seller name; organization enrollment requires an eligible legal entity and usually a D-U-N-S number. Forming a company is not a prerequisite for individual enrollment. [Apple enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)
   - [ ] Budget Apple's US $99/year membership. [Apple Developer Program](https://developer.apple.com/programs/)
   - [ ] Complete identity verification, agreements, banking, and tax details. Apply for the Small Business Program if eligible; its commission is 15% on paid apps and IAP once applicable. [Small Business Program](https://developer.apple.com/app-store/small-business-program/)
   - [ ] Reserve the app record and bundle identifier; secure account recovery and signing access. Confirm name availability and ownership of the branding.

   **Done when:** a signed test build can be installed and the account can distribute and sell the app.

5. **Package the existing app for iOS.**

   - [ ] Evaluate a thin Capacitor shell as the first implementation option. Keep the existing HTML/CSS/JS and renderer; a native rewrite is not required by this proposal. Capacitor provides an iOS runtime around WKWebView and supports native integrations. [Capacitor iOS](https://capacitorjs.com/docs/ios)
   - [ ] Add only the native tooling and plugins needed for purchases, files/sharing, photo import, and any required lifecycle handling. This introduces a native build process and dependencies, so record the intentional exception to the current web-only architecture.
   - [ ] Bundle the actual app assets. Start successfully in airplane mode on the first launch. Keep development tools and test pages out of the release bundle.
   - [ ] Configure app icons, launch appearance, safe areas, orientation, supported devices, version, build number, and signing.
   - [ ] Use the current submission SDK. Since April 28, 2026, Apple requires Xcode 26 or later with the iOS/iPadOS 26 SDK or later. This is a build requirement, not a requirement to exclude every older iPhone OS. [Apple submission requirements](https://developer.apple.com/news/upcoming-requirements/)
   - [ ] Give the native app a deliberate update path: bundle updates through store releases; keep the web service worker/update bar from replacing or confusing native assets. Keep web version constants synchronized for web releases.

   Apple's guideline 4.2 requires sufficient utility beyond a repackaged website. Demonstrate the working offline garden editor, seasonal rendering, saved projects, and integrated exports. A wrapper by itself is not a promise of approval. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

6. **Make garden storage dependable inside the native app.**

   - [ ] Verify IndexedDB durability in the native WebView; add a suitable native storage/backup layer if testing shows it is needed. Preserve the centralized asynchronous storage API.
   - [ ] Save safely around app backgrounding, interruptions, and termination; do not rely on a last-second page event being guaranteed to finish.
   - [ ] Test reopening, native app updates, large gardens, multiple schemes, site photos, low storage, interrupted writes, and legacy saves.
   - [ ] Keep the native storage location/origin stable across releases and test migrations.
   - [ ] Provide a clear Export backup / Import backup path using Files. Test export → reinstall → import as a separate workflow from an in-place update.
   - [ ] Provide a web-to-native import path: Safari/PWA storage will not automatically become the installed app's garden database.

   **Done when:** the supported save/update/backup workflows retain an identical garden, and failures give a usable recovery action. Cloud sync is optional for this release.

7. **Make exports worth purchasing and usable on a phone.**

   - [ ] Replace or adapt browser-only download links and `window.print()` for the native environment. Verify Files, the native share sheet, image export, CSV, and printing/PDF on actual devices.
   - [ ] Build the premium PDF packet if using the recommended package. Include the plan, legible legend, scale reference, plant names/cultivars, quantities, spacing, and a seasonal calendar.
   - [ ] Check quantities against small hand-worked examples, including individual woody plants, drift coverage, bulbs, and containers. Distinguish drawn clumps from estimated plants to order.
   - [ ] Check feet/meters, page sizes, long names, large legends, and output from each planting scheme.
   - [ ] Show a sample or preview of the paid result before asking for the purchase. Keep backup access free.

   **Done when:** a tester can take a legible file to a nursery or print it without desktop instructions.

8. **Implement and test real purchases, if using the free-plus-Premium model.**

   - [ ] Create the non-consumable product and its metadata in App Store Connect.
   - [ ] Replace the two placeholder purchase/restore functions and the local boolean entitlement with verified StoreKit entitlement handling. [StoreKit transactions](https://developer.apple.com/documentation/StoreKit/Transaction)
   - [ ] Load localized price text from the store. Handle buying, already owned, pending approval, cancellation, network failure, refund/revocation, and app termination during purchase.
   - [ ] Restore on another supported device with the same purchasing account. Keep verified paid functionality usable offline; distinguish unavailable verification from confirmed revocation.
   - [ ] Test all entry points to premium tools, including imported gardens. Handle the free-tier limits without damaging or hiding existing work.
   - [ ] Put the offer at the moment of value and Restore Purchases in Settings. Decide whether to enable Family Sharing.
   - [ ] Exercise the real purchase flow in Apple's test environments, then verify the production product configuration during release.

   **Done when:** purchase, cancellation, restoration, interruption, offline use, and revocation behave correctly. Skip this IAP step if selling the complete app upfront.

9. **Finish mobile usability and accessibility.**

   - [ ] Test a smaller iPhone, a current iPhone, and an iPad if included. Cover the oldest supported OS and current OS.
   - [ ] Verify one-finger placement, two-finger pan/pinch, accidental placement prevention, selection/move/cancel, undo, keyboard appearance, rotation, and tray scrolling.
   - [ ] Run realistic and dense gardens long enough to check sustained performance, memory, battery use, and heat. Existing renderer tests do not measure physical-device performance.
   - [ ] Check light/dark modes, safe areas, readable text, touch target sizes, reduced motion, contrast, and screen-reader labels/navigation for standard controls.
   - [ ] Inspect the canvas accessibility limitations and describe supported accessibility features honestly in the listing.
   - [ ] Make the first-use tour end with a saved garden and an understandable planting list.

   **Done when:** a new tester can complete the main workflow without coaching or a blocking interaction problem.

10. **Finish privacy, rights, and support for the exact shipping build.**

   - [ ] Keep the existing privacy/terms/credits pages, but update their claims to match store purchases, native plugins, and any new crash or support handling. “No network requests” needs qualification once the app communicates with the store.
   - [ ] Audit actual data flows before completing App Privacy answers. Do not automatically choose “Data Not Collected” solely because the current web app stores gardens locally. [App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
   - [ ] Include required native privacy manifests and approved API-use reasons for the code and SDKs actually shipped. [Apple requirements](https://developer.apple.com/news/upcoming-requirements/)
   - [ ] Publish a working support page with contact details, save/backup instructions, restore-purchase help, and common troubleshooting. Apple requires support and privacy links. [Apple review preparation](https://developer.apple.com/app-store/review/)
   - [ ] Verify ownership/licenses for the logo, illustrations, fonts, and any photographs actually included. Retain notices and attribution. No photograph collection is currently bundled, so do not promise one in the paid feature list.
   - [ ] If photographs are later added, follow the project's existing provenance/licensing process before shipping them. Review the app terms against the chosen license/EULA approach and sales model.
   - [ ] Complete age rating, export-compliance, content-rights, and country-specific declarations; if distributing in the EU, complete the applicable trader-status verification. [Apple submission requirements](https://developer.apple.com/news/upcoming-requirements/)

   **Done when:** the forms, policies, links, and actual binary describe the same product.

11. **Prepare the store listing and a small launch kit.**

   - [ ] Write the name/subtitle, description, keywords, category, support/privacy URLs, copyright, price, and territories.
   - [ ] Verify that the existing 1024px icon meets current submission requirements and looks clear at small sizes.
   - [ ] Capture current required screenshot sizes for the devices you support. Show: a finished garden, the same garden across seasons, site tracing, the planting plan/list, and a saved alternative.
   - [ ] Use actual app screens. Accurately describe the free limits and one-time purchase. Do not promise photorealism, professional survey accuracy, cloud sync, or plant photographs that are not included.
   - [ ] Make a short screen-recorded demonstration and a simple public product/support page. Choose a small initial audience, such as existing testers, gardening groups that permit promotion, or local nursery contacts.
   - [ ] Prepare reviewer notes with exact instructions to create a garden, find exports, buy/restore Premium, and understand offline/local storage behavior.

   **Done when:** someone seeing only the listing understands the benefit, cost, and supported workflow. Check the current upload specifications in App Store Connect. [Submitting apps](https://developer.apple.com/app-store/submitting/)

12. **Run a focused TestFlight beta.**

   - [ ] Start with a small internal group, then recruit roughly 15–30 relevant external testers. These are suggested recruitment targets, not Apple's minimum requirement.
   - [ ] Budget approximately two weeks of use and fixes. TestFlight external distribution may need Beta App Review. [Apple external testing](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers)
   - [ ] Ask testers to complete a garden, return on another day, use another season, export, and send specific feedback. Include an update from one beta build to the next while retaining their gardens.
   - [ ] Collect device/OS/app version, reproduction steps, and any user-chosen diagnostic export. The existing funnel counters stay on the device; they are not central conversion analytics.
   - [ ] Fix every reproducible data-loss, purchase/restore, crash, and blocked-core-workflow issue. Repeat affected tests.

   **Done when:** the tested release candidate has no known reproducible blocker in the promised purchase/design/save/export workflows.

13. **Submit, then verify the released app.**

   - [ ] Freeze a release candidate, run the automated suite and syntax checks, and perform the physical-device acceptance checklist on the exact archive.
   - [ ] Upload the signed build, complete compliance answers, attach the initial IAP if applicable, and submit with clear reviewer instructions. Initial IAP review must be coordinated with the app submission.
   - [ ] Select manual release if you want to coordinate the listing, support page, and announcement. Allow time for review feedback; approval timing is outside your control.
   - [ ] After approval/release, verify the public listing, fresh install, purchase availability, restoration, offline editing, saving, and export.
   - [ ] Announce to the audience that tested the concept. Ask for honest feedback; do not tie benefits to positive ratings.

14. **Operate the launch and learn from actual purchases.**

   - [ ] Watch support and store-provided crash/sales information closely at launch. Keep a reproducible build and a patch procedure ready.
   - [ ] Review weekly: downloads, paid purchases, refunds, customer questions, and the most common incomplete workflows. These are business observations, not proof that a specific in-app button caused a sale.
   - [ ] Use interviews and voluntarily shared diagnostics to understand behavior; central analytics would be a separate product/privacy decision.
   - [ ] Improve the weakest part of create → trust → export → buy before adding another monetization system.
   - [ ] Maintain dependency/SDK updates, backups/migrations, support, and the annual developer membership. A one-time customer purchase does not eliminate ongoing costs.

**Budget and sequencing**

At a $19.99 price and a 15% commission, the illustrative amount after commission is about **$16.99 per purchase**, before taxes, refunds, support, and other costs. At 30% it is about **$13.99**. One hundred purchases at the 15% assumption produces about **$1,699**, before those other costs. These are arithmetic scenarios, not sales forecasts. The Small Business rate requires eligibility, enrollment, and its effective date. [Apple Small Business Program](https://developer.apple.com/app-store/small-business-program/)

Budget the $99/year Apple account, Mac access if needed, access to test devices, and any selected domain, support, or native-tool costs. Hosting a custom backend is not inherent to the proposed offline iOS launch. Avoid recurring paid purchase/analytics services unless their benefit is worth their cost and data handling.

A planning allowance is **roughly 4–8 focused weeks once Mac/account access is available**, with substantial uncertainty around native integration and issues uncovered in beta; part-time work or learning the store tools can take longer. Scope validation and enrollment can proceed together, followed by packaging/storage/export/purchases, device QA, beta, and submission. This is not a release commitment.

**Later opportunities**

Curated ready-to-plant garden designs, premium presentation tools for designers, or a larger one-time professional edition may be worth testing after customer demand appears. A future recurring service such as cross-device cloud storage would have ongoing costs and needs its own business model; it should not be silently included in a vague lifetime promise. More catalog entries, a full photograph collection, AR, AI, social features, live collaboration, and the remaining renderer refinements are not prerequisites unless a specific defect blocks the advertised workflow.

**If Google Play is also part of the first launch**

- [ ] Add the Android project, signing and Android App Bundle release process; secure the upload key and configure Play App Signing.
- [ ] Register/verify the Play Console account and payments profile. The registration fee is **US $25 once**; new personal accounts also have device verification requirements. [Play Console setup](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)
- [ ] Integrate Google Play Billing for a one-time unlock, including purchase verification, acknowledgment, restore/query-owned-purchases behavior, refunds, and interruptions. Apple's IAP does not implement Android purchases.
- [ ] Complete Data safety, content rating, ads/target-audience/app-access declarations, privacy/support links, store artwork, and release checks. Audit any native libraries for the platform's current compatibility requirements.
- [ ] New apps/updates currently must target **Android 16 / API 36 or higher**, effective August 31, 2026. Recheck at submission. [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- [ ] For personal accounts created after November 13, 2023, run the required closed test with **at least 12 testers continuously opted in for at least 14 days**, then apply for production access. Meeting the duration alone is not production approval. [Google testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [ ] Repeat physical-device, purchase, storage, update, export, accessibility, and performance testing on Android, including its Back behavior and permission flows.

Launching Apple first keeps the initial integration and support scope smaller. Android can follow once the purchase package and customer workflow are validated.
