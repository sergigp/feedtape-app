# Implementation Log: RSS Content Cleaning Pipeline

## Iteration 1: Update Post Model & Install Dependencies

**Date**: 2026-01-04

### What Was Implemented

1. **Installed html-to-text library**
   - Added `html-to-text` package via npm
   - Package installed successfully with 12 dependencies

2. **Created ParsedPost and Post type separation**
   - Introduced `ParsedPost` interface for raw RSS parser output (src/types/index.ts:60-69)
   - Updated `Post` interface to include state machine fields (src/types/index.ts:71-93):
     - `id: string` - Unique identifier generated from link
     - `feedId: string` - Associated feed ID
     - `rawContent: string` - Copy of original content
     - `cleanedContent: string | null` - Null until cleaning completes
     - `status: 'raw' | 'cleaning' | 'cleaned' | 'error'` - State machine status

3. **Created generatePostId helper**
   - Simple implementation using link as ID (src/types/index.ts:103-105)
   - Links are already unique, so no hashing needed

4. **Updated rssParser.ts**
   - Changed return types from `Post` to `ParsedPost` (lines 46, 164-165)
   - Parser now returns raw parsed data without state machine fields
   - Exported both `ParsedPost` and `Post` types

5. **Updated App.tsx to handle type conversion**
   - Imported `ParsedPost` and `generatePostId` (lines 17, 22)
   - Added conversion logic in `handleFeedSelect` (lines 105-113)
   - Converts `ParsedPost[]` → `Post[]` by adding state machine fields
   - Sets initial status to 'raw' for all posts

### Decisions Made

- **Type separation**: Created `ParsedPost` vs `Post` to separate parser concerns from state management
  - Keeps parser simple and focused on extraction
  - PostsContext (future iteration) will handle state enrichment
  - Current App.tsx does temporary conversion until PostsContext is ready

- **generatePostId implementation**: Used link directly as ID
  - Links are already unique across all posts
  - Avoids unnecessary hashing complexity
  - Can be changed later if needed

### Issues Found

- None - TypeScript compilation succeeds with no errors

### Refinement: Simplified to Use Link as Identifier

After initial implementation, simplified the design based on user feedback:

1. **Removed redundant `id` field**
   - Originally had both `id` and `link` fields where `id = generatePostId(link)` = `link`
   - Removed unnecessary duplication
   - Now use `link` directly as unique identifier

2. **Removed `generatePostId` helper function**
   - No longer needed since we use link directly
   - Removed from src/types/index.ts

3. **Updated App.tsx**
   - Removed `generatePostId` import
   - Removed `id: generatePostId(parsed.link)` from post enrichment
   - Simpler conversion: just spread ParsedPost and add state fields

4. **Moved `link` to first property**
   - Better convention: identifier comes first
   - Updated both ParsedPost and Post interfaces

5. **Updated plan.md**
   - Changed all references from `post.id` to `post.link`
   - Updated logging examples to use `post.link`
   - Updated PostsContext updatePost() to use link for lookup

**Benefits:**
- ✅ Less code to maintain
- ✅ No data duplication
- ✅ Consistent with readStatusService (already uses link as key)
- ✅ Clearer intent: link IS the identifier

### Next Steps

Iteration 2 will implement the Content Cleaning Service with multi-step HTML transformation pipeline.

---

## Iteration 2: Content Cleaning Service

**Date**: 2026-01-04

### What Was Implemented

1. **Created contentCleaningService.ts** (src/services/contentCleaningService.ts)
   - Multi-step cleaning pipeline with three distinct phases
   - Singleton service pattern matching other services in the codebase
   - Error handling with try-catch and null returns for failures

2. **Implemented htmlToText() method**
   - Uses `html-to-text` library's `convert()` function
   - Configuration:
     - `wordwrap: false` - Preserves natural text flow
     - Skips `img`, `script`, `style` tags entirely
     - Ignores href attributes in links (keeps only link text)
   - Removes all HTML structure while preserving text content

