# DSE Study Library

A responsive HKDSE Biology and Economics question bank that runs entirely in the browser. It includes 2,920 indexed Aristo questions, 1,451 standalone Oxford text questions, 46 Oxford Word bank and update documents, and 3,947 Pearson Economics questions across 35 renamed topic files. The app opens on a navigation hub and supports English and Traditional Chinese, light/dark/system themes, responsive layouts, question filters, saved questions, collections and quizzes. No backend or API key is needed. Personal data stays in the browser; export a backup from **Settings & backup** to move it to another device.

The library supports topic, type, publisher and text filters; personal topic/type changes and tags; saved questions and collections; timed and untimed quizzes; and question papers with original diagrams exported to PDF or Word. Name a paper before exporting; supported browsers can also save it to a chosen folder and filename. Source PDFs and the app's PDF/DOCX tools are included in the published site. Oxford chapter entries covered by a complete update book open its illustrated preview and download that full DOCX. The five native `.docx` files are copied unchanged from the resources folder, with their original download names. The 47 legacy `.doc` originals are preserved in `resources/Oxford DOC backup/`; their paired DOCX text editions now live in `resources/Oxford resource/`. Chapter 1 and elective entries remain text-only until matching full illustrated DOCX files are available. Economics source names use the requested `101.doc` through `715.doc` pattern. The generated Economics DOCX and PDF editions are extracted text editions; the published source folder also includes the untouched `.doc` file so graphs, images and original layout remain available while a desktop Word conversion is unavailable.

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

The Oxford bank was absent from the first app build because its legacy Word sources had not been imported. The Oxford sources are now indexed in-app across Ch1–Ch30 and E1–E4. All 46 documents open in a Word-style preview. The five native `.docx` update books display supported formatting, tables and embedded images, and are linked to chapters Ch2–Ch30 for preview and full-DOCX downloads. Chapter 1 and E1–E4 use text-only editions because no matching full illustrated DOCX is currently available. Preview pagination is approximate; complex Word drawings, equations, and unsupported elements may differ from the downloaded original. The matching `.doc` originals are retained under `resources/Oxford DOC backup/`. The quiz setup lets users choose Oxford, Aristo, or both, along with chapters, question type and a saved/selected question pool. The Oxford quiz index contains 1,451 standalone text questions with answer keys or marking schemes. Items referring to missing figures, equations, labels, or shared passages are excluded. Oxford PDF downloads are text editions without the original diagrams or layout.

## Economics Import

The Economics importer reads `Econ resources/Pearson by topic`, renames source identities by book and chapter (`b1c01` becomes `101.doc`), indexes the extracted questions, and writes the generated assets to `bank/economics/`. Run it from this checkout with the bundled `docx` module when needed:

```powershell
$env:DOCX_MODULE = 'path/to/docx'
npm run convert:economics
node scripts/import-economics.mjs
```

Each Economics source has a generated `.docx` text edition, a browser-generated text PDF option, and a copy of the original `.doc` file under `bank/economics/originals/`. The text editions are marked `wordEdition: "text"` and `mediaPreserved: false` in `bank/economics/index.json`; the original download is the media-preserving source until a Word or LibreOffice conversion can run in an interactive desktop session.

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

The checked-in Oxford previews were generated from the local `resources/Oxford resource` folder. The 47 legacy `.doc` resources have been moved to the sibling `resources/Oxford DOC backup/` folder, retaining their relative paths. Their matching DOCX text editions are now the active Word files in `Oxford resource`; these text editions can omit diagrams, equations, formatting and page breaks. The original `.doc` files are preserved in the backup. `bank/oxford/conversion-manifest.json` maps each DOCX edition to its original source hash so import IDs remain stable after the move. When adding new legacy `.doc` files, run `npm run convert:legacy-doc` (set `DOCX_MODULE` if needed) before `node scripts/import-oxford.mjs`; the importer updates this manifest and regenerates the catalog, text previews, quiz index and published Word downloads. Legacy `.doc` parsing uses the vendored MIT-licensed Word text extractor at `scripts/vendor/word-extractor/`; `.docx` reading uses JSZip and xml-js. The five native `.docx` updates are copied unchanged for download. Run `npm run prepare:word -- "path/to/Oxford resource"` to refresh direct Word assets based on the catalog edition type. Prepared downloads live in `bank/oxford/` so they work on GitHub Pages; deployed browsers do not need access to a local resources folder. Run `npm run index:oxford` to rebuild only the quiz index from the checked-in previews, without Word or additional dependencies.

## Word Previews

After importing or updating Word downloads, regenerate the static formatted previews with `npm run prepare:word-preview`. This preparation command requires Python 3 with `python-docx` and Pillow; it reads the downloadable DOCX files, extracts supported formatting and images, and updates `wordPreviewPath` in the catalog. Commit the generated `bank/oxford/*.preview.json` files and `bank/oxford/preview-media/` together with the catalog. Tests verify that each preview matches its downloadable DOCX and all images exist. The app, GitHub Actions build, and GitHub Pages hosting use these prepared assets and do not require Python or Microsoft Word.

## Browser Tests

Install Playwright with a browser, or point `PLAYWRIGHT_MODULE` to an existing Playwright package. Start the app, then run `npm run test:browser`. Set `BROWSER_CHANNEL=msedge` to use an installed Microsoft Edge and `TEST_URL` to test a different local URL. The test exercises filters, categories, collections, saved state, quizzes, backups, actual PDF/DOCX downloads and phone/tablet layouts. Screenshots and test downloads go to ignored `test-results/`.

Verification covers the existing question flows and the new home hub, Oxford catalog, in-app document previews, bilingual settings, themes, responsive widths and keyboard navigation, publisher-specific quizzes and source PDF downloads. Oxford document assets are inspected for missing files by the unit suite. Legacy Word extraction is text-only and does not include figures; use the preserved originals for figure-dependent questions.

## Data And Publishing

Personal data is local to each browser unless the user downloads and imports a backup. The app has no account sync. A GitHub Pages deployment makes its bundled question sources publicly accessible. Publish source materials only where you have the necessary redistribution rights.
