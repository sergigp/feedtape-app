# Implementation Plan: Progressive Feed Loading with Concurrent Processing

## Overview

Transform feed loading from blocking batch processing to progressive per-feed loading with concurrent RSS fetching and cleaning. Users will see feeds immediately after backend fetch, with each feed independently progressing through states (idle → fetching → processing → ready) and becoming clickable as soon as all its posts are cleaned.

## Architecture Changes

### Current Flow
```
App startup → PostsContext.initializeFeeds()
  → feedService.getFeeds() (backend metadata)
  → Promise.allSettled() - fetch ALL RSS in parallel
  → WAIT for all RSS fetches to complete (blocking)
  → Add ALL posts to state at once (status='raw')
  → setIsLoading(false) - FeedList now renders
  → contentPipelineService.processPosts() (non-blocking background)

Problems:
- Feeds not visible until slowest RSS fetch completes
- No per-feed progress indication
- Can't interact with feeds until everything loaded
- All-or-nothing visibility
```

### Target Flow
```
App startup → PostsContext.initializeFeeds()
  → feedService.getFeeds() (backend metadata)
  → Initialize all feeds with status='idle'
  → setIsLoading(false) - Feeds IMMEDIATELY visible
  → Promise.allSettled() - process ALL feeds concurrently:
      │
      For each feed in parallel:
      ├─ updateFeedState(feedId, 'fetching')
      │  UI shows: "Syncing..."
      │
      ├─ fetchRSSContent() with 15s timeout
      │
      ├─ parseRSSFeed(xml, { maxItems: 15 })
      │
      ├─ addPosts(posts) - add incrementally per feed
      │
      ├─ updateFeedState(feedId, 'processing', { cleaned: 0, total: 15 })
      │  UI shows: "Syncing... 0/15 cleaned"
      │
      ├─ contentPipelineService.processPosts(posts, updatePost)
      │  Pipeline tracks per-post completion
      │  On each post cleaned → increment progress
      │  UI shows: "Syncing... 1/15 cleaned" ... "15/15 cleaned"
      │
      └─ updateFeedState(feedId, 'ready')
         UI shows: "15 new tracks - 45:00"
         Feed becomes CLICKABLE ✓

Benefits:
- Feeds visible within ~1 second (backend fetch only)
- Each feed progresses independently
- Fast feeds ready first, slow feeds later
- Per-feed progress indication
- Better perceived performance
```

## Critical Files

### New Files
None - all changes to existing files

### Modified Files
1. **src/types/index.ts** - Add FeedStatus type and FeedLoadState interface
2. **src/contexts/PostsContext.tsx** - Add feedStates Map, refactor initializeFeeds(), track progress
3. **src/services/rssParser.ts** - Add maxItems parameter to limit posts per feed
4. **src/components/FeedList.tsx** - Use feed states for UI, add retry handler
5. **src/components/FeedListItem.tsx** - Add retry button for error state, handle disabled state
6. **src/components/TrackList.tsx** - Update filter (already mostly fixed)

## User Stories

### Iteration 1: Type Definitions & RSS Parser Limit
**Expected Behavior**: TypeScript types support feed states, RSS parser limits posts to 15 items

**Tests to Implement/Modify**:
- Manual test: Check TypeScript compilation succeeds
- Manual test: Parse RSS feed with >15 items, verify only 15 returned
- Manual test: Parse RSS feed with <15 items, verify all returned
- Manual test: Verify date filtering (90 days) still works with limit

**Implementation Notes**:

1. Add types to `src/types/index.ts`:
```typescript
export type FeedStatus =
  | 'idle'        // Feed metadata loaded, not started
  | 'fetching'    // Fetching RSS XML from URL
  | 'processing'  // RSS parsed, posts being cleaned
  | 'ready'       // All posts cleaned, clickable
  | 'error';      // Failed to fetch or process

export interface FeedLoadState {
  feedId: string;
  status: FeedStatus;
  progress?: {
    total: number;      // Total posts for this feed
    cleaned: number;    // How many posts cleaned
  };
  error?: string;       // Error message if status is 'error'
}
```

