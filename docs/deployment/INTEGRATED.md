# Integrated source deployment — 2026-10-03

The authoritative master remains the supplied integrated SQLite file. Only its public event export is stored here. Do not publish the compressed research originals, review queue, or master database as a browser asset.

## Rebuild

1. `python3 scripts/export-integrated.py /path/to/master data/integrated/events.web.json.gz`
2. `npm run publish:integrated` (requires current packets; preserves all existing leader records).
3. `npm test` and `python3 -m unittest discover -s tests -p 'test_*.py'`
4. `npm run build`.

`source-pack/manifest.json` restores six source files before the build. Edits to those targets must be mirrored in their gzip/base64 source capsules and hashes. The display patch is idempotent and covered by a regression test.

## Contract

- `date`/`date_label` preserve the historical source wording and precision. `timeline_date` is a placement/search interval only, not an independently verified historical date.
- Three Hijri labels use the master's explicit western year bounds rather than treating their source calendar numerals as CE years. The master itself was not changed.
- A decade remains a ten-year range. Uncertain dates do not enter exact-day comparisons.
- `map_status=unresolved` is authoritative: no coordinate, country or continent fallback. Null coordinates clear the previous marker without disabling the map.
- Existing inherited coordinates keep their unverified status. No additional geocoding was undertaken for this deployment.
- The four display regions remain unchanged. 89 unclassified events are available through the footer button and search.
- All 38,920 event IDs are retained. Existing 6,338 leader records are preserved without modification. Unique source URLs are exported; cautions are available in a collapsed detail block.
- Shared references are used across zoom indexes instead of copying event objects repeatedly.
- The source master SHA-256 and public event/leader content hashes are in `integrated-release.json`.

The full knowledge-graph exploration/series UI is not part of this deployment; no historical data completeness claim is implied by passing software tests.
