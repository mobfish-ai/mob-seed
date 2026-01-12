---
name: mob-seed:spec
description: SEED S阶段 - 单源规格定义（创建/验证/状态转换）
allowed-tools: Read, Write, Edit, Bash, Task, TodoWrite, AskUserQuestion
argument-hint: <功能名称> [--create|--validate|--edit|--submit|--reopen] [--template=feature|api|component]
---

# mob-seed:spec - 单源规格定义

执行内容：$ARGUMENTS

---

## S 阶段核心原则

> **Single-source（单源定义）**: 每种信息只在规格中定义一次，规格是唯一真相源。

---

## 📦 依赖资源

```
{SKILL_DIR}/                # 技能目录（自动检测）
├── lib/lifecycle/
│   ├── types.js            # 生命周期类型定义
│   └── parser.js           # 规格解析器
├── prompts/
│   ├── spec-create.md      # 规格创建指导
│   └── spec-validate.md    # 规格验证指导
├── templates/
│   ├── feature.fspec.md    # 功能规格模板
│   ├── api.fspec.md        # API 规格模板
│   └── component.fspec.md  # 组件规格模板
└── adapters/
    └── seed-utils.js       # 工具模块
```

**项目配置**: `.seed/config.json`（由 `/mob-seed:init` 生成）

### 技能目录检测优先级

| 优先级 | 路径 | 说明 |
|--------|------|------|
| 1 | `~/.claude/plugins/marketplaces/mobfish-ai/skills/mob-seed/` | Plugin marketplace |
| 2 | `~/.claude/plugins/cache/mobfish-ai/mob-seed/{version}/skills/mob-seed/` | Plugin cache |
| 3 | `~/.claude/skills/mob-seed/` | 用户全局技能 |
| 4 | `.claude/skills/mob-seed/` | 项目本地技能 |

---

## 执行步骤

### 步骤 0: 版本显示（遵循 SKILL.md 强制启动行为）

> 遵循 SKILL.md "🚀 强制启动行为" 章节定义，显示版本和场景信息。

### 步骤 0.5: 检查初始化状态并加载配置

1. **检查 SEED 是否已初始化**：
   - 检查 `.seed/config.json` 是否存在
   - 如不存在，提示用户运行 `/mob-seed:init`

2. **检测 OpenSpec 模式**：
   - 检查 `config.openspec.enabled` 是否为 `true`
   - 或者检查 `openspec/` 目录是否存在
   - OpenSpec 模式下使用 `lib/lifecycle/parser.js` 进行状态管理

3. **加载配置获取路径**：
```javascript
// 从 .seed/config.json 读取
const config = loadSeedConfig();
const isOpenSpec = config.openspec?.enabled || fs.existsSync('openspec/');
const SPECS_DIR = isOpenSpec ? 'openspec/specs' : config.paths.specs;
const CHANGES_DIR = isOpenSpec ? 'openspec/changes' : null;
```

4. **动态检测技能目录**（按优先级）：
```bash
SKILL_DIR=""

# 1. Plugin marketplace（最常见）
if [ -d "$HOME/.claude/plugins/marketplaces/mobfish-ai/skills/mob-seed" ]; then
    SKILL_DIR="$HOME/.claude/plugins/marketplaces/mobfish-ai/skills/mob-seed"
# 2. Plugin cache（查找最新版本）
elif [ -d "$HOME/.claude/plugins/cache/mobfish-ai/mob-seed" ]; then
    LATEST=$(ls -1 "$HOME/.claude/plugins/cache/mobfish-ai/mob-seed" | sort -V | tail -1)
    if [ -n "$LATEST" ]; then
        SKILL_DIR="$HOME/.claude/plugins/cache/mobfish-ai/mob-seed/$LATEST/skills/mob-seed"
    fi
# 3. 用户全局技能
elif [ -d "$HOME/.claude/skills/mob-seed" ]; then
    SKILL_DIR="$HOME/.claude/skills/mob-seed"
# 4. 项目本地技能
elif [ -d ".claude/skills/mob-seed" ]; then
    SKILL_DIR=".claude/skills/mob-seed"
fi

if [ -z "$SKILL_DIR" ]; then
    echo "❌ 错误: 未找到 mob-seed 技能目录"
    exit 1
fi
```

### 步骤 1: 解析参数

| 参数 | 模式 | 说明 |
|------|------|------|
| `--create` | 创建模式 | 创建新规格文件（默认） |
| `--validate` | 验证模式 | 验证现有规格完整性 |
| `--edit` | 编辑模式 | 编辑现有规格 |
| `--submit` | 提交审查 | OpenSpec: draft → review |
| `--reopen` | 重新开启 | OpenSpec: archived → draft |
| `--template=X` | 模板选择 | feature/api/component |

