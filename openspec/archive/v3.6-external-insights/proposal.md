# v3.6 External Insights - 外部洞见积累机制

> 状态: archived
> 创建: 2026-01-04
> 更新: 2026-01-11
> 归档日期: 2026-01-11
> 优先级: P1

## 概述

扩展 ACE (Agentic Context Engineering) 机制，新增外部洞见（External Insights）收集、评估和积累功能。支持从专家意见、论文、博客、社区讨论等外部来源系统性地吸收知识，并通过辩证评估流程决定是否采纳。

## 背景

### 问题陈述

1. **外部知识无系统积累**：团队获取的外部洞见（专家意见、行业最佳实践）缺乏统一存储和管理
2. **采纳决策不透明**：外部建议的评估和采纳过程缺乏追溯性
3. **时效性管理缺失**：随着模型进化，早期的工程约束可能过时，缺乏系统性复审机制

### 解决方案

新增 `.seed/insights/` 目录，作为外部洞见的积累区，配合评估流程和时效性标注，实现：
- 系统性收集外部知识
- 辩证评估后选择性采纳
- 模型升级时自动触发复审
- **快速导入**：粘贴即用，AI 自动提取元数据

## 目标

- [x] 实现外部洞见的标准化存储格式
- [x] 实现洞见生命周期管理（收集 → 评估 → 采纳/拒绝 → 复审）
- [x] 实现模型时代标注和过时检测
- [x] 与现有 ACE 机制集成
- [x] **实现快速导入功能**（URL/文本 → 结构化洞见）

## 非目标

- 自动从互联网抓取洞见
- 替代现有的 observations/reflections 机制
- 强制所有外部输入都经过此流程

## 设计概要

### 目录结构

支持两种模式：

#### 模式 1：默认模式（无需配置）

洞见存储在本项目的 `.seed/insights/` 目录，适用于非开源项目：

```
my-project/
├── .seed/
│   ├── config.json         # 无需配置 insights.output_dir
│   ├── observations/       # 内部观察
│   ├── reflections/        # 模式分析
│   └── insights/           # 🆕 外部洞见（默认位置）
│       ├── index.json
│       └── ins-*.md
└── ...
```

#### 模式 2：外部+软链接模式（推荐，适用于开源项目）

对于开源项目（如 mob-seed），不希望将个人知识内容提交到公开仓库。采用外部存储+软链接方案，覆盖所有 ACE 相关目录：

**涉及目录**:

| 目录 | 内容 | 说明 |
|------|------|------|
| `observations/` | 内部观察记录 | 测试失败、规格偏离等自动收集 |
| `reflections/` | 模式分析 | 从观察中提炼的规律 |
| `insights/` | 外部洞见 | 本提案新增，外部知识导入 |
| `learning/` | 学习记录 | 历史样本和效果反馈 |

**目录结构**:

```
~/workspace/                          # 用户工作空间
├── projects/
│   └── my-oss-project/               # 开源项目（不含私有内容）
│       └── .seed/
│           ├── config.json           # 公开配置（不含路径）
│           ├── config.local.json     # 私有配置（gitignored）
│           ├── observations -> ~/knowledge/my-oss-project/observations
│           ├── reflections -> ~/knowledge/my-oss-project/reflections
│           ├── insights -> ~/knowledge/my-oss-project/insights
│           └── learning -> ~/knowledge/my-oss-project/learning
│
└── knowledge/                        # 私有知识库（独立 git 仓库）
    ├── .git/
    ├── my-oss-project/
    │   ├── observations/
    │   ├── reflections/
    │   ├── insights/
    │   └── learning/
    └── other-project/
        └── ...
```

**配置步骤**:

```bash
# 1. 创建外部知识库（独立 git 仓库）
mkdir -p ~/knowledge/my-project/{observations,reflections,insights,learning}
cd ~/knowledge && git init

# 2. 配置 ACE 输出目录（统一配置）
# 方式 A：环境变量
export ACE_OUTPUT_DIR="$HOME/knowledge/my-project"

# 方式 B：本地配置文件
cat > .seed/config.local.json << 'EOF'
{
  "ace": {
    "output_dir": "~/knowledge/my-project"
  }
}
EOF

# 3. 创建软链接（方便在项目内浏览）
ln -s ~/knowledge/my-project/observations .seed/observations
ln -s ~/knowledge/my-project/reflections .seed/reflections
ln -s ~/knowledge/my-project/insights .seed/insights
ln -s ~/knowledge/my-project/learning .seed/learning
```

**配置优先级**:

```
1. 环境变量: ACE_OUTPUT_DIR（最高优先级，统一目录）
   - 或单独配置: OBSERVATIONS_OUTPUT_DIR, REFLECTIONS_OUTPUT_DIR,
                 INSIGHTS_OUTPUT_DIR, LEARNING_OUTPUT_DIR
2. 本地配置: .seed/config.local.json（gitignored）
3. 项目配置: .seed/config.json
4. 默认值: .seed/{observations,reflections,insights,learning}/
```

**配置结构**:

```json
// .seed/config.local.json（gitignored）
{
  "ace": {
    "output_dir": "~/knowledge/my-project"  // 统一配置，自动添加子目录
  }
}

// 或分别配置
{
  "ace": {
    "observations_dir": "~/knowledge/my-project/observations",
    "reflections_dir": "~/knowledge/my-project/reflections",
    "insights_dir": "~/knowledge/my-project/insights",
    "learning_dir": "~/knowledge/my-project/learning"
  }
}
```

**优势**:

| 特性 | 说明 |
|------|------|
| 隐私安全 | 所有私有内容不会提交到公开仓库 |
| 统一管理 | 一个配置覆盖全部 ACE 目录 |
| 独立版本控制 | 知识库有自己的 git 历史 |
| 项目内浏览 | 通过软链接可在项目内直接访问 |
| 跨项目共享 | 多个项目可共用同一个知识库 |

**.gitignore 需新增**:

```gitignore
# Local configuration (may contain private paths)
.seed/config.local.json

# ACE directories (may be symlinks to private location)
.seed/observations
.seed/reflections
.seed/insights
.seed/learning
```

**路径解析规则**:

| 配置值 | 解析结果 | 适用场景 |
|--------|----------|----------|
| 未配置 | `.seed/{dir}/` | 默认模式 |
| `output_dir` | `{output_dir}/{observations,reflections,...}/` | 统一外部目录 |
| `{dir}_dir` | 指定路径 | 单独配置某个目录 |
| `~/xxx` | 展开为用户目录 | 外部知识库 |

### 洞见格式

```yaml
---
id: ins-20260104-agent-expert
source:
  title: "Agent 研发经验分享"        # 来源标题
  type: expert_opinion              # paper / blog / expert_opinion / community / conference / book
  author: "张三"                    # 作者/分享者
  affiliation: "某 AI 公司"          # 所属机构
  date: 2026-01-04                  # 原始发布/分享日期
  context: "技术交流会议"            # 获取场景
  url: ""                           # 来源链接（可选）
  credibility: high                 # high / medium / low
date: 2026-01-04
status: evaluating  # evaluating / piloting / adopted / partial / rejected / obsolete
model_era: claude-opus-4.5  # 洞见适用的模型时代
review_trigger: "claude-5.0"  # 触发复审的条件
tags: [architecture, scaffolding, context-management]
---

## 原始洞见

[洞见内容]

## 评估笔记

[辩证分析]

## 采纳决策

[具体行动]
```

### 生命周期

```
收集(collected) → 评估(evaluating) → 试点(piloting)
                                         ↓
                         ┌───────────────┼───────────────┐
                         ↓               ↓               ↓
                    adopted          partial         rejected
                         ↓               ↓
                    (模型升级触发)  →  obsolete
```

### 快速导入

**设计理念**: 作为顶级命令，与核心 SEED 命令平行

