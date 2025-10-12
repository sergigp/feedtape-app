---
description: Create a GitHub issue in feedtape-app repository based on current discussion
---

Create a GitHub issue in the feedtape-app repository (owner: sergigp, repo: feedtape-app) based on our current discussion.

## Steps:
1. Extract the feature/task/bug from the conversation context
2. Create a well-structured issue with:
   - Clear, descriptive title
   - Feature description section
   - Use cases section (3-5 concrete examples)
   - Technical notes section (implementation details, affected files, APIs)
   - Acceptance criteria checklist
3. Apply the labels requested by the user
4. Return the created issue URL

## Issue Template Structure:

```
## Feature Description
[What the feature does or problem it solves]

## Use Cases
- [User scenario 1]
- [User scenario 2]
- [User scenario 3]

## Technical Notes
- [Implementation approach]
- [Files to modify]
- [Dependencies/APIs/Libraries]
- [Any architectural considerations]

## Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
```

## Common Labels:
- `feature` - New feature or enhancement
- `bug` - Bug fix
- `mvp` - Required for MVP
- `enhancement` - Improvement to existing feature
- `documentation` - Documentation improvements

## Examples:
- User: "Create an issue about this with labels feature, mvp"
- User: "/create-issue with enhancement label"
- User: "Make a GitHub issue for this, mark it as bug"

If the user doesn't specify labels, ask them which labels to apply.
