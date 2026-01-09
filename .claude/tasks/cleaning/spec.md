## Context

RSS feeds contain messy content (CDATA, JavaScript, HTML, tracking pixels, etc.) that creates poor TTS experience. With Sherpa ONNX generating WAV files (which takes several seconds per article), clean input is critical to avoid wasting generation time on junk content.

## Scope

Build a content processing pipeline with state machine architecture for RSS posts. The pipeline will support multiple phases (cleaning, summarization, TTS enhancements), but this task implements only the first phase: cleaning content for TTS.

### In Scope

- **Pipeline infrastructure**: Phase-based, extensible architecture for future tasks
- **Non-blocking execution**: Posts available immediately, pipeline updates state incrementally
- **App startup integration**: Move feed/RSS fetching from FeedList to app startup
- **State machine**: Posts tracked with status field, updated as pipeline progresses
- **Cleaning phase implementation**:
  - HTML → text conversion (html-to-text library)
  - Remove scripts, tracking pixels, images, inline CSS, control characters
  - Fix double-escaped entities (&amp;lt; → &lt;)
  - TTS-specific post-processing (abbreviations, URLs, symbols)
- **Error handling**: Log errors and skip posts that fail cleaning
- **Performance logging**: Console logs for measuring pipeline performance

### Out of Scope (Future Tasks)

- Summarization phase (future: ~5 seconds per post)
- TTS enhancement phase (pauses, pacing, etc.)
- WAV generation/caching (separate TTS pipeline task)
- Post vs Track model split (future refactor)
- Persistent storage (memory/state only for now)
- UX improvements (loading indicators, progress bars)
- Pre-generation of WAVs (not viable with hundreds of posts)

## Architecture

### State Machine Post Model

```typescript
interface Post {
  id: string;
  feedId: string;
  title: string;
  link: string;
  isoDate: string;
  rawContent: string;              // original from RSS
  cleanedContent: string | null;   // null until cleaning completes
  summary: string | null;           // future: null until summarization completes
  status: 'raw' | 'cleaning' | 'cleaned' | 'summarizing' | 'ready' | 'error';
}
```