### 步骤 2: 执行对应操作

#### 2.1 创建模式 (--create)

1. 读取模板文件：`$SKILL_DIR/templates/{template}.fspec.md`
2. 读取创建指导：`$SKILL_DIR/prompts/spec-create.md`
3. **完成架构决策检查清单**（新增）：
   - 模板自动包含 8 个架构决策点
   - **必须在编写详细规格前完成所有决策**
   - 完成后将 frontmatter 中 `architecture_decisions_completed` 设为 `true`

   **8 个决策点**：
   - 目录结构设计（分层/分组/扁平）
   - 命名规范（动词-对象/对象-动词/名词）
   - 库与 CLI 分离
   - 错误处理策略（优雅降级/快速失败/静默失败）
   - 退出码设计（分层/简单/不关心）
   - Git Hooks 集成方式
   - 测试覆盖率要求（按风险分级/统一标准）
   - 废弃策略（版本化/立即废弃）

   > 📚 **参考文档**: `openspec/changes/v3.3-brownfield-support/best-practices-integration.md`
   > 📖 **实例**: `spec-extract.fspec.md`, `spec-enrich.fspec.md`

4. 根据用户需求填充模板（在架构决策完成后）
5. 输出到：`{config.paths.specs}/{name}.fspec.md`

**OpenSpec 提案完整性检查** (自动执行):

在 OpenSpec 模式下创建变更提案时，**必须**自动创建以下完整结构：

```
openspec/changes/{proposal-name}/
├── proposal.md    # 提案文档 ✅ 必需
├── tasks.md       # 任务清单 ✅ 必需 (自动创建)
└── specs/         # 规格目录
    └── *.fspec.md # 规格文件
```

**tasks.md 自动创建**：
```javascript
// 使用代码生成（与 triage-handler.js 的 generateTasksContent 一致）
const tasksContent = generateTasksContent(proposalName, 'draft');
fs.writeFileSync(path.join(proposalDir, 'tasks.md'), tasksContent);
```

**完整性验证输出**：
```
✅ proposal.md 已创建
✅ tasks.md 已创建 (自动)
📝 下一步: 创建 specs/*.fspec.md 规格文件
```

#### 2.2 验证模式 (--validate)

1. 读取验证指导：`$SKILL_DIR/prompts/spec-validate.md`
2. 检查规格文件必需章节：
   - [ ] overview（概述）
   - [ ] requirements（需求）
   - [ ] constraints（约束）
   - [ ] acceptance（验收标准）
3. 输出验证报告

#### 2.3 编辑模式 (--edit)

1. 定位规格文件：`{config.paths.specs}/{name}.fspec.md`
2. 读取当前内容
3. 根据用户要求修改
4. 验证修改后的规格

#### 2.4 提交审查模式 (--submit) [OpenSpec]

> 仅在 OpenSpec 模式下可用

1. 检查当前状态：
   ```javascript
   const { parseSpecFile, updateSpecState } = require('./lib/lifecycle/parser');
   const { canTransition } = require('./lib/lifecycle/types');

   const spec = parseSpecFile(specPath);
   if (!canTransition(spec.metadata.state, 'review')) {
     throw new Error(`无法从 ${spec.metadata.state} 转换到 review`);
   }
   ```

2. 验证提交前检查（提案完整性）：
   - [ ] proposal.md 存在且完整
   - [ ] tasks.md 存在且包含必需阶段（规格定义、实现、验证、归档）
   - [ ] 至少有一个 .fspec.md 规格文件
   - [ ] 所有规格通过基础验证

   **tasks.md 缺失时自动创建**：
   ```javascript
   if (!fs.existsSync(path.join(proposalDir, 'tasks.md'))) {
     console.warn('⚠️ tasks.md 缺失，自动创建...');
     const tasksContent = generateTasksFromProposal(proposal, specs);
     fs.writeFileSync(path.join(proposalDir, 'tasks.md'), tasksContent);
     console.log('✅ tasks.md 已补充');
   }
   ```

3. 更新状态：
   ```javascript
   updateSpecState(proposalPath, 'review');
   ```

4. 输出变更摘要

**状态转换**：`📝 draft` → `🔍 review`

#### 2.5 重新开启模式 (--reopen) [OpenSpec]

> 仅在 OpenSpec 模式下可用