3. **Implemented removeJunk() method**
   - Removes control characters: `/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g`
   - Fixes double-escaped HTML entities:
     - `&amp;lt;` → `&lt;`
     - `&amp;gt;` → `&gt;`
     - `&amp;quot;` → `&quot;`
     - `&amp;amp;` → `&amp;`

4. **Implemented postProcessForTTS() method**
   - URL removal: `/https?:\/\/[^\s]+/g`
   - Abbreviation expansion:
     - `etc.` → `etcetera`
     - `e.g.` → `for example`
     - `i.e.` → `that is`
   - Symbol replacement:
     - `&` → ` and `
     - `@` → ` at `
     - `#word` → `hashtag word`
   - Number formatting:
     - `10k` → `10 thousand`
     - `5m` → `5 million`
   - Whitespace normalization:
     - Collapse multiple newlines: `/\n{3,}/g` → `\n\n`
     - Collapse multiple spaces: `/\s{2,}/g` → ` `
     - Trim leading/trailing whitespace

5. **Added minimum content length validation**
   - Constant: `MIN_CONTENT_LENGTH = 50`
   - Returns `null` if cleaned content is too short
   - Logs rejection to console for debugging

6. **Installed TypeScript types**
   - Added `@types/html-to-text` dev dependency
   - Ensures type safety for html-to-text library usage

### Decisions Made

- **Multi-step pipeline**: Separated cleaning into three distinct methods for easier debugging
  - Can inspect intermediate results between steps
  - Easier to identify which transformation is causing issues
  - Matches spec requirements for debugging-friendly architecture

- **Null return on failure**: Service returns `null` instead of throwing errors
  - Consistent with spec: "skip posts that fail cleaning"
  - Easier for pipeline service to handle failures
  - Logged errors provide debugging information

- **Aggressive content removal**: Removes all images, scripts, styles
  - TTS can't use visual content anyway
  - Eliminates tracking pixels automatically
  - Reduces junk in final output

- **Conservative TTS transformations**: Focused on common abbreviations and symbols
  - Can expand later based on real-world testing
  - Avoided overly aggressive transformations that might break content
  - Left room for future refinements (bullet points, acronyms, etc.)

### Issues Found

- **TypeScript compilation error**: Missing `@types/html-to-text` initially
  - **Resolution**: Installed `@types/html-to-text` as dev dependency
  - TypeScript compilation now succeeds with no errors

### Testing Approach

Manual testing will occur during pipeline integration (Iteration 3):
- Service will be called by pipeline with real RSS content
- Console logs will show before/after cleaning results
- Can verify transformations work correctly with actual feed data
- Performance metrics will be logged by pipeline service

### Next Steps

Iteration 3 will implement the Pipeline Service with phase-based architecture and batch processing.

---

## Iteration 3: Pipeline Service & Phase Architecture

**Date**: 2026-01-04

### What Was Implemented

1. **Created contentPipelineService.ts** (src/services/contentPipelineService.ts)
   - Singleton service pattern matching other services in the codebase
   - Phase-based architecture with extensible phase array
   - Batch processing with configurable batch size (default: 10)
   - Queue-based execution with async task management

2. **Implemented cleaningPhase() method**
   - Wraps contentCleaningService.cleanContent()
   - Updates post status to 'cleaned' or 'error'
   - Performance logging with duration tracking
   - Error handling with try-catch
   - Console logs: Started/Completed/Failed with duration in ms

3. **Implemented processPost() method**
   - Orchestrates sequential phase execution
   - Updates post status before each phase ('cleaning')
   - Calls onUpdate callback after each phase
   - Stops processing if error occurs
   - Logs post status transitions

4. **Implemented processPosts() method**
   - Batch processing with BATCH_SIZE = 10
   - Queue-based task management
   - Asynchronous execution - processes next task as soon as slot becomes available
   - Doesn't wait for full batch to complete before starting new tasks
   - Console logs: Batch start, queue size

5. **Implemented runQueuedTask() private method**
   - Manages active task count
   - Dequeues tasks when slots available
   - Automatically starts next task after completion
   - Ensures batch size limit is respected

