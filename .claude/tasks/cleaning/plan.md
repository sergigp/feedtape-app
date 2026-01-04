# Implementation Plan: RSS Content Cleaning Pipeline

## Overview

Transform RSS content processing by implementing a phase-based pipeline architecture. This plan focuses on **cleaning phase only** while establishing infrastructure for future phases (summarization, TTS enhancements).

## Architecture Changes

### Current Flow
```
FeedList.loadFeeds() → feedService.getFeeds() → loadFeedStats()
  → feedService.fetchRSSContent() → parseRSSFeed()
  → posts stored in App.tsx state

handleFeedSelect() → fetchRSSContent() again → parseRSSFeed()
  → posts stored in App.tsx state
```

### Target Flow
```
App.tsx startup → AppContext.initializeFeeds()
  → feedService.getFeeds()
  → fetchRSSContent() for all feeds in parallel
  → parseRSSFeed() → posts with status='raw'
  → contentPipelineService.processPosts()
    → cleaningPhase() for each post (batched)
    → update status='cleaning' → 'cleaned'
    → posts available with cleanedContent

FeedList → read from PostsContext (no re-fetching)
TrackList → read from PostsContext (no re-fetching)
Playback → use cleanedContent field
```

## Critical Files

### New Files
- `src/contexts/PostsContext.tsx` - Global posts state management
- `src/services/contentPipelineService.ts` - Pipeline orchestration
- `src/services/contentCleaningService.ts` - HTML cleaning transformations

### Modified Files
- `src/App.tsx` - Add PostsProvider wrapper, remove local posts state
- `src/components/FeedList.tsx` - Remove RSS fetching, read from context
- `src/components/TrackList.tsx` - Read posts from context
- `src/services/sherpaOnnxService.ts` - Use cleanedContent field
- `src/types/index.ts` - Update Post interface with new fields
- `package.json` - Add html-to-text dependency

## User Stories

### Iteration 1: Update Post Model & Install Dependencies
**Expected Behavior**: Post interface supports state machine fields, html-to-text library available

**Tests to Implement/Modify**:
- Manual verification: Check TypeScript compilation succeeds
- Manual verification: npm install completes without errors
- Manual verification: Post type exported correctly from types/index.ts

**Implementation Notes**:
1. Install `html-to-text` library via npm: `npm install html-to-text`
2. Update `Post` interface in `src/types/index.ts`:
   - Add `id: string` field (generated from link using simple hash or link itself)
   - Add `feedId: string` field
   - Add `rawContent: string` field (original RSS content from `content`)
   - Add `cleanedContent: string | null` field (null until cleaning completes)
   - Add `status: 'raw' | 'cleaning' | 'cleaned' | 'error'` field
   - Keep existing fields: `title`, `link`, `pubDate`, `author`, `content`, `plainText`, `language`
3. Create helper function `generatePostId(link: string): string`:
   - Simple approach: use link as ID (already unique)
   - Or: create hash from link using simple string hash function
4. Update `parseRSSFeed()` in `src/services/rssParser.ts`:
   - These new fields will be populated by PostsContext when creating posts
   - Parser continues returning existing Post structure
   - Context layer adds: `id`, `feedId`, `rawContent`, `cleanedContent`, `status`

---

### Iteration 2: Content Cleaning Service
**Expected Behavior**: Cleaning service transforms HTML to TTS-optimized plain text

**Tests to Implement/Modify**:
- Manual test: Log before/after cleaning with sample RSS content
- Manual test: Verify HTML tags removed
- Manual test: Verify abbreviations expanded (e.g., etc., i.e.)
- Manual test: Verify URLs removed

**Implementation Notes**:
1. Create `src/services/contentCleaningService.ts`
2. Implement multi-step cleaning:
   ```typescript
   function cleanContent(rawHtml: string): string {
     const plainText = htmlToText(rawHtml);  // Step 1: HTML → text
     const cleaned = removeJunk(plainText);   // Step 2: Remove control chars
     const ttsOptimized = postProcessForTTS(cleaned);  // Step 3: TTS transformations
     return ttsOptimized;
   }
   ```
3. Implement `postProcessForTTS()` transformations:
   - Remove URLs: `/https?:\/\/[^\s]+/g`
   - Expand abbreviations: `etc. → etcetera`, `e.g. → for example`, `i.e. → that is`
   - Symbols: `& → and`, `@ → at`, `# → hashtag`
   - Numbers: `10k → 10 thousand`, `5m → 5 million`
   - Collapse newlines: `/\n{3,}/g → \n\n`
4. Add minimum content length validation (50 chars)
5. Export singleton: `export default new ContentCleaningService()`

---

