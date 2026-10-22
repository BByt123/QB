# Biology Bank

A responsive HKDSE Biology question bank that runs entirely in the browser. It includes 2,920 indexed Aristo questions, 1,451 standalone Oxford text questions, 46 Oxford Word bank and update documents, and a 34-part Oxford chapter index (Ch1–Ch30, E1–E4). The app opens on a navigation hub and supports English and Traditional Chinese, light/dark/system themes, responsive layouts, question filters, saved questions, collections and quizzes. No backend or API key is needed. Personal data stays in the browser; export a backup from **Settings & backup** to move it to another device.

The library supports topic, type, publisher and text filters; personal topic/type changes and tags; saved questions and collections; timed and untimed quizzes; and question papers with original diagrams exported to PDF or Word. Name a paper before exporting; supported browsers can also save it to a chosen folder and filename. Source PDFs and the app's PDF/DOCX tools are included in the published site. Oxford legacy `.doc` files have in-app text previews, text downloads and downloadable PDF text editions; diagrams and original formatting in those older files are not included in the web edition. The five `.docx` update files are included as original downloads. Original materials under `resources/` stay out of Git.

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

The Oxford bank was absent from the first app build because its legacy Word sources had not been imported. The Oxford sources are now indexed in-app across Ch1–Ch30 and E1–E4. The `.doc` banks are text previews rather than layout-faithful documents; their original embedded diagrams remain in the local originals under `resources/`. The five `.docx` updates have text previews and original-file downloads. The quiz setup lets users choose Oxford, Aristo, or both, along with chapters, question type and a saved/selected question pool. The Oxford quiz index contains 1,451 standalone text questions with answer keys or marking schemes. Items referring to missing figures, equations, labels, or shared passages are excluded. Oxford PDF downloads are text editions without the original diagrams or layout.

## Prepare An Updated Bank

Place source PDFs and archives in `resources/`, then run the commands below. The preparation script also finds an existing `resources/` folder beside this checkout, or accepts an explicit `-ResourcePath`.

```powershell
pwsh -NoProfile -File scripts/prepare-sources.ps1 -SkipWord
$env:CANVAS_MODULE = 'path/to/@napi-rs/canvas/index.js'
node scripts/index-bank.mjs
```

`@napi-rs/canvas` provides the PDF.js geometry polyfills used during indexing. The bundled web dependencies are already present; `scripts/vendor.mjs` can recreate them from installed packages. Neither dependency installation nor indexing is needed for deployment of the prepared bank.

On an interactive Windows desktop with Microsoft Word, omit `-SkipWord` to convert Word files to PDFs. Originals are opened read-only and macros are disabled. Converted documents without supported question markers remain accessible as full source documents. Conversion to PDF does not itself guarantee individual-question indexing. After changing the bank, rerun `npm test` and inspect the source crops before publishing.

## Oxford Import

The checked-in Oxford previews were generated from the local `resources/Oxford resource` folder. With the Node dependencies used by the import script available, rerun `node scripts/import-oxford.mjs` from this folder to regenerate the catalog and text previews. Legacy `.doc` parsing uses the vendored MIT-licensed Word text extractor at `scripts/vendor/word-extractor/`; `.docx` reading uses JSZip and xml-js. Original legacy `.doc` files are not copied into the Pages bundle. `.docx` update files are copied for download. Run `npm run index:oxford` to rebuild only the quiz index from the checked-in previews, without Word or additional dependencies.

## Browser Tests

Install Playwright with a browser, or point `PLAYWRIGHT_MODULE` to an existing Playwright package. Start the app, then run `npm run test:browser`. Set `BROWSER_CHANNEL=msedge` to use an installed Microsoft Edge and `TEST_URL` to test a different local URL. The test exercises filters, categories, collections, saved state, quizzes, backups, actual PDF/DOCX downloads and phone/tablet layouts. Screenshots and test downloads go to ignored `test-results/`.

Verification covers the existing question flows and the new home hub, Oxford catalog, in-app document previews, bilingual settings, themes, responsive widths and keyboard navigation, publisher-specific quizzes and source PDF downloads. Oxford document assets are inspected for missing files by the unit suite. Legacy Word extraction is text-only and does not include figures; use the preserved originals for figure-dependent questions.

## Data And Publishing

Personal data is local to each browser unless the user downloads and imports a backup. The app has no account sync. A GitHub Pages deployment makes its bundled question sources publicly accessible. Publish source materials only where you have the necessary redistribution rights.