2. Update `src/services/rssParser.ts`:
```typescript
export function parseRSSFeed(
  xmlString: string,
  options?: { maxItems?: number }  // NEW: optional limit
): ParsedPost[] {
  // ... existing parsing logic ...

  // After filtering by date (90 days), apply item limit
  const maxItems = options?.maxItems || Infinity;
  const limitedPosts = recentPosts.slice(0, maxItems);

  if (recentPosts.length > maxItems) {
    console.log(
      `[RSSParser] Limited to ${maxItems} posts (${recentPosts.length} available)`
    );
  }

  return limitedPosts;
}
```

3. Verify:
- TypeScript compilation: `npm run tsc --noEmit`
- Test RSS parser with sample feed that has many items

---

### Iteration 2: PostsContext - Add Feed States Infrastructure
**Expected Behavior**: PostsContext tracks per-feed state, exposes getFeedState() and retryFeed()

**Tests to Implement/Modify**:
- Manual test: Log feedStates Map after initializeFeeds() called
- Manual test: Verify feedStates updates when updateFeedState() called
- Manual test: Verify getFeedState() returns correct state
- Manual test: Check that addPosts() updates postIndexMap correctly

**Implementation Notes**:

1. Add state to `PostsContext.tsx`:
```typescript
const [feedStates, setFeedStates] = useState<Map<string, FeedLoadState>>(new Map());
```

2. Add helper functions:
```typescript
// Update a single feed's state
const updateFeedState = (feedId: string, update: Partial<FeedLoadState>) => {
  setFeedStates(prev => {
    const newStates = new Map(prev);
    const current = newStates.get(feedId) || { feedId, status: 'idle' };
    newStates.set(feedId, { ...current, ...update });
    return newStates;
  });
};

// Add posts incrementally (per feed)
const addPosts = (newPosts: Post[]) => {
  setPosts(prev => [...prev, ...newPosts]);

  // Update index map
  setPostIndexMap(prev => {
    const newMap = new Map(prev);
    const startIndex = posts.length;
    newPosts.forEach((post, i) => {
      newMap.set(post.link, startIndex + i);
    });
    return newMap;
  });
};

// Get feed state (exposed to consumers)
const getFeedState = (feedId: string): FeedLoadState | undefined => {
  return feedStates.get(feedId);
};
```

3. Update context interface:
```typescript
interface PostsContextType {
  posts: Post[];
  isLoading: boolean;
  feedStates: Map<string, FeedLoadState>;  // NEW
  initializeFeeds: () => Promise<void>;
  retryFeed: (feedId: string) => Promise<void>;  // NEW
  getFeedState: (feedId: string) => FeedLoadState | undefined;  // NEW
  updatePost: (post: Post) => void;
  getPostsByFeed: (feedId: string) => Post[];
  clearPosts: () => void;
}
```

4. Export new methods in context value:
```typescript
const value: PostsContextType = {
  posts,
  isLoading,
  feedStates,  // NEW
  initializeFeeds,
  retryFeed,  // NEW (implemented in Iteration 4)
  getFeedState,  // NEW
  updatePost,
  getPostsByFeed,
  clearPosts,
};
```

---

### Iteration 3: PostsContext - Refactor initializeFeeds() for Concurrent Processing
**Expected Behavior**: Feeds visible immediately, all process concurrently, independent completion

**Tests to Implement/Modify**:
- Manual test: Verify feeds appear within 1 second (before RSS fetch)
- Manual test: Check console logs show all feeds start fetching concurrently
- Manual test: Verify fast feeds complete before slow feeds
- Manual test: Test with mix of fast/slow/error feeds
- Manual test: Verify timeout works (mock 20s RSS fetch)

