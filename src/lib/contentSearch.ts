/**
 * Pari AI — universal content search for chat (videos + articles).
 *
 * When the user asks for a video ("show me how to do a push up", "how to fix
 * a leaking tap") or is looking for an article they can't find, Pari AI calls
 * these tools and includes REAL links in her reply.
 *
 * Repo-first, free, no API keys anywhere:
 *  - Videos: open-source `yt-dlp` CLI (tier 1), YouTube search-page scrape
 *    (tier 2, dependency-free), plain YouTube search URL (fallback).
 *  - Articles, medical/health: PubMed E-utilities (free official NCBI API,
 *    no key) PLUS authoritative health sources (WHO, CDC, AHA, NIH,
 *    MedlinePlus, Mayo Clinic, NHS, Cleveland Clinic...) found via a
 *    domain-biased DuckDuckGo Lite search — merged and deduped, so health
 *    answers are never PubMed-only.
 *  - Articles, engineering/CS/physics/math: arXiv API (free official API, no
 *    key) plus Semantic Scholar Graph API (free, no key, rate-limited) —
 *    real research-paper links, merged and deduped.
 *  - Articles, research/academic intent ("paper", "study", "thesis",
 *    "journal"...): Semantic Scholar (free, no key).
 *  - Articles, general: DuckDuckGo Lite HTML endpoint (no key), parsed for
 *    title/URL/snippet; plain duckduckgo.com search link as fallback.
 *
 * Safety rules (never break these):
 *  - NEVER invent/fabricate a URL. A fabricated link is worse than a search
 *    link. Only URLs actually returned by the source are used.
 *  - Never throws: on ANY failure return the honest search-link fallback.
 *
 * Pure module: no Express, no routes. Callers (chat tool-calling) use
 * searchVideos() / searchArticles().
 */

import { execFile } from 'child_process';
import fs from 'fs';
import https from 'https';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const LOOKUP_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const CACHE_MAX_ENTRIES = 300;

const YT_SEARCH_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

interface CacheEntry {
  at: number;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  return null;
}

function cacheSet(key: string, value: unknown): void {
  cache.set(key, { at: Date.now(), value });
  if (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
}

/** Normalize a search query for cache keys and requests. */
export function normalizeQuery(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

/** Extra CA bundle for TLS-intercepting test sandboxes (honest env-based). */
function extraCaBundle(): string | undefined {
  for (const key of ['NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'YT_EXTRA_CA_BUNDLE']) {
    const p = process.env[key];
    if (p && fs.existsSync(p)) return p;
  }
  return undefined;
}

function fetchText(url: string, maxBytes = 8 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const caPath = extraCaBundle();
    const opts: https.RequestOptions = {
      headers: { 'User-Agent': YT_SEARCH_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: LOOKUP_TIMEOUT_MS,
      ...(caPath ? { ca: fs.readFileSync(caPath) } : {}),
    };
    const req = https.get(url, opts, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        body += c;
        if (body.length > maxBytes) {
          res.destroy();
          reject(new Error('Response too large'));
        }
      });
      res.on('end', () => resolve(body));
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Fetch timeout'));
    });
    req.on('error', reject);
  });
}

/** Test/support helper: clear the in-memory cache. */
export function clearContentSearchCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Videos: searchVideos(query)
// ---------------------------------------------------------------------------

export interface ContentVideo {
  videoId: string;
  title: string;
  url: string;
  thumbnailUrl: string;
}

export interface VideoSearchResult {
  ok: boolean;
  videos: ContentVideo[];
  fallback: boolean;
  fallbackUrl: string | null;
  fallbackTitle: string | null;
  query: string;
  source: 'yt-dlp' | 'scrape' | 'fallback';
}

// YouTube video IDs are always 11 chars from this alphabet.
const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const MAX_VIDEO_RESULTS = 3;

