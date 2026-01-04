import { convert } from 'html-to-text';

const MIN_CONTENT_LENGTH = 50;

class ContentCleaningService {
  cleanContent(rawHtml: string): string | null {
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
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/\betc\./gi, 'etcetera')
      .replace(/\be\.g\./gi, 'for example')
      .replace(/\bi\.e\./gi, 'that is')
      .replace(/&/g, ' and ')
      .replace(/@/g, ' at ')
      .replace(/#(\w+)/g, 'hashtag $1')
      .replace(/(\d+)k\b/gi, '$1 thousand')
      .replace(/(\d+)m\b/gi, '$1 million')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}

export default new ContentCleaningService();
