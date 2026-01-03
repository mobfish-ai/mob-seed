# mob-seed

> SEED Methodology - Spec-Driven Development with OpenSpec Native Support

[中文文档](./README.zh-CN.md)

## Overview

**mob-seed** is a Claude Code skill that implements the SEED methodology for spec-driven development. It automates the workflow from specification to code, tests, and documentation, with **ACE (Agentic Context Engineering)** enabling self-evolution through execution feedback.

```
┌─────────────────────────────────────────────────────────────────┐
│                     🌱 SEED Methodology                          │
│               OpenSpec + fspec Native + ACE Self-Evolution       │
│                                                                  │
│  "One seed, one tree, fully automated growth"                   │
│                                                                  │
│  Spec (seed) ──auto-grow──► Code + Tests + Docs (tree)          │
│       ▲                                        │                 │
│       │           ┌────────────────────────────┘                 │
│       │           ▼                                              │
│       └── ACE (Observe → Reflect → Curate) ◄───┘                 │
│                                                                  │
│  openspec/specs/*.fspec.md  →  src/ + test/ + docs/             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## SEED Principles

| Letter | Principle | Philosophy | Rule |
|--------|-----------|------------|------|
| **S** | Single-source | Single source of truth | Each piece of information defined only once in spec |
| **E** | Emit | Auto-derive | All artifacts auto-generated from spec |
| **E** | Execute | Auto-execute | CI/CD triggered automatically |
| **D** | Defend | Guard standards | Prevent manual intervention |

**Mnemonic**: Single defines source, Emit auto-derives, Execute auto-runs, Defend guards standards.

## ACE Self-Evolution

ACE (Agentic Context Engineering) enables specs to evolve from execution feedback:

```
┌───────────────────────────────────────────────────────────────────┐
│                        SEED + ACE Cycle                            │
│                                                                    │
│   Spec ──────► Emit ──────► Execute ──────► Defend                │
│    ▲                           │              │                   │
│    │                           ▼              ▼                   │
│    │                    ┌──────────────────────────┐              │
│    │                    │ Observe (collect signals)│              │
│    │                    └───────────┬──────────────┘              │
│    │                                ▼                              │
│    │                    ┌──────────────────────────┐              │
│    │                    │ Reflect (identify patterns)│            │
│    │                    └───────────┬──────────────┘              │
│    │                                ▼                              │
│    │                    ┌──────────────────────────┐              │
│    └────────────────────│ Curate (evolve spec)     │              │
│                         └──────────────────────────┘              │
└───────────────────────────────────────────────────────────────────┘
```

| Stage | Description | Trigger |
|-------|-------------|---------|
| **Observe** | Collect execution signals (test failures, spec drift) | Auto/Manual |
| **Reflect** | Identify patterns across observations | Threshold trigger |
| **Curate** | Propose spec improvements from insights | Manual review |

## Installation

### Via Plugin Marketplace (Recommended)

```bash
# Step 1: Add the marketplace
/plugin marketplace add mobfish-ai/mob-seed

# Step 2: Install the plugin
/plugin install mob-seed
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/mobfish-ai/mob-seed.git
cd mob-seed

# Install to user scope (available in all projects)
./install.sh user

# Or install to project scope (only available in that project)
./install.sh project
```

After installation, restart Claude Code to load the plugin.

## Project Structure

```
mob-seed/                          # Project root
├── .seed/                         # SEED configuration
│   ├── config.json               # Core config (paths, patterns, emit settings)
│   └── mission.md              # Mission statement
├── openspec/                      # OpenSpec specifications
│   ├── specs/                    # Stable specs (archived)
│   ├── changes/                  # Change proposals (implementing)
│   └── archive/                  # Historical specs
├── skills/mob-seed/              # Skill implementation
│   ├── lib/                      # Source code (CommonJS)
│   ├── test/                     # Tests (CommonJS)
│   ├── adapters/                 # API adapters (ES Modules)
│   ├── prompts/                  # Prompt templates
│   ├── templates/                # Code generation templates
│   └── SKILL.md                  # Skill definition
├── commands/                      # User-facing commands
└── examples/                      # Usage examples
```

**Key directories:**
- `.seed/config.json`: All path configurations are relative to project root
- `openspec/changes/`: Active development (specs with status: implementing)
- `skills/mob-seed/lib/`: Core implementation code

## Quick Start

### 1. Initialize Project (OpenSpec mode - default)

```bash
/mob-seed:init
```

This creates the OpenSpec directory structure:

```
your-project/
├── openspec/
│   ├── specs/          # Source of truth (implemented specs)
│   ├── changes/        # Change proposals (in-development specs)
│   ├── project.md      # Project conventions
│   └── AGENTS.md       # AI workflow instructions
└── .seed/
    └── config.json     # SEED configuration
