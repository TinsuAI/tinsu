---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - docs/research.md
  - docs/bmad-taskmaster-integration.md
date: 2026-01-02
author: Tinxu
project: TinSu
---

# Product Brief: TinSu

## Executive Summary

TinSu is an AI Agent Orchestration Platform that transforms the chaos of "vibe coding" into structured, trustworthy product development. Built on the proven BMAD Method and TaskMaster patterns, TinSu provides a familiar Kanban interface where tasks don't just get tracked—they get executed by AI agents under human oversight.

Unlike traditional project management tools (Asana, Trello) that only track human work, or developer-focused AI tools (Cursor, Claude Code) that require technical expertise, TinSu delivers "Service-as-a-Software": founders manage sprints, epics, and stories while AI agents actually implement them. This horizontal platform serves both technical and non-technical founders across all startup activities—from product development to growth hacking to sales.

---

## Core Vision

### Problem Statement

Vibe coding—the intuitive, AI-assisted approach to building software—has unlocked unprecedented creative potential. But without structure, it collapses into chaos: context loss mid-project, uncontrolled scope creep, losing track of what's done versus pending, and AI hallucinations that go uncaught until damage is done.

### Problem Impact

Founders attempting to build products with AI face a trust gap. They cannot "fire and forget" with AI agents because the risk of errors, hallucinations, and off-brand outputs is too high. Without a reliable review mechanism, founders either:

- Micromanage every AI interaction (defeating the productivity gain)
- Accept unacceptable quality risks
- Abandon AI-assisted workflows entirely

The tools that solve this problem (BMAD Method, TaskMaster) exist but are locked behind technical barriers, inaccessible to non-technical founders who could benefit most.

### Why Existing Solutions Fall Short

| Solution                  | Limitation                                                                   |
| ------------------------- | ---------------------------------------------------------------------------- |
| **Asana / Trello / Jira** | Track tasks but don't execute them—still require human labor                 |
| **Cursor / Claude Code**  | Execute code but require technical expertise—excludes non-technical founders |
| **CrewAI / LangChain**    | Powerful agent frameworks but no user-friendly management interface          |
| **ChatGPT / Claude Chat** | One-off interactions with no continuity, context decay, no project memory    |

No existing solution provides a **visual, accessible control plane** where founders can orchestrate AI agents with the trust and transparency they need.

### Proposed Solution

TinSu reimagines the Kanban board as a **computing interface**. Each card is not a static task record but a **runtime environment** where AI agents plan, execute, and deliver work under human oversight:

- **Backlog → Planning → In Progress → Review → Done** becomes an automated pipeline
- AI agents execute stories while humans retain approval authority at each gate
- The "Manager-in-the-Loop" pattern ensures nothing ships without human review
- Same workflow applies to code, content, growth experiments, sales outreach, and beyond

### Key Differentiators

1. **Service-as-a-Software Model**: Project management that executes work, not just tracks it
2. **Hybrid Orchestration**: Combines BMAD (persona-driven planning) with TaskMaster (deterministic execution)—a pattern discovered and validated by the founder over months of real-world use
3. **Horizontal Platform**: One workflow for ALL startup activities, not just coding
4. **Non-Technical Accessibility**: Kanban familiarity means founders don't need to learn CLI tools or write code
5. **Dog-fooded Credibility**: TinSu is being built using its own methodology—living proof the approach works

---

## Target Users

### Primary Users

#### 1. The Technical Startup Founder ("The Builder")

**Profile:** Ex-engineer or self-taught developer building their startup with AI assistance.

**Current Reality:**

- Uses powerful tools like Claude Code, BMAD Method, and GitHub
- Frustrated that "all the good tools live in terminal"
- Struggles to maintain visibility when away from their computer
- Juggles multiple fragmented tools with no unified view

**Core Pain:** Trustworthy, structured engineering with visibility across all their AI-assisted work.

**What Success Looks Like:** A visual command center where they can see all sprints, stories, and agent progress at a glance—even from their phone.

#### 2. The Non-Technical Startup Founder ("The Visionary")

**Profile:** Business, marketing, or domain expert building a startup without coding skills.

**Current Reality:**

- Relies on ChatGPT conversations with no continuity
- Uses tools like n8n for basic automation
- Knows AI could do more but can't access the good tools
- Hires developers for tasks AI could handle

**Core Pain:** Technical barriers block access to the most powerful AI workflows.

**What Success Looks Like:** Using the same structured, trustworthy AI workflows that technical founders use—without touching a terminal.

### Secondary Users

#### CEOs & Executives

- **Role:** Strategic oversight and final approval authority
- **Need:** "God view" dashboard showing agent activity, costs, and risk status
- **Key Action:** Approve high-stakes outputs before deployment (investor emails, public content)

#### Product Managers

- **Role:** Planning, prioritization, and quality review
- **Need:** Sprint planning interface and story management
- **Key Action:** Define sprints, review agent outputs, ensure alignment with product goals

### User Journey