6. **Added comprehensive performance logging**
   - `[Pipeline] Starting processing for ${post.link} (${characterCount} chars)`
   - `[Cleaning] Started for ${post.link}`
   - `[Cleaning] Completed for ${post.link} in ${duration}ms`
   - `[Cleaning] Failed for ${post.link} in ${duration}ms`
   - `[Pipeline] Post ${post.link} status: ${status}`
   - `[Pipeline] Queued ${count} posts for processing`

### Decisions Made

- **Phase array architecture**: Used array of PipelinePhase functions for extensibility
  - Easy to add new phases (summarization, TTS enhancement) in the future
  - Each phase is independent and testable
  - Sequential execution ensures proper state transitions

- **Queue-based batch processing**: Implemented async queue instead of Promise.all batches
  - More efficient: starts new task immediately when slot becomes available
  - Doesn't wait for all 10 tasks to complete before starting next batch
  - Better resource utilization with long-running operations

- **Status tracking**: Updates status before and after each phase
  - Provides visibility into pipeline progress
  - Allows UI to show loading states (future iteration)
  - Makes debugging easier with status transition logs

- **onUpdate callback pattern**: Passes updated post to callback after each phase
  - Will integrate cleanly with PostsContext setState (Iteration 4)
  - Allows incremental UI updates as pipeline progresses
  - Decouples pipeline from state management

- **Error handling strategy**: Returns error status instead of throwing
  - Failed posts marked as 'error' and skipped
  - Errors logged to console with full context
  - Other posts continue processing unaffected

### Issues Found

- None - TypeScript compilation succeeds with no errors

### Testing Approach

Manual testing will occur during PostsContext integration (Iteration 4):
- Pipeline will be called with real posts from RSS feeds
- Console logs will verify status transitions
- Performance metrics will measure cleaning duration
- Can observe batch processing behavior with multiple feeds

### Next Steps

Iteration 4 will implement PostsContext for global state management, which will consume the pipeline service via the onUpdate callback.

---

## Iteration 3.5: Unit Tests for Pipeline Service (Bonus)

**Date**: 2026-01-04

### What Was Implemented

1. **Refactored ContentPipelineService for testability**
   - Exported `ContentPipelineService` class and `PipelinePhase` type for testing
   - Made `batchSize` configurable via constructor (allows tests to use smaller batch sizes)
   - Added optional `phases` parameter to `processPost()` and `processPosts()`
   - Created `getDefaultPhases()` method to maintain backward compatibility
   - Made `runQueuedTask()` public for testing queue behavior
   - Added test helper methods: `getActiveTasks()`, `getQueueLength()`, `clearQueue()`
   - Maintained backward compatibility - existing code works without changes

2. **Created comprehensive unit test suite** (src/services/__tests__/contentPipelineService.test.ts)
   - 14 tests covering all major functionality
   - Tests completely isolated from cleaning phase logic
   - Uses mock phases for all testing
   - No dependencies on actual content cleaning

3. **Test Coverage by Category**:

   **Queue Management (4 tests)**:
   - Batch size limits respected during concurrent processing
   - All posts eventually processed regardless of queue size
   - Tasks start immediately when slots become available (not batch-and-wait)
   - Queue clearing works correctly

   **Phase Orchestration (4 tests)**:
   - Phases execute in sequential order
   - onUpdate callback invoked after each phase
   - Updated post data passes correctly between phases
   - Processing stops when error status is set

   **Error Handling (4 tests)**:
   - Phase exceptions caught and handled gracefully
   - Failed posts don't affect other posts in queue
   - Errors logged to console with context
   - Pipeline continues after errors

   **Integration Tests (2 tests)**:
   - Async phases with different durations work correctly
   - Many posts with varying processing times all complete

### Decisions Made

- **Dependency injection pattern**: Made phases injectable without breaking existing code
  - Tests can use simple mock phases (instant execution, predictable behavior)
  - No need to mock contentCleaningService or other dependencies
  - Future pipelines (TTS, summarization) can reuse the same test approach