```
SEED 命令体系（v3.6 更新）：

┌─────────────────────────────────────────────────────────────────────────────┐
│ /mob-seed:spec     S: 规格定义 (Specification)                               │
│                    ├── 创建/编辑 .fspec.md 规格文件                          │
│                    ├── 定义功能需求 (FR)、非功能需求 (NFR)                    │
│                    └── 编写验收标准 (AC)，作为后续派生的唯一真相源            │
├─────────────────────────────────────────────────────────────────────────────┤
│ /mob-seed:emit     E₁: 自动派生 (Emit = 生成产物)                            │
│                    ├── 输入: 规格文件 (.fspec.md)                            │
│                    ├── 输出: 代码、测试、文档                                │
│                    ├── 特点: 纯生成，不执行任何代码                          │
│                    └── 类比: 编译器（源码 → 产物）                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ /mob-seed:exec     E₂: 自动执行 (Execute = 运行验证)                         │
│                    ├── 输入: E₁ 生成的测试代码                               │
│                    ├── 输出: 测试结果、AC 完成状态、观察记录                  │
│                    ├── 特点: 实际运行代码，验证正确性                        │
│                    └── 类比: 测试运行器（产物 → 验证结果）                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ /mob-seed:defend   D: 守护规范 (Defend = 一致性检查)                         │
│                    ├── 检查规格与代码的一致性（spec drift 检测）             │
│                    ├── 检查代码与文档的同步状态                              │
│                    └── 防止手动修改破坏派生链完整性                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ /mob-seed:insight  🆕 外部洞见 (Insight = 知识积累)                          │
│                    ├── 从 URL/文本快速导入外部知识                           │
│                    ├── AI 自动提取元数据，人类专注辩证评估                   │
│                    └── 支持模型升级时的时效性复审                            │
└─────────────────────────────────────────────────────────────────────────────┘

E₁ vs E₂ 核心区别：

│ 维度     │ E₁ (emit)          │ E₂ (exec)              │
│──────────│────────────────────│────────────────────────│
│ 动作     │ 生成文件           │ 运行程序               │
│ 副作用   │ 写入磁盘           │ 执行进程               │
│ 可逆性   │ 可重新生成         │ 结果不可逆（状态变更） │
│ 依赖     │ 只需规格文件       │ 需要运行时环境         │
│ 失败处理 │ 重新派生           │ 记录观察，迭代修复     │

派生链：

    Spec ───E₁───► Code ───E₁───► Docs
      │              │
      │              E₂ (运行测试，验证正确性)
      │              │
      │              ▼
      │           Results ───► AC 状态更新
      │              │
      └──────────────┴───► D (守护：检查一致性)
```

**命令设计**:

```bash
# 导入洞见（默认行为，最常用）
/mob-seed:insight "https://example.com/article"
/mob-seed:insight --text    # 交互式粘贴

# 管理操作（通过 flag）
/mob-seed:insight --list    # 列出洞见
/mob-seed:insight --stats   # 统计
/mob-seed:insight --review  # 复审检查
```

**为什么升级为顶级命令**:

| 原设计 | 新设计 | 理由 |
|--------|--------|------|
| `/mob-seed:spec insight` | `/mob-seed:insight` | 独立功能，不是 spec 子命令 |
| 嵌套在 ACE 下 | 与 SEED 平行 | 外部洞见是知识积累，非规格定义 |
| 命令较长 | 命令简短 | 高频使用需要简洁入口 |

**与其他命令的对比**:

| 命令 | 来源 | 输入 | 处理 | 输出位置 |
|------|------|------|------|----------|
| `/mob-seed:spec observe` | 内部 | 描述文字 | 直接记录 | `.seed/observations/` |
| `/mob-seed:insight` | 外部 | URL/文本 | AI 提取 | 配置的 insights 目录 |

**AI 自动完成**:
- 提取标题、作者、机构、日期
- 推断来源类型和可信度
- 生成标签
- 结构化核心观点