```

### 2. Create a Spec

```bash
/mob-seed:spec "user-authentication"
```

### 3. Auto-derive Code, Tests, and Docs

```bash
/mob-seed:emit specs/user-authentication.fspec.md
```

### 4. Guard Synchronization

```bash
/mob-seed:defend
```

### 5. Self-Evolution (ACE)

```bash
# Add manual observation
/mob-seed:spec observe "Test flaky in CI due to timing"

# Trigger reflection analysis
/mob-seed:spec reflect

# Promote insight to proposal
/mob-seed:spec promote <reflection-id>
```

## Commands

> **v3.0.0**: Commands unified to subcommand pattern (`/mob-seed:*`) with ACE integration

### Core SEED Commands

| Command | Description |
|---------|-------------|
| `/mob-seed` | Main entry (smart routing) |
| `/mob-seed:init` | Initialize project (OpenSpec default) |
| `/mob-seed:spec` | S: Create/edit spec |
| `/mob-seed:emit` | E: Auto-derive artifacts |
| `/mob-seed:exec` | E: Auto-execute CI |
| `/mob-seed:defend` | D: Guard compliance |
| `/mob-seed:archive` | Archive completed proposals |

### ACE Commands (Self-Evolution)

| Command | Description |
|---------|-------------|
| `/mob-seed:spec observe` | Add manual observation |
| `/mob-seed:spec triage` | Categorize observations |
| `/mob-seed:spec reflect` | Trigger pattern analysis |
| `/mob-seed:spec promote` | Promote insight to proposal |

## OpenSpec Lifecycle

```
┌─────────┐  --submit   ┌─────────┐  emit    ┌──────────────┐  defend  ┌──────────┐
│  📝     │ ─────────→  │  🔍     │ ─────→   │  🔨          │ ─────→   │  ✅      │
│  draft  │             │  review │          │  implementing│          │  archived│
└─────────┘             └─────────┘          └──────────────┘          └──────────┘
     ↑                       │                      │                       │
     │                       │                      │                       │
     └───────────────────────┴──────────────────────┴───────── --reopen ────┘
```

## fspec Format

```markdown
# Feature: User Authentication

> Status: implementing
> Version: 1.0.0

## ADDED Requirements

### REQ-001: OAuth2 Login
The system SHALL support OAuth2 authentication.

## MODIFIED Requirements

### REQ-002: Password Policy
Changed: Minimum length from 6 to 8

## REMOVED Requirements

### REQ-003: Legacy Session
Reason: Replaced by OAuth
```

## Mission Statement

mob-seed supports **Mission Statement** for AI-guided development decisions. The mission defines project purpose, principles, and anti-goals.

`.seed/mission.md`:

```yaml
version: "1.0"
mission:
  en: "Spec-driven AI-assisted development"
  zh: "规格驱动的 AI 辅助开发"

principles:
  - id: quality_first
    name: { en: "Quality First", zh: "质量优先" }
    description: { en: "Quality over speed", zh: "质量优于速度" }

anti_goals:
  - id: feature_creep
    name: { en: "Feature Creep", zh: "功能蔓延" }
    description: { en: "Adding unplanned features", zh: "添加计划外功能" }

evolution:
  auto_apply_threshold: 0.70
```

The mission is checked during `/mob-seed:defend` to ensure changes align with project goals.

## Configuration

`.seed/config.json`:

```json
{
  "openspec": {
    "enabled": true,
    "root": "openspec",
    "specsDir": "specs",
    "changesDir": "changes"
  },
  "mission": {
    "enabled": true,
    "path": ".seed/mission.md"
  },
  "emit": {
    "targets": {
      "code": { "enabled": true, "path": "src/" },
      "test": { "enabled": true, "path": "test/" },
      "docs": { "enabled": true, "path": "docs/" }
    }
  }
}
```

## Requirements

- [Claude Code](https://claude.ai/code) CLI
- Node.js 18+ (for some features)

## License

MIT License - see [LICENSE](./LICENSE)

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Links

- [GitHub Repository](https://github.com/mobfish-ai/mob-seed)
- [OpenSpec Standard](https://openspec.dev) (coming soon)
- [SEED Methodology](https://seed.dev) (coming soon)