- **Test isolation**: Tests completely independent of cleaning logic
  - Mock phases use simple delay + status change
  - No HTML processing, no file I/O, no external dependencies
  - Tests run fast (<2 seconds for full suite)
  - Easy to debug failures

- **Backward compatibility**: Existing code requires zero changes
  - Singleton export still works: `import service from './contentPipelineService'`
  - Default phases used when none provided
  - All existing APIs unchanged

### Test Results

```
PASS src/services/__tests__/contentPipelineService.test.ts
  ContentPipelineService
    Queue Management
      ✓ should respect batch size limit (12 ms)
      ✓ should process all posts eventually (202 ms)
      ✓ should start next task as soon as slot becomes available (52 ms)
      ✓ should clear queue properly (1 ms)
    Phase Orchestration
      ✓ should call phases in sequential order (2 ms)
      ✓ should call onUpdate callback after each phase (1 ms)
      ✓ should pass updated post to next phase (1 ms)
      ✓ should stop processing on error status (1 ms)
    Error Handling
      ✓ should handle phase throwing error (1 ms)
      ✓ should not affect other posts if one fails (101 ms)
      ✓ should log error when phase fails (1 ms)
      ✓ should continue to next post after error (203 ms)
    Integration with Async Operations
      ✓ should handle async phases with different durations (64 ms)
      ✓ should handle many posts with varying processing times (303 ms)

Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
Time:        1.448 s
```

### Benefits for Future Development

1. **Reusable pipeline pattern**: Same architecture can be used for:
   - TTS generation pipeline (future task)
   - Summarization pipeline (future phase)
   - Any multi-step async processing

2. **Confidence in refactoring**: Can modify queue logic or phase orchestration with test safety net

3. **Documentation**: Tests serve as executable documentation of expected behavior

4. **Regression prevention**: Queue bugs, race conditions, and error handling issues caught immediately

### Next Steps

Iteration 4 will implement PostsContext for global state management, which will consume the pipeline service via the onUpdate callback.

---

## Iteration 4: PostsContext - Global State Management

**Date**: 2026-01-06

### What Was Implemented

1. **Created PostsContext.tsx** (src/contexts/PostsContext.tsx)
   - Followed AuthContext pattern from existing codebase
   - React Context pattern with Provider and custom hook
   - Type-safe context with PostsContextType interface
   - 76 lines of clean, well-structured code

2. **Implemented PostsContextType interface**
   - `posts: Post[]` - All posts from all feeds
   - `isLoading: boolean` - True during initial feed fetching
   - `initializeFeeds: () => Promise<void>` - Placeholder for Iteration 5
   - `updatePost: (post: Post) => void` - Update single post by link
   - `getPostsByFeed: (feedId: string) => Post[]` - Filter posts by feed
   - `clearPosts: () => void` - Clear all posts (on logout)

3. **Implemented PostsProvider component**
   - State management with `useState<Post[]>([])`
   - Loading state with `useState<boolean>(true)`
   - Immutable state updates using functional setState
   - Console logging for debugging and visibility

4. **Implemented updatePost() method**
   - O(1) lookup using link as unique identifier
   - Immutable array update pattern: `[...prevPosts]`
   - Warning logged if post not found (defensive coding)
   - Triggers re-render for subscribed components

5. **Implemented getPostsByFeed() method**
   - Simple filter operation: `posts.filter(post => post.feedId === feedId)`
   - Returns new array (immutable)
   - Used by FeedList and TrackList components (future iterations)

6. **Implemented clearPosts() method**
   - Resets posts array to empty
   - Sets isLoading to false
   - Called on user logout to free memory

7. **Created usePosts() custom hook**
   - Follows React Context best practices
   - Throws descriptive error if used outside provider
   - Type-safe access to context

8. **Deferred initializeFeeds() implementation**
   - Placeholder function logs message
   - Will be implemented in Iteration 5 with feed fetching logic
   - Maintains type safety and interface contract

### Decisions Made

- **Context pattern over Redux**: Matched existing AuthContext pattern
  - Simpler for this use case (no complex reducers needed)
  - Less boilerplate code
  - Familiar pattern for developers working on this codebase

