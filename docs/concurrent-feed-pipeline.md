# Concurrent Feed Processing Pipeline

**Technical Documentation**

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Concurrency Model](#concurrency-model)
- [Feed State Machine](#feed-state-machine)
- [Data Flow](#data-flow)
- [Race Condition Handling](#race-condition-handling)
- [Performance Characteristics](#performance-characteristics)
- [Design Trade-offs](#design-trade-offs)

---

## Overview

The concurrent feed pipeline is a **progressive loading system** that processes RSS feeds independently and in parallel, providing immediate UI feedback and incremental state updates as each feed completes its processing stages.

### Key Characteristics

- **Not a stream**: This is not a streaming architecture. It's a **concurrent pipeline** system where multiple independent pipelines process feeds in parallel
- **Progressive UI updates**: Feeds appear immediately, then update independently as they progress through states
- **Bounded concurrency**: Two-level batching prevents system overload
- **Per-feed isolation**: Fast feeds don't wait for slow feeds

### Motivation

**Before**: Blocking batch processing
- Fetch all RSS feeds in parallel → wait for slowest → all-or-nothing UI update
- User sees nothing until the slowest feed completes (could be 15+ seconds)
- No per-feed progress indication
- Single point of failure (one slow feed blocks everything)

**After**: Progressive concurrent processing
- Feeds visible within ~1 second (after backend metadata fetch)
- Each feed progresses independently: idle → fetching → processing → ready
- Fast feeds become clickable first, slow feeds later
- Better perceived performance and user experience

---

## Architecture

### High-Level Flow

```
App Startup
    ↓
PostsContext.initializeFeeds()
    ↓
┌─────────────────────────────────────────────────────┐
│ 1. Fetch Feed Metadata from Backend (~500ms)       │
│    GET /api/feeds → [{ id, url, title }, ...]      │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ 2. Initialize All Feeds to 'idle' State            │
│    setFeedStates(Map: feedId → { status: 'idle' }) │
│    setIsLoading(false) ← FEEDS NOW VISIBLE IN UI   │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ 3. Process Feeds in BATCHES (max 5 concurrent)     │
│                                                     │
│    Batch 1: [Feed A, Feed B, Feed C, Feed D, Feed E]│
│       ├─ processFeedProgressive(Feed A) ─┐         │
│       ├─ processFeedProgressive(Feed B) ─┤         │
│       ├─ processFeedProgressive(Feed C) ─┼─ Parallel│
│       ├─ processFeedProgressive(Feed D) ─┤         │
│       └─ processFeedProgressive(Feed E) ─┘         │
│                                                     │
│    Await batch 1 completion...                     │
│                                                     │
│    Batch 2: [Feed F, Feed G, ...]                  │
│       └─ ... (next batch starts)                   │
└─────────────────────────────────────────────────────┘
```

### Per-Feed Pipeline: `processFeedProgressive(feed)`

Each feed goes through an **independent pipeline**:

```
┌──────────────────────────────────────────────────────────┐
│ Feed: "The Verge"                                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Status: 'idle' → UI shows "Waiting..."                 │
│      ↓                                                   │
│  Status: 'fetching' → UI shows "Syncing..."             │
│      ├─ Fetch RSS XML from feed.url (HTTP GET)          │
│      ├─ Race with 15s timeout (Promise.race)            │
│      └─ Parse RSS → filter by date → limit to 15 posts  │
│      ↓                                                   │
│  Status: 'processing' → UI shows "Syncing... 0/15"      │
│      ├─ Add posts to global state (status: 'raw')       │
│      ├─ Clean posts in batches of 5 (concurrent)        │
│      │   ├─ Batch 1: [Post 1-5] → clean in parallel    │
│      │   │   UI: "Syncing... 1/15" ... "5/15"          │
│      │   ├─ Batch 2: [Post 6-10] → clean in parallel   │
│      │   │   UI: "Syncing... 6/15" ... "10/15"         │
│      │   └─ Batch 3: [Post 11-15] → clean in parallel  │
│      │       UI: "Syncing... 11/15" ... "15/15"        │
│      └─ Update each post: status 'raw' → 'cleaned'     │
│      ↓                                                   │
│  Status: 'ready' → UI shows "15 new tracks - 45:00"    │
│      └─ Feed becomes CLICKABLE ✓                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Key Point**: Each feed's pipeline is **independent**. Feed A reaching 'ready' does not affect Feed B still in 'processing'.

---

## Concurrency Model

### Two-Level Batching

The system uses **bounded concurrency** at two levels to prevent resource exhaustion:

```
┌─────────────────────────────────────────────────────────┐
│ Level 1: Feed-Level Batching (FEED_BATCH_SIZE = 5)     │
│                                                         │
│  Max 5 feeds processing concurrently                    │
│  Sequential batches: Batch 2 waits for Batch 1         │
│                                                         │
│  Why? Prevents 100+ feeds overwhelming the device      │
├─────────────────────────────────────────────────────────┤
│ Level 2: Post-Level Batching (POST_BATCH_SIZE = 5)     │
│                                                         │
│  Each feed processes max 5 posts concurrently           │
│  Sequential batches within each feed                    │
│                                                         │
│  Why? Content cleaning is CPU-intensive                 │
└─────────────────────────────────────────────────────────┘

Total Max Concurrency: 5 feeds × 5 posts = 25 operations
```

### Example: 3 Feeds, Different Speeds

```
Time  Feed A (3 posts)    Feed B (15 posts)   Feed C (10 posts)
────────────────────────────────────────────────────────────────
0s    idle                idle                idle
      ↓                   ↓                   ↓
1s    fetching            fetching            fetching
      ↓                   ↓                   ↓
2s    processing (0/3)    processing (0/15)   processing (0/10)
      ↓                   ↓                   ↓
3s    processing (3/3)    processing (5/15)   processing (5/10)
      ↓                   ↓                   ↓
4s    ✓ READY             processing (10/15)  processing (10/10)
      clickable!          ↓                   ↓
                          processing (15/15)  ✓ READY
                          ↓                   clickable!
5s                        ✓ READY
                          clickable!
```

**Result**: Users can interact with Feed A at 4s, don't wait for Feed B to finish at 5s.

### Not a Stream

This is **not** a streaming architecture:

| Streaming | Concurrent Pipeline (Ours) |
|-----------|----------------------------|
| Single ordered sequence | Multiple independent pipelines |
| Items processed one-by-one | Batches processed in parallel |
| Backpressure mechanisms | Bounded concurrency (fixed batch sizes) |
| Push-based (producer controls) | Pull-based (consumer-driven state updates) |
| Examples: RxJS, Node streams | Examples: Promise.allSettled, concurrent tasks |

Our model is closer to **concurrent task execution** with batching, not reactive streaming.

---

## Feed State Machine

Each feed follows a deterministic state machine:

```
        ┌─────┐
   ───→ │ idle│
        └──┬──┘
           │ Fetch RSS starts
           ↓
     ┌──────────┐
     │ fetching │
     └────┬─────┘
          │ RSS parsed, posts added
          ↓
   ┌────────────┐
   │ processing │ ← Progress tracked: { total: 15, cleaned: 0...15 }
   └─────┬──────┘
         │ All posts cleaned
         ↓
     ┌───────┐
     │ ready │ ← Feed clickable, shows stats
     └───────┘

     (Any stage can transition to 'error' on failure)
```

### State Definitions

| State | Meaning | UI Display | Clickable |
|-------|---------|------------|-----------|
| `idle` | Feed metadata loaded, not started | "Waiting..." | ❌ No |
| `fetching` | Fetching RSS XML from URL | "Syncing..." | ❌ No |
| `processing` | RSS parsed, posts being cleaned | "Syncing... X/Y cleaned" | ❌ No |
| `ready` | All posts cleaned, ready to play | "15 new tracks - 45:00" | ✅ Yes |
| `error` | Failed to fetch or process | Error message + retry button | ❌ No |

### State Transitions

```typescript
// Successful flow
'idle'
  → updateFeedState(feedId, { status: 'fetching' })
  → updateFeedState(feedId, { status: 'processing', progress: { total: 15, cleaned: 0 } })
  → updateFeedState(feedId, { status: 'processing', progress: { total: 15, cleaned: 1 } })
  → ... (progress increments as posts clean)
  → updateFeedState(feedId, { status: 'processing', progress: { total: 15, cleaned: 15 } })
  → updateFeedState(feedId, { status: 'ready' })

// Error flow (timeout, network failure, parse error)
'idle'
  → updateFeedState(feedId, { status: 'fetching' })
  → updateFeedState(feedId, { status: 'error', error: 'Feed fetch timeout' })
```

---

## Data Flow

### Types and Structures

```typescript
// Feed state tracked per feed
type FeedStatus = 'idle' | 'fetching' | 'processing' | 'ready' | 'error';

interface FeedLoadState {
  feedId: string;
  status: FeedStatus;
  progress?: {
    total: number;      // Total posts for this feed
    cleaned: number;    // How many posts cleaned
  };
  error?: string;       // Error message if status is 'error'
}

// Global state in PostsContext
const [feedStates, setFeedStates] = useState<Map<string, FeedLoadState>>(new Map());
const [posts, setPosts] = useState<Post[]>([]);
const [postIndexMap, setPostIndexMap] = useState<Map<string, number>>(new Map());
```

### Progressive State Updates

#### 1. Initial State (Immediate)

```typescript
// After backend fetch (< 1 second)
feedStates = Map {
  "feed-1" → { feedId: "feed-1", status: 'idle' },
  "feed-2" → { feedId: "feed-2", status: 'idle' },
  "feed-3" → { feedId: "feed-3", status: 'idle' },
}

posts = []
isLoading = false ← UI renders feeds immediately
```

#### 2. Fetching Stage

```typescript
// Feed 1 starts fetching
feedStates.set("feed-1", { feedId: "feed-1", status: 'fetching' })
// UI updates: "Waiting..." → "Syncing..."
```

#### 3. Processing Stage

```typescript
// Feed 1 RSS parsed, 10 posts added
posts = [
  { feedId: "feed-1", title: "Post 1", status: 'raw', ... },
  { feedId: "feed-1", title: "Post 2", status: 'raw', ... },
  // ... 8 more posts
]

postIndexMap = Map {
  "https://feed1.com/post1" → 0,
  "https://feed1.com/post2" → 1,
  // ...
}

feedStates.set("feed-1", {
  feedId: "feed-1",
  status: 'processing',
  progress: { total: 10, cleaned: 0 }
})
// UI updates: "Syncing..." → "Syncing... 0/10 cleaned"
```

#### 4. Incremental Progress

```typescript
// Post 1 cleaned
posts[0] = { ...posts[0], status: 'cleaned', cleanedContent: "..." }
feedStates.set("feed-1", {
  feedId: "feed-1",
  status: 'processing',
  progress: { total: 10, cleaned: 1 }
})
// UI updates: "Syncing... 0/10" → "Syncing... 1/10"

// Post 2 cleaned
posts[1] = { ...posts[1], status: 'cleaned', cleanedContent: "..." }
feedStates.set("feed-1", {
  feedId: "feed-1",
  status: 'processing',
  progress: { total: 10, cleaned: 2 }
})
// UI updates: "Syncing... 1/10" → "Syncing... 2/10"

// ... continues until all posts cleaned
```

#### 5. Ready State

```typescript
// All posts cleaned (cleaned === total)
feedStates.set("feed-1", { feedId: "feed-1", status: 'ready' })
// UI updates: "Syncing... 10/10" → "10 new tracks - 30:00"
// Feed becomes clickable
```

### Concurrent Updates (Multiple Feeds)

When multiple feeds process simultaneously:

```typescript
// Time: 2s - All 3 feeds fetching
feedStates = Map {
  "feed-1" → { status: 'fetching' },
  "feed-2" → { status: 'fetching' },
  "feed-3" → { status: 'fetching' },
}

// Time: 3s - All 3 feeds processing (different progress)
feedStates = Map {
  "feed-1" → { status: 'processing', progress: { total: 10, cleaned: 2 } },
  "feed-2" → { status: 'processing', progress: { total: 15, cleaned: 3 } },
  "feed-3" → { status: 'processing', progress: { total: 5, cleaned: 5 } },
}

// Time: 4s - Feed 3 done, others still processing
feedStates = Map {
  "feed-1" → { status: 'processing', progress: { total: 10, cleaned: 8 } },
  "feed-2" → { status: 'processing', progress: { total: 15, cleaned: 10 } },
  "feed-3" → { status: 'ready' }, ← Clickable!
}

// Time: 5s - Feed 1 done
feedStates = Map {
  "feed-1" → { status: 'ready' }, ← Clickable!
  "feed-2" → { status: 'processing', progress: { total: 15, cleaned: 14 } },
  "feed-3" → { status: 'ready' },
}

// Time: 6s - All done
feedStates = Map {
  "feed-1" → { status: 'ready' },
  "feed-2" → { status: 'ready' }, ← Clickable!
  "feed-3" → { status: 'ready' },
}
```

---

## Race Condition Handling

The concurrent nature of the pipeline introduces several race conditions that must be handled carefully.

### Race Condition 1: Progress Counter

**Problem**: Multiple posts clean concurrently and increment progress counter.

**Without Fix** (stale closure):
```typescript
// All 5 posts read the same stale value
const feedState = feedStates.get(feedId);  // { cleaned: 0 }
const newCleaned = feedState.progress.cleaned + 1;  // All compute: 0 + 1 = 1

// Result: Counter stuck at 1 instead of 5
```

**With Fix** (functional update):
```typescript
setFeedStates(prevStates => {
  const feedState = prevStates.get(feedId);  // Always latest value
  const newCleaned = feedState.progress.cleaned + 1;
  // ... update state
  return newStates;
});

// Result: Counter correctly increments 0 → 1 → 2 → 3 → 4 → 5
```

### Race Condition 2: postIndexMap Not Ready

**Problem**: `addPosts()` updates `posts` and `postIndexMap` (async), but `processPostsForFeed()` immediately calls `updatePost()` before map is ready.

**Timeline**:
```
T0: addPosts([post1, post2, ...]) called
    ├─ setPosts([...]) ← React batches this update
    └─ setPostIndexMap(...) ← React batches this update
T1: processPostsForFeed() starts immediately
    └─ updatePost(post1) called
        └─ postIndexMap.get(post1.link) → undefined! ❌
T2: React applies batched state updates
    └─ postIndexMap now has entries ✓ (too late)
```

**Solution**: Fallback to array search when map not ready.

```typescript
const updatePost = (updatedPost: Post) => {
  setPosts(prevPosts => {
    // Try O(1) map lookup first
    let index = postIndexMap.get(updatedPost.link);

    if (index === undefined) {
      // Map not ready - fallback to O(n) array search
      index = prevPosts.findIndex(p => p.link === updatedPost.link);
    }

    // Update post at found index
    const newPosts = [...prevPosts];
    newPosts[index] = updatedPost;
    return newPosts;
  });
};
```

**Performance Impact**:
- **Fast path**: O(1) map lookup (taken ~99% of the time after initialization)
- **Slow path**: O(n) array search (only during initialization window, ~47 posts total)
- **Acceptable trade-off**: Correctness over microseconds during app startup

### Race Condition 3: Concurrent addPosts Calls

**Problem**: Multiple feeds call `addPosts()` concurrently, index calculations become incorrect.

**Without Fix**:
```typescript
// Feed A adds 10 posts
const startIndex = posts.length;  // 0
// ... but Feed B also reads posts.length = 0 at same time!
// Both calculate startIndex = 0 → collision!
```

**With Fix**: Rebuild entire map from merged array.

```typescript
const addPosts = (newPosts: Post[]) => {
  setPosts(prev => {
    const newPostsArray = [...prev, ...newPosts];

    // Rebuild map from scratch - always correct
    setPostIndexMap(() => {
      const newMap = new Map<string, number>();
      newPostsArray.forEach((post, index) => {
        newMap.set(post.link, index);
      });
      return newMap;
    });

    return newPostsArray;
  });
};
```

---

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Frequency |
|-----------|-----------|-----------|
| Feed metadata fetch | O(1) HTTP call | Once per app load |
| RSS fetch | O(1) HTTP call per feed | Once per feed |
| RSS parse | O(n) posts in feed | Once per feed |
| Content cleaning | O(m) content length | Once per post |
| Post update (map hit) | O(1) | Per post cleaned |
| Post update (map miss) | O(n) posts | Only during init |
| Index map rebuild | O(n) posts | 4 times (once per feed) |

### Timeline (Typical 4-Feed Scenario)

```
Time    Event                           User Perception
─────────────────────────────────────────────────────────────
0ms     App startup
500ms   Backend metadata fetched        "Loading..."
1000ms  Feeds visible (idle state)      Sees 4 feed items!
1500ms  All feeds fetching RSS
3000ms  All feeds parsing + processing  "Syncing... 0/X"
3500ms  First posts cleaned             "Syncing... 1/X"
5000ms  First feed ready                Can click Feed 1! ✓
6000ms  Second feed ready               Can click Feed 2! ✓
7000ms  Third feed ready                Can click Feed 3! ✓
8000ms  Fourth feed ready               Can click Feed 4! ✓
```

**Total time to first interaction**: ~5 seconds (vs 15+ seconds in old blocking model)

### Memory Usage

**Per-Feed State**:
- FeedLoadState object: ~100 bytes
- 15 posts × (Post object + index entry): ~10 KB

**Total for 4 feeds**:
- Feed states: 4 × 100 bytes = 400 bytes
- Posts: 4 × 15 × ~10 KB = ~600 KB
- Index map: 60 entries × 50 bytes = ~3 KB

**Peak concurrency memory**:
- 5 feeds processing × 5 posts cleaning = 25 concurrent operations
- Each operation: ~50 KB intermediate data
- Peak: ~1.25 MB additional (acceptable on modern devices)

### Network Usage

**Optimized**:
- RSS feeds fetched only once (not polled)
- 15-item limit per feed reduces bandwidth
- Parallel fetching reduces total time
- 15s timeout prevents hanging on slow feeds

**For 4 feeds**:
- ~4 parallel HTTP requests (RSS XML)
- ~100-200 KB total download
- ~2-3 seconds total fetch time (parallel)

---

## Design Trade-offs

### 1. Bounded Concurrency vs Unlimited Parallelism

**Choice**: Fixed batch sizes (5 feeds × 5 posts)

**Trade-offs**:
- ✅ Prevents device overload (CPU, memory, network)
- ✅ Predictable performance characteristics
- ✅ Works well for both 3 feeds and 100 feeds
- ❌ Doesn't adapt to device capability (could be dynamic)
- ❌ Sequential batches (batch 2 waits for batch 1)

### 2. Immediate Feed Visibility vs Loading Screen

**Choice**: Show feeds immediately after metadata fetch

**Trade-offs**:
- ✅ Instant feedback (perceived performance boost)
- ✅ Users see progress per feed
- ✅ No blocking wait for slowest feed
- ❌ More complex UI state handling
- ❌ More states to handle (idle, fetching, processing, ready, error)

### 3. Index Map with Fallback vs Pure Array Search

**Choice**: O(1) map with O(n) fallback for race conditions

**Trade-offs**:
- ✅ Fast path (O(1)) taken 99% of the time
- ✅ Correct even with state update delays
- ✅ No crashes or silent failures
- ❌ Slight complexity (two code paths)
- ❌ Fallback has O(n) cost (but only during init)

### 4. Per-Feed State Isolation vs Global Pipeline

**Choice**: Each feed has independent state machine

**Trade-offs**:
- ✅ Fast feeds don't wait for slow feeds
- ✅ Error in one feed doesn't affect others
- ✅ Clear UI feedback per feed
- ✅ Easier to reason about (no global locks)
- ❌ More state to manage (Map of feed states)
- ❌ More memory overhead (state per feed)

### 5. RSS Item Limit (15) vs Unlimited

**Choice**: Hard limit of 15 posts per feed

**Trade-offs**:
- ✅ Reduces processing time (fewer posts to clean)
- ✅ Reduces memory usage
- ✅ Reduces bandwidth (smaller XML parsing)
- ✅ Focuses on recent content (90-day filter)
- ❌ Users miss older articles if feed publishes many per day
- ❌ Power users may want more control

---

## Conclusion

The concurrent feed pipeline is a **bounded concurrency system** with two-level batching and per-feed state machines. It provides:

1. **Immediate feedback**: Feeds visible within 1 second
2. **Progressive updates**: Each feed updates independently
3. **Bounded resources**: Fixed concurrency prevents overload
4. **Robust error handling**: Race conditions handled with functional updates and fallbacks
5. **Scalable**: Works with 3 feeds or 100 feeds

**Not** a streaming system, but rather **concurrent task execution** with careful state management and race condition handling for React's async state updates.

---

## Further Reading

- [React State Updates and Batching](https://react.dev/learn/queueing-a-series-of-state-updates)
- [Promise.allSettled for Concurrent Operations](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)
- [Functional Updates in React](https://react.dev/reference/react/useState#updating-state-based-on-the-previous-state)
- [RSS 2.0 Specification](https://www.rssboard.org/rss-specification)