export function buildVideoSearchUrl(query: string): string {
  const q = normalizeQuery(query) || 'video';
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export function thumbnailUrlFor(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function videoFallback(query: string): VideoSearchResult {
  const clean = normalizeQuery(query) || 'video';
  return {
    ok: true,
    videos: [],
    fallback: true,
    fallbackUrl: buildVideoSearchUrl(clean),
    fallbackTitle: `YouTube search: ${clean}`,
    query: clean,
    source: 'fallback',
  };
}

/** Tier 1: yt-dlp — best on normal networks. */
function runYtDlp(query: string): Promise<ContentVideo[]> {
  return new Promise((resolve) => {
    const args = [
      `ytsearch${MAX_VIDEO_RESULTS}:${query}`,
      '--print',
      '%(id)s\t%(title)s',
      '--no-playlist',
      '--quiet',
      '--no-warnings',
    ];
    // Escape hatch for TLS-intercepting test sandboxes only.
    if (process.env.YTDLP_NO_CHECK_CERTIFICATES === '1') args.push('--no-check-certificates');
    execFile('yt-dlp', args, { timeout: LOOKUP_TIMEOUT_MS, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve([]);
      const videos: ContentVideo[] = [];
      for (const line of String(stdout || '').split('\n')) {
        const tab = line.indexOf('\t');
        if (tab <= 0) continue;
        const videoId = line.slice(0, tab).trim();
        const title = line.slice(tab + 1).trim();
        if (!VIDEO_ID_RE.test(videoId) || !title) continue;
        videos.push({
          videoId,
          title: title.slice(0, 120),
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnailUrl: thumbnailUrlFor(videoId),
        });
        if (videos.length >= MAX_VIDEO_RESULTS) break;
      }
      resolve(videos);
    });
  });
}

/** Tier 2: YouTube search-page HTML scrape — parses embedded ytInitialData. */
async function scrapeYouTubeSearch(query: string): Promise<ContentVideo[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const html = await fetchText(url);
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return [];
  let data: any;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const sections =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
  const videos: ContentVideo[] = [];
  const seen = new Set<string>();
  for (const s of sections) {
    const items = s?.itemSectionRenderer?.contents || [];
    for (const it of items) {
      const vr = it?.videoRenderer;
      const videoId = vr?.videoId;
      const title = vr?.title?.runs?.[0]?.text;
      if (typeof videoId !== 'string' || !VIDEO_ID_RE.test(videoId)) continue;
      if (typeof title !== 'string' || !title.trim()) continue;
      if (seen.has(videoId)) continue;
      seen.add(videoId);
      videos.push({
        videoId,
        title: title.trim().slice(0, 120),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnailUrl: thumbnailUrlFor(videoId),
      });
      if (videos.length >= MAX_VIDEO_RESULTS) return videos;
    }
  }
  return videos;
}

/**
 * Search YouTube for videos about anything ("push up proper form",
 * "how to fix a leaking tap"). Never throws.
 */
export async function searchVideos(rawQuery: string): Promise<VideoSearchResult> {
  const query = normalizeQuery(rawQuery);
  if (!query) return videoFallback('video');

  const key = `v:${query}`;
  const hit = cacheGet<VideoSearchResult>(key);
  if (hit) return hit;

  let result: VideoSearchResult;
  try {
    const viaYtDlp = await runYtDlp(query);
    if (viaYtDlp.length > 0) {
      result = { ok: true, videos: viaYtDlp, fallback: false, fallbackUrl: null, fallbackTitle: null, query, source: 'yt-dlp' };
    } else {
      const viaScrape = await scrapeYouTubeSearch(query).catch(() => [] as ContentVideo[]);
      result = viaScrape.length > 0
        ? { ok: true, videos: viaScrape, fallback: false, fallbackUrl: null, fallbackTitle: null, query, source: 'scrape' }
        : videoFallback(query);
    }
  } catch {
    result = videoFallback(query);
  }
  cacheSet(key, result);
  return result;
}

// ---------------------------------------------------------------------------
// Articles: searchArticles(query)
// ---------------------------------------------------------------------------

export interface ContentArticle {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  /** Which source produced this article: pubmed (medical), arxiv or
   *  semanticscholar (academic), web (general DDG results). */
  source: 'pubmed' | 'web' | 'arxiv' | 'semanticscholar';
}

export interface ArticleSearchResult {
  ok: boolean;
  articles: ContentArticle[];
  fallback: boolean;
  fallbackUrl: string | null;
  fallbackTitle: string | null;
  query: string;
  source: 'pubmed' | 'duckduckgo' | 'arxiv' | 'semanticscholar' | 'mixed' | 'fallback';
}

const MAX_ARTICLE_RESULTS = 5;
const MAX_AUTHORITY_RESULTS = 3;

// Authoritative health sources Mohsin explicitly expects for medical queries:
// WHO, CDC, AHA, NIH (+ institutes), MedlinePlus, Mayo Clinic, NHS,
// Cleveland Clinic, Harvard Health, Johns Hopkins.
const AUTHORITY_DOMAINS = [
  'who.int',
  'cdc.gov',
  'heart.org',
  'nih.gov',
  'medlineplus.gov',
  'mayoclinic.org',
  'nhs.uk',
  'clevelandclinic.org',
  'health.harvard.edu',
  'hopkinsmedicine.org',
];

/** True when the domain is (or is a subdomain of) a known health authority. */
export function isAuthorityDomain(domain: string): boolean {
  const d = String(domain || '').toLowerCase().trim();
  if (!d) return false;
  return AUTHORITY_DOMAINS.some((a) => d === a || d.endsWith(`.${a}`));
}

// Heuristic: queries containing these go to PubMed (free official API) first.
const MEDICAL_KEYWORDS = [
  'vitamin', 'deficiency', 'disease', 'symptom', 'symptoms', 'diagnosis', 'treatment',
  'therapy', 'dosage', 'dose', 'medicine', 'medication', 'drug', 'infection', 'cancer',
  'diabetes', 'blood pressure', 'cholesterol', 'heart', 'pregnancy', 'nutrition',
  'supplement', 'antibiotic', 'vaccine', 'syndrome', 'disorder', 'chronic', 'acute',
  'clinical', 'medical', 'health', 'doctor', 'hospital', 'surgery', 'pain',
];

export function isMedicalQuery(query: string): boolean {
  const q = ` ${normalizeQuery(query)} `;
  return MEDICAL_KEYWORDS.some((k) => q.includes(k));
}

export function buildArticleSearchUrl(query: string): string {
  const q = normalizeQuery(query) || 'articles';
  return `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
}

function articleFallback(query: string): ArticleSearchResult {
  const clean = normalizeQuery(query) || 'articles';
  return {
    ok: true,
    articles: [],
    fallback: true,
    fallbackUrl: buildArticleSearchUrl(clean),
    fallbackTitle: `DuckDuckGo search: ${clean}`,
    query: clean,
    source: 'fallback',
  };
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** PubMed E-utilities: esearch -> esummary. Free official NCBI API, no key. */
async function searchPubMed(query: string): Promise<ContentArticle[]> {
  const searchUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi` +
    `?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${MAX_ARTICLE_RESULTS}`;
  const searchBody = await fetchText(searchUrl, 512 * 1024);
  const searchJson = JSON.parse(searchBody);
  const ids: string[] = searchJson?.esearchresult?.idlist || [];
  if (ids.length === 0) return [];

  const summaryUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi` +
    `?db=pubmed&id=${ids.join(',')}&retmode=json`;
  const summaryBody = await fetchText(summaryUrl, 1024 * 1024);
  const summaryJson = JSON.parse(summaryBody);
  const result = summaryJson?.result || {};
  const articles: ContentArticle[] = [];
  for (const id of ids) {
    const rec = result[id];
    if (!rec?.title) continue;
    const title = String(rec.title).replace(/\.$/, '').trim().slice(0, 160) || 'Untitled';
    const meta = [rec.source, rec.pubdate].filter(Boolean).join(' · ');
    articles.push({
      title,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      domain: 'pubmed.ncbi.nlm.nih.gov',
      snippet: meta.slice(0, 160),
      source: 'pubmed',
    });
  }
  return articles;
}

/** DuckDuckGo Lite HTML endpoint: parse result links + titles + snippets. */
async function searchDuckDuckGo(query: string, maxResults: number = MAX_ARTICLE_RESULTS): Promise<ContentArticle[]> {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(url);
  const articles: ContentArticle[] = [];
  const seen = new Set<string>();
  const re = /<a rel="nofollow" href="\/\/duckduckgo\.com\/l\/\?uddg=([^"&']+)[^>]*class='result-link'>(.*?)<\/a>/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && articles.length < maxResults) {
    let dest: string;
    try {
      dest = decodeURIComponent(m[1].replace(/&amp;/g, '&'));
    } catch {
      continue;
    }
    if (!/^https?:\/\//i.test(dest)) continue;
    // Skip DDG's own redirect wrappers and ad-like junk.
    if (dest.includes('duckduckgo.com')) continue;
    if (seen.has(dest)) continue;
    seen.add(dest);
    const title = m[2]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .trim()
      .slice(0, 160);
    if (!title) continue;
    // Snippet lives in the following result-snippet cell.
    const tail = html.slice(m.index + m[0].length, m.index + m[0].length + 900);
    const sn = tail.match(/class='result-snippet'>(.*?)<\/td>/s);
    const snippet = sn
      ? sn[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim().slice(0, 200)
      : '';
    articles.push({ title, url: dest, domain: domainOf(dest), snippet, source: 'web' });
  }
  return articles;
}

/**
 * Authoritative health sources for medical queries: a DuckDuckGo Lite search
 * biased toward WHO/CDC/AHA/NIH/Mayo/etc. via site: operators, then strictly
 * filtered to authority domains only (in case the operator isn't honored).
 * Returns real parsed results only — never fabricated URLs.
 */
async function searchAuthorityHealth(query: string): Promise<ContentArticle[]> {
  const biased =
    `${query} ` + AUTHORITY_DOMAINS.slice(0, 6).map((d) => `site:${d}`).join(' OR ');
  const raw = await searchDuckDuckGo(biased, 10);
  const articles: ContentArticle[] = [];
  const seen = new Set<string>();
  for (const a of raw) {
    if (!isAuthorityDomain(a.domain)) continue;
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    articles.push(a);
    if (articles.length >= MAX_AUTHORITY_RESULTS) break;
  }
  return articles;
}

// ---------------------------------------------------------------------------
// Academic sources: arXiv + Semantic Scholar (free, no keys)
// ---------------------------------------------------------------------------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Field routing: queries with these signals go to arXiv (+ Semantic Scholar). */
const TECHNICAL_KEYWORDS = [
  'algorithm', 'algorithms', 'neural network', 'neural networks', 'machine learning',
  'deep learning', 'transformer', 'transformers', 'attention mechanism', 'llm',
  'quantum', 'quantum computing', 'qubit', 'superconduct', 'semiconductor',
  'microchip', 'vlsi', 'circuit', 'circuits', 'robotics', 'robot', 'control theory',
  'signal processing', 'thermodynamics', 'fluid dynamics', 'electromagnetic',
  'electromagnetism', 'astrophysics', 'particle physics', 'relativity',
  'black hole', 'cosmology', 'string theory', 'engineering', 'aerospace',
  'mechanical', 'civil engineering', 'cryptography', 'blockchain', 'compiler',
  'operating system', 'distributed systems', 'database', 'computer vision',
  'natural language processing', 'nlp', 'reinforcement learning', 'generative ai',
  'artificial intelligence', 'ai model', 'optimization', 'graph theory',
  'topology', 'differential equation', 'linear algebra', 'calculus', 'mathematics',
  'physics', 'computer science', 'software architecture', 'kernel', 'embedded',
  'nanotechnology', 'photonics', 'laser', 'plasma physics', 'nuclear',
];

/** Research/academic intent: "paper", "study", "thesis", ... */
const RESEARCH_INTENT_KEYWORDS = [
  'research', 'paper', 'papers', 'study', 'studies', 'thesis', 'dissertation',
  'journal', 'journals', 'survey', 'survey paper', 'literature review', 'publication',
  'academic', 'scholar', 'arxiv', 'peer reviewed', 'peer-review', 'experiment',
  'findings', 'meta analysis', 'meta-analysis', 'whitepaper', 'preprint',
];

function keywordRegex(words: string[]): RegExp {
  return new RegExp(`\\b(${words.map(escapeRegExp).join('|')})\\b`, 'i');
}

const TECHNICAL_RE = keywordRegex(TECHNICAL_KEYWORDS);
const RESEARCH_INTENT_RE = keywordRegex(RESEARCH_INTENT_KEYWORDS);

/** True for CS/engineering/physics/math-flavored queries. */
export function isTechnicalQuery(query: string): boolean {
  return TECHNICAL_RE.test(normalizeQuery(query));
}

/** True when the user is looking for research papers/studies. */
export function isResearchIntent(query: string): boolean {
  return RESEARCH_INTENT_RE.test(normalizeQuery(query));
}

/** Decode XML/HTML entities (arXiv titles/authors carry these). */
function decodeEntities(text: string): string {
  return String(text || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; }
    })
    .replace(/&#(\d+);/g, (_, d) => {
      try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ''; }
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Respect provider rate guidance: arXiv asks ≤1 request / 3s; Semantic Scholar
// is fine around ~1 req/sec unauthenticated. The 24h cache covers repeats.
async function throttle(lastRef: { t: number }, minGapMs: number): Promise<void> {
  const wait = minGapMs - (Date.now() - lastRef.t);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
const arxivClock = { t: 0 };
const s2Clock = { t: 0 };

const MAX_ACADEMIC_RESULTS = 3;

/**
 * arXiv API (free official, no key): Atom XML -> title + canonical abs link.
 * Only URLs actually returned by arXiv are used; the version suffix (v2) is
 * stripped for the canonical link.
 */
async function searchArxiv(query: string): Promise<ContentArticle[]> {
  await throttle(arxivClock, 3000);
  arxivClock.t = Date.now();
  const url =
    `https://export.arxiv.org/api/query` +
    `?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${MAX_ACADEMIC_RESULTS}` +
    `&sortBy=relevance&sortOrder=descending`;
  const xml = await fetchText(url, 1024 * 1024);
  const articles: ContentArticle[] = [];
  const seen = new Set<string>();
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let em: RegExpExecArray | null;
  while ((em = entryRe.exec(xml)) !== null && articles.length < MAX_ACADEMIC_RESULTS) {
    const entry = em[1];
    const idm = entry.match(/<id>\s*https?:\/\/arxiv\.org\/abs\/([^\s<]+)\s*<\/id>/);
    if (!idm) continue;
    const baseId = idm[1].replace(/v\d+$/, ''); // canonical link, version stripped
    const link = `https://arxiv.org/abs/${baseId}`;
    if (seen.has(link)) continue;
    seen.add(link);
    const tm = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    const title = decodeEntities(tm ? tm[1] : '').slice(0, 160) || 'Untitled arXiv paper';
    const authors = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)]
      .map((a) => decodeEntities(a[1]))
      .filter(Boolean);
    const pm = entry.match(/<published>(\d{4}-\d{2}-\d{2})/);
    const who = authors.length > 0
      ? `${authors.slice(0, 2).join(', ')}${authors.length > 2 ? ' et al.' : ''}`
      : '';
    const when = pm ? pm[1].slice(0, 4) : '';
    const snippet = [who, when].filter(Boolean).join(' · ').slice(0, 160);
    articles.push({ title, url: link, domain: 'arxiv.org', snippet, source: 'arxiv' });
  }
  return articles;
}