**Implementation Notes**:

1. Refactor `initializeFeeds()` in `PostsContext.tsx`:
```typescript
const initializeFeeds = async () => {
  if (isLoading) {
    console.log('[PostsContext] Already loading, skipping');
    return;
  }

  console.log('[PostsContext] Starting feed initialization');
  setIsLoading(true);

  try {
    // 1. Fetch feed metadata from backend (fast)
    const feeds = await feedService.getFeeds();
    console.log(`[PostsContext] Fetched ${feeds.length} feeds from backend`);

    // 2. Initialize all feeds to 'idle' state immediately
    const initialStates = new Map<string, FeedLoadState>();
    feeds.forEach(feed => {
      initialStates.set(feed.id, { feedId: feed.id, status: 'idle' });
    });
    setFeedStates(initialStates);
    setIsLoading(false);  // ← Feeds now visible in UI!

    // 3. Process feeds in BATCHES to prevent overload
    // Process max FEED_BATCH_SIZE (e.g., 5) feeds concurrently
    // Each feed has its own pipeline for posts
    // As feeds complete, next batch starts
    const FEED_BATCH_SIZE = 5;
    for (let i = 0; i < feeds.length; i += FEED_BATCH_SIZE) {
      const batch = feeds.slice(i, i + FEED_BATCH_SIZE);
      console.log(`[PostsContext] Processing feed batch ${i / FEED_BATCH_SIZE + 1}`);

      await Promise.allSettled(
        batch.map(feed => processFeedProgressive(feed))
      );
    }

    console.log('[PostsContext] All feeds processed');
  } catch (error) {
    console.error('[PostsContext] Failed to initialize feeds:', error);
    setIsLoading(false);
  }
};
```

2. Implement `processFeedProgressive()`:
```typescript
const processFeedProgressive = async (feed: Feed) => {
  console.log(`[PostsContext] Processing feed: ${feed.title}`);

  // Step 1: Mark as 'fetching'
  updateFeedState(feed.id, { status: 'fetching' });

  try {
    // Step 2: Fetch RSS with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Feed fetch timeout')), 15000);
    });

    const xmlContent = await Promise.race([
      feedService.fetchRSSContent(feed.url),
      timeoutPromise
    ]);

    // Step 3: Parse RSS with 15-item limit
    const parsedPosts = parseRSSFeed(xmlContent, { maxItems: 15 });
    console.log(`[PostsContext] Parsed ${parsedPosts.length} posts from ${feed.title}`);

    // Step 4: Convert to Post objects with state machine fields
    const posts = parsedPosts.map(parsed => ({
      ...parsed,
      feedId: feed.id,
      rawContent: parsed.content,
      cleanedContent: null,
      status: 'raw' as const,
    }));

    // Step 5: Add to state incrementally
    addPosts(posts);

    // Step 6: Mark as 'processing' with progress
    updateFeedState(feed.id, {
      status: 'processing',
      progress: { total: posts.length, cleaned: 0 }
    });

    // Step 7: Start PER-FEED pipeline for this feed's posts
    // Each feed gets its own mini-pipeline (e.g., 5 concurrent posts)
    // This ensures fast feeds become ready quickly without waiting for slow feeds
    await processPostsForFeed(posts, updatePost);

  } catch (error) {
    console.error(`[PostsContext] Feed ${feed.id} failed:`, error);
    updateFeedState(feed.id, {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to load feed'
    });
  }
};
```

3. Testing approach:
- Add temporary 5-second delay in one feed's fetchRSSContent() to test staggered completion
- Verify other feeds complete and become clickable while slow feed still processing
- Check console logs for concurrent processing

---

### Iteration 4: PostsContext - Implement Per-Feed Pipeline
**Expected Behavior**: Each feed processes its own posts concurrently (mini-pipeline), doesn't wait for other feeds

