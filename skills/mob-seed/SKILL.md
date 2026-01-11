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

## SEED 四原则 + ACE 自演化

| 字母 | 原则 | 核心哲学 | 铁律 |
|------|------|----------|------|
| **S** | Single-source | 单源定义 | 每种信息只在规格中定义一次 |
| **E** | Emit | 自动派生 | 所有产物必须从规格自动生成 |
| **E** | Execute | 自动执行 | CI/CD 自动触发，无需人工 |
| **D** | Defend | 守护规范 | 防御手动干预、守护自动化流程 |
| **A** | **ACE** | **自演化** | **系统从经验中学习，持续进化** |

**口诀**: Single 定单源，Emit 自派生，Execute 自动跑，Defend 守规范，**ACE 自演化**。

---

## ACE 自演化机制（核心行为）

> **ACE = Agentic Context Engineering**
> ACE 不是可选功能，是**基础设施**。像空气一样无处不在，无需刻意呼吸。
> 任何使用 mob-seed 的项目自动享受 ACE 自演化的好处。

### ACE 三阶段循环

```
┌──────────────────────────────────────────────────────────────┐
│                    ACE 自演化循环                             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Observe（观察）──► Reflect（反思）──► Curate（策展）         │
│       │                  │                  │                 │
│       ▼                  ▼                  ▼                 │
│  自动收集问题      分析根因提取模式    更新规格/工具/文档      │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### ACE 行为约定（不可违反）

Claude 在执行 mob-seed 命令时**必须**遵守以下行为：

| 触发条件 | 必须执行 | 输出 |
|----------|----------|------|
| 测试失败 | 调用 `collectFromExecute()` | `💡 ACE: 收集 N 条观察` |
| 规格漂移 | 调用 `collectFromDefend()` | `💡 ACE: 收集 N 条观察` |
| 用户说"又/再次/还是" | 创建 pattern_detected 观察 | `💡 ACE: 已记录重复模式` |
| 用户报告问题 | 创建 user_feedback 观察 | `💡 ACE: 已记录反馈` |
| 同类观察 ≥ 3 | 主动提议反思 | `💡 ACE: 建议进行反思分析` |

### ACE 触发点

```
/mob-seed:exec   → 步骤末尾自动调用 ACE 收集器
/mob-seed:defend → 步骤末尾自动调用 ACE 收集器
/mob-seed        → 智能入口分析用户输入
git commit       → pre-commit hook 检查 ACE 状态
git push         → pre-push hook 检查反思阈值
```

### ACE 存储结构

```
.seed/
├── observations/          # 观察记录
│   ├── index.json         # 观察索引（JSON 格式）
│   └── obs-*.md           # 单个观察（YAML frontmatter + Markdown）
├── reflections/           # 反思记录
│   ├── index.json         # 反思索引（JSON 格式）
│   └── ref-*.md           # 单个反思（YAML frontmatter + Markdown）
├── insights/              # 外部洞见
│   ├── index.json         # 洞见索引
│   └── ins-*.md           # 单个洞见（YAML frontmatter + Markdown）
└── learning/              # 学习成果
    └── patterns.json      # 提取的模式
```

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
│   ├── mission/             # Mission Statement 模块
│   │   ├── loader.js        # Mission 加载器（双语支持）
│   │   └── types.js         # Mission 类型定义
│   ├── stacks/              # 技术栈配置模块
│   │   ├── types.js         # 栈类型定义
│   │   ├── loader.js        # 栈配置加载器
│   │   └── resolver.js      # 栈依赖解析器
│   └── workflow/            # 工作流模块
│       ├── unified-command.js  # 统一命令入口（状态面板 + 路由）
│       ├── flow-router.js      # 工作流路由（Quick/Standard/Full）
│       └── pre-impl-confirmation.js  # 实现前确认
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
│   ├── seed-utils.js        # 核心工具函数
│   ├── defend-checker.js    # 漂移检测与同步检查
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
| `/mob-seed:seed` | 智能入口（状态面板 + 建议行动） | unified-command.js, 全部 |
| `/mob-seed:init` | 项目初始化 | templates/, config/ |
| `/mob-seed:spec` | S: 规格定义 | spec-*.md, templates/, lifecycle/ |
| `/mob-seed:emit` | E: 自动派生 | emit-*.md, emit-engine.js |
| `/mob-seed:exec` | E: 自动执行 | exec-ci.md, emit.sh |
| `/mob-seed:defend` | D: 守护规范（含 --diff, --sync） | defend-check.md, defend-check.sh |
| `/mob-seed:archive` | 归档提案 | lifecycle/archiver.js |
| `/mob-seed:insight` | 外部洞见管理（导入、评估、复审） | lib/ace/insight-*.js |
| `/mob-seed --version` | 显示详细版本信息 | lib/runtime/ |
| `/mob-seed --update` | 执行版本更新 | lib/runtime/ |

### 版本显示（必须遵守）

> **每个 mob-seed 命令执行时必须显示版本和场景信息**

Claude 在执行任何 `/mob-seed:*` 命令时，**必须**在输出的第一行显示版本信息：

```
🌱 mob-seed v3.5.0 [开发模式] mob-seed dogfooding
```

**实现方式**:
```bash
# 获取版本信息（四层回退）
node -e "
  const { getVersionInfoSync } = require('./lib/runtime/version-checker');
  const { formatVersionLine } = require('./lib/runtime/version-display');
  console.log(formatVersionLine(getVersionInfoSync()));
"
```

**显示格式**:
| 入口类型 | 格式 |
|----------|------|
| 命令入口 | `🌱 mob-seed v{version} [{场景}] {描述}` |
| Git Hooks | `🔍 SEED {检查类型}... v{version} [{场景}] {描述}` |

**场景标签**:
| 场景 | 标签 | 描述 |
|------|------|------|
| dogfooding | 开发模式 | mob-seed dogfooding |
| user-plugin | 用户项目 | Claude Code 插件 |
| user-env | 用户项目 | 环境变量配置 |
| compat | 兼容模式 | .seed/scripts |

### 命令架构

```
/mob-seed:seed            # 智能入口（状态面板 + 建议行动）
├── /mob-seed:init        # 项目初始化
├── /mob-seed:spec        # S: 规格定义（含 --edit, --submit）
├── /mob-seed:emit        # E: 自动派生
├── /mob-seed:exec        # E: 自动执行
├── /mob-seed:defend      # D: 守护规范（含 --diff, --sync）
├── /mob-seed:archive     # 归档提案
└── /mob-seed:insight     # 外部洞见管理
```

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

### Mission 模块

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
