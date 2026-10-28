# SameTimeWorld

Public deployment files only. Readable development sources and debugging maps are kept outside this repository.
The current release runs entirely on GitHub Pages with verified public data packets. Search, timeline, leaders and series run in the browser.
Previous public commit history is retained; old source is not erased.

## Multilingual search metadata

The existing app accepts `?lang=ko`, `?lang=en`, `?lang=ja`, and `?lang=zh`.
Its runtime updates the document language and visible UI. Search discovery uses
ordinary language links, reciprocal hreflang annotations and `site/sitemap.xml`.
The PC language URLs are the canonical search URLs; mobile remains available.
A separate content-hashed metadata asset follows the app's document language
without changing language preferences, app navigation, data packets or bundles.
Titles, descriptions and canonical links are localized after JavaScript runs.
The initial static HTML remains Korean; non-rendering crawlers do not receive
fully localized HTML. This is not a prerendered event-page implementation.

Deployment must retain these HTML additions, the metadata asset, sitemap and
the sitemap allowlist entry. Regenerate the affected `release.json` file sizes
and SHA-256 hashes on every release; never bypass the protected-release checks.
The private release generator must incorporate these changes to prevent the
next generated release from overwriting them.

Submit `https://yataje.github.io/sametimeworld/sitemap.xml` in Search Console
after deployment. Inspect all four language URLs using both URL Inspection and
its live rendered-HTML test; check selected canonical, indexing and blocked
resources. Search-result absence alone does not prove that a URL is unindexed.
No `site/robots.txt` is provided because robots rules apply at the host root
(`https://yataje.github.io/robots.txt`), not a project subdirectory.

Validation (2026-10-29): the existing live app changed language and navigation
for all four explicit language URLs. The patch passed eight DOM metadata cases
(PC/mobile × four languages), including the app's late title reset; sitemap
reciprocity, script SRI and the protected-release validator also passed.
These checks do not establish Google/Bing/Naver/Baidu indexing or rankings.
