import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

function stripMarkdown(md: string): string {
  return md
    // code fences
    .replace(/```[\s\S]*?```/g, ' ')
    // inline code
    .replace(/`[^`]*`/g, ' ')
    // images ![alt](url)
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ')
    // links [text](url)
    .replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1')
    // headings/blockquote markers
    .replace(/^\s{0,3}(#{1,6}|>)\s+/gm, '')
    // lists markers
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // emphasis
    .replace(/[*_]{1,3}/g, '')
    // collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

export const GET: APIRoute = async () => {
  const allPosts = await getCollection('posts');
  const posts = allPosts
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const items = posts.map((p) => {
    const text = stripMarkdown(p.body ?? '');
    // keep index reasonably small
    const content = text.slice(0, 4000);
    return {
      slug: p.slug,
      title: p.data.title,
      description: p.data.description ?? '',
      pubDate: p.data.pubDate.toISOString(),
      tags: p.data.tags ?? [],
      content,
    };
  });

  return new Response(JSON.stringify({ items }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // static site: cache aggressively; busts on deploy
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