**Tests to Implement/Modify**:
- Manual test: Process 2 feeds with different sizes (5 vs 15 posts), verify smaller completes first
- Manual test: Process feed with all posts, verify 5 concurrent cleanings happening
- Manual test: Verify posts for one feed don't block posts for another feed
- Manual test: Check memory usage with multiple feeds processing

**Implementation Notes**:

1. Add per-feed pipeline function to `PostsContext.tsx`:
```typescript
// Process all posts for a single feed with limited concurrency
const processPostsForFeed = async (
  posts: Post[],
  onUpdate: (post: Post) => void
): Promise<void> => {
  const POST_BATCH_SIZE = 5;  // Process 5 posts concurrently per feed

  // Process posts in batches
  for (let i = 0; i < posts.length; i += POST_BATCH_SIZE) {
    const batch = posts.slice(i, i + POST_BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (post) => {
        try {
          // Clean the post
          const cleanedContent = await contentCleaningService.cleanContent(post.rawContent);

          // Update post with cleaned content
          const updatedPost = {
            ...post,
            cleanedContent,
            status: 'cleaned' as const,
          };

          onUpdate(updatedPost);
        } catch (error) {
          console.error(`[PostsContext] Failed to clean post ${post.link}:`, error);

          const errorPost = {
            ...post,
            status: 'error' as const,
          };

          onUpdate(errorPost);
        }
      })
    );
  }
};
```

2. Update `processFeedProgressive()` to use per-feed pipeline (already updated in Iteration 3)

3. Constants at top of file:
```typescript
const FEED_BATCH_SIZE = 5;  // Max 5 feeds processing concurrently
const POST_BATCH_SIZE = 5;  // Max 5 posts cleaning per feed
// Total max concurrency: 5 feeds × 5 posts = 25 operations
```

4. Remove dependency on global `contentPipelineService` - we're implementing mini-pipelines per feed instead

5. Testing approach:
- Start 2 feeds with different sizes
- Log timestamps for each post cleaned
- Verify Feed A (5 posts) completes before Feed B (15 posts)
- Check that posts clean in batches of 5

---

### Iteration 5: PostsContext - Track Pipeline Progress & Mark Feeds Ready
**Expected Behavior**: Feed transitions to 'ready' when all posts cleaned, progress updates during cleaning

**Tests to Implement/Modify**:
- Manual test: Watch feed progress counter increment (0/15 → 15/15)
- Manual test: Verify feed becomes 'ready' when last post cleaned
- Manual test: Test with feed that has <15 posts (e.g., 5 posts)
- Manual test: Test with feed where some posts fail cleaning
- Manual test: Verify progress tracks correctly with concurrent feeds

**Implementation Notes**:

1. Enhance `updatePost()` to track feed completion:
```typescript
const updatePost = (updatedPost: Post) => {
  // Existing: Update post in array
  const index = postIndexMap.get(updatedPost.link);
  if (index === undefined) {
    console.warn('[PostsContext] updatePost called for unknown post:', updatedPost.link);
    return;
  }

  setPosts(prevPosts => {
    const newPosts = [...prevPosts];
    newPosts[index] = updatedPost;
    return newPosts;
  });

  // NEW: Track feed completion
  if (updatedPost.status === 'cleaned' || updatedPost.status === 'error') {
    const feedState = feedStates.get(updatedPost.feedId);
    if (feedState?.status === 'processing') {
      const progress = feedState.progress!;
      const newCleaned = progress.cleaned + 1;

      if (newCleaned >= progress.total) {
        // All posts processed, mark feed as ready
        console.log(`[PostsContext] Feed ${updatedPost.feedId} is ready`);
        updateFeedState(updatedPost.feedId, { status: 'ready' });
      } else {
        // Update progress
        updateFeedState(updatedPost.feedId, {
          status: 'processing',
          progress: { total: progress.total, cleaned: newCleaned }
        });
      }
    }
  }
};
```