/**
 * Semantic Scholar Graph API (free, no key at low rate). 429 (rate-limited)
 * throws here and is swallowed by the caller -> falls back to the other
 * sources; never surfaces to the user.
 */
async function searchSemanticScholar(query: string): Promise<ContentArticle[]> {
  await throttle(s2Clock, 1100);
  s2Clock.t = Date.now();
  const url =
    `https://api.semanticscholar.org/graph/v1/paper/search` +
    `?query=${encodeURIComponent(query)}&limit=${MAX_ACADEMIC_RESULTS}` +
    `&fields=title,url,abstract,venue,year,paperId`;
  const body = await fetchText(url, 512 * 1024); // rejects on non-200 incl. 429
  const json = JSON.parse(body);
  const papers: any[] = json?.data || [];
  const articles: ContentArticle[] = [];
  const seen = new Set<string>();
  for (const p of papers) {
    if (!p?.title) continue;
    // Prefer the publisher URL from the API; otherwise the canonical S2 page
    // derived from the API's own paperId (documented link pattern).
    const link =
      (typeof p.url === 'string' && /^https?:\/\//.test(p.url) && p.url) ||
      (typeof p.paperId === 'string' && p.paperId.length > 0
        ? `https://www.semanticscholar.org/paper/${p.paperId}`
        : '');
    if (!link || seen.has(link)) continue;
    seen.add(link);
    const meta = [p.venue, p.year].filter(Boolean).join(' · ');
    const snippet = (typeof p.abstract === 'string' && p.abstract.trim()
      ? p.abstract.trim().slice(0, 200)
      : meta).slice(0, 200);
    articles.push({
      title: String(p.title).trim().slice(0, 160),
      url: link,
      domain: domainOf(link),
      snippet,
      source: 'semanticscholar',
    });
    if (articles.length >= MAX_ACADEMIC_RESULTS) break;
  }
  return articles;
}

/** Merge academic lists, dedupe by URL, cap the total. */
function mergeArticles(lists: ContentArticle[][], cap: number): ContentArticle[] {
  const out: ContentArticle[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const a of list) {
      if (seen.has(a.url)) continue;
      seen.add(a.url);
      out.push(a);
      if (out.length >= cap) return out;
    }
  }
  return out;
}

