/**
 * Pari AI — REAL file generation. No stubs, no fake downloads.
 *
 * Routes accept {title, ...content}; a Gemini draft pass (paid by the USER's
 * own key) produces the content JSON, then a free/MIT npm lib builds the
 * actual binary: pptxgenjs (PPTX), docx (DOCX), pdfkit (PDF), epub-gen
 * (EPUB), exceljs (XLSX).
 *
 * Books are MANUSCRIPT ONLY: chapter-by-chapter text generation with an
 * honest "Manuscript — not a publish-ready illustrated book" label on the
 * title page. We never claim illustrated/publish-ready output.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import pptxgen from 'pptxgenjs';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import EPub from 'epub-gen';
import { resolveDataPath } from './runtimePaths';
import { generateTextWithUserKey, extractJsonPayload, pariLoad, pariSave, pariId } from './pariStore';

export const MANUSCRIPT_NOTICE =
  'Manuscript — not a publish-ready illustrated book. Generated with Pari AI as a drafting aid; edit, illustrate, and design before publishing.';

export type PariFileKind =
  | 'pptx'
  | 'docx'
  | 'pdf'
  | 'epub'
  | 'xlsx'
  | 'png'
  | 'jpg'
  | 'jpeg'
  | 'webp'
  | 'gif'
  | 'txt'
  | 'md'
  | 'csv';

export interface PariFileMeta {
  id: string;
  userId: string;
  filename: string;
  mimeType: string;
  size: number;
  kind: PariFileKind;
  createdAt: string;
}

const META_FILE = 'client_files.json';

function loadMeta(): PariFileMeta[] {
  return pariLoad<PariFileMeta[]>(META_FILE, []);
}

function saveMeta(metas: PariFileMeta[]): void {
  pariSave(META_FILE, metas);
}

function safeUserDir(userId: string): string {
  const clean = (userId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'unknown';
  return resolveDataPath('hoorvia_platform', 'pari_user_files', clean);
}

function slugify(title: string): string {
  return (
    (title || 'pari-file')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'pari-file'
  );
}

/** Public: sanitize a client-supplied filename stem (never trust it for paths). */
export function slugifyFilenameStem(stem: string): string {
  return slugify(stem);
}

/** Persist a generated binary under the user's own folder. */
export function saveUserFile(
  userId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string,
  kind: PariFileKind
): PariFileMeta {
  const dir = safeUserDir(userId);
  fs.mkdirSync(dir, { recursive: true });
  const absPath = path.join(dir, filename);
  fs.writeFileSync(absPath, buffer);
  const meta: PariFileMeta = {
    id: pariId('file'),
    userId,
    filename,
    mimeType,
    size: buffer.length,
    kind,
    createdAt: new Date().toISOString(),
  };
  const metas = loadMeta();
  metas.push(meta);
  saveMeta(metas);
  return meta;
}

/** Fetch a file only if it belongs to the requesting user. */
export function getUserFile(userId: string, fileId: string): { meta: PariFileMeta; absPath: string } | null {
  const meta = loadMeta().find((m) => m.id === fileId && m.userId === userId);
  if (!meta) return null;
  const absPath = path.join(safeUserDir(userId), meta.filename);
  if (!fs.existsSync(absPath)) return null;
  return { meta, absPath };
}

