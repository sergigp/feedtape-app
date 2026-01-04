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
