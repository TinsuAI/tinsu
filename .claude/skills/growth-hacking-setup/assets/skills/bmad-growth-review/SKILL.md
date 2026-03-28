---
name: bmad-growth-review
description: Autonomous growth strategy review of the PRD before architecture begins. Evaluates organic growth potential, identifies viral loops and growth levers that should be designed into the MVP architecture from day one. Use when the user says "run growth review" or "review PRD for growth" or after PRD validation before creating architecture.
---

# Growth Review — PRD Growth Readiness Assessment

## Purpose

Evaluate the PRD through an organic growth lens before architecture decisions are locked. Growth infrastructure is 10x harder to retrofit than to design in. This step ensures the architecture will support the product's growth engine from day one.

## When to Run

After PRD is validated (bmad-validate-prd), before architecture begins (bmad-create-architecture). The PRD contains the full product vision, user journeys, and functional requirements — everything needed for a growth assessment.

## Inputs

Load these artifacts (search for them in the project):

1. **PRD** (required) — `prd.md` in planning artifacts
2. **Product Brief** (if exists) — `product-brief*.md` in planning artifacts
3. **Market Research** (if exists) — market research docs in planning artifacts
4. **Domain Research** (if exists) — domain research docs in planning artifacts

## How to Execute

Read the growth-hacking-guru-pipeline skill from `{project-root}/growth-hacking-guru-pipeline/SKILL.md` and apply its methodology in **Mode 3: Plan & Tactic Review** against the PRD.

Evaluate the PRD against these growth-specific criteria:

### 1. Growth Model Fit
- Does the PRD define a clear acquisition → activation → retention → referral loop?
- Is there a North Star Metric that captures user value delivery?
- Are the user journeys designed to create "aha moments" that drive word-of-mouth?

### 2. Viral & Network Effects
- Does the product have built-in sharing mechanics (output sharing, collaboration, social proof)?
- Are there network effects that make the product more valuable as more people use it?
- Can user-generated content or results be shared externally?

### 3. Architecture Implications
- What data sharing/privacy infrastructure is needed from day one?
- What analytics hooks should be in the architecture for growth measurement?
- What API surfaces or export formats enable organic distribution?
- Does the onboarding flow minimize time-to-value?

### 4. Organic Channel Readiness
- Which 2-3 organic channels does the product naturally fit?
- Does the PRD's content strategy align with the target audience's information sources?
- Are there SEO, community, or content distribution opportunities baked into the product?

### 5. Retention Architecture
- Does the product create habit loops (daily/weekly engagement patterns)?
- Are there progression systems, streaks, or identity markers that build switching costs?
- Is the re-engagement strategy defined (notifications, email triggers, content cadence)?

## Output

Produce a `growth-hacking-review.md` in the planning artifacts folder with this structure:

```markdown
# Growth Readiness Review

## Growth Model Assessment
[AARRR analysis of the PRD — where is the funnel strong/weak?]

## Top 3 Growth Levers
[ICE-scored tactics that should be designed into the MVP]

## Architecture Requirements for Growth
[Specific technical decisions the architecture must make to support growth — data models, APIs, sharing infrastructure, analytics hooks]

## Risks & Blind Spots
[What the PRD is missing or underweighting from a growth perspective]

## Recommendations
[Prioritized list: what to add to PRD before architecture, what to flag for the architect, what can wait for Phase 2]
```

## After Completion

The architect (bmad-create-architecture) should reference this review when making technical decisions. Key architecture requirements identified here should be treated as cross-cutting concerns in the architecture spec.