/** List all files owned by a user, newest first. */
export function listUserFiles(userId: string): PariFileMeta[] {
  return loadMeta()
    .filter((m) => m.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// ---------------------------------------------------------------------------
// Gemini draft passes (user's key pays for the content)
// ---------------------------------------------------------------------------

async function draftJson<T>(apiKey: string, model: string, system: string, prompt: string): Promise<T | null> {
  const text = await generateTextWithUserKey(apiKey, model, prompt, system);
  if (!text) return null;
  const parsed = extractJsonPayload(text);
  return (parsed as T) || null;
}

interface SlideDraft {
  title: string;
  bullets: string[];
}

async function draftSlides(apiKey: string, model: string, topic: string, slideCount: number): Promise<SlideDraft[] | null> {
  const n = Math.min(Math.max(slideCount || 8, 3), 20);
  const parsed = await draftJson<{ slides: SlideDraft[] }>(
    apiKey,
    model,
    'You are a presentation outliner. Output ONLY a JSON object {"slides":[{"title":string,"bullets":[string,...]}]} with no prose or fences.',
    `Create a ${n}-slide presentation outline about: ${JSON.stringify(topic)}. Each slide: short title, 3-6 crisp bullets.`
  );
  if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length === 0) return null;
  return parsed.slides.slice(0, 20).map((s) => ({
    title: String(s.title || 'Slide').slice(0, 120),
    bullets: Array.isArray(s.bullets) ? s.bullets.map((b) => String(b).slice(0, 300)).slice(0, 8) : [],
  }));
}

async function draftChapterBody(
  apiKey: string,
  model: string,
  bookTitle: string,
  chapterHeading: string,
  brief: string
): Promise<string> {
  const text = await generateTextWithUserKey(
    apiKey,
    model,
    `Write the full text of the chapter "${chapterHeading}" for the book manuscript "${bookTitle}". Brief/outline: ${JSON.stringify(
      brief || 'Expand this chapter naturally.'
    )}\n\nWrite up to ~700 words of clean manuscript prose, in paragraphs separated by blank lines. No chapter heading repetition, no meta commentary.`,
    'You are a ghostwriter drafting a book manuscript chapter. Output ONLY the chapter prose.'
  );
  return text && text.trim().length > 50
    ? text.trim()
    : '[Draft failed for this chapter — please retry or write it manually.]';
}

interface SheetDraft {
  name: string;
  headers: string[];
  rows: string[][];
}

async function draftSheets(apiKey: string, model: string, topic: string): Promise<SheetDraft[] | null> {
  const parsed = await draftJson<{ sheets: SheetDraft[] }>(
    apiKey,
    model,
    'You are a spreadsheet designer. Output ONLY a JSON object {"sheets":[{"name":string,"headers":[string],"rows":[[string]]}]} with no prose or fences.',
    `Design spreadsheet data for: ${JSON.stringify(topic)}. 1-3 sheets, sensible headers, up to 60 data rows per sheet, plain string cells.`
  );
  if (!parsed || !Array.isArray(parsed.sheets) || parsed.sheets.length === 0) return null;
  return parsed.sheets.slice(0, 5).map((s) => ({
    name: String(s.name || 'Sheet').slice(0, 31),
    headers: Array.isArray(s.headers) ? s.headers.map((h) => String(h).slice(0, 80)).slice(0, 20) : [],
    rows: Array.isArray(s.rows) ? s.rows.slice(0, 200).map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '').slice(0, 200)) : [])) : [],
  }));
}

// ---------------------------------------------------------------------------
// Builders — each returns the real binary
// ---------------------------------------------------------------------------