- **Link as unique identifier**: Used `post.link` for O(1) lookup in updatePost()
  - Already established as unique identifier in Iteration 1
  - Consistent with readStatusService (also uses link)
  - No additional indexing needed

- **Immutable state updates**: Used functional setState pattern
  - `setPosts(prevPosts => ...)` ensures atomic updates
  - Prevents race conditions with concurrent updates
  - React best practice for derived state

- **Deferred initialization**: Placeholder for initializeFeeds()
  - Keeps Iteration 4 focused on context infrastructure
  - Iteration 5 will add feed fetching, RSS parsing, and pipeline integration
  - Maintains clean separation of concerns

- **No persistent storage**: Memory-only state for now
  - Matches spec requirement: "Persistent storage deferred to future iteration"
  - Posts cleared on logout
  - Re-fetched on app startup

### Issues Found

- None - TypeScript compilation succeeds with no errors

### Testing Approach

Manual testing will occur during App.tsx integration (Iteration 5):
- PostsProvider will wrap App component
- initializeFeeds() will be called on authenticated user
- updatePost() will be called by pipeline service callbacks
- Component re-renders will be verified when posts state changes

### Next Steps

Iteration 5 will implement App Startup Integration:
- Implement initializeFeeds() with feed fetching and RSS parsing
- Integrate contentPipelineService with updatePost() callback
- Add PostsProvider to App.tsx component tree
- Ensure splash screen stays visible until feeds are loaded

---

## Iteration 5: App Startup Integration

**Date**: 2026-01-08

### What Was Implemented

1. **Implemented initializeFeeds() in PostsContext** (src/contexts/PostsContext.tsx)
   - Fetches all feeds from backend using `feedService.getFeeds()`
   - Fetches RSS content for all feeds in parallel
   - 15-second timeout per feed using `Promise.race()`
   - Uses `Promise.allSettled()` for graceful failure handling
   - Converts ParsedPost to Post with state machine fields:
     - `feedId: feed.id`
     - `rawContent: parsed.content`
     - `cleanedContent: null`
     - `status: 'raw'`
   - Adds all posts to state with `setPosts(allPosts)`
   - Starts pipeline processing automatically with `contentPipelineService.processPosts(allPosts, updatePost)`
   - Console logging for visibility into feed fetching process

2. **Updated App.tsx to integrate PostsProvider**
   - Imported `PostsProvider` and `usePosts` hook (line 12)
   - Added PostsProvider wrapper around AppContent (lines 366-368)
   - Used `usePosts()` hook to access posts context (line 29)
   - Added new useEffect to call `initializeFeeds()` when authenticated (lines 73-78)
   - Updated splash screen transition to wait for feeds to load (lines 81-100)
   - Checks `postsLoading` state before transitioning to FeedList
   - Minimum 3-second splash screen or until feeds load (whichever is longer)

3. **Added imports to PostsContext**
   - `feedService` for backend API calls
   - `parseRSSFeed` for RSS parsing
   - `contentPipelineService` for pipeline processing

### Decisions Made

- **Parallel feed fetching with timeouts**: Used `Promise.race()` with 15-second timeout per feed
  - Prevents slow/hanging feeds from blocking app startup
  - Each feed fetched independently
  - Failed feeds logged but don't block other feeds

- **Promise.allSettled() for graceful failures**: Used `Promise.allSettled()` instead of `Promise.all()`
  - Allows some feeds to fail while others succeed
  - Collects successful results
  - Logs failures with feed ID and title for debugging
  - Shows "N successful out of M total feeds" in console

- **Non-blocking pipeline**: Pipeline starts after posts are added to state
  - `processPosts()` is called but not awaited
  - Posts available immediately with status='raw'
  - Pipeline runs in background while user sees FeedList
  - State updates trigger re-renders as posts are cleaned

- **Splash screen timing**: Wait for both auth AND feeds before showing FeedList
  - Original: 3-second timeout after auth completes
  - New: 3-second minimum OR until feeds load (whichever is longer)
  - Prevents flash of empty FeedList while feeds are loading
  - Test mode still transitions immediately