### Iteration 3: Pipeline Service & Phase Architecture
**Expected Behavior**: Pipeline orchestrates cleaning phase with state updates

**Tests to Implement/Modify**:
- Manual test: Pipeline processes single post through cleaning phase
- Manual test: Status transitions logged correctly (raw → cleaning → cleaned)
- Manual test: Multiple posts processed with batch size 10
- Manual test: Failed posts logged and skipped

**Implementation Notes**:
1. Create `src/services/contentPipelineService.ts`
2. Define phase interface:
   ```typescript
   type PipelinePhase = (post: Post) => Promise<Post>;

   const phases: PipelinePhase[] = [
     cleaningPhase,
     // Future: summarizationPhase
   ];
   ```
3. Implement `processPost(post, onUpdate)`:
   - Run each phase sequentially
   - Update status between phases
   - Call `onUpdate(post)` after each phase
   - Error handling: catch, log, set status='error'
4. Implement `processPosts(posts, onUpdate)`:
   - Batch size: 10 (configurable)
   - Async queue: process as slots become available
   - Don't wait for full batch to complete
5. Add performance logging:
   - `[Pipeline] Starting processing for ${postId}`
   - `[Cleaning] Started/Completed/Failed for ${postId} in ${duration}ms`
6. Export singleton

---

### Iteration 4: PostsContext - Global State Management
**Expected Behavior**: Posts stored globally, components subscribe via useContext

**Tests to Implement/Modify**:
- Manual test: Posts state persists across screen navigation
- Manual test: State updates trigger re-renders in FeedList
- Manual test: State updates trigger re-renders in TrackList

**Implementation Notes**:
1. Create `src/contexts/PostsContext.tsx` following AuthContext pattern
2. Define context interface:
   ```typescript
   interface PostsContextType {
     posts: Post[];                    // All posts from all feeds
     isLoading: boolean;              // True during initial fetch
     initializeFeeds: () => Promise<void>;
     updatePost: (post: Post) => void;
     getPostsByFeed: (feedId: string) => Post[];
     clearPosts: () => void;
   }
   ```
3. Implement PostsProvider:
   - `useState<Post[]>([])` for posts
   - `useState<boolean>(true)` for isLoading
   - `updatePost()`: find by id, replace, trigger re-render
   - `getPostsByFeed()`: filter by feedId
4. Create `usePosts()` hook for accessing context
5. DO NOT implement `initializeFeeds()` yet (next iteration)

---

### Iteration 5: App Startup Integration
**Expected Behavior**: Feeds/RSS fetched at app startup, pipeline runs automatically

**Tests to Implement/Modify**:
- Manual test: App startup fetches all feeds
- Manual test: RSS content fetched for all feeds in parallel
- Manual test: Posts added to context with status='raw'
- Manual test: Pipeline starts automatically after parsing
- Manual test: FeedList displays while pipeline runs in background

**Implementation Notes**:
1. Implement `initializeFeeds()` in PostsContext:
   ```typescript
   async initializeFeeds() {
     setIsLoading(true);
     const feeds = await feedService.getFeeds();
     const allPosts: Post[] = [];

     const results = await Promise.allSettled(
       feeds.map(async (feed) => {
         const xmlContent = await fetchRSSContent(feed.url);  // 15s timeout
         const parsedPosts = parseRSSFeed(xmlContent);
         return parsedPosts.map(post => ({
           ...post,
           id: generateId(post.link),
           feedId: feed.id,
           rawContent: post.content,
           cleanedContent: null,
           status: 'raw' as const,
         }));
       })
     );

     // Collect successful results, log failures
     results.forEach((result, index) => {
       if (result.status === 'fulfilled') {
         allPosts.push(...result.value);
       } else {
         console.error(`[Startup] Feed ${feeds[index].id} failed:`, result.reason);
       }
     });

     setPosts(allPosts);
     setIsLoading(false);

     // Start pipeline (non-blocking)
     contentPipelineService.processPosts(allPosts, updatePost);
   }
   ```
2. Update `App.tsx`:
   - Import PostsProvider, wrap AppContent with it
   - Call `initializeFeeds()` in useEffect when authenticated
   - Keep splash screen visible until `isLoading=false`
3. Add 15-second timeout per feed using `Promise.race()`

---

### Iteration 6: Update FeedList Component
**Expected Behavior**: FeedList reads from context, no RSS re-fetching

**Tests to Implement/Modify**:
- Manual test: FeedList displays posts from context
- Manual test: Feed stats calculated from context posts
- Manual test: Unread count correct (filter by readStatusService)
- Manual test: Total duration calculated from posts

