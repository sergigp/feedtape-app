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