2. Implement `retryFeed()`:
```typescript
const retryFeed = async (feedId: string) => {
  console.log(`[PostsContext] Retrying feed ${feedId}`);

  // Remove old posts for this feed
  setPosts(prev => prev.filter(p => p.feedId !== feedId));

  // Rebuild index map
  setPostIndexMap(prev => {
    const newMap = new Map<string, number>();
    posts.filter(p => p.feedId !== feedId).forEach((post, i) => {
      newMap.set(post.link, i);
    });
    return newMap;
  });

  // Find feed metadata and retry
  const feeds = await feedService.getFeeds();
  const feed = feeds.find(f => f.id === feedId);
  if (!feed) {
    throw new Error('Feed not found');
  }

  await processFeedProgressive(feed);
};
```

3. Testing:
- Log every progress update to verify counter increments correctly
- Test with different feed sizes (3, 10, 15 posts)
- Verify ready state triggers exactly when last post completes

---

### Iteration 6: FeedList - Display Feed States & Handle Clickability
**Expected Behavior**: UI shows feed states, progress, and only allows clicking ready feeds

**Tests to Implement/Modify**:
- Manual test: Verify feeds show "Waiting..." when status='idle'
- Manual test: Verify "Syncing..." shows when status='fetching'
- Manual test: Verify "Syncing... 5/15 cleaned" shows during processing
- Manual test: Verify feed shows track count and duration when status='ready'
- Manual test: Verify feeds are not clickable until status='ready'
- Manual test: Verify error state shows with retry button

**Implementation Notes**:

1. Import feed state methods from context in `FeedList.tsx`:
```typescript
const { posts, getPostsByFeed, initializeFeeds, getFeedState, retryFeed } = usePosts();
```

2. Update `calculateFeedStats()` to check feed state:
```typescript
const calculateFeedStats = (feedsToCalculate: Feed[]) => {
  const updatedStats: Record<string, FeedStats> = {};

  feedsToCalculate.forEach((feed) => {
    const feedState = getFeedState(feed.id);

    // Only calculate stats for ready feeds
    if (feedState?.status !== 'ready') {
      updatedStats[feed.id] = {
        unreadCount: 0,
        totalDuration: 0,
        isLoading: feedState?.status === 'fetching' || feedState?.status === 'processing',
        error: feedState?.status === 'error',
      };
      return;
    }

    // Existing stats calculation for ready feeds
    const feedPosts = getPostsByFeed(feed.id);
    const validPosts = feedPosts.filter(p => p.status === 'cleaned');
    const unreadPosts = validPosts.filter(p => !readStatusService.isRead(p.link));
    const totalDuration = unreadPosts.reduce((sum, post) => {
      return sum + nativeTtsService.estimateDuration(post.cleanedContent || '');
    }, 0);

    updatedStats[feed.id] = {
      unreadCount: unreadPosts.length,
      totalDuration,
      isLoading: false,
      error: false,
    };
  });

  setFeedStats(updatedStats);
};
```

3. Add helper functions for rendering:
```typescript
// Determine subtitle based on feed state
const getSubtitle = (feed: Feed) => {
  const feedState = getFeedState(feed.id);
  const stats = feedStats[feed.id];

  switch (feedState?.status) {
    case 'idle':
      return 'Waiting...';
    case 'fetching':
      return 'Syncing...';
    case 'processing':
      const { cleaned, total } = feedState.progress || { cleaned: 0, total: 0 };
      return `Syncing... ${cleaned}/${total} cleaned`;
    case 'ready':
      if (stats?.unreadCount === 0) {
        return 'all played';
      }
      return undefined;  // Use FeedListItem's default formatting
    case 'error':
      return feedState.error || 'Failed to load';
    default:
      return undefined;
  }
};

// Determine if feed is clickable
const isClickable = (feed: Feed) => {
  const feedState = getFeedState(feed.id);
  return feedState?.status === 'ready';
};
```

