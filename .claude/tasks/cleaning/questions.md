# Questions:

## Section 1: Global State Management

### Question 1: What state management approach should we use for the global posts state?

- The spec mentions "global state/context" for storing posts but doesn't specify the implementation
- Should we create a new PostsContext similar to AuthContext, or use a different approach?
- Should this state be persisted (AsyncStorage) or memory-only for now?
- **Answer:** memory only, postscontext sounds good to me but im not very used to this pattern, is this like a redux like state that you patch it? If yes, it sounds good. If not i need clarification

### Question 2: How should the state update mechanism work?

- Pipeline calls `onUpdate(post)` after each phase to update state
- Should this be a Context Provider method, a service singleton, or something else?
- How do components subscribe to post updates (re-render when status changes)?
- **Answer:** We will wait posts are ready to render.

## Section 2: App Startup Flow

### Question 3: What happens if feed fetching or RSS parsing fails at startup?

- The spec says "Fetch all feeds → Fetch RSS for all feeds in parallel" at app startup
- If a feed fails to fetch (network error, invalid RSS, 404), should we:
  - Show error UI and block app usage?
  - Skip failed feeds silently and show successful ones?
  - Show feeds with error states in FeedList?
- **Answer:** skip fialed feeds ans show successfull ones, and log an error.

### Question 4: How long should we wait for RSS fetching during startup?

- If fetching dozens of feeds in parallel, some may be slow
- Should we have a timeout per feed (e.g., 10 seconds)?
- What happens if a feed takes too long - skip it or keep waiting?
- **Answer:** 15s sounds good, skip it

### Question 5: Should the splash screen stay visible during initial feed fetching?

- Current flow: Splash (3s) → FeedList
- New flow might need: Splash → Fetch feeds/RSS → FeedList
- Should splash screen extend until feeds are fetched, or show FeedList immediately with loading state?
- **Answer:** ideally splash screen should stay until feeds are fetched from database. Then on feed list we can show feedback per feed that is being processed (fetching rss, and cleaing) But we can balance this if it adds a lot of complexity.

## Section 3: Feed Statistics

### Question 6: How should FeedList display post counts when posts are filtering out due to cleaning errors?

- Current: FeedList shows `itemCount` from RSS parsing
- New behavior: Some posts may fail cleaning and be skipped entirely
- Should we show:
  - Original RSS count (e.g., "50 posts")?
  - Successful count after cleaning (e.g., "47 posts")?
  - Both counts (e.g., "47 of 50 posts")?
- **Answer:** successful count only

## Section 4: Pipeline Execution Details

### Question 7: What order should posts be processed in the pipeline?

- Processing "posts in parallel without blocking" - but should there be ordering/prioritization?
- Options:
  - Process all posts truly in parallel (may overwhelm device)
  - Process in batches (e.g., 5 at a time)
  - Process newest first, oldest last
  - Process in RSS feed order
- **Answer:** ideally we should provide a batch side of 10 (configurable) and process them async... i mean that we dont wait to all 10 to finish, once one is freed we add another one. But we can balance this if its too complex.

### Question 8: Should pipeline processing pause when app is backgrounded?

- User opens app → pipeline starts → user backgrounds app
- Should processing:
  - Continue in background (may drain battery)
  - Pause and resume when app returns to foreground
  - Stop entirely (restart on next app open)
- **Answer:** pause and resume

## Section 5: TrackList Integration

### Question 9: How should TrackList handle posts with different statuses?

- User selects feed → navigates to TrackList
- Posts may have status: 'raw', 'cleaning', 'cleaned', 'error'
- Should TrackList:
  - Show all posts regardless of status?
  - Hide posts that haven't been cleaned yet?
  - Show disabled/grayed-out posts that are still cleaning?
  - Filter out 'error' posts entirely?
- **Answer:** filter out error posts entirely by now. But always log errors.

### Question 10: Can users play posts that are in 'cleaning' state?

- User might try to play a post before cleaning completes
- Should we:
  - Allow playing with rawContent (poor TTS quality)
  - Block playing until status='cleaned'
  - Show a "Processing..." message
- **Answer:** No

## Section 6: Cleaning Transformation Details

### Question 11: How should we handle posts with no content after cleaning?

- Some RSS posts might be just images/embeds - after cleaning, text could be empty or just whitespace
- Should we:
  - Skip these posts (like error posts)
  - Keep them with empty cleanedContent
  - Set a minimum content length threshold (e.g., 50 characters)
- **Answer:** set a minimum content length treshold, 50 chars sounds good.

### Question 12: Should we preserve any markdown-like formatting for TTS pauses?

- After cleaning, we have plain text with newlines
- Should we preserve paragraph breaks (double newlines) for TTS pacing?
- Should bullet points become "item one", "item two", etc.?
- Should section headings get special treatment (e.g., "Section: <title>")?
- **Answer:** not by now.

### Question 13: How aggressive should tracking pixel removal be?

- Spec says "Remove tracking pixels (img tags with tracking URLs)"
- How do we identify tracking URLs? Examples:
  - Any 1x1 pixel image
  - Specific domains (doubleclick, google-analytics, etc.)
  - Any external image domain
- Should we maintain a blocklist of tracking domains?
- **Answer:** we need to remove all images anyway so maybe this is already covered.

## Section 7: Error Handling

### Question 14: Should we retry failed posts?

- Spec says "Log error and skip posts that fail cleaning"
- Should we:
  - Mark post with status='error' and never retry
  - Retry on next app startup
  - Provide manual retry mechanism
- **Answer:** it will be retried on next app startup, but result wont probably change tbh

### Question 15: What level of error detail should be logged?

- Spec mentions logging "feed ID, post ID, and error details"
- Should logs include:
  - Full error stack trace
  - Sample of problematic content (first 200 chars)
  - Just error message
- Privacy concern: RSS content might contain sensitive info
- **Answer:** error message, line, post id and feed id

## Section 8: Performance and Testing

### Question 16: What's the expected maximum number of posts per feed?

- Affects parallelization strategy and memory usage
- Typical RSS feeds: 10-50 posts, but some have hundreds
- Should we limit posts per feed (e.g., most recent 100)?
- **Answer:** we will handle this in the future.

### Question 17: How can we test the cleaning transformations effectively?

- Should we create test fixtures with problematic RSS content?
- Should we include unit tests for cleaning functions?
- Should we test with real RSS feeds (which specific ones)?
- **Answer:** I will do some manual tests