**人类专注**:
- 评估笔记（辩证分析）
- 采纳决策（✅/⏸️/❌）

> 💡 符合 SEED 哲学：AI 处理重复劳动，人类做判断决策

### 命令与技能定义

在 Claude Code 插件体系中，**命令**和**技能**是两个不同的概念：

| 概念 | 位置 | 触发方式 | 职责 |
|------|------|----------|------|
| **命令 (Command)** | `commands/*.md` | `/mob-seed:insight` 显式调用 | 完整执行流程定义 |
| **技能 (Skill)** | `skills/mob-seed/SKILL.md` | 自然语言触发 | 技能总览 + 关联命令表 |

**两者都需要定义**：

#### 1. 命令文件 (`commands/insight.md`)

用户通过 `/mob-seed:insight` 显式调用时执行的完整流程：

```markdown
---
name: mob-seed:insight
description: |
  外部洞见积累 - 从 URL/文本快速导入外部知识，AI 自动提取元数据

  🎯 核心功能：
  - 从 URL 或粘贴文本导入外部洞见
  - AI 自动提取元数据（标题、作者、来源类型、可信度）
  - 辩证评估和采纳决策跟踪
  - 模型升级时的时效性复审

  触发场景：
  - 阅读到有价值的技术文章/论文/分享
  - 需要系统性积累外部知识
  - 准备评估某个技术决策或实践

  显式触发词：
  - "导入洞见"、"记录这个洞见"、"保存这篇文章"
  - "分析这个观点"、"评估这个建议"
  - "insight"、"洞见"
allowed-tools: Read, Write, Edit, Bash, Task, TodoWrite, WebFetch, AskUserQuestion
argument-hint: <URL|--text|--list|--stats|--review> [--tag=xxx] [--status=xxx]
---

# mob-seed:insight - 外部洞见积累

执行内容：$ARGUMENTS

---

## 核心理念

> **辩证吸收，而非盲从**: 外部洞见需要经过评估才能采纳。
> **AI 做提取，人做判断**: AI 处理重复劳动，人类专注决策。

---

## 📦 依赖资源

\`\`\`
{SKILL_DIR}/                # 技能目录（自动检测）
├── lib/ace/
│   ├── insight-types.js    # 类型定义
│   ├── insight-parser.js   # 洞见解析
│   ├── insight-index.js    # 索引管理
│   ├── insight-config.js   # 配置解析（含 output_dir）
│   └── insight-importer.js # 快速导入
├── prompts/
│   ├── insight-import.md   # 导入提示
│   └── insight-evaluate.md # 评估引导
├── templates/
│   └── insight.md          # 洞见模板
└── schemas/
    └── insight.schema.json # 验证模式
\`\`\`

---

## 执行步骤

### 步骤 0: 检测配置和输出目录

1. **检测 ACE 输出目录**（优先级从高到低）：
   - 环境变量 \`ACE_OUTPUT_DIR\` 或 \`INSIGHTS_OUTPUT_DIR\`
   - \`.seed/config.local.json\` 中的 \`ace.output_dir\` 或 \`ace.insights_dir\`
   - \`.seed/config.json\` 中的配置
   - 默认值 \`.seed/insights/\`

2. **确保目录存在**：
   \`\`\`bash
   mkdir -p "$INSIGHTS_DIR"
   \`\`\`

### 步骤 1: 解析参数

| 参数 | 行为 |
|------|------|
| URL | 从 URL 抓取并导入 |
| \`--text\` | 交互式粘贴文本导入 |
| \`--list\` | 列出洞见（支持 --status, --tag 过滤） |
| \`--stats\` | 显示统计信息 |
| \`--review\` | 检查需复审的洞见 |
| \`--update <id>\` | 更新洞见状态 |

### 步骤 2: 执行对应操作

#### 2.1 导入模式（URL 或 --text）

1. **抓取/获取内容**
2. **AI 自动提取元数据**：
   - 标题、作者、机构、日期
   - 来源类型（expert_opinion / paper / blog / community / conference / book）
   - 可信度评级（high / medium / low）
   - 标签
   - 核心观点结构化
3. **生成洞见文件**：
   - ID 格式：\`ins-{YYYYMMDD}-{slug}\`
   - 状态：\`evaluating\`
   - 模型时代：当前模型版本
4. **更新索引**
5. **输出结果**：
   \`\`\`
   ✅ 已生成洞见: ins-20260111-xxx
   📄 文件: {INSIGHTS_DIR}/ins-20260111-xxx.md

   提取信息:
   ├── 标题: xxx
   ├── 作者: xxx
   ├── 类型: expert_opinion
   ├── 可信度: high
   └── 标签: [a, b, c]

   💡 建议: 请检查并补充评估笔记
   \`\`\`

#### 2.2 列表模式（--list）

\`\`\`bash
/mob-seed:insight --list                    # 全部
/mob-seed:insight --list --status evaluating # 按状态
/mob-seed:insight --list --tag architecture  # 按标签
\`\`\`

#### 2.3 统计模式（--stats）

显示各状态洞见数量和标签分布。

#### 2.4 复审模式（--review）

\`\`\`bash
/mob-seed:insight --review                      # 常规复审
/mob-seed:insight --review --model-upgrade X    # 模型升级复审
\`\`\`

#### 2.5 更新模式（--update）

\`\`\`bash
/mob-seed:insight --update ins-xxx --status adopted
\`\`\`

---

## 洞见生命周期

\`\`\`
evaluating (评估中)
    ↓
├── piloting (试点中) ──┬── adopted (已采纳)
├── adopted (已采纳)    ├── partial (部分采纳)
├── partial (部分采纳)  └── rejected (已拒绝)
└── rejected (已拒绝)
         ↓
    obsolete (已过时) ← 模型升级触发
\`\`\`

---

## 使用示例

\`\`\`bash
# 从 URL 导入
/mob-seed:insight "https://arxiv.org/abs/2512.24880"

# 从文本导入
/mob-seed:insight --text
[粘贴内容]

# 查看待评估洞见
/mob-seed:insight --list --status evaluating

# 模型升级后复审
/mob-seed:insight --review --model-upgrade claude-5.0

# 标记为已采纳
/mob-seed:insight --update ins-20260111-xxx --status adopted
\`\`\`
```

