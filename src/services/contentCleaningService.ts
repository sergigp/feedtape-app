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
    let processed = text
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

      // Ellipsis - convert to pause marker (period + newlines)
      .replace(/\.{3,}/g, '.\n\n')

      // HTML entities that might slip through
      .replace(/&nbsp;/g, ' ')
      .replace(/&mdash;/g, ', ')  // em-dash as comma pause
      .replace(/&ndash;/g, ', ')  // en-dash as comma pause
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"');

    // TTS pause improvements: add breathing room after sentences
    processed = this.addTTSPauses(processed);

    // Final whitespace normalization (preserve paragraph breaks)
    return processed
      .replace(/\n{4,}/g, '\n\n\n')  // Max 3 newlines (long pause)
      .replace(/[ \t]{2,}/g, ' ')     // Collapse horizontal whitespace only
      .trim();
  }

  /**
   * Add natural pauses for TTS by inserting newlines after sentence boundaries.
   * This helps TTS engines like Sherpa ONNX produce more natural-sounding speech
   * with appropriate breathing pauses between sentences and paragraphs.
   */
  private addTTSPauses(text: string): string {
    return text
      // Mark existing paragraph breaks with placeholder to preserve them
      .replace(/\n\n+/g, '\n\n\n')  // Existing paragraphs get extra pause

      // Add pause after sentence-ending punctuation followed by space and capital letter
      // This creates paragraph-like breaks between sentences for longer pauses
      .replace(/([.!?])\s+([A-Z])/g, '$1\n\n$2')

      // Add pause after colons that introduce lists or explanations
      .replace(/:\s+([A-Z])/g, ':\n\n$1')

      // Add pause after semicolons (clause separator)
      .replace(/;\s+/g, ';\n\n')

      // Add slight pause (comma) before coordinating conjunctions in longer phrases
      // This helps break up run-on sentences for better TTS rhythm
      .replace(/(\w{20,})\s+(and|but|or|yet|so)\s+/gi, '$1, $2 ');
  }
}

export default new ContentCleaningService();