export async function buildPptx(
  apiKey: string,
  model: string,
  input: { title: string; topic?: string; slides?: SlideDraft[]; slideCount?: number }
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const title = (input.title || 'Presentation').slice(0, 120);
  let slides = Array.isArray(input.slides) && input.slides.length > 0 ? input.slides : null;
  if (!slides) {
    slides = (await draftSlides(apiKey, model, input.topic || title, input.slideCount || 8)) || [
      { title, bullets: ['Add your content here.'] },
    ];
  }

  const pres = new pptxgen();
  pres.defineLayout({ name: 'PARI_WIDE', width: 13.33, height: 7.5 });
  pres.layout = 'PARI_WIDE';

  const titleSlide = pres.addSlide();
  titleSlide.background = { color: '1F2937' };
  titleSlide.addText(title, {
    x: 0.8, y: 2.2, w: 11.7, h: 2,
    fontSize: 44, bold: true, color: 'F9FAFB', align: 'center',
  });
  titleSlide.addText('Generated with Pari AI', {
    x: 0.8, y: 4.6, w: 11.7, h: 0.8,
    fontSize: 18, color: '9CA3AF', align: 'center',
  });

  slides.forEach((s, i) => {
    const slide = pres.addSlide();
    slide.background = { color: 'FFFFFF' };
    slide.addText(`${i + 1}. ${s.title}`, {
      x: 0.6, y: 0.3, w: 12.1, h: 1,
      fontSize: 32, bold: true, color: '1F2937',
    });
    slide.addText(s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })) as any, {
      x: 0.8, y: 1.6, w: 11.7, h: 5.2,
      fontSize: 20, color: '374151', lineSpacingMultiple: 1.3,
    });
  });

  const buffer = (await pres.write({ outputType: 'nodebuffer' })) as Buffer;
  return { buffer, filename: `${slugify(title)}.pptx`, mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
}

export interface BookChapterInput {
  heading: string;
  brief?: string;
  body?: string;
}