**Implementation Notes**:
1. Update `src/components/FeedList.tsx`:
   - Replace `loadFeedStats()` RSS fetching with context reads
   - Use `usePosts()` hook: `const { posts, getPostsByFeed } = usePosts()`
   - Calculate stats from context posts:
     ```typescript
     const feedPosts = getPostsByFeed(feed.id);
     const cleanedPosts = feedPosts.filter(p => p.status === 'cleaned');
     const unreadPosts = cleanedPosts.filter(p => !readStatusService.isRead(p.link));
     const totalDuration = unreadPosts.reduce((sum, p) =>
       sum + nativeTtsService.estimateDuration(p.cleanedContent), 0
     );
     ```
   - Remove `fetchRSSContent()` and `parseRSSFeed()` calls
   - Keep loading state during context initialization
2. Filter out posts with `status='error'` (invisible to user)

---

### Iteration 7: Update TrackList Component & Playback
**Expected Behavior**: TrackList reads from context, playback uses cleanedContent

**Tests to Implement/Modify**:
- Manual test: TrackList displays posts from selected feed
- Manual test: Only shows posts with status='cleaned'
- Manual test: Playback uses cleanedContent field
- Manual test: Failed posts invisible to user

**Implementation Notes**:
1. Update `src/components/TrackList.tsx`:
   - Use `usePosts()` hook instead of props
   - Filter posts: `posts.filter(p => p.feedId === selectedFeed.id && p.status === 'cleaned')`
   - Remove any RSS re-fetching logic
2. Update `src/App.tsx` handleFeedSelect:
   - Remove `fetchRSSContent()` and `parseRSSFeed()` calls
   - Select feed, navigate to TrackList
   - TrackList will read from context
3. Update playback in `src/App.tsx` (around line 180-200):
   - In `startPlayback()`, change this line:
     ```typescript
     // OLD: await sherpaOnnxService.speakWithTitle(post.title, post.plainText, ...)
     // NEW:
     const contentToSpeak = post.cleanedContent || post.plainText;
     await sherpaOnnxService.speakWithTitle(post.title, contentToSpeak, ...)
     ```
   - Fallback to `post.plainText` ensures backward compatibility during migration
4. Update `handleBackToFeedList()`:
   - Don't clear posts (keep in context)
   - Just navigate back to FeedList
5. Update duration estimation in FeedList:
   - Use `cleanedContent` length for more accurate duration estimates
   - Cleaned content is typically shorter than raw HTML

---

## Edge Cases & Error Handling

### Feed Fetching Failures
- **Timeout**: 15 seconds per feed via `Promise.race()`
- **Network errors**: Log and skip feed, continue with others
- **Invalid RSS**: Catch parsing errors, log, skip feed

### Cleaning Failures
- **html-to-text crashes**: Catch error, log, set status='error'
- **Content too short**: Skip if <50 chars after cleaning
- **Empty content**: Skip post (don't add to context)

### Pipeline Execution
- **App backgrounded**: Continue processing (pause feature deferred)
- **Multiple updates**: Use post.id for O(1) lookup in updatePost()
- **Race conditions**: Use functional setState for atomic updates

### Display & Playback
- **Posts still cleaning**: Don't show in TrackList until status='cleaned'
- **All posts failed**: Show "No articles available" message
- **cleanedContent null**: Fallback to plainText (defensive)

## Performance Considerations

### Batch Processing
- Batch size: 10 concurrent cleanings
- Queue-based: add new post as soon as slot available
- Total posts: 10-50 per feed typical, could be hundreds

### Memory Usage
- All posts in memory: ~500 posts × ~10KB = ~5MB
- No persistent storage (deferred to future iteration)
- Clear context on logout

### Logging
- Console logs for all pipeline operations
- Track cleaning duration per post
- Success/failure rates per feed
- Total pipeline duration

## Success Criteria Checklist

- [ ] Feeds fetched at app startup (not FeedList mount)
- [ ] Posts added to context with status='raw'
- [ ] Pipeline runs per-post without blocking UI
- [ ] Cleaning transforms HTML → TTS-optimized text
- [ ] Posts have cleanedContent before playback
- [ ] Sherpa ONNX uses cleanedContent field
- [ ] Performance metrics logged to console
- [ ] Failed posts logged and skipped (invisible to user)
- [ ] FeedList reads from context (no re-fetching)
- [ ] TrackList filters posts by status='cleaned'
- [ ] Pipeline infrastructure ready for future phases

## Future Iterations (Out of Scope)

- Summarization phase (~5 seconds per post)
- TTS enhancement phase (pauses, pacing)
- WAV caching
- Persistent storage
- UX improvements (loading indicators, progress)
- Background processing pause/resume
- Retry logic for failed posts
- Maximum posts limit per feed
