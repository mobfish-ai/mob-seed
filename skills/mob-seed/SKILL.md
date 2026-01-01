---
name: mob-seed
description: |
  SEED 方法论驱动的统一开发工作流引擎（种子法则）
  🌱 OpenSpec 原生支持 | 规格驱动开发

  核心理念：零冗余 + 全自动
  - S: Single-source 单源定义（规格是唯一真相源）
  - E: Emit 自动派生（所有产物自动生成）
  - E: Execute 自动执行（CI/CD 自动触发）
  - D: Defend 守护规范（防御手动干预）

  特性：
  - OpenSpec + fspec 规格标准原生支持
  - 完整生命周期: Draft → Review → Implementing → Archived
  - Delta 语法: ADDED/MODIFIED/REMOVED

  触发场景：
  - 新功能开发、代码实现
  - 规格驱动开发 (Spec-Driven Development)
  - 自动化派生（代码、测试、文档）
  - 合规检查、一致性验证

  显式触发词：
  - "SEED"、"种子法则"、"mob-seed"、"OpenSpec"
  - "规格驱动"、"自动派生"、"零冗余"、"fspec"
  - "单源定义"、"守护规范"
allowed-tools: Read, Write, Edit, Bash, Task, TodoWrite
---

# mob-seed 技能 - SEED 方法论引擎

> **OpenSpec 原生支持** | 规格驱动开发 | MIT License

## 核心概念

```
┌─────────────────────────────────────────────────────────────────┐
│                     🌱 SEED 种子法则                             │
│                     OpenSpec + fspec 原生                        │
│                                                                  │
│  "一粒种子，一棵大树，全自动生长"                                 │
│                                                                  │
│  规格（种子）──自动生长──► 代码 + 测试 + 文档（大树）             │
│                                                                  │
│  openspec/specs/*.fspec.md  →  src/ + test/ + docs/             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## SEED 四原则

| 字母 | 原则 | 核心哲学 | 铁律 |
|------|------|----------|------|
| **S** | Single-source | 单源定义 | 每种信息只在规格中定义一次 |
| **E** | Emit | 自动派生 | 所有产物必须从规格自动生成 |
| **E** | Execute | 自动执行 | CI/CD 自动触发，无需人工 |
| **D** | Defend | 守护规范 | 防御手动干预、守护自动化流程 |

**口诀**: Single 定单源，Emit 自派生，Execute 自动跑，Defend 守规范。

---

## 目录结构

```
.claude/skills/mob-seed/
├── SKILL.md                 # 本文件 - 技能定义
├── config/
│   ├── seed.config.json     # SEED 配置
│   └── loader.js            # 配置加载器
├── lib/
│   ├── lifecycle/           # OpenSpec 生命周期模块
│   │   ├── types.js         # 状态定义与转换规则
│   │   ├── parser.js        # 规格解析器（元数据、Delta）
│   │   └── archiver.js      # 归档逻辑（Delta 合并）
│   ├── mission/             # Mission Statement 模块（ACE 自演化）
│   │   ├── loader.js        # Mission 加载器（双语支持）
│   │   └── types.js         # Mission 类型定义
│   └── stacks/              # 技术栈配置模块
│       ├── types.js         # 栈类型定义
│       ├── loader.js        # 栈配置加载器
│       └── resolver.js      # 栈依赖解析器
├── prompts/
│   ├── spec-create.md       # S: 规格创建指导
│   ├── spec-validate.md     # S: 规格验证
│   ├── emit-code.md         # E: 代码派生
│   ├── emit-test.md         # E: 测试派生
│   ├── emit-docs.md         # E: 文档派生
│   ├── exec-ci.md           # E: CI 触发
│   └── defend-check.md      # D: 守护检查
├── templates/
│   ├── feature.fspec.md     # 功能规格模板
│   ├── api.fspec.md         # API 规格模板
│   └── component.fspec.md   # 组件规格模板
├── adapters/
│   └── emit-engine.js       # 派生引擎
└── scripts/
    ├── emit.sh              # 派生执行脚本
    ├── defend-check.sh      # 守护检查脚本
    └── diff.sh              # 差异检测脚本
```

---

## 关联命令

| 命令 | 说明 | 引用资源 |
|------|------|----------|
| `/mob-seed` | 主入口（智能路由） | 全部 |
| `/mob-seed-spec` | S: 规格定义 | spec-*.md, templates/ |
| `/mob-seed-emit` | E: 自动派生 | emit-*.md, emit-engine.js |
| `/mob-seed-exec` | E: 自动执行 | exec-ci.md, emit.sh |
| `/mob-seed-defend` | D: 守护规范 | defend-check.md, defend-check.sh |
| `/mob-seed-init` | 项目初始化 | templates/, config/ |
| `/mob-seed-status` | 状态查看 | lifecycle/parser.js, mission/loader.js |
| `/mob-seed-diff` | 差异对比 | diff.sh, mission/loader.js |
| `/mob-seed-sync` | 强制同步 | emit-engine.js, mission/loader.js |
| `/mob-seed-archive` | 归档提案 | lifecycle/archiver.js |

---

## 配置说明

配置文件: `config/seed.config.json`

```json
{
  "spec": {
    "format": "fspec",
    "extension": ".fspec.md"
  },
  "emit": {
    "targets": {
      "code": { "enabled": true, "path": "src/" },
      "test": { "enabled": true, "path": "test/" },
      "docs": { "enabled": true, "path": "docs/" }
    }
  },
  "execute": {
    "ci_trigger": "on_emit",
    "auto_commit": false
  },
  "defend": {
    "check_on_commit": true,
    "forbidden_patterns": ["手动复制", "TODO: sync"]
  }
}
```

---

## 工作流程

### 完整 S-E-E-D 流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     SEED 完整流程                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  用户需求                                                        │
│      │                                                           │
│      ▼                                                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ S: Single-source                                          │  │
│  │ 创建/编辑规格文件 (.fspec.md)                              │  │
│  │ 输出: specs/{name}.fspec.md                               │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ E: Emit                                                   │  │
│  │ 从规格自动派生产物                                         │  │
│  │ 输出: src/, test/, docs/                                  │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ E: Execute                                                │  │
│  │ 自动执行 CI/CD                                            │  │
│  │ 输出: 测试报告、构建产物                                   │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ D: Defend                                                 │  │
│  │ 检查合规性、守护自动化                                     │  │
│  │ 输出: 合规报告                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 规格文件格式 (.fspec.md)

```markdown
# {功能名称} 规格