async function resolveChapterBodies(
  apiKey: string,
  model: string,
  title: string,
  chapters: BookChapterInput[]
): Promise<Array<{ heading: string; body: string }>> {
  const list = chapters.slice(0, 12);
  const out: Array<{ heading: string; body: string }> = [];
  for (const c of list) {
    const heading = (c.heading || 'Chapter').slice(0, 120);
    const body =
      typeof c.body === 'string' && c.body.trim().length > 50
        ? c.body.trim()
        : await draftChapterBody(apiKey, model, title, heading, c.brief || '');
    out.push({ heading, body });
  }
  return out;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export async function buildDocx(
  apiKey: string,
  model: string,
  input: { title: string; kind?: 'document' | 'book'; chapters?: BookChapterInput[]; text?: string }
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const title = (input.title || 'Document').slice(0, 120);
  const isBook = input.kind === 'book';
  const children: Paragraph[] = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: '' }),
  ];
  if (isBook) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: MANUSCRIPT_NOTICE, italics: true, size: 20, color: '666666' })],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: '' })
    );
  }
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `Generated with Pari AI · ${new Date().toLocaleDateString()}`, size: 20, color: '999999' })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '' })
  );

  if (isBook) {
    const chapters = await resolveChapterBodies(apiKey, model, title, input.chapters || [{ heading: 'Chapter 1', brief: input.text || '' }]);
    for (const c of chapters) {
      children.push(new Paragraph({ text: c.heading, heading: HeadingLevel.HEADING_1 }));
      for (const p of splitParagraphs(c.body)) {
        children.push(new Paragraph({ text: p }));
      }
      children.push(new Paragraph({ text: '' }));
    }
  } else {
    const body = (input.text || '').trim() || 'Your content goes here.';
    for (const p of splitParagraphs(body)) {
      children.push(new Paragraph({ text: p }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return {
    buffer,
    filename: `${slugify(title)}.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
}

function pdfBuffer(build: (doc: any) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      build(doc);
    } catch (e) {
      reject(e);
      return;
    }
    doc.end();
  });
}

export async function buildPdf(
  apiKey: string,
  model: string,
  input: { title: string; kind?: 'document' | 'book'; chapters?: BookChapterInput[]; text?: string }
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const title = (input.title || 'Document').slice(0, 120);
  const isBook = input.kind === 'book';
  const chapters = isBook
    ? await resolveChapterBodies(apiKey, model, title, input.chapters || [{ heading: 'Chapter 1', brief: input.text || '' }])
    : [];

  const buffer = await pdfBuffer((doc) => {
    doc.fontSize(26).fillColor('#111827').text(title, { align: 'center' });
    doc.moveDown();
    if (isBook) {
      doc.fontSize(10).fillColor('#6B7280').text(MANUSCRIPT_NOTICE, { align: 'center' });
      doc.moveDown();
    }
    doc.fontSize(10).fillColor('#9CA3AF').text(`Generated with Pari AI · ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.addPage();

    if (isBook) {
      for (const c of chapters) {
        doc.fontSize(20).fillColor('#111827').text(c.heading, { underline: false });
        doc.moveDown(0.5);
        for (const p of splitParagraphs(c.body)) {
          doc.fontSize(12).fillColor('#1F2937').text(p, { align: 'justify', lineGap: 4 });
          doc.moveDown(0.5);
        }
        doc.addPage();
      }
    } else {
      const body = (input.text || '').trim() || 'Your content goes here.';
      for (const p of splitParagraphs(body)) {
        doc.fontSize(12).fillColor('#1F2937').text(p, { align: 'justify', lineGap: 4 });
        doc.moveDown(0.5);
      }
    }
  });

  return { buffer, filename: `${slugify(title)}.pdf`, mimeType: 'application/pdf' };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function buildEpub(
  apiKey: string,
  model: string,
  input: { title: string; author?: string; chapters?: BookChapterInput[]; text?: string }
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const title = (input.title || 'Manuscript').slice(0, 120);
  const chapters = await resolveChapterBodies(
    apiKey,
    model,
    title,
    input.chapters && input.chapters.length > 0 ? input.chapters : [{ heading: 'Chapter 1', brief: input.text || '' }]
  );

  const content = [
    {
      title: 'About this manuscript',
      data: `<p><em>${escapeHtml(MANUSCRIPT_NOTICE)}</em></p><p>Generated with Pari AI · ${escapeHtml(
        new Date().toLocaleDateString()
      )}</p>`,
    },
    ...chapters.map((c) => ({
      title: c.heading,
      data:
        `<h1>${escapeHtml(c.heading)}</h1>` +
        splitParagraphs(c.body)
          .map((p) => `<p>${escapeHtml(p)}</p>`)
          .join('\n'),
    })),
  ];

  const tmpPath = path.join(os.tmpdir(), `pari-epub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.epub`);
  const epub = new EPub(
    {
      title,
      author: (input.author || 'Pari AI').slice(0, 120),
      publisher: 'Pari AI manuscript draft',
      content,
    },
    tmpPath
  );
  await epub.promise;
  const buffer = fs.readFileSync(tmpPath);
  try {
    fs.unlinkSync(tmpPath);
  } catch (_) {}
  return { buffer, filename: `${slugify(title)}.epub`, mimeType: 'application/epub+zip' };
}

export async function buildXlsx(
  apiKey: string,
  model: string,
  input: { title: string; topic?: string; sheets?: Array<{ name?: string; headers?: string[]; rows?: string[][] }> }
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const title = (input.title || 'Spreadsheet').slice(0, 120);
  let sheets: SheetDraft[] | null =
    Array.isArray(input.sheets) && input.sheets.length > 0
      ? input.sheets.map((s, i) => ({
          name: String(s.name || `Sheet${i + 1}`).slice(0, 31),
          headers: Array.isArray(s.headers) ? s.headers.map((h) => String(h)) : [],
          rows: Array.isArray(s.rows) ? s.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : [])) : [],
        }))
      : null;
  if (!sheets) {
    sheets = (await draftSheets(apiKey, model, input.topic || title)) || [
      { name: 'Sheet1', headers: ['Column A'], rows: [] },
    ];
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Pari AI';
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name || 'Sheet');
    if (s.headers.length > 0) {
      const headerRow = ws.addRow(s.headers);
      headerRow.font = { bold: true };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    }
    for (const row of s.rows) ws.addRow(row);
    ws.columns.forEach((col: any) => {
      col.width = 22;
    });
  }

  const out = await wb.xlsx.writeBuffer();
  const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out as any);
  return {
    buffer,
    filename: `${slugify(title)}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