| Stage               | Experience                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| **Discovery**       | Finds TinSu through BMAD community, Product Hunt, or word of mouth from other founders              |
| **First Win**       | Creates first sprint using BMAD Method → watches agent execute a story → reviews the completed work |
| **Aha Moment**      | "This is structured, I can trust it, and I didn't have to use the terminal"                         |
| **Daily Habit**     | Checks the board every morning to see overnight progress and plan the day                           |
| **Long-term Value** | TinSu becomes the operating system for their entire startup—code, content, growth, sales            |

---

## Success Metrics

### User Success Metrics

| Metric                    | Definition                                       | Target         |
| ------------------------- | ------------------------------------------------ | -------------- |
| **Peace of Mind Index**   | % of tasks delegated to agents vs. done manually | >80% delegated |
| **Quality Approval Rate** | % of agent outputs approved on first review      | >80%           |
| **Daily Engagement**      | Users checking their board daily (DAU)           | Measured       |
| **Task Velocity**         | Stories/tasks completed per user per week        | 20+ tasks/week |

**North Star Metric:** Tasks completed per user per week—this captures both engagement and value delivery.

### Business Objectives

| Timeframe     | Objective                   | Target                                     |
| ------------- | --------------------------- | ------------------------------------------ |
| **3 Months**  | Validate product-market fit | Active users completing tasks consistently |
| **6 Months**  | Growth acceleration         | Strong word-of-mouth, organic acquisition  |
| **12 Months** | Scale to mass adoption      | 1 million users                            |

### Key Performance Indicators

| Category        | KPI                             | Target                      |
| --------------- | ------------------------------- | --------------------------- |
| **Acquisition** | New user signups                | Growth trajectory toward 1M |
| **Activation**  | Users who complete first sprint | >60% of signups             |
| **Retention**   | Monthly active user retention   | >50%                        |
| **Engagement**  | Weekly task completion rate     | 20+ tasks/user/week         |
| **Quality**     | First-review approval rate      | >80%                        |
| **Revenue**     | MRR growth (if applicable)      | TBD based on pricing model  |

### Leading Indicators

- **Early signal:** Users who complete their first sprint within 24 hours of signup
- **Stickiness signal:** Users who check the board 5+ days per week
- **Expansion signal:** Users adding additional workflows (growth, sales) beyond initial use case

---

## MVP Scope

### Core Features

#### 1. Kanban Board Interface

- **Columns:** Backlog → In Progress → Review → Done
- **Visual task management** with drag-and-drop
- **Sprint/Epic/Story hierarchy** following BMAD Method structure
- **Real-time status updates** as agents work

#### 2. AI Agent Execution Engine

- **Claude Code integration** for code generation and execution
- **Story-to-execution pipeline** - stories become agent instructions
- **Context management** - agents maintain project context across tasks
- **Execution logs** - visibility into what agents are doing

#### 3. Review Workflow

- **Approve/Reject mechanism** for all agent outputs
- **Feedback loop** - rejected work gets refined instructions
- **Quality gates** - nothing moves to Done without human approval
- **Diff view** - see exactly what the agent created/changed

#### 4. BMAD Method Integration

- **Sprint creation** using BMAD planning structure
- **Epic and story breakdown** built into the workflow
- **Structured prompts** that leverage BMAD persona patterns

### Out of Scope for MVP

| Feature                            | Reason for Deferral                                 |
| ---------------------------------- | --------------------------------------------------- |
| **Non-technical founder UX**       | Focus on dog-fooding with technical founders first  |
| **Growth/Sales/Content workflows** | Prove coding workflow before expanding horizontally |
| **Team collaboration**             | Single-user focus for MVP validation                |
| **Mobile app**                     | Web-first, mobile later                             |
| **CEO dashboard / God view**       | Enterprise features for post-PMF                    |
| **Multiple AI agent providers**    | Claude Code first, expand later                     |
| **Billing/subscription system**    | Free beta during validation phase                   |

### MVP Success Criteria

| Criteria              | Target                                                 | Validation Method       |
| --------------------- | ------------------------------------------------------ | ----------------------- |
| **Core loop works**   | Create → Execute → Review cycle completes successfully | Founder dog-fooding     |
| **Quality output**    | >80% of agent outputs approved on first review         | Tracking approval rates |
| **Daily habit forms** | Founder checks board daily for 2+ weeks                | Usage analytics         |
| **Task velocity**     | 20+ stories completed per week                         | Sprint tracking         |
| **Pain point solved** | "I trust this more than raw vibe coding"               | Founder sentiment       |

**Go/No-Go Decision:** If MVP achieves these criteria with the founder (Tinxu), proceed to invite 10-20 beta testers from BMAD community.

### Future Vision

#### Phase 2: Non-Technical Founders

- Simplified UI for non-coders
- Pre-built workflow templates
- Natural language sprint creation

#### Phase 3: Horizontal Expansion

- Growth hacking workflow agents
- Sales outreach automation
- Content creation pipeline
- CRM integration

#### Phase 4: Team & Enterprise

- Multi-user collaboration
- Role-based permissions
- CEO governance dashboard
- Audit trails and compliance

#### Phase 5: Platform & Scale

- Multiple AI provider support
- Marketplace for workflow templates
- API for custom integrations
- Mobile apps (iOS/Android)

**Long-term Vision:** TinSu becomes the operating system for AI-powered startups—the single interface where founders manage all their AI agents across every business function.