## 概述
- 功能描述
- 目标用户
- 核心价值

## 需求
- [ ] 需求1
- [ ] 需求2

## 约束
- 技术约束
- 业务约束

## 验收标准
- 验收条件1
- 验收条件2
```

---

## OpenSpec 生命周期（默认模式）

SEED **原生支持** OpenSpec 规范，提供完整的规格生命周期管理。

### 状态流转

```
┌─────────┐  --submit   ┌─────────┐  emit    ┌──────────────┐  defend  ┌──────────┐
│  📝     │ ─────────→  │  🔍     │ ─────→   │  🔨          │ ─────→   │  ✅      │
│  draft  │             │  review │          │  implementing│          │  archived│
└─────────┘             └─────────┘          └──────────────┘          └──────────┘
     ↑                       │                      │                       │
     │                       │                      │                       │
     └───────────────────────┴──────────────────────┴───────── --reopen ────┘
```

### 目录结构（OpenSpec 模式）

```
openspec/
├── project.md              # 项目约定
├── AGENTS.md               # AI Agent 工作流指令
├── specs/                  # 真相源（已归档的规格）
│   └── {domain}/
│       └── spec.fspec.md
├── changes/                # 变更提案（开发中）
│   └── {proposal}/
│       ├── proposal.md     # 提案元数据
│       ├── tasks.md        # 任务列表
│       └── specs/
│           └── {domain}.fspec.md  # Delta 规格
└── archive/                # 归档历史
    └── {YYYY-MM}/
        └── {proposal}/
```

### 生命周期模块

| 模块 | 职责 | 主要函数 |
|------|------|----------|
| `types.js` | 状态定义 | `canTransition()`, `getStateDisplay()` |
| `parser.js` | 规格解析 | `parseMetadata()`, `parseDeltaRequirements()` |
| `archiver.js` | 归档逻辑 | `archiveProposal()`, `mergeDeltaToSpec()` |

### Mission 模块（ACE 自演化）

Mission Statement 定义项目的使命、原则和反目标，用于指导 AI 辅助开发决策。

| 模块 | 职责 | 主要函数 |
|------|------|----------|
| `types.js` | 类型定义 | `MissionSchema`, `AlignmentResult` |
| `loader.js` | 加载与评估 | `loadMission()`, `evaluateAlignment()`, `canAutoApply()` |

**配置文件**: `.seed/mission.md`

```yaml
version: "1.0"
mission:
  en: "Spec-driven AI-assisted development"
  zh: "规格驱动的 AI 辅助开发"
principles:
  - id: quality_first
    name: { en: "Quality First", zh: "质量优先" }
anti_goals:
  - id: feature_creep
    name: { en: "Feature Creep", zh: "功能蔓延" }
evolution:
  auto_apply_threshold: 0.70
```

### Delta 规格格式

```markdown
# Feature: OAuth 支持

> 状态: implementing
> 版本: 1.0.0

## ADDED Requirements

### REQ-001: OAuth2 登录
The system SHALL support OAuth2 authentication.

## MODIFIED Requirements

### REQ-002: 密码策略
Changed: 最小长度从 6 改为 8

## REMOVED Requirements

### REQ-003: 旧版 Session
Reason: 已被 OAuth 替代
```

---

## 输出目录

```
output/mob-seed/
├── seed-report.md          # 执行报告（人类可读）
├── seed-manifest.json      # 规格→产物映射
└── seed-log.txt            # 执行日志

openspec/
├── specs/                  # 规格文件（唯一真相源）
│   └── {domain}/
│       └── spec.fspec.md
└── changes/                # 变更提案（开发中）
    └── {proposal}/
```

---

## 资源引用规范

命令中使用动态路径检测：

```bash
# 动态检测 SKILL_DIR
if [ -d ".claude/skills/mob-seed" ]; then
    SKILL_DIR=".claude/skills/mob-seed"
elif [ -d "$HOME/.claude/skills/mob-seed" ]; then
    SKILL_DIR="$HOME/.claude/skills/mob-seed"
fi

# 引用提示词
"$SKILL_DIR/prompts/spec-create.md"

# 引用脚本
"$SKILL_DIR/scripts/emit.sh"
```

> **禁止硬编码路径**：确保跨用户、跨项目兼容
