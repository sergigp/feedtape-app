// RSS Parser Service
// Extracts and processes text content from RSS feed items

import { iso6393ToBCP47 } from '../utils/languageMapper';
import { ParsedPost, Post } from '../types';

// React Native requires using require() for franc-min and accessing the correct export
const francModule = require('franc-min');
const franc = francModule.default || francModule.franc || francModule;

// Re-export types for convenience
export { ParsedPost, Post };

/**
 * Strips HTML tags and decodes HTML entities from text
 */
export function stripHtml(html: string): string {
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&#x20;/g, ' ');
  text = text.replace(/&#x00F1;/g, 'ñ');
  text = text.replace(/&#x00ED;/g, 'í');
  text = text.replace(/&#x00E1;/g, 'á');
  text = text.replace(/&#x00E9;/g, 'é');
  text = text.replace(/&#x00F3;/g, 'ó');
  text = text.replace(/&#x00FA;/g, 'ú');
  text = text.replace(/&#x3A;/g, ':');

  // Clean up multiple spaces and line breaks
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Parses RSS/Atom XML string and extracts article content
 */
export function parseRSSItem(xmlString: string): ParsedPost | null {
  try {
    // Extract CDATA content using regex
    const extractCDATA = (text: string): string => {
      const match = text.match(/<!\[CDATA\[(.*?)\]\]>/s);
      return match ? match[1] : text;
    };

    // Extract title
    const titleMatch = xmlString.match(/<title[^>]*>(.*?)<\/title>/s);
    const title = titleMatch ? extractCDATA(titleMatch[1]).trim() : '';

    // Extract link (RSS: <link>url</link>, Atom: <link rel="alternate" href="url" />)
    let link = '';
    const linkMatch = xmlString.match(/<link>(.*?)<\/link>/s);
    if (linkMatch) {
      link = linkMatch[1].trim();
    } else {
      const atomLinkMatch = xmlString.match(/<link[^>]*rel="alternate"[^>]*href="([^"]*)"/);
      if (atomLinkMatch) {
        link = atomLinkMatch[1];
      }
    }

    // Extract publication date (RSS: <pubDate>, Atom: <published> or <updated>)
    let pubDate = '';
    const pubDateMatch = xmlString.match(/<pubDate>(.*?)<\/pubDate>/s);
    if (pubDateMatch) {
      pubDate = pubDateMatch[1].trim();
    } else {
      const publishedMatch = xmlString.match(/<published>(.*?)<\/published>/s);
      if (publishedMatch) {
        pubDate = publishedMatch[1].trim();
      } else {
        const updatedMatch = xmlString.match(/<updated>(.*?)<\/updated>/s);
        if (updatedMatch) {
          pubDate = updatedMatch[1].trim();
        }
      }
    }

    // Extract author (RSS: <dc:creator>, Atom: <author><name>)
    let author = '';
    const authorMatch = xmlString.match(/<dc:creator>(.*?)<\/dc:creator>/s);
    if (authorMatch) {
      author = authorMatch[1].trim();
    } else {
      const atomAuthorMatch = xmlString.match(/<author>[\s\S]*?<name>(.*?)<\/name>/s);
      if (atomAuthorMatch) {
        author = atomAuthorMatch[1].trim();
      }
    }

    // Extract content with RSS best practices priority:
    // 1. <content:encoded> (RSS 2.0 full article)
    // 2. <content> (Atom full article)
    // 3. <description> (RSS 2.0 fallback, may be summary or full content)
    // 4. <summary> (Atom summary)
    let content = '';

    // Priority 1: content:encoded (RSS 2.0 Content Module - full article)
    const contentEncodedMatch = xmlString.match(/<content:encoded>(.*?)<\/content:encoded>/s);
    if (contentEncodedMatch) {
      content = extractCDATA(contentEncodedMatch[1]).trim();
      console.log(`[RSSParser] Using content:encoded (${content.length} chars)`);
    }
    // Priority 2: content (Atom - full article)
    else {
      const contentMatch = xmlString.match(/<content[^>]*>(.*?)<\/content>/s);
      if (contentMatch) {
        content = extractCDATA(contentMatch[1]).trim();
        console.log(`[RSSParser] Using <content> (${content.length} chars)`);
      }
      // Priority 3: description (RSS 2.0 - may be summary or full content)
      else {
        const descriptionMatch = xmlString.match(/<description>(.*?)<\/description>/s);
        if (descriptionMatch) {
          content = extractCDATA(descriptionMatch[1]).trim();
          console.log(`[RSSParser] Using <description> (${content.length} chars)`);
        }
        // Priority 4: summary (Atom - always summary)
        else {
          const summaryMatch = xmlString.match(/<summary[^>]*>(.*?)<\/summary>/s);
          if (summaryMatch) {
            content = extractCDATA(summaryMatch[1]).trim();
            console.log(`[RSSParser] Using <summary> (${content.length} chars)`);
          }
        }
      }
    }

    // Create plain text version for TTS
    const plainText = stripHtml(content);

    // Detect language from plain text
    let detectedLanguage: string | null = null;

    if (plainText.length >= 20) {
      try {
        const francResult = franc(plainText, { minLength: 20 });

        if (francResult !== 'und') {
          detectedLanguage = iso6393ToBCP47(francResult);

          // Only log warnings for unmapped languages (not every detection)
          if (!detectedLanguage) {
            console.warn(`[RSSParser] Unmapped language: ${francResult}`);
          }
        }
      } catch (error) {
        console.error('[RSSParser] Detection error:', error);
      }
    }

    // Guaranteed language: use detected language or fallback to 'en-US'
    const language = detectedLanguage || 'en-US';

    return {
      title: stripHtml(title),
      link,
      pubDate,
      author,
      content,
      plainText,
      language  // Now required, always present
    };
  } catch (error) {
    console.error('Error parsing RSS item:', error);
    return null;
  }
}

/**
 * Parse multiple RSS items from feed XML (supports both RSS <item> and Atom <entry>)
 * Filters out articles older than RSS_ARTICLE_MAX_AGE_DAYS to prevent old articles
 * from appearing as "unread" after read status cleanup.
 *
 * @param xmlString - The RSS/Atom XML string to parse
 * @param options - Optional parsing options
 * @param options.maxItems - Maximum number of items to return (default: unlimited)
 */
export function parseRSSPost(
  xmlString: string,
  options?: { maxItems?: number }
): ParsedPost[] {
  const posts: ParsedPost[] = [];

  // CRITICAL: Must match CLEANUP_AGE_DAYS in readStatusService.ts
  // Only show articles from last 90 days to prevent old articles showing as "unread"
  const RSS_ARTICLE_MAX_AGE_DAYS = 90;
  const cutoffDate = new Date(Date.now() - RSS_ARTICLE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  // Try RSS format first (<item> tags)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xmlString)) !== null) {
    const post = parseRSSItem(`<item>${match[1]}</item>`);
    if (post) {
      posts.push(post);
    }
  }

  // If no posts found, try Atom format (<entry> tags)
  if (posts.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    while ((match = entryRegex.exec(xmlString)) !== null) {
      const post = parseRSSItem(`<entry>${match[1]}</entry>`);
      if (post) {
        posts.push(post);
      }
    }
  }

  // Filter out articles older than 90 days
  const recentPosts = posts.filter(post => {
    if (!post.pubDate) {
      // Keep articles without pubDate (edge case)
      return true;
    }

    const postDate = new Date(post.pubDate);
    const isRecent = postDate >= cutoffDate;

    // Only log when filtering out old articles (not the common case)
    if (!isRecent) {
      console.log(`[RSSParser] Filtered old article (${post.pubDate}): ${post.title}`);
    }

    return isRecent;
  });

  // Only log summary if articles were filtered
  if (posts.length !== recentPosts.length) {
    console.log(`[RSSParser] Parsed ${recentPosts.length} articles (${posts.length - recentPosts.length} filtered as too old)`);
  }

  // Apply item limit after date filtering
  const maxItems = options?.maxItems || Infinity;
  const limitedPosts = recentPosts.slice(0, maxItems);

  if (recentPosts.length > maxItems) {
    console.log(
      `[RSSParser] Limited to ${maxItems} posts (${recentPosts.length} available)`
    );
  }

  return limitedPosts;
}