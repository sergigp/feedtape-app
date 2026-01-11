# Concurrent Feed Processing Pipeline

**Technical Documentation**

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Concurrency Model](#concurrency-model)
- [Worker Pool Deep Dive](#worker-pool-deep-dive)
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
│ 3. Process Feeds with Worker Pool (5 workers)      │
│                                                     │
│    Feed Queue: [A, B, C, D, E, F, G, H, I, J, ...]│
│                                                     │
│    Worker 1: Feed A → Feed F → Feed K → ...        │
│    Worker 2: Feed B → Feed G → Feed L → ...        │
│    Worker 3: Feed C → Feed H → Feed M → ...        │
│    Worker 4: Feed D → Feed I → Feed N → ...        │
│    Worker 5: Feed E → Feed J → Feed O → ...        │
│                                                     │
│    Each worker grabs next feed as soon as done     │
│    Fast feeds don't wait for slow feeds ✓          │
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
│      ├─ Create worker pool (5 workers pulling from queue)│
│      │   Worker 1: Post 1 → Post 6 → Post 11 (done)    │
│      │   Worker 2: Post 2 → Post 7 → Post 12 (done)    │
│      │   Worker 3: Post 3 → Post 8 → Post 13 (done)    │
│      │   Worker 4: Post 4 → Post 9 → Post 14 (done)    │
│      │   Worker 5: Post 5 → Post 10 → Post 15 (done)   │
│      │   (Each worker grabs next post as soon as done)  │
│      │   UI updates: "Syncing... 1/15" ... "15/15"     │
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

### Two-Level Worker Pools: Feeds + Posts

The system uses **worker pool pattern at BOTH levels** for optimal throughput:

```
┌─────────────────────────────────────────────────────────┐
│ Level 1: Feed-Level Worker Pool (FEED_BATCH_SIZE = 5)  │
│                                                         │
│  5 feed workers pulling from feed queue                 │
│  Each worker processes feeds until queue empty          │
│  Fast feed workers grab next feed immediately           │
│                                                         │
│  Why? Fast feeds don't wait for slow feeds             │
├─────────────────────────────────────────────────────────┤
│ Level 2: Post-Level Worker Pool (POST_BATCH_SIZE = 5)  │
│                                                         │
│  Each feed has 5 post workers pulling from post queue   │
│  Each worker processes posts until queue empty          │
│  Fast post workers grab next post immediately           │
│                                                         │
│  Why? Fast posts don't wait for slow posts             │
└─────────────────────────────────────────────────────────┘

Total Max Concurrency: 5 feed workers × 5 post workers = 25 operations
```

**Consistent architecture**: Worker pools all the way down!

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

Our model is closer to **concurrent task execution** with worker pools, not reactive streaming.

---

## Worker Pool Deep Dive

### How the Worker Pool Works

Each feed creates a **worker pool** of 5 concurrent workers that pull posts from a shared queue:

```typescript
// Simplified implementation
const processPostsForFeed = async (feedPosts: Post[], onUpdate) => {
  // 1. Create queue from posts array
  const queue = [...feedPosts];  // [Post1, Post2, ..., Post15]

  // 2. Spawn 5 workers
  const workers = Array.from({ length: 5 }, async () => {
    // 3. Each worker runs independently
    while (queue.length > 0) {
      const post = queue.shift();  // Grab next post (FIFO)
      if (!post) break;

      // 4. Process post (content cleaning)
      const cleaned = cleanContent(post.rawContent);

      // 5. Update state (triggers UI progress update)
      onUpdate({ ...post, cleanedContent: cleaned, status: 'cleaned' });
    }
  });

  // 6. Wait for all workers to finish
  await Promise.all(workers);
};
```

### Visual Timeline

Let's trace how 15 posts get processed by 5 workers with **variable processing times**:

```
Time    Queue               Worker 1    Worker 2    Worker 3    Worker 4    Worker 5
────────────────────────────────────────────────────────────────────────────────────
0ms     [P1..P15]          grab P1     grab P2     grab P3     grab P4     grab P5
                           (2s task)   (1s task)   (3s task)   (1s task)   (2s task)

1000ms  [P6..P15]          working...  grab P6 ✓   working...  grab P7 ✓   working...
                           (1s left)   (2s task)   (2s left)   (2s task)   (1s left)

2000ms  [P8..P15]          grab P8 ✓   working...  grab P9 ✓   working...  grab P10 ✓
                           (1s task)   (1s left)   (1s task)   (1s left)   (1s task)

3000ms  [P11..P15]         grab P11 ✓  grab P12 ✓  grab P13 ✓  grab P14 ✓  grab P15 ✓
                           (1s task)   (1s task)   (1s task)   (1s task)   (1s task)

4000ms  []                 DONE ✓      DONE ✓      DONE ✓      DONE ✓      DONE ✓
```

**Total time: 4 seconds** (vs 7 seconds with sequential batching)

### Key Characteristics

1. **Pull-Based**: Workers **pull** from queue (not pushed to)
2. **FIFO Queue**: First-in, first-out processing order
3. **No Waiting**: Fast workers immediately grab next task
4. **Bounded**: Fixed number of workers (5) prevents overload
5. **Independent**: Each worker has its own async execution context

### Batching vs Worker Pool

**Batching Approach** (old):
```
┌─────────────────────────────────────┐
│ Batch 1: [P1, P2, P3, P4, P5]      │
│   P1 (2s) ─────────────┐            │
│   P2 (1s) ──────┐      │            │
│   P3 (3s) ──────────────────┐ ← slowest!
│   P4 (1s) ──────┐      │    │       │
│   P5 (2s) ─────────────┘    │       │
│                              ↓       │
│   All wait for P3 to finish (3s)    │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ Batch 2: [P6, P7, P8, P9, P10]     │
│   ... (waits another 2s)            │
└─────────────────────────────────────┘

Total: 7 seconds (artificial waiting)
```

**Worker Pool** (new):
```
┌─────────────────────────────────────┐
│ Worker 1: P1 (2s) → P8 (1s) → P11 (1s) = 4s
│ Worker 2: P2 (1s) → P6 (2s) → P12 (1s) = 4s
│ Worker 3: P3 (3s) → P9 (1s) → P13 (1s) = 5s ← slowest path
│ Worker 4: P4 (1s) → P7 (2s) → P14 (1s) = 4s
│ Worker 5: P5 (2s) → P10 (1s) → P15 (1s) = 4s
└─────────────────────────────────────┘

Total: 5 seconds (only waits for slowest worker path)
```

### Why Worker Pool Wins

**Batching**: Waits for slowest task **in each batch**
- Batch 1 waits for P3 (3s) even though P2, P4 finished at 1s
- Batch 2 can't start until Batch 1 fully completes
- **Artificial boundaries** create unnecessary idle time

**Worker Pool**: Waits for slowest task **across all tasks**
- Worker 2 finishes P2 at 1s, immediately grabs P6 (no waiting!)
- No artificial batches - continuous processing
- **Natural load balancing** - workers stay busy

### Real-World Analogy

**Batching**: Supermarket checkout with batch processing
- Group customers in batches of 5
- Batch 2 waits even if cashiers are free
- Slow customer blocks entire batch

**Worker Pool**: Supermarket with "next customer please"
- 5 cashiers continuously serving
- As soon as cashier free, next customer goes
- Fast customers don't wait for slow ones

### Code Comparison

**Batching** (old):
```typescript
for (let i = 0; i < posts.length; i += 5) {
  const batch = posts.slice(i, i + 5);

  // All 5 start together
  await Promise.allSettled(batch.map(cleanPost));
  // All 5 must finish before next batch

  // Problem: Artificial boundary at i += 5
}
```

**Worker Pool** (new):
```typescript
const queue = [...posts];

const workers = Array.from({ length: 5 }, async () => {
  while (queue.length > 0) {
    const post = queue.shift();
    await cleanPost(post);
    // Immediately grab next! No waiting!
  }
});

await Promise.all(workers);
// Problem: None! Natural flow.
```

### Performance Formula

Given:
- N = total posts
- W = number of workers
- T_avg = average task time
- T_max = slowest task time

**Batching**:
```
Total time = (N / W) × T_max_per_batch
           = Multiple waiting periods for slow tasks
```

**Worker Pool**:
```
Total time ≈ (N / W) × T_avg + T_max_slowest_worker
           = Fewer waiting periods (only final worker)
```

**The more variable your task times, the bigger the win!**

### When Worker Pool Matters Most

| Scenario | Batching | Worker Pool | Improvement |
|----------|----------|-------------|-------------|
| All tasks same duration (1s) | 3s | 3s | 0% |
| 50% variance (0.5-1.5s) | 4s | 3.5s | 12% |
| 100% variance (0.5-2s) | 5s | 4s | 20% |
| 200% variance (0.5-3s) | 7s | 5s | 29% |

**Takeaway**: More variability = more benefit from worker pool.

### Feed-Level Worker Pool

The same worker pool pattern is applied at the **feed level**:

```typescript
// Feed-level worker pool implementation
const initializeFeeds = async () => {
  // 1. Fetch metadata and initialize to 'idle'
  const feeds = await feedService.getFeeds();
  setFeedStates(/* all feeds to 'idle' */);
  setIsLoading(false);  // Feeds visible!

  // 2. Create queue from feeds array
  const feedQueue = [...feeds];

  // 3. Spawn 5 feed workers
  const feedWorkers = Array.from({ length: 5 }, async (_, workerIndex) => {
    while (feedQueue.length > 0) {
      const feed = feedQueue.shift();
      if (!feed) break;

      // Process entire feed (fetch RSS + clean posts)
      await processFeedProgressive(feed);
    }
  });

  // 4. Wait for all feed workers to finish
  await Promise.all(feedWorkers);
};
```

**Example with 10 feeds:**

```
Feed Queue: [A, B, C, D, E, F, G, H, I, J]

Worker 1: Feed A (5s) → Feed F (6s) → DONE      = 11s
Worker 2: Feed B (6s) → Feed G (4s) → DONE      = 10s
Worker 3: Feed C (15s) → DONE                   = 15s ← slowest
Worker 4: Feed D (4s) → Feed H (5s) → DONE      = 9s
Worker 5: Feed E (5s) → Feed I (5s) → DONE      = 10s
                        Feed J (4s) processed by Worker 4

Total: 15 seconds (slowest feed path)
```

**Without worker pool (batching)**:
```
Batch 1: [A, B, C, D, E] → waits for C (15s)    = 15s
Batch 2: [F, G, H, I, J] → waits for F (6s)     = 6s

Total: 21 seconds (artificial batch boundaries)
```

**Improvement**: 6 seconds faster (29% improvement)!

### Why Both Levels Need Worker Pools

**Post level**: Variable cleaning times (50ms - 500ms)
- HTML complexity varies
- Text length varies
- Natural language detection varies

**Feed level**: Variable feed processing times (2s - 20s)
- RSS fetch speed varies (network latency)
- Feed size varies (5 posts vs 15 posts)
- Number of posts varies

**Both levels have high variability** → both benefit from worker pools!

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
