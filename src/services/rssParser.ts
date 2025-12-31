// RSS Parser Service
// Extracts and processes text content from RSS feed items

import { iso6393ToBCP47 } from '../utils/languageMapper';
import { Post } from '../types';

// React Native requires using require() for franc-min and accessing the correct export
const francModule = require('franc-min');
const franc = francModule.default || francModule.franc || francModule;

// Re-export Post for convenience
export { Post };

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
export function parseRSSItem(xmlString: string): Post | null {
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

    // Extract description/content (RSS: <description>, Atom: <content> or <summary>)
    let content = '';
    const descriptionMatch = xmlString.match(/<description>(.*?)<\/description>/s);
    if (descriptionMatch) {
      content = extractCDATA(descriptionMatch[1]).trim();
    } else {
      const contentMatch = xmlString.match(/<content[^>]*>(.*?)<\/content>/s);
      if (contentMatch) {
        content = extractCDATA(contentMatch[1]).trim();
      } else {
        const summaryMatch = xmlString.match(/<summary[^>]*>(.*?)<\/summary>/s);
        if (summaryMatch) {
          content = extractCDATA(summaryMatch[1]).trim();
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

          if (detectedLanguage) {
            console.log(`[RSSParser] Detected: ${francResult} → ${detectedLanguage}`);
          } else {
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
 * @param xmlString - The RSS/Atom XML string to parse
 * @param lastReadAt - Optional ISO date string; stops parsing when encountering older posts (optimization)
 */
export function parseRSSFeed(xmlString: string, lastReadAt?: string | null): Post[] {
  const posts: Post[] = [];
  const cutoffDate = lastReadAt ? new Date(lastReadAt) : null;

  // Try RSS format first (<item> tags)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xmlString)) !== null) {
    const post = parseRSSItem(`<item>${match[1]}</item>`);
    if (post) {
      // Early termination: stop parsing if this post is older than cutoff
      if (cutoffDate && post.pubDate) {
        const postDate = new Date(post.pubDate);
        if (postDate <= cutoffDate) {
          console.log(`[RSSParser] Early stop: reached posts older than ${lastReadAt}`);
          break;
        }
      }
      posts.push(post);
    }
  }

  // If no posts found, try Atom format (<entry> tags)
  if (posts.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    while ((match = entryRegex.exec(xmlString)) !== null) {
      const post = parseRSSItem(`<entry>${match[1]}</entry>`);
      if (post) {
        // Early termination: stop parsing if this post is older than cutoff
        if (cutoffDate && post.pubDate) {
          const postDate = new Date(post.pubDate);
          if (postDate <= cutoffDate) {
            console.log(`[RSSParser] Early stop: reached posts older than ${lastReadAt}`);
            break;
          }
        }
        posts.push(post);
      }
    }
  }

  return posts;
}