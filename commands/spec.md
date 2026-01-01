---
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
.claude/skills/mob-seed/
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

---

## 执行步骤

### 步骤 0: 检查初始化状态并加载配置

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

4. **动态检测技能目录**：
```bash
if [ -d ".claude/skills/mob-seed" ]; then
    SKILL_DIR=".claude/skills/mob-seed"
elif [ -d "$HOME/.claude/skills/mob-seed" ]; then
    SKILL_DIR="$HOME/.claude/skills/mob-seed"
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
3. 根据用户需求填充模板
4. 输出到：`{config.paths.specs}/{name}.fspec.md`

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

2. 验证提交前检查：
   - [ ] proposal.md 存在且完整
   - [ ] 至少有一个 .fspec.md 规格文件
   - [ ] 所有规格通过基础验证

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
# {功能名称} 规格

> 版本: 1.0.0
> 创建时间: YYYY-MM-DD
> 最后更新: YYYY-MM-DD

## 概述 (Overview)
- 功能描述
- 目标用户
- 核心价值

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