/**
 * Search the web for articles about anything. Field-routed, all free/keyless:
 *  - Medical/health -> PubMed (official API) + authoritative health sources
 *    (WHO, CDC, AHA, NIH, Mayo, ...) merged and deduped — never PubMed-only.
 *  - Engineering/CS/physics/math -> arXiv + Semantic Scholar merged.
 *  - Research/academic intent ("paper", "study", "thesis") -> Semantic Scholar.
 *  - Everything else -> DuckDuckGo.
 * Never throws — worst case returns a search link. Never fabricates URLs.
 */
export async function searchArticles(rawQuery: string): Promise<ArticleSearchResult> {
  const query = normalizeQuery(rawQuery);
  if (!query) return articleFallback('articles');

  const key = `a:${query}`;
  const hit = cacheGet<ArticleSearchResult>(key);
  if (hit) return hit;

  let result: ArticleSearchResult;
  try {
    let articles: ContentArticle[] = [];
    let source: ArticleSearchResult['source'] = 'duckduckgo';

    if (isMedicalQuery(query)) {
      // Run both in parallel; merge PubMed + authority results, dedupe by URL.
      const [pubmed, authority] = await Promise.all([
        searchPubMed(query).catch(() => [] as ContentArticle[]),
        searchAuthorityHealth(query).catch(() => [] as ContentArticle[]),
      ]);
      articles = mergeArticles([pubmed.slice(0, 3), authority], MAX_ARTICLE_RESULTS);
      if (articles.length > 0) {
        source = pubmed.length > 0 && authority.length > 0 ? 'mixed'
          : pubmed.length > 0 ? 'pubmed'
          : 'duckduckgo';
      } else {
        // Both empty: one unbiased general pass before giving up.
        articles = await searchDuckDuckGo(query).catch(() => [] as ContentArticle[]);
      }
    } else if (isTechnicalQuery(query)) {
      // arXiv primary, Semantic Scholar as backup; merged and deduped.
      const [arxiv, s2] = await Promise.all([
        searchArxiv(query).catch(() => [] as ContentArticle[]),
        searchSemanticScholar(query).catch(() => [] as ContentArticle[]),
      ]);
      articles = mergeArticles([arxiv, s2], MAX_ARTICLE_RESULTS);
      if (articles.length > 0) {
        source = arxiv.length > 0 && s2.length > 0 ? 'mixed'
          : arxiv.length > 0 ? 'arxiv'
          : 'semanticscholar';
      } else {
        // Academic sources empty: one unbiased general pass before giving up.
        articles = await searchDuckDuckGo(query).catch(() => [] as ContentArticle[]);
      }
    } else if (isResearchIntent(query)) {
      const s2 = await searchSemanticScholar(query).catch(() => [] as ContentArticle[]);
      articles = mergeArticles([s2], MAX_ARTICLE_RESULTS);
      if (articles.length > 0) {
        source = 'semanticscholar';
      } else {
        // S2 empty/rate-limited: one unbiased general pass before giving up.
        articles = await searchDuckDuckGo(query).catch(() => [] as ContentArticle[]);
      }
    } else {
      articles = await searchDuckDuckGo(query).catch(() => [] as ContentArticle[]);
    }

    result = articles.length > 0
      ? { ok: true, articles, fallback: false, fallbackUrl: null, fallbackTitle: null, query, source }
      : articleFallback(query);
  } catch {
    result = articleFallback(query);
  }
  cacheSet(key, result);
  return result;
}