4. Update feed rendering:
```typescript
feeds.map((feed) => {
  const feedState = getFeedState(feed.id);
  const stats = feedStats[feed.id];
  const clickable = isClickable(feed);
  const subtitle = getSubtitle(feed);

  return (
    <FeedListItem
      key={feed.id}
      title={feed.title || feed.url}
      subtitle={subtitle}
      isActive={activeFeed?.id === feed.id}
      isLoading={stats?.isLoading}
      unreadCount={feedState?.status === 'ready' ? stats?.unreadCount : undefined}
      duration={feedState?.status === 'ready' ? stats?.totalDuration : undefined}
      error={stats?.error}
      isGrayedOut={feedState?.status === 'ready' && stats?.unreadCount === 0}
      onPress={clickable ? () => handleFeedPress(feed) : undefined}
      onPlayPress={clickable ? () => handleFeedPress(feed) : undefined}
      onRetry={feedState?.status === 'error' ? () => handleRetryFeed(feed.id) : undefined}
    />
  );
})
```

5. Add retry handler:
```typescript
const handleRetryFeed = async (feedId: string) => {
  try {
    await retryFeed(feedId);
  } catch (error) {
    console.error('[FeedList] Retry failed:', error);
    Alert.alert('Error', 'Failed to retry feed. Please try again.');
  }
};
```

6. Testing:
- Walk through all feed states manually
- Tap on feeds in different states to verify clickability
- Test error retry flow

---

### Iteration 7: FeedListItem - Add Retry Button & Disable Touch
**Expected Behavior**: Error feeds show retry button, non-clickable feeds don't respond to touch

**Tests to Implement/Modify**:
- Manual test: Error feed shows refresh icon
- Manual test: Tapping retry icon triggers retry
- Manual test: Non-clickable feeds have no visual feedback on touch
- Manual test: Ready feeds still clickable normally

**Implementation Notes**:

1. Add `onRetry` prop to `FeedListItem.tsx`:
```typescript
interface FeedListItemProps {
  // ... existing props ...
  onRetry?: () => void;  // NEW: Retry callback for error state
}
```

2. Update button rendering logic:
```typescript
{isLoading ? (
  <ActivityIndicator size="small" color={colors.foreground} />
) : error && onRetry ? (
  <TouchableOpacity onPress={onRetry}>
    <Ionicons name="refresh" size={24} color={colors.error} />
  </TouchableOpacity>
) : (
  <TouchableOpacity onPress={isGrayedOut ? onPress : onPlayPress}>
    <Ionicons
      name={isGrayedOut ? 'reload' : 'play'}
      size={24}
      color={isGrayedOut ? colors.grayedOut : colors.foreground}
    />
  </TouchableOpacity>
)}
```

3. Make touch inactive when onPress is undefined:
```typescript
<TouchableOpacity
  onPress={onPress}
  style={styles.textContainer}
  disabled={!onPress}  // NEW: Disable touch when no handler
  activeOpacity={onPress ? 0.7 : 1}  // NEW: No visual feedback when disabled
>
  <Text style={[styles.feedTitle, isGrayedOut && styles.grayText]}>
    {title}
  </Text>
  <Text style={[styles.feedSubtitle, (isGrayedOut || error) && styles.grayText]}>
    {getSubtitle()}
  </Text>
</TouchableOpacity>
```

4. Testing:
- Tap on feeds in idle, fetching, processing states (should not respond)
- Tap on ready feeds (should navigate)
- Tap retry button on error feed (should trigger retry)

---

### Iteration 8: TrackList - Update Post Filter
**Expected Behavior**: TrackList only shows cleaned posts (since feed only clickable when all cleaned)

**Tests to Implement/Modify**:
- Manual test: Open feed that just became ready, verify all posts visible
- Manual test: Verify posts are all status='cleaned'
- Manual test: Check new tracks count is accurate

**Implementation Notes**:

1. Update post filter in `TrackList.tsx`:
```typescript
const { getPostsByFeed, posts: contextPosts } = usePosts();

// Get posts from context, filtered by feedId
// Only show cleaned posts since feed is clickable only when all are cleaned
const posts = React.useMemo(() => {
  const feedPosts = getPostsByFeed(feedId);
  return feedPosts.filter(post => post.status === 'cleaned');
}, [feedId, getPostsByFeed, contextPosts]);
```

2. This should already be mostly correct from previous fixes, just verify:
- No 'raw' posts shown
- All posts have cleanedContent
- Count matches feed stats

---

## Testing Plan

### Unit Tests
- RSS parser maxItems parameter
- Feed state transitions (idle → fetching → processing → ready)
- Progress tracking increments correctly
- Feed marked ready when all posts cleaned

### Integration Tests
- Feeds appear immediately after backend fetch
- Each feed progresses independently through states
- Retry functionality works
- Pull-to-refresh resets all states
- Concurrent processing doesn't cause race conditions

### Manual Testing Checklist
- [ ] Fresh install: Feeds visible within 1 second
- [ ] Fast feed: Rapid progression through states
- [ ] Slow feed: Shows progress during cleaning
- [ ] Timeout: Mock 20s RSS fetch, verify error after 15s
- [ ] Network error: Mock failed fetch, verify error message
- [ ] Retry: Tap retry on error feed, verify it processes
- [ ] Clickable: Feeds only clickable when ready
- [ ] Mixed states: Test with fast/slow/error feeds together
- [ ] Pull to refresh: Verify all states reset

### Performance Testing
- [ ] Memory usage with 10+ feeds
- [ ] UI responsiveness during processing
- [ ] No memory leaks on multiple refresh cycles
- [ ] Smooth scrolling with 20+ feeds

## Verification

After implementation:
1. **Immediate feedback**: Feeds visible within 1 second
2. **Progressive states**: Each feed shows loading → processing → ready
3. **Progress indicator**: "Syncing... X/15" updates during processing
4. **Clickable logic**: Feeds not clickable until 'ready'
5. **Error handling**: Failed feeds show error with retry
6. **15-item limit**: Each feed has max 15 posts
7. **Concurrent processing**: Fast feeds ready before slow feeds
8. **Performance**: UI remains responsive

## Concurrency Architecture

**Feed-Level Batching:**
- Max 5 feeds processing concurrently (FEED_BATCH_SIZE = 5)
- Prevents device overload with 100+ feeds
- As feeds complete, next batch starts

**Post-Level Batching (Per Feed):**
- Each feed processes max 5 posts concurrently (POST_BATCH_SIZE = 5)
- Independent pipelines ensure fast feeds ready quickly
- Doesn't wait for slow feeds or other feeds' posts

**Total System Concurrency:**
- Worst case: 5 feeds × 5 posts = 25 concurrent cleaning operations
- RSS fetching happens in parallel to cleaning (network I/O)
- Reasonable load for mobile devices

**Benefits:**
- Users with 3 feeds see fast results (all 3 process immediately)
- Users with 100 feeds see batched progress (5 at a time)
- Small feeds (5 posts) ready in ~1 batch (~2-3 seconds)
- Large feeds (15 posts) ready in ~3 batches (~6-8 seconds)

## Known Limitations

1. **Fixed Batch Sizes**: FEED_BATCH_SIZE=5 and POST_BATCH_SIZE=5 are hardcoded. Could be dynamic based on device.
2. **No Priority**: All feeds treated equally. Could prioritize user's favorite feeds.
3. **No Background Refresh**: Feeds only load on app startup.
4. **Sequential Feed Batches**: Feed batch 2 waits for batch 1 to complete. Could overlap batches with available slots.

## Rollback Plan

If issues occur:
1. Revert PostsContext changes to previous parallel fetch-all logic
2. Remove feedStates tracking
3. Keep maxItems parameter in RSS parser (harmless optimization)
