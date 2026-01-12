# mob-seed 详细参考文档

> 本文件包含 SKILL.md 的详细参考内容，通过渐进式披露模式按需加载。
>
> **主文件**: [SKILL.md](SKILL.md) - 核心指令（<500 行）
> **本文件**: REFERENCE.md - 详细参考（按需加载）

---

## 目录

1. [架构详解](#架构详解)
2. [目录结构](#目录结构)
3. [配置说明](#配置说明)
4. [完整工作流程](#完整工作流程)
5. [OpenSpec 生命周期](#openspec-生命周期)
6. [Delta 规格格式](#delta-规格格式)
7. [输出目录](#输出目录)
8. [资源引用规范](#资源引用规范)

---

## 架构详解

### DRY 原则在 mob-seed 中的应用

| 类型 | 定义位置 | 命令文件 |
|------|----------|----------|
| **强制启动行为** | SKILL.md | 引用，不重复代码 |
| **ACE 行为约定** | SKILL.md | 引用，不重复代码 |
| **版本显示格式** | SKILL.md | 引用，不重复代码 |
| **目录检测逻辑** | `lib/runtime/` 模块 | 调用模块，不内联 |

### 行为定义层次

```
┌─────────────────────────────────────────────────────────────────┐
│                     行为定义层次结构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SKILL.md (核心指令)                                             │
│      │                                                           │
│      ├── 强制启动行为（版本显示、初始化检查）                      │
│      ├── ACE 行为约定（观察收集、反思触发）                        │
│      └── 输出格式规范（版本行、进度图标）                          │
│                                                                  │
│  commands/*.md                                                   │
│      │                                                           │
│      └── 引用 SKILL.md 行为 + 定义具体执行步骤                    │
│                                                                  │
│  lib/*.js                                                        │
│      │                                                           │
│      └── 实现具体逻辑（被 SKILL.md 和 commands 调用）             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Claude 执行 mob-seed 命令时必须遵循的顺序

```
1. 读取 SKILL.md 获取强制启动行为
2. 执行强制启动行为（版本显示）
3. 读取具体命令文件（commands/*.md）
4. 按命令文件步骤执行
5. 执行 ACE 行为（如适用）
```

---

## 目录结构

```
.claude/skills/mob-seed/
├── SKILL.md                 # 核心指令（<500 行）
├── REFERENCE.md             # 本文件 - 详细参考
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
│   ├── ace/                 # ACE 自演化模块
│   │   ├── observation-*.js # 观察管理
│   │   ├── reflection-*.js  # 反思管理
│   │   └── insight-*.js     # 洞见管理
│   ├── runtime/             # 运行时模块
│   │   ├── version-*.js     # 版本管理
│   │   └── scenario-*.js    # 场景检测
│   └── workflow/            # 工作流模块
│       ├── unified-command.js  # 统一命令入口
│       ├── flow-router.js      # 工作流路由
│       └── pre-impl-confirmation.js
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
    ├── show-version.js      # 版本显示脚本
    ├── init-project.js      # 项目初始化脚本
    ├── emit.sh              # 派生执行脚本
    └── defend-check.sh      # 守护检查脚本
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

## 完整工作流程

### S-E-E-D 流程图

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

---

## OpenSpec 生命周期

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

**格式**: YAML frontmatter + Markdown body（用于人机协作）

```markdown
---
# YAML frontmatter（机器可解析）
version: "1.0.0"
bilingual: true

principle_ids:
  - quality_first
  - simplicity_over_cleverness

anti_goal_ids:
  - feature_creep
  - over_engineering

evolution:
  allowed_scopes: [refactor, document, test, fix]
  auto_apply: [document, test]
  min_alignment_score: 0.7
---

# Project Mission | 项目使命

> **The Covenant Between Human Intent and Machine Intelligence**

---

## Purpose: Why We Exist | 使命：为何存在

### Statement | 宣言

**EN:** [Your mission in 1-2 sentences]

**ZH:** [用1-2句话定义使命]

---

## Principles: How We Operate | 原则：如何运作

### 1. Quality First | 质量优先 (`quality_first`)

**EN:** Write code that is correct, readable, and maintainable.

**ZH:** 编写正确、可读、可维护的代码。

...
```

**格式优势**:
- **YAML frontmatter**: 机器可解析的结构化数据（ID、配置、阈值）
- **Markdown body**: 人类友好的可预览文档（双语、章节）
- **预览体验**: 在任何 Markdown 编辑器中都能正确渲染

---

## Delta 规格格式

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

---

## ACE 存储结构

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

## 版本显示格式

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

---

## 规格文件模板

### 基本模板 (.fspec.md)

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

*本文件是 SKILL.md 的补充参考，详细内容按需加载以优化 token 使用。*
