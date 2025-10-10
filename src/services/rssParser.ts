// RSS Parser Service
// Extracts and processes text content from RSS feed items

export interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  author: string;
  content: string;
  plainText: string;
}

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
export function parseRSSItem(xmlString: string): RSSItem | null {
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

    return {
      title: stripHtml(title),
      link,
      pubDate,
      author,
      content,
      plainText
    };
  } catch (error) {
    console.error('Error parsing RSS item:', error);
    return null;
  }
}

/**
 * Parse multiple RSS items from feed XML (supports both RSS <item> and Atom <entry>)
 */
export function parseRSSFeed(xmlString: string): RSSItem[] {
  const items: RSSItem[] = [];

  // Try RSS format first (<item> tags)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xmlString)) !== null) {
    const item = parseRSSItem(`<item>${match[1]}</item>`);
    if (item) {
      items.push(item);
    }
  }

  // If no items found, try Atom format (<entry> tags)
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    while ((match = entryRegex.exec(xmlString)) !== null) {
      const item = parseRSSItem(`<entry>${match[1]}</entry>`);
      if (item) {
        items.push(item);
      }
    }
  }

  return items;
}