1. 检查当前状态（必须是 archived）：
   ```javascript
   const spec = parseSpecFile(specPath);
   if (!canTransition(spec.metadata.state, 'draft')) {
     throw new Error(`无法从 ${spec.metadata.state} 转换到 draft`);
   }
   ```

2. 创建变更提案：
   - 在 `openspec/changes/` 下创建新目录
   - 复制规格文件到提案目录
   - 创建 proposal.md 模板

3. 更新状态为 draft

**状态转换**：`✅ archived` → `📝 draft`

### 步骤 3: 输出结果

```
{config.paths.specs}/
└── {name}.fspec.md    # 规格文件（唯一真相源）

{config.paths.output}/
└── spec-report.md     # 操作报告
```

> 注：所有路径从 `.seed/config.json` 读取，适配任何项目结构

---

## 规格文件格式 (.fspec.md)

```markdown
---
status: draft
created: YYYY-MM-DD
architecture_decisions_completed: false
---

# {功能名称} 规格

> 版本: 1.0.0
> 创建时间: YYYY-MM-DD
> 最后更新: YYYY-MM-DD

## 概述 (Overview)
- 功能描述
- 目标用户
- 核心价值

## 架构决策检查清单 (Architecture Decisions)

> **重要**: 在编写详细规格前，先完成以下架构决策检查。
> 完成所有检查后，将 frontmatter 中 `architecture_decisions_completed` 设为 `true`。

### 1. 目录结构设计
- [ ] 按功能分层（推荐）
- [ ] 按模块分组
- [ ] 扁平结构

**选择**: ____________
**理由**: ____________

### 2-8. 其他决策点...

（完整检查清单见模板文件）

## 需求 (Requirements)
### 功能需求
- [ ] FR-001: 需求描述

### 非功能需求
- [ ] NFR-001: 性能/安全/可用性要求

## 约束 (Constraints)
### 技术约束
- 使用的技术栈
- 兼容性要求

### 业务约束
- 业务规则
- 合规要求

## 验收标准 (Acceptance Criteria)
### AC-001: 标准描述
- Given: 前置条件
- When: 操作
- Then: 期望结果

## 派生产物 (Derived Outputs)
| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | src/xxx | 主要实现 |
| 测试 | test/xxx | 测试用例 |
| 文档 | docs/xxx | 使用文档 |
```

---

## 使用示例

### 标准模式

```bash
# 创建功能规格（默认模板）
/mob-seed:spec "用户登录" --create

# 使用 API 模板创建
/mob-seed:spec "获取用户信息" --template=api

# 验证规格完整性
/mob-seed:spec "用户登录" --validate

# 编辑现有规格
/mob-seed:spec "用户登录" --edit
```

### OpenSpec 模式（生命周期管理）

```bash
# 创建变更提案（在 openspec/changes/ 下）
/mob-seed:spec "add-oauth" --create

# 提交审查（draft → review）
/mob-seed:spec "add-oauth" --submit

# 重新开启已归档规格（archived → draft）
/mob-seed:spec "user-login" --reopen

# 验证变更提案
/mob-seed:spec "add-oauth" --validate
```

## 生命周期状态机

```
┌─────────┐  --submit   ┌─────────┐  emit    ┌──────────────┐  defend  ┌──────────┐
│  📝     │ ─────────→  │  🔍     │ ─────→   │  🔨          │ ─────→   │  ✅      │
│  draft  │             │  review │          │  implementing│          │  archived│
└─────────┘             └─────────┘          └──────────────┘          └──────────┘
     ↑                       │                      │                       │
     │                       │                      │                       │
     └───────────────────────┴──────────────────────┴───────── --reopen ────┘
```

| 转换 | 命令 | 说明 |
|------|------|------|
| draft → review | `--submit` | 提交规格审查 |
| review → implementing | `/mob-seed:emit` | 批准并开始派生 |
| implementing → archived | `/mob-seed:defend` | 验证通过后归档 |
| archived → draft | `--reopen` | 重新开启修改 |

---

## 进度显示

| 图标 | 含义 |
|------|------|
| 📝 | 正在编写规格 |
| 🔍 | 正在验证规格 |
| ✅ | 规格完成 |
| ⚠️ | 规格不完整 |
| ❌ | 规格无效 |

示例输出：
```
🌱 SEED S阶段: 单源规格定义
━━━ 📝 创建规格 ━━━
模板: feature.fspec.md
功能: 用户登录

📝 填充规格内容...
✅ 规格已创建: specs/user-login.fspec.md

🔍 自动验证...
✅ overview: 通过
✅ requirements: 通过
✅ constraints: 通过
✅ acceptance: 通过

✅ S阶段完成
```