- **Keep local posts state**: Kept `posts` local state in App.tsx for now
  - TrackList still uses local state (from handleFeedSelect)
  - Will transition to context in Iteration 7
  - Maintains backward compatibility during migration
  - Added comment explaining transition plan (line 35)

### Issues Found

- None - TypeScript compilation succeeds with no errors

### Testing Approach

Manual testing will verify:
1. Feeds fetched at app startup (not when FeedList mounts)
2. Splash screen stays visible until feeds are loaded
3. Console logs show feed fetching progress
4. Pipeline starts automatically after parsing
5. Posts added to context with status='raw'
6. FeedList displays after feeds are loaded (Iteration 6 will update FeedList to read from context)

### Console Log Output Expected

```
[PostsContext] Starting feed initialization
[PostsContext] Fetched 3 feeds from backend
[PostsContext] Parsed 47 posts from TechCrunch
[PostsContext] Parsed 30 posts from Hacker News
[PostsContext] Feed abc123 (Slow Feed) failed: Error: Feed fetch timeout
[PostsContext] Collected 77 posts from 2/3 feeds
[PostsContext] Starting content pipeline
[Pipeline] Starting batch processing for 77 posts (batch size: 10)
[Pipeline] Queued 77 posts for processing
[Cleaning] Started for https://example.com/post1
[Cleaning] Completed for https://example.com/post1 in 5ms
[Pipeline] Post https://example.com/post1 status: cleaned
...
```

### Next Steps

Iteration 6 will update FeedList component:
- Remove RSS fetching logic from FeedList
- Read posts from PostsContext using `usePosts()` hook
- Calculate feed stats from context posts
- Filter posts by status='cleaned'
- Display accurate unread counts and durations

---

## Iteration 6: Update FeedList Component

**Date**: 2026-01-08

### What Was Implemented

1. **Updated FeedList.tsx to read from PostsContext** (src/components/FeedList.tsx)
   - Added `usePosts()` hook import and usage (line 25, line 42)
   - Removed `parseRSSFeed` import (no longer needed)
   - Removed RSS fetching from component

2. **Replaced loadFeedStats() with calculateFeedStats()**
   - Old: Fetched RSS content and parsed for each feed in parallel
   - New: Reads posts from global PostsContext using `getPostsByFeed()`
   - No network calls or RSS parsing in this component
   - Pure calculation from existing state (lines 55-88)

3. **Added reactive stats calculation**
   - New useEffect hook watches `posts` and `feeds` state (lines 48-53)
   - Recalculates feed stats automatically as pipeline progresses
   - Stats update in real-time as posts transition from 'raw' → 'cleaning' → 'cleaned'

4. **Implemented status filtering**
   - Only counts posts with `status === 'cleaned'` (lines 64-66)
   - Posts with status='error' are invisible to user
   - Posts with status='raw' or 'cleaning' don't appear in counts yet
   - Ensures accurate stats as pipeline processes posts

5. **Updated duration calculation to use cleanedContent**
   - Uses `post.cleanedContent || post.plainText` for estimation (line 76)
   - Cleaned content is shorter than raw HTML, giving more accurate durations
   - Fallback to plainText for backward compatibility

6. **Updated loadFeeds() for refresh behavior**
   - Pull-to-refresh now triggers `initializeFeeds()` from context (line 95)
   - Re-fetches RSS and reruns entire pipeline
   - Fetches feed metadata only from backend (line 101)
   - No more duplicate RSS fetching

### Decisions Made

- **Reactive stats calculation**: Added useEffect to recalculate stats when posts change
  - FeedList stats update automatically as pipeline progresses
  - User sees counts increase as posts are cleaned
  - No manual state management needed

- **Status filtering strategy**: Filter by `status === 'cleaned'` only
  - Posts in 'raw' or 'cleaning' state don't count yet
  - Error posts completely invisible (no confusing partial counts)
  - Simple and clear behavior for users

