---
description: SEED D阶段 - 守护规格与代码的同步
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
argument-hint: <spec-path> [--check] [--fix] [--report] [--strict]
---

# mob-seed-defend

执行内容：$ARGUMENTS

## 📦 依赖资源

- 技能目录: `.claude/skills/mob-seed/`
- 同步检查: `prompts/defend-sync.md`
- 漂移检测: `prompts/defend-drift.md`
- 检查引擎: `adapters/defend-checker.js`
- **项目配置**: `.seed/config.json`（由 `/mob-seed-init` 生成）

## 执行步骤

### 步骤0: 检查初始化状态并加载配置

1. **检查 SEED 是否已初始化**：
   - 检查 `.seed/config.json` 是否存在
   - 如不存在，提示用户运行 `/mob-seed-init`

2. **加载配置获取路径**：
```javascript
const config = loadSeedConfig();
const SPECS_DIR = config.paths.specs;
const SRC_DIR = config.paths.src;
const TEST_DIR = config.paths.test;
const OUTPUT_DIR = config.paths.output;
```

3. **动态检测技能目录**：
```bash
if [ -d ".claude/skills/mob-seed" ]; then
    SKILL_DIR=".claude/skills/mob-seed"
elif [ -d "$HOME/.claude/skills/mob-seed" ]; then
    SKILL_DIR="$HOME/.claude/skills/mob-seed"
fi
```

### 步骤1: 解析参数

从 `$ARGUMENTS` 中解析：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<spec-path>` | 规格文件路径 | 必需 |
| `--check` | 只检查不修复 | 默认 |
| `--fix` | 自动修复可修复的问题 | - |
| `--report` | 生成详细报告 | - |
| `--strict` | 严格模式（警告也算失败）| - |

### 步骤2: 同步检查

检查规格与派生代码的同步状态：

1. **需求覆盖**: 每个 FR 都有对应的实现
2. **测试覆盖**: 每个 AC 都有对应的测试
3. **文档同步**: 文档内容与规格一致

### 步骤3: 漂移检测

检测代码是否偏离规格：

1. **新增检测**: 代码中有规格未定义的功能
2. **缺失检测**: 规格定义但代码未实现
3. **不一致检测**: 实现与规格描述不符

### 步骤4: 问题分类

| 级别 | 说明 | 示例 |
|------|------|------|
| ERROR | 严重偏离，必须修复 | 未实现的需求 |
| WARNING | 轻微偏离，建议修复 | 文档过时 |
| INFO | 提示信息 | 建议优化 |

### 步骤5: 自动修复（--fix）

可自动修复的问题：

- 更新文档中的版本号
- 重新生成过时的文档
- 补充缺失的测试骨架

不可自动修复的问题：

- 代码实现缺失
- 逻辑不一致

### 步骤6: 输出报告

```
output/mob-seed/
├── defend-report-{timestamp}.json   # 详细报告
└── defend-summary-{timestamp}.md    # 可读摘要
```

## 输出格式

### 守护摘要

```markdown
# 守护报告: {模块名}

## 同步状态

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 需求覆盖 | ✅ | 5/5 FR 已实现 |
| 测试覆盖 | ⚠️ | 4/5 AC 有测试 |
| 文档同步 | ❌ | 版本号过时 |

## 漂移检测

- 🔴 ERROR: FR-003 未实现
- 🟡 WARNING: 文档版本号与规格不符
- 🔵 INFO: 建议添加 AC-005 的边界测试

## 修复建议

1. 实现 FR-003 对应的功能
2. 运行 `/mob-seed-emit --docs` 更新文档
```

### 步骤7: 归档提示（重要）

**当所有检查通过且规格处于 `implementing` 状态时**，必须提示用户：

```markdown
## ✅ 所有检查通过

规格 `{spec-name}` 已完全同步，可以归档。

**下一步操作**:
```bash
/mob-seed-archive {proposal-path}
```

⚠️ **重要**:
- 本命令 (`/mob-seed-defend`) 只做检查，不执行归档
- 归档操作请使用 `/mob-seed-archive`，它会：
  1. 合并规格到 `openspec/specs/`（真相源）
  2. 移动提案到 `openspec/archive/`
  3. 更新状态为 `archived`
```

**禁止**: 在此命令中手动执行 `mv` 或修改文件位置。

## 示例用法

```bash
# 检查同步状态
/mob-seed-defend specs/user-auth.fspec.md

# 检查并自动修复
/mob-seed-defend specs/user-auth.fspec.md --fix

# 生成详细报告
/mob-seed-defend specs/user-auth.fspec.md --report

# 严格模式（CI 中使用）
/mob-seed-defend specs/user-auth.fspec.md --strict
```

## 注意事项

- `/mob-seed-defend` 是**只读**命令，不会修改文件位置
- 归档操作请使用 `/mob-seed-archive`
- 参见 CLAUDE.md 经验教训 #7 和 #8