**Why state machine?**
- Posts available immediately (don't block on pipeline completion)
- Future phases (summarization) take ~5 seconds per post
- Incremental updates allow progressive enhancement
- User can play posts even while pipeline runs in background

### Pipeline Flow

```
App Startup:
  → Fetch all feeds (feedService.getFeeds())
  → Fetch RSS for all feeds in parallel
  → Parse posts (parseRSSFeed)
  → Add posts to global state with status='raw'
  → Trigger pipeline for each post (async, non-blocking)

Per-Post Pipeline:
  → Cleaning phase
    - Update status='cleaning'
    - Run cleaning transformations
    - Update state with cleanedContent
    - Update status='cleaned'
  → [Future] Summarization phase
    - Update status='summarizing'
    - Generate summary (~5 seconds)
    - Update state with summary
    - Update status='ready'
  → [Future] TTS enhancement phase
    - Add pauses, pacing markers, etc.
```

### Service Structure

**New Service: `contentPipelineService.ts`**
```typescript
type PipelinePhase = (post: Post) => Promise<Post>;

const phases: PipelinePhase[] = [
  cleaningPhase,
  // Future: summarizationPhase,
  // Future: ttsEnhancementPhase,
];

// Runs pipeline for single post, updates state after each phase
async function processPost(
  post: Post,
  onUpdate: (post: Post) => void
): Promise<void> {
  // Run each phase, update state incrementally
}

// Trigger pipeline for all posts (non-blocking)
function processPosts(
  posts: Post[],
  onUpdate: (post: Post) => void
): void {
  // Process posts in parallel without blocking
}
```

**New Service: `contentCleaningService.ts`**
```typescript
// Multi-step cleaning for debugging
function cleanContent(rawHtml: string): string {
  const plainText = htmlToText(rawHtml);
  const cleaned = removeJunk(plainText);
  const ttsOptimized = postProcessForTTS(cleaned);
  return ttsOptimized;
}
```

## Implementation Notes

### RSS Format Support

Support RSS 2.0, RSS 1.0, and Atom:
- **RSS 2.0**: Date format RFC 822, item container `<item>`, content field `<description>` or `<content:encoded>`
- **RSS 1.0**: Similar to RSS 2.0 with different namespace
- **Atom**: Date format RFC 3339, item container `<entry>`, content field `<content>`

**Note**: `rss-parser` library already normalizes these formats, so we can handle them uniformly.

### Cleaning Transformations

**Step 1: HTML to Text** (using `html-to-text` library)
- Convert HTML to plain text
- Remove HTML tags and structure
- Preserve text content and readability

**Step 2: Remove Junk**
- Strip `<script>` tags and content
- Remove tracking pixels (`<img>` tags with tracking URLs)
- Remove all images (can't show in TTS)
- Remove tracking/advertising elements
- Remove inline CSS and style attributes
- Remove control characters
- Fix double-escaped entities (`&amp;lt;` → `&lt;`)

**Step 3: TTS Post-Processing**
```typescript
function postProcessForTTS(text: string): string {
  return text
    .replace(/https?:\/\/[^\s]+/g, '')        // Remove URLs
    .replace(/\betc\./gi, 'etcetera')
    .replace(/\be\.g\./gi, 'for example')
    .replace(/\bi\.e\./gi, 'that is')
    .replace(/&/g, ' and ')
    .replace(/@/g, ' at ')
    .replace(/#(\w+)/g, 'hashtag $1')
    .replace(/(\d+)k\b/gi, '$1 thousand')
    .replace(/(\d+)m\b/gi, '$1 million')
    .replace(/\n{3,}/g, '\n\n')               // Collapse multiple newlines
    .trim();
}
```

**Additional considerations** (refine during implementation):
- Bullet points → "item" or similar
- Acronyms handling (NASA, etc.)
- Numbers with commas
- Special characters that don't translate to speech

### Error Handling

**Pipeline errors:**
- Log error with feed ID, post ID, and error details
- Skip the post (don't add to state or mark status='error')
- Continue processing other posts
- No user-facing error UI for now (just console logs)

**Cleaning errors:**
- If `html-to-text` fails: log and skip post
- If post-processing fails: log and skip post
- Never add posts with incomplete/failed cleaning to state

### Performance Logging

Log to console for all pipeline operations:
- `[Pipeline] Starting processing for ${postId} (${characterCount} chars)`
- `[Cleaning] Started for ${postId}`
- `[Cleaning] Completed for ${postId} in ${duration}ms`
- `[Cleaning] Failed for ${postId}: ${error}`
- `[Pipeline] Post ${postId} status: ${status}`

**Metrics to track:**
- Total posts per feed
- Cleaning duration per post
- Success/failure rates
- Total pipeline duration per feed

### Libraries

**Install:**
- `html-to-text`: HTML → plain text conversion

**Already using:**
- `rss-parser`: RSS/Atom parsing

**Not using:**
- ~~`cheerio`~~: Not needed if using html-to-text
- ~~`sanitize-html`~~: May cause React Native bundler issues

### Integration Points

**Current architecture changes:**
1. **App.tsx**: Fetch feeds/RSS at startup (move from FeedList.tsx)
2. **FeedList.tsx**: Remove RSS fetching from `loadFeedStats()`, read from global state
3. **TrackList.tsx**: Read posts from global state (no re-fetching RSS)
4. **New global state/context**: Store posts with status tracking
5. **Sherpa ONNX integration**: Use `cleanedContent` field for WAV generation

## Success Criteria

✅ Feeds and RSS fetched at app startup (not when FeedList mounts)
✅ All posts added to state immediately with status='raw'
✅ Pipeline runs per-post without blocking UI
✅ Posts have `cleanedContent` populated before user hits play
✅ Cleaning removes HTML, scripts, tracking, images, junk
✅ TTS post-processing makes content natural-sounding
✅ Sherpa ONNX generates WAVs from `cleanedContent` field
✅ Performance metrics logged to console
✅ Error handling: failed posts logged and skipped
✅ Pipeline infrastructure ready for future phases (summarization, etc.)

## Key Clarifications and Answered Questions

### Pipeline Architecture
**Q**: Build full pipeline infrastructure now or defer?
**A**: Build phase-based pipeline infrastructure now (Option B), even with just cleaning phase. Makes adding future phases (summarization, TTS enhancements) trivial.

### When Does Processing Happen?
**Q**: Process at startup, on feed selection, or hybrid?
**A**: Fetch and parse at app startup, run pipeline immediately. Posts available in state with incremental updates as pipeline progresses.

### State Machine Rationale
**Q**: Is state machine approach overengineering?
**A**: No - essential for handling future long-running phases (summarization ~5 seconds per post). With 100 posts × 5 seconds = 8+ minutes, blocking pipeline is unacceptable. State machine allows posts to be available/playable while pipeline runs in background.

### Post Model
**Q**: Split into Post (text) vs Track (audio) models?
**A**: Defer to future refactor. Keep simple Post model for now with optional fields (cleanedContent, summary, etc.).

### WAV Caching
**Q**: Should we cache generated WAV files?
**A**: Out of scope. Will be handled in separate TTS pipeline task.

### Pre-generation
**Q**: Pre-generate WAVs for all posts?
**A**: No - not viable with dozens/hundreds of unread posts. Generate on-demand when user hits play.

### UX During Processing
**Q**: Show loading indicators, progress bars?
**A**: No UX changes for now. Focus on logging performance metrics. UX improvements in future iterations.

### Error Handling Strategy
**Q**: Fallback to uncleaned content if cleaning fails?
**A**: No - skip the post entirely. Log error and continue processing other posts. Failed posts don't appear in state.

### Cleaning Multi-Step
**Q**: Single function or multi-step process?
**A**: Multi-step for debugging and logging: `htmlToText()` → `removeJunk()` → `postProcessForTTS()`. Easier to inspect intermediate results and identify issues.

### Global State Management
**Q**: What state management approach should we use for the global posts state?
**A**: Memory-only PostsContext (similar to AuthContext). React Context pattern with Provider that exposes state and update methods. Components can subscribe via `useContext()` hook and re-render when state changes.

### App Startup Flow & Timing
**Q**: What happens if feed fetching or RSS parsing fails at startup?
**A**: Skip failed feeds silently, show successful ones, and log errors. Each feed has 15-second timeout - if exceeded, skip and continue with other feeds.

**Q**: Should the splash screen stay visible during initial feed fetching?
**A**: Ideally splash screen stays until feeds are fetched from database. Then FeedList can show per-feed feedback (fetching RSS, cleaning status). Balance complexity - can simplify if too complex.

### Feed Statistics Display
**Q**: How should FeedList display post counts when posts are filtered out due to cleaning errors?
**A**: Show successful count only (e.g., "47 posts" not "47 of 50 posts"). Failed posts are invisible to user.

### Pipeline Execution Strategy
**Q**: What order should posts be processed in the pipeline?
**A**: Batch processing with size 10 (configurable). Process posts asynchronously - as soon as one finishes, add another from queue (don't wait for full batch to complete). Balance complexity if implementation too difficult.

**Q**: Should pipeline processing pause when app is backgrounded?
**A**: Yes - pause processing when app backgrounds, resume when app returns to foreground.

### TrackList Behavior
**Q**: How should TrackList handle posts with different statuses?
**A**: Filter out 'error' posts entirely (invisible to user). Always log errors to console.

**Q**: Can users play posts that are in 'cleaning' state?
**A**: No - users cannot play posts until status='cleaned'. Posts must complete cleaning before playback is available.

### Content Validation
**Q**: How should we handle posts with no content after cleaning?
**A**: Set minimum content length threshold of 50 characters. Posts below this threshold are skipped (treated like cleaning errors).

### Markdown/Formatting Preservation
**Q**: Should we preserve any markdown-like formatting for TTS pauses?
**A**: Not for now. Future enhancement - defer to later phase.

### Image/Tracking Removal
**Q**: How aggressive should tracking pixel removal be?
**A**: Remove all images anyway, so tracking pixel removal is already covered by general image removal logic.

### Error Retry Logic
**Q**: Should we retry failed posts?
**A**: Posts will be retried on next app startup (full re-process). Note: Results likely won't change if error is content-based, but network errors may succeed on retry.

### Error Logging Detail
**Q**: What level of error detail should be logged?
**A**: Log error message, line number, post ID, and feed ID. Avoid logging content samples due to privacy concerns.

### Maximum Posts Per Feed
**Q**: What's the expected maximum number of posts per feed?
**A**: Will handle limits in future iteration. For now, process all posts returned by RSS feed (typically 10-50, but could be hundreds).

### Testing Strategy
**Q**: How should we test the cleaning transformations?
**A**: Manual testing by developer. No automated test fixtures needed for this phase.
