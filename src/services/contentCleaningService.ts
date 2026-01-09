import { convert } from 'html-to-text';

const MIN_CONTENT_LENGTH = 50;
const MAX_CONTENT_LENGTH = 500_000; // 500KB - prevent memory exhaustion attacks

class ContentCleaningService {
  cleanContent(rawHtml: string): string | null {
    // Security: Validate input size to prevent memory exhaustion from malicious feeds
    if (rawHtml.length > MAX_CONTENT_LENGTH) {
      console.warn(`[Cleaning] Content too large: ${rawHtml.length} chars (max: ${MAX_CONTENT_LENGTH})`);
      return null;
    }

    try {
      const plainText = this.htmlToText(rawHtml);
      const cleaned = this.removeJunk(plainText);
      const ttsOptimized = this.postProcessForTTS(cleaned);

      if (ttsOptimized.length < MIN_CONTENT_LENGTH) {
        console.log('[Cleaning] Content too short after processing:', ttsOptimized.length, 'chars');
        return null;
      }

      return ttsOptimized;
    } catch (error) {
      console.error('[Cleaning] Error during content cleaning:', error);
      return null;
    }
  }

  /**
   * Clean title by decoding HTML entities and removing unwanted characters
   */
  cleanTitle(rawTitle: string): string {
    try {
      return this.decodeHtmlEntities(rawTitle)
        .replace(/\s{2,}/g, ' ')  // Collapse multiple spaces
        .trim();
    } catch (error) {
      console.error('[Cleaning] Error cleaning title:', error);
      return rawTitle;  // Return original on error
    }
  }

  /**
   * Decode common HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    return text
      // Numeric entities (decimal)
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
      // Numeric entities (hex)
      .replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
      // Named entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')
      .replace(/&hellip;/g, '…');
  }

  private htmlToText(rawHtml: string): string {
    return convert(rawHtml, {
      wordwrap: false,
      selectors: [
        { selector: 'img', format: 'skip' },
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'a', options: { ignoreHref: true } },
      ],
    });
  }

  private removeJunk(text: string): string {
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/&amp;lt;/g, '&lt;')
      .replace(/&amp;gt;/g, '&gt;')
      .replace(/&amp;quot;/g, '&quot;')
      .replace(/&amp;amp;/g, '&amp;');
  }

  private postProcessForTTS(text: string): string {
    return text
      // Remove URLs
      .replace(/https?:\/\/[^\s]+/g, '')

      // Common abbreviations
      .replace(/\betc\./gi, 'etcetera')
      .replace(/\be\.g\./gi, 'for example')
      .replace(/\bi\.e\./gi, 'that is')
      .replace(/\bvs\./gi, 'versus')
      .replace(/\bMr\./gi, 'Mister')
      .replace(/\bMrs\./gi, 'Missus')
      .replace(/\bDr\./gi, 'Doctor')
      .replace(/\bProf\./gi, 'Professor')
      .replace(/\bSt\./gi, 'Saint')

      // Money symbols
      .replace(/\$(\d+)/g, '$1 dollars')
      .replace(/€(\d+)/g, '$1 euros')
      .replace(/£(\d+)/g, '$1 pounds')

      // Percentages
      .replace(/(\d+)%/g, '$1 percent')

      // Degrees (temperature/angles)
      .replace(/(\d+)°\s*F\b/g, '$1 degrees Fahrenheit')
      .replace(/(\d+)°\s*C\b/g, '$1 degrees Celsius')
      .replace(/(\d+)°/g, '$1 degrees')

      // Common symbols
      .replace(/&/g, ' and ')
      .replace(/@/g, ' at ')
      .replace(/#(\w+)/g, 'hashtag $1')

      // Numbers with magnitude
      .replace(/(\d+)k\b/gi, '$1 thousand')
      .replace(/(\d+)m\b/gi, '$1 million')
      .replace(/(\d+)b\b/gi, '$1 billion')

      // Citations and references
      .replace(/\[\d+\]/g, '')  // Remove [1], [2], etc.
      .replace(/\[source\]/gi, '')
      .replace(/\[citation needed\]/gi, '')

      // Ellipsis
      .replace(/\.{3,}/g, '.')

      // HTML entities that might slip through
      .replace(/&nbsp;/g, ' ')
      .replace(/&mdash;/g, ' ')
      .replace(/&ndash;/g, ' ')
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')

      // Whitespace normalization
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}

export default new ContentCleaningService();
