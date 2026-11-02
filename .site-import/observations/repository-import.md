# Repository source import

Source: https://github.com/Routbe/compass-navigator-a0913aa5.git at d32376a. Owner permission confirmed. Imported source directly, not GitHub’s website; no source website capture exists for visual comparison.

Original database, auth signing keys, payments, email and storage configuration are not imported. SQL retained for review only. Current project Cloud clients and identity preserved.

## Verified
- Managed build: build OK (2026-11-02 11:15:45 UTC).
- Desktop 1280×1800 and phone 390×844: home opens without browser errors or horizontal overflow; URL submission reaches /studio?mode=qr&url=... and visible QR editor renders.
- Both layouts: actual PNG downloads saved, 87,243 bytes each; QR preview is visible. Menu opens with tools/infrastructure and Escape dismisses it. Evidence: controls.json and /tmp/browser/compass-import screenshots.
- 1497 tests passed initially; 7 early route failures disappeared after route generation and passed on rerun. 13 focused QR/parser/routing tests also passed.
- One source test remains failed: src/test/migration-replay.test.ts reports the source schema snapshot is missing agent audit objects. Imported SQL was not changed or applied.
- Every rendered content route has a leaf head definition; imported metadata helpers retained.

## Limits
- Accounts, private Studio editor, dynamic links, payments, email, uploads and remote storage are blocked by the original database and service credentials; not tested as a signed-in user.
- Exhaustive coverage of all 345 routes and secondary popups is not verified. No source website was supplied for paired visual comparison. Source copy, sample content, motion and layouts retained; no static media fallbacks introduced.
