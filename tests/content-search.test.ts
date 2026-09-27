/**
 * Pari AI universal content search — automated tests.
 * Imports from src/lib/contentSearch.ts.
 * Run: npx tsx tests/content-search.test.ts
 */
import assert from 'node:assert/strict';

import {
  normalizeQuery,
  buildVideoSearchUrl,
  buildArticleSearchUrl,
  thumbnailUrlFor,
  isMedicalQuery,
  isAuthorityDomain,
  searchVideos,
  searchArticles,
  clearContentSearchCache,
} from '../src/lib/contentSearch';

const YT_WATCH_RE = /^https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}$/;

async function main() {
  // --- Unit: normalizeQuery ---
  assert.equal(normalizeQuery('  Push   UP  '), 'push up');
  assert.equal(normalizeQuery(''), '');
  assert.ok(normalizeQuery('x'.repeat(200)).length <= 120);

  // --- Unit: URL builders (never fabricated IDs) ---
  assert.equal(
    buildVideoSearchUrl('push up proper form'),
    'https://www.youtube.com/results?search_query=push%20up%20proper%20form'
  );
  assert.equal(
    buildArticleSearchUrl('vitamin D deficiency'),
    'https://duckduckgo.com/?q=vitamin%20d%20deficiency'
  );
  assert.equal(thumbnailUrlFor('dQw4w9WgXcQ'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');

  // --- Unit: medical heuristic ---
  assert.equal(isMedicalQuery('vitamin D deficiency treatment'), true);
  assert.equal(isMedicalQuery('how to fix a leaking tap'), false);
  assert.equal(isMedicalQuery('best budget phones 2026'), false);

  // --- Unit: authority domain detection ---
  assert.equal(isAuthorityDomain('who.int'), true);
  assert.equal(isAuthorityDomain('www.heart.org'), true);
  assert.equal(isAuthorityDomain('professional.heart.org'), true);
  assert.equal(isAuthorityDomain('CDC.GOV'), true);
  assert.equal(isAuthorityDomain('mayoclinic.org'), true);
  assert.equal(isAuthorityDomain('randomblog.com'), false);
  assert.equal(isAuthorityDomain('notcdc.gov.evil.com'), false);
  assert.equal(isAuthorityDomain(''), false);

  // --- Unit: empty query -> honest fallback, never throws ---
  clearContentSearchCache();
  const emptyV = await searchVideos('');
  assert.equal(emptyV.fallback, true);
  assert.ok(emptyV.fallbackUrl?.startsWith('https://www.youtube.com/results?search_query='));
  assert.equal(emptyV.videos.length, 0);
  const emptyA = await searchArticles('   ');
  assert.equal(emptyA.fallback, true);
  assert.ok(emptyA.fallbackUrl?.startsWith('https://duckduckgo.com/?q='));

  // --- Integration: real video search (live network) ---
  clearContentSearchCache();
  const vids = await searchVideos('push up proper form');
  assert.equal(vids.fallback, false, 'expected real video results, got fallback');
  assert.ok(vids.videos.length >= 1, 'expected at least 1 video');
  assert.ok(['yt-dlp', 'scrape'].includes(vids.source), `unexpected source ${vids.source}`);
  for (const v of vids.videos) {
    assert.match(v.url, YT_WATCH_RE, `bad video URL shape: ${v.url}`);
    assert.ok(v.title.length > 0, 'video title must not be empty');
    assert.ok(v.thumbnailUrl.startsWith('https://i.ytimg.com/vi/'));
  }
  console.log('video proof:', vids.source, '->', vids.videos[0].url, '|', vids.videos[0].title);

  // --- Integration: cache hit returns same result without re-search ---
  const vids2 = await searchVideos('push up proper form');
  assert.deepEqual(vids2.videos.map((v) => v.videoId), vids.videos.map((v) => v.videoId));

  // --- Integration: medical article search -> PubMed + authority MIX ---
  // (retried a few times: the sandbox sometimes rate-limits DDG Lite)
  clearContentSearchCache();
  let med = await searchArticles('vitamin D deficiency treatment');
  for (let attempt = 1; attempt < 3 && med.articles.every((a) => a.url.startsWith('https://pubmed.ncbi.nlm.nih.gov/')); attempt++) {
    await new Promise((r) => setTimeout(r, 8000));
    clearContentSearchCache();
    med = await searchArticles('vitamin D deficiency treatment');
  }
  assert.equal(med.fallback, false, 'expected real articles, got fallback');
  assert.ok(med.articles.length >= 2, 'expected a mix of at least 2 articles');
  const PUBMED_PREFIX = 'https://pubmed.ncbi.nlm.nih.gov/';
  const hasPubmed = med.articles.some((a) => a.url.startsWith(PUBMED_PREFIX));
  // A NON-PubMed authority: who.int / cdc.gov / heart.org / nih.gov / mayoclinic.org / ...
  const hasNonPubmedAuthority = med.articles.some(
    (a) => !a.url.startsWith(PUBMED_PREFIX) && isAuthorityDomain(a.domain)
  );
  assert.ok(hasPubmed, 'expected at least one PubMed link in the mix');
  assert.ok(hasNonPubmedAuthority, 'expected at least one non-PubMed WHO/CDC/AHA/NIH/Mayo link in the mix');
  assert.ok(['mixed', 'pubmed', 'duckduckgo'].includes(med.source), `unexpected source ${med.source}`);
  // No fabricated URLs anywhere in the mix.
  for (const a of med.articles) {
    assert.ok(/^https?:\/\//.test(a.url), `bad article URL: ${a.url}`);
    assert.ok(a.title.length > 0);
    assert.ok(a.domain.length > 0);
  }
  // No duplicate URLs in the merged mix.
  const urls = med.articles.map((a) => a.url);
  assert.equal(new Set(urls).size, urls.length, 'duplicate URLs in merged mix');
  console.log('medical mix proof:', med.source);
  for (const a of med.articles) console.log('  -', a.domain, '->', a.url);

  // --- Integration: general article search -> DuckDuckGo ---
  // (retried: the sandbox sometimes rate-limits DDG Lite after the searches above)
  clearContentSearchCache();
  await new Promise((r) => setTimeout(r, 5000));
  let web = await searchArticles('how to fix a leaking tap');
  for (let attempt = 1; attempt < 3 && web.fallback; attempt++) {
    await new Promise((r) => setTimeout(r, 10000));
    clearContentSearchCache();
    web = await searchArticles('how to fix a leaking tap');
  }
  assert.equal(web.fallback, false, 'expected real articles, got fallback');
  assert.equal(web.source, 'duckduckgo', `expected duckduckgo, got ${web.source}`);
  assert.ok(web.articles.length >= 1);
  for (const a of web.articles) {
    assert.ok(/^https?:\/\//.test(a.url), `bad article URL: ${a.url}`);
    assert.ok(!a.url.includes('duckduckgo.com/l/'), 'must be the real destination, not a DDG wrapper');
    assert.ok(a.domain.length > 0);
  }
  console.log('ddg proof:', web.articles[0].url, '|', web.articles[0].title.slice(0, 60));

  console.log('\nAll content-search tests passed.');
}

main().catch((err) => {
  console.error('TEST FAILURE:', err?.message || err);
  process.exit(1);
});
