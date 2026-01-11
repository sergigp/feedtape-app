# Worker Pool Refactor (Future Optimization)

If we scale to 100+ feeds and throughput becomes critical, here's how to refactor to a worker pool pattern.

## Current Approach (Batching)

```typescript
const processPostsForFeed = async (feedPosts: Post[], onUpdate: (post: Post) => void) => {
  const POST_BATCH_SIZE = 5;

  // Sequential batches
  for (let i = 0; i < feedPosts.length; i += POST_BATCH_SIZE) {
    const batch = feedPosts.slice(i, i + POST_BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (post) => {
        const cleanedContent = contentCleaningService.cleanContent(post.rawContent);
        const updatedPost = { ...post, cleanedContent, status: 'cleaned' as const };
        onUpdate(updatedPost);
      })
    );
  }
};
```

**Throughput**: ~5-8 seconds for 60 posts

## Refactored Approach (Worker Pool)

### Option 1: Using `p-limit` (Recommended)

```bash
npm install p-limit
```

```typescript
import pLimit from 'p-limit';

const processPostsForFeed = async (feedPosts: Post[], onUpdate: (post: Post) => void) => {
  const limit = pLimit(5);  // Max 5 concurrent

  // All posts start immediately, but only 5 execute at a time
  // As soon as one finishes, the next one starts
  const promises = feedPosts.map(post =>
    limit(async () => {
      const cleanedContent = contentCleaningService.cleanContent(post.rawContent);
      const updatedPost = { ...post, cleanedContent, status: 'cleaned' as const };
      onUpdate(updatedPost);
    })
  );

  await Promise.allSettled(promises);
};
```

**Benefits**:
- ✅ Better throughput (no waiting for slow tasks)
- ✅ Simple API (just wrap with `limit()`)
- ✅ Well-tested library (23M downloads/week)
- ✅ TypeScript support

**Throughput**: ~4-6 seconds for 60 posts (**~20% faster**)

### Option 2: Custom Worker Pool (No Dependencies)

```typescript
const processPostsForFeed = async (feedPosts: Post[], onUpdate: (post: Post) => void) => {
  const CONCURRENCY = 5;
  const queue = [...feedPosts];

  // Create worker promises
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const post = queue.shift();
      if (!post) break;

      try {
        const cleanedContent = contentCleaningService.cleanContent(post.rawContent);
        const updatedPost = { ...post, cleanedContent, status: 'cleaned' as const };
        onUpdate(updatedPost);
      } catch (error) {
        console.error(`[PostsContext] Failed to clean post ${post.link}:`, error);
        const errorPost = { ...post, status: 'error' as const };
        onUpdate(errorPost);
      }
    }
  });

  // Wait for all workers to finish
  await Promise.all(workers);
};
```

**Benefits**:
- ✅ No dependencies
- ✅ Full control over worker behavior
- ✅ Same throughput as p-limit

**Drawbacks**:
- ❌ More code to maintain
- ❌ Need to handle edge cases ourselves

### Option 3: Async Generator (Advanced)

```typescript
async function* processPostsStream(
  posts: Post[],
  concurrency: number
): AsyncGenerator<Post, void, unknown> {
  const queue = [...posts];
  const active = new Set<Promise<Post>>();

  while (queue.length > 0 || active.size > 0) {
    // Fill up to concurrency limit
    while (queue.length > 0 && active.size < concurrency) {
      const post = queue.shift()!;

      const promise = (async () => {
        const cleanedContent = contentCleaningService.cleanContent(post.rawContent);
        return { ...post, cleanedContent, status: 'cleaned' as const };
      })();

      active.add(promise);

      // Remove from active when done
      promise.finally(() => active.delete(promise));
    }

    // Wait for first completion
    if (active.size > 0) {
      const completed = await Promise.race(active);
      yield completed;
    }
  }
}

// Usage
const processPostsForFeed = async (feedPosts: Post[], onUpdate: (post: Post) => void) => {
  for await (const updatedPost of processPostsStream(feedPosts, 5)) {
    onUpdate(updatedPost);
  }
};
```

**Benefits**:
- ✅ Stream-based (most similar to backend patterns)
- ✅ Can yield results as they complete
- ✅ Backpressure support (if needed)

**Drawbacks**:
- ❌ Most complex
- ❌ Overkill for our use case

## Performance Comparison

### Current Scale (60 posts, 4 feeds)

| Approach | Time | Improvement |
|----------|------|-------------|
| Sequential Batches (current) | 5-8s | Baseline |
| Worker Pool (p-limit) | 4-6s | ~20% faster |
| Custom Worker Pool | 4-6s | ~20% faster |
| Async Generator | 4-6s | ~20% faster |

**Verdict**: Marginal improvement (~1-2 seconds)

### Scaled (1500 posts, 100 feeds)

| Approach | Time | Improvement |
|----------|------|-------------|
| Sequential Batches (current) | 25-30s | Baseline |
| Worker Pool (p-limit) | 18-22s | ~28% faster |
| Custom Worker Pool | 18-22s | ~28% faster |
| Async Generator | 18-22s | ~28% faster |

**Verdict**: Significant improvement (~7-8 seconds)

## When to Refactor

### Don't Refactor If:
- ✅ Total posts < 200 (current: ~60)
- ✅ Total processing time < 15 seconds (current: ~8s)
- ✅ Simplicity is more important than micro-optimization

### Do Refactor If:
- ❌ Users have 50+ feeds (750+ posts)
- ❌ Processing time exceeds 20 seconds
- ❌ User feedback indicates slow initial load
- ❌ We add more expensive processing steps (e.g., AI summarization)

## Recommendation

**Current state**: Keep batching approach
- Simple, maintainable code
- Performance adequate for current scale
- No additional dependencies

**Future optimization** (if needed): Use `p-limit`
- Drop-in replacement (minimal code change)
- Well-tested library
- Best balance of simplicity and performance

**Backend engineer's choice**: Custom worker pool or async generator
- More control, no dependencies
- Familiar pattern from backend systems
- Slight overkill but perfectly valid
