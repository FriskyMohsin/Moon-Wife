/**
 * Maryam/Owner voice research tools — server-side (Azure).
 * search_videos: real YouTube links. search_articles: field-routed web search.
 * No local runner needed.
 */
import { searchVideos, searchArticles } from './contentSearch';

export const RESEARCH_TOOL_NAMES = ['search_videos', 'search_articles'] as const;

export const RESEARCH_TOOL_DECLARATIONS: any[] = [
  {
    name: 'search_videos',
    description:
      'Search YouTube for real demo/how-to videos about anything (exercises, DIY, repairs, recipes). Call when Mohsin asks for a video or wants to SEE how something is done.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Short English search query, e.g. "push up proper form" or "fix leaking tap".',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_articles',
    description:
      'Search the web for real articles and studies. Medical queries use PubMed + WHO/CDC/AHA/NIH; engineering/CS/physics/math use arXiv + Semantic Scholar. Call when Mohsin wants to read more about something or asks for research.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Short English search query, e.g. "vitamin D deficiency treatment".',
        },
      },
      required: ['query'],
    },
  },
];

export async function executeResearchTool(toolName: string, args: any): Promise<any> {
  const query = String(args?.query || '').slice(0, 120).trim();
  if (!query) return { ok: false, message: 'query is required.' };

  if (toolName === 'search_videos') {
    const r = await searchVideos(query);
    if ((r as any).fallback) {
      return {
        ok: true,
        fallback: true,
        message: 'No direct video found; share the search link instead.',
        searchUrl: (r as any).fallbackUrl,
        searchTitle: (r as any).fallbackTitle,
      };
    }
    return {
      ok: true,
      videos: r.videos.map((v: any) => ({ title: v.title, url: v.url })),
    };
  }

  if (toolName === 'search_articles') {
    const r = await searchArticles(query);
    if ((r as any).fallback) {
      return {
        ok: true,
        fallback: true,
        message: 'No direct article found; share the search link instead.',
        searchUrl: (r as any).fallbackUrl,
        searchTitle: (r as any).fallbackTitle,
      };
    }
    return {
      ok: true,
      articles: (r as any).articles?.map((a: any) => ({ title: a.title, url: a.url, source: a.source })) || [],
    };
  }

  return { ok: false, message: `Unknown research tool: ${toolName}` };
}