#### 2. 技能更新 (`skills/mob-seed/SKILL.md`)

需要在 SKILL.md 的**关联命令表**中新增 insight 命令：

```markdown
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
| `/mob-seed:insight` | 🆕 外部洞见积累 | insight-*.js, insight-*.md |
```

同时在 **ACE 存储结构** 中补充 insights 目录：

```markdown
### ACE 存储结构

\`\`\`
.seed/
├── observations/          # 观察记录
├── reflections/           # 反思记录
├── insights/              # 🆕 外部洞见
│   ├── index.json         # 洞见索引
│   └── ins-*.md           # 单个洞见
└── learning/              # 学习成果
\`\`\`
```

**触发场景**:

| 触发方式 | 示例 | 说明 |
|----------|------|------|
| 显式命令 | `/mob-seed:insight` | 直接调用 |
| 自然语言 | "记录这个洞见"、"导入这篇文章" | 意图识别（需技能描述支持） |
| URL 粘贴 | 粘贴 arXiv/博客链接 + "分析一下" | 上下文触发 |

**适用项目**:

| 项目类型 | 使用方式 |
|----------|----------|
| mob-seed 本身 | 直接使用 `/mob-seed:insight` |
| 安装 mob-seed 插件的项目 | 插件提供 `/mob-seed:insight` 命令 |
| 未安装插件的项目 | 无法使用（需先安装 mob-seed 插件） |

**派生产物**:

| 类型 | 路径 | 说明 |
|------|------|------|
| 命令 | `commands/insight.md` | 🆕 顶级命令定义（完整执行流程） |
| 技能更新 | `skills/mob-seed/SKILL.md` | 🔄 关联命令表 + ACE 存储结构 |
| 提示 | `skills/mob-seed/prompts/insight-import.md` | 🆕 导入时的 AI 提示 |
| 提示 | `skills/mob-seed/prompts/insight-evaluate.md` | 🆕 评估引导提示 |
| 模板 | `skills/mob-seed/templates/insight.md` | 🆕 洞见文件模板 |
| 库 | `skills/mob-seed/lib/ace/insight-*.js` | 🆕 核心逻辑 |
| 测试 | `skills/mob-seed/test/ace/insight-*.test.js` | 🆕 单元测试 |

### 配置集成

在 `.seed/config.json` 中新增 `insights` 顶级配置（独立于 `ace`）：

```json
{
  "insights": {
    "enabled": true,
    // output_dir 可选，默认 .seed/insights/
    // 开源项目建议通过环境变量或 config.local.json 配置
    "source_types": ["expert_opinion", "research_paper", "blog", "community", "conference", "book", "internal"],
    "auto_review_on_model_upgrade": true,
    "review_interval_days": 90
  },
  "ace": {
    "sources": {
      "core": ["test_failure", "spec_drift", "coverage_gap", "user_feedback"]
    }
  }
}
```

**配置加载优先级**:

```
1. 环境变量 INSIGHTS_OUTPUT_DIR（最高优先级）
2. .seed/config.local.json 中的 insights.output_dir
3. .seed/config.json 中的 insights.output_dir
4. 默认值 .seed/insights/（最低优先级）
```

**为什么独立于 ACE**:

| 对比 | ACE | Insights |
|------|-----|----------|
| 来源 | 内部执行反馈 | 外部知识输入 |
| 触发 | 自动（测试/检查） | 手动（用户导入） |
| 目的 | 发现问题 → 改进规格 | 吸收知识 → 指导决策 |
| 存储 | `.seed/observations/` | 可配置（支持外部目录） |

## 规格文件

- [external-insights.fspec.md](specs/external-insights.fspec.md) - 外部洞见机制规格

## 示例洞见

> 示例洞见已迁移至外部知识库，演示外部+软链接模式的实际使用。
>
> 通过 `.seed/insights` 软链接可在项目内浏览这些示例。

### 洞见格式特性

1. **YAML frontmatter**: 结构化元数据（来源、状态、模型时代、标签）
2. **来源层级**: 支持 `secondary_sources` 记录二次来源
3. **原始洞见**: 保留原始观点和引用
4. **评估笔记**: 辩证分析表格
5. **采纳决策**: 明确的行动分类（✅ 采纳 / ⏸️ 观望 / ❌ 不采纳）
6. **相关变更**: 追溯洞见影响
7. **量化数据**: Token 消耗对比、效率提升倍数等实测数据
8. **框架映射**: 外部方法论与 SEED 的系统性对照分析

## 验收标准

- [x] AC-001: 可以创建符合格式的洞见文件
- [x] AC-002: 洞见索引自动更新
- [x] AC-003: 状态转换符合生命周期定义
- [x] AC-004: 模型升级时可触发复审提醒
- [x] AC-005: `/mob-seed:insight` 顶级命令可用（通过 `commands/insight.md`）
- [x] AC-005B: 自然语言可触发洞见导入（"记录这个洞见"、"导入这篇文章"）
- [x] AC-005C: `SKILL.md` 关联命令表包含 `/mob-seed:insight` 条目
- [x] AC-006: 默认模式正确存储到 `.seed/insights/`
- [x] AC-007: 外部+软链接模式正确写入配置的外部目录
- [x] AC-008: 命令模式（快速导入）和引导模式（交互评估）均可用

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 洞见堆积不处理 | 定期复审提醒 |
| 评估标准不统一 | 提供评估模板 |
| 过度依赖外部意见 | 强调辩证吸收 |

## 时间线

- Phase 1: 数据结构和基础命令
- Phase 2: ACE 集成
- Phase 3: 复审自动化