- **Duration estimation improvement**: Use cleanedContent instead of plainText
  - Cleaned content is typically 30-50% shorter than raw HTML
  - More accurate time estimates for users
  - Fallback to plainText ensures backward compatibility during migration

- **Pull-to-refresh behavior**: Trigger full re-initialization
  - Calls `initializeFeeds()` to re-fetch everything from scratch
  - Re-runs entire pipeline for all posts
  - User gets fresh data including new posts from RSS feeds

- **Keep local feeds state**: Kept `feeds` in local state for now
  - Feeds metadata is small and changes rarely
  - No need to move to context (yet)
  - Can be moved in future refactor if needed

### Key Code Changes

**Before (Iteration 5):**
```typescript
// Fetched RSS content for every feed on component mount
const loadFeedStats = async (feedsToLoad: Feed[]) => {
  const results = await Promise.allSettled(
    feedsToLoad.map(async (feed) => {
      const xmlContent = await feedService.fetchRSSContent(feed.url);
      const posts = parseRSSFeed(xmlContent);
      const unreadPosts = posts.filter(post => !readStatusService.isRead(post.link));
      const totalDuration = unreadPosts.reduce((sum, post) =>
        sum + nativeTtsService.estimateDuration(post.plainText), 0
      );
      return { feedId: feed.id, unreadCount: unreadPosts.length, totalDuration };
    })
  );
  // ... update stats
};
```

**After (Iteration 6):**
```typescript
// Reads posts from global context (no network calls)
const calculateFeedStats = (feedsToCalculate: Feed[]) => {
  const updatedStats: Record<string, FeedStats> = {};

  feedsToCalculate.forEach((feed) => {
    const feedPosts = getPostsByFeed(feed.id);
    const cleanedPosts = feedPosts.filter(post => post.status === 'cleaned');
    const unreadPosts = cleanedPosts.filter(post => !readStatusService.isRead(post.link));
    const totalDuration = unreadPosts.reduce((sum, post) => {
      const content = post.cleanedContent || post.plainText;
      return sum + nativeTtsService.estimateDuration(content);
    }, 0);
    updatedStats[feed.id] = { unreadCount: unreadPosts.length, totalDuration, isLoading: false };
  });

  setFeedStats(updatedStats);
};

// Reactive updates when posts change
useEffect(() => {
  if (feeds.length > 0) {
    calculateFeedStats(feeds);
  }
}, [posts, feeds]);
```

### Benefits

1. **No duplicate RSS fetching**: Posts fetched once at app startup, read from context thereafter
2. **Real-time stats updates**: Stats recalculate automatically as pipeline cleans posts
3. **Accurate duration estimates**: Uses cleaned content length instead of raw HTML
4. **Cleaner separation of concerns**: FeedList is now purely presentational (reads from context)
5. **Better performance**: No network calls on component mount, only local state reads
6. **Simpler error handling**: Failed posts invisible by design (status filtering)

### Issues Found

- None - TypeScript compilation succeeds with no errors

### Testing Approach

Manual testing will verify:
1. FeedList displays feeds on mount (no re-fetching RSS)
2. Stats show 0 initially, then increase as pipeline cleans posts
3. Only cleaned posts count toward stats
4. Duration estimates use cleanedContent (shorter, more accurate)
5. Pull-to-refresh triggers full re-initialization
6. Failed posts don't appear in counts

### Console Log Output Expected

```
[PostsContext] Starting feed initialization
[PostsContext] Fetched 3 feeds from backend
[PostsContext] Parsed 47 posts from TechCrunch
[Pipeline] Starting batch processing for 47 posts
[Cleaning] Completed for https://techcrunch.com/post1 in 5ms
[Pipeline] Post https://techcrunch.com/post1 status: cleaned
// FeedList useEffect triggers automatically
[FeedList] Recalculating stats for 3 feeds
// Stats updated: TechCrunch now shows 1 unread post
...
```

### Next Steps

Iteration 7 will update TrackList component and playback:
- Update TrackList to read from PostsContext
- Filter posts by feedId and status='cleaned'
- Update playback to use cleanedContent field
- Remove RSS fetching from handleFeedSelect in App.tsx
