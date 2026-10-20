# Biology Bank

A responsive HKDSE Biology question bank that runs entirely in the browser. It includes 2,920 indexed questions from 175 PDF sources and requires no backend or API key. Bookmarks, custom categories, collections, quizzes and quiz history are stored in the user's browser. Use **Settings & backup** to move personal data to another device.

The library supports topic, type, publisher and text filters; personal topic/type changes and tags; saved questions and collections; timed and untimed quizzes; and question papers with original diagrams exported to PDF or Word. Name a paper before exporting; browsers that support the file picker can also save it to a chosen folder and filename. Other browsers use their normal download location. Source PDFs and the app's PDF/DOCX tools are included in the published site. The prepared source bank is about 97 MB. Original materials under `resources/` stay out of Git.

## Open it locally

Install Node.js 20 or later, then run:

```sh
npm run dev
```

Open the URL printed by the development server. `npm run check` checks JavaScript syntax and `npm test` runs the question-bank and feature tests. No package installation or build is needed to use the app.

## Publish on GitHub Pages

Push this folder to a GitHub repository, then open **Settings > Pages** and select **GitHub Actions** as the build source. The workflow runs the checks, builds `dist/`, and deploys it to Pages. Push to `main` or `master`. App assets and PDFs use relative URLs and work beneath the repository subpath.

The workflow publishes only the site, vendor libraries and `bank/`. It excludes the original `resources/`, extracted ZIP contents, tests and source-conversion tools. Keep `.github/`, `bank/`, `vendor/` and the root app files in your repository. GitHub Pages also supports deploying the root files directly from a branch.

## Current Source Coverage

All 130 supplied Aristo question-bank PDFs are indexed, together with 28 integrated questions from two additional PDFs. The remaining 43 chapter-test PDFs are available as complete papers in **Source documents**. They do not have reliable question-boundary markers and are excluded from individual-question quizzes.

Oxford legacy Word banks, Oxford updates and archived Aristo Word banks are not converted yet. Microsoft Word automation failed in this environment with a Windows logon-session error; attempts to access the desktop session also timed out in automatic approval review. The original documents are preserved under `resources/`.

## Prepare An Updated Bank

Place source PDFs and archives in `resources/`, then run the commands below. The preparation script also finds an existing `resources/` folder beside this checkout, or accepts an explicit `-ResourcePath`.

```powershell
pwsh -NoProfile -File scripts/prepare-sources.ps1 -SkipWord
$env:CANVAS_MODULE = 'path/to/@napi-rs/canvas/index.js'
node scripts/index-bank.mjs
```

`@napi-rs/canvas` provides the PDF.js geometry polyfills used during indexing. The bundled web dependencies are already present; `scripts/vendor.mjs` can recreate them from installed packages. Neither dependency installation nor indexing is needed for deployment of the prepared bank.

On an interactive Windows desktop with Microsoft Word, omit `-SkipWord` to convert Word files to PDFs. Originals are opened read-only and macros are disabled. Converted documents without supported question markers remain accessible as full source documents. Conversion to PDF does not itself guarantee individual-question indexing. After changing the bank, rerun `npm test` and inspect the source crops before publishing.

## Browser Tests

Install Playwright with a browser, or point `PLAYWRIGHT_MODULE` to an existing Playwright package. Start the app, then run `npm run test:browser`. Set `BROWSER_CHANNEL=msedge` to use an installed Microsoft Edge and `TEST_URL` to test a different local URL. The test exercises filters, categories, collections, saved state, quizzes, backups, actual PDF/DOCX downloads and phone/tablet layouts. Screenshots and test downloads go to ignored `test-results/`.

Verification completed in Microsoft Edge at desktop and 375, 390, 768 and 1024 pixel widths, both at the site root and beneath a project subpath. The browser suite also covers written responses, topic selection, timer expiry, unavailable browser storage, save-picker cancellation and keyboard access. All eight unit tests and the static build pass. A sample PDF was rendered and visually inspected on every page; the sample DOCX opens structurally with all images, but its visual layout could not be rendered here because LibreOffice is unavailable and Word automation fails. Question crops are extracted from source geometry; the entire bank has structural validation, with representative visual checks rather than manual review of every question.

## Data And Publishing

Personal data is local to each browser unless the user downloads and imports a backup. The app has no account sync. A GitHub Pages deployment makes its bundled question sources publicly accessible. Publish source materials only where you have the necessary redistribution rights.
