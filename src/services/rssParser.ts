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
 * Parses RSS XML string and extracts article content
 */
export function parseRSSItem(xmlString: string): RSSItem | null {
  try {
    // Extract CDATA content using regex
    const extractCDATA = (text: string): string => {
      const match = text.match(/<!\[CDATA\[(.*?)\]\]>/s);
      return match ? match[1] : text;
    };

    // Extract title
    const titleMatch = xmlString.match(/<title>(.*?)<\/title>/s);
    const title = titleMatch ? extractCDATA(titleMatch[1]).trim() : '';

    // Extract link
    const linkMatch = xmlString.match(/<link>(.*?)<\/link>/s);
    const link = linkMatch ? linkMatch[1].trim() : '';

    // Extract publication date
    const pubDateMatch = xmlString.match(/<pubDate>(.*?)<\/pubDate>/s);
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';

    // Extract author
    const authorMatch = xmlString.match(/<dc:creator>(.*?)<\/dc:creator>/s);
    const author = authorMatch ? authorMatch[1].trim() : '';

    // Extract description/content
    const descriptionMatch = xmlString.match(/<description>(.*?)<\/description>/s);
    const content = descriptionMatch ? extractCDATA(descriptionMatch[1]).trim() : '';

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
 * Parse multiple RSS items from feed XML
 */
export function parseRSSFeed(xmlString: string): RSSItem[] {
  const items: RSSItem[] = [];

  // Match all <item> tags
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xmlString)) !== null) {
    const item = parseRSSItem(`<item>${match[1]}</item>`);
    if (item) {
      items.push(item);
    }
  }

  return items;
}