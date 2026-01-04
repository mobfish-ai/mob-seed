---
name: mob-seed:defend
description: SEED D阶段 - 守护规格与代码的同步（含原则验证）
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
argument-hint: <spec-path> [--check] [--fix] [--report] [--strict] [--no-cache] [--quick] [--incremental] [--cached]
---

# mob-seed:defend

执行内容：$ARGUMENTS

## 📦 依赖资源

- 技能目录: `{SKILL_DIR}/`（自动检测，见下方优先级）
- 同步检查: `prompts/defend-sync.md`
- 漂移检测: `prompts/defend-drift.md`
- 检查引擎: `adapters/defend-checker.js`
- **项目配置**: `.seed/config.json`（由 `/mob-seed:init` 生成）
- **使命声明**: `.seed/mission.md`（原则与反目标定义）
- **检查缓存**: `.seed/check-cache.json`（检查结果缓存）

### 技能目录检测优先级

| 优先级 | 路径 | 说明 |
|--------|------|------|
| 1 | `~/.claude/plugins/marketplaces/mobfish-ai/skills/mob-seed/` | Plugin marketplace |
| 2 | `~/.claude/plugins/cache/mobfish-ai/mob-seed/{version}/skills/mob-seed/` | Plugin cache |
| 3 | `~/.claude/skills/mob-seed/` | 用户全局技能 |
| 4 | `.claude/skills/mob-seed/` | 项目本地技能 |

## 执行步骤

### 步骤0: 检查初始化状态并加载配置

1. **检查 SEED 是否已初始化**：
   - 检查 `.seed/config.json` 是否存在
   - 如不存在，提示用户运行 `/mob-seed:init`

2. **加载配置获取路径**：
```javascript
const config = loadSeedConfig();
const SPECS_DIR = config.paths.specs;
const SRC_DIR = config.paths.src;
const TEST_DIR = config.paths.test;
const OUTPUT_DIR = config.paths.output;
```

3. **动态检测技能目录**（按优先级）：
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

### 步骤1: 解析参数

从 `$ARGUMENTS` 中解析：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<spec-path>` | 规格文件路径 | 必需 |
| `--check` | 只检查不修复 | 默认 |
| `--fix` | 自动修复可修复的问题 | - |
| `--report` | 生成详细报告 | - |
| `--strict` | 严格模式（警告也算失败）| - |
| `--no-cache` | 强制重新检查（忽略缓存）| - |
| `--quick` | 快速模式：仅检查 staged 文件（pre-commit 用）| - |
| `--incremental` | 增量模式：检查未推送 commits（pre-push 用）| - |
| `--cached` | 仅检查缓存是否命中（不执行完整检查）| - |

### 步骤1.5: 检查缓存（性能优化）

**缓存机制**：避免重复检查，提升效率。

```javascript
// .seed/check-cache.json 结构
{
  "version": "1.0.0",
  "entries": {
    "specs/auth.fspec.md": {
      "specHash": "sha256:abc123...",
      "codeHashes": {
        "skills/lib/auth.js": "sha256:def456...",
        "test/auth.test.js": "sha256:ghi789..."
      },
      "result": {
        "syncStatus": "pass",
        "principleScore": 0.95,
        "antiGoalViolations": []
      },
      "checkedAt": "2025-01-01T14:00:00Z"
    }
  }
}
```

**缓存策略**：
1. 计算当前文件的内容 hash（规格 + 代码 + 测试）
2. 对比缓存中的 hash
3. 若 hash 一致 → 返回缓存结果
4. 若 hash 不一致 → 执行完整检查 → 更新缓存

**自动失效条件**：
- 文件内容变更（hash 不匹配）
- 依赖文件变更
- 使用 `--no-cache` 参数
- PR 检查（强制完整扫描）
- 缓存文件超过 24 小时

### 步骤2: 同步检查

检查规格与派生产物的同步状态：

1. **需求覆盖**: 每个 FR 都有对应的实现 (Spec → Code)
2. **测试覆盖**: 每个 AC 都有对应的测试 (Spec → Test)
3. **文档同步**: 文档内容与**代码**一致 (Code → Docs)

> ⚠️ **重要**: 文档从代码派生，不是从规格派生！
> 派生链: `Spec → Code → Docs`

### 步骤2.5: 原则验证（默认执行）

> ⚠️ **重要**: 原则验证是默认行为，无需额外参数。
>
> 读取 `.seed/mission.md`，验证当前改动是否符合 SEED 核心哲学。

#### 2.5.1 SEED 四字诀验证

对每个改动验证：

| 检查项 | 问题 | 失败条件 |
|--------|------|----------|
| **S**pec | 规格是单一真相源？ | 代码有规格未定义的功能 |
| **E**mit | 产物是从规格/代码派生？ | 存在手动创建的派生产物 |
| **E**xec | 派生产物可执行验证？ | 测试未覆盖或失败 |
| **D**efend | 防止手动篡改？ | 代码修改未同步规格 |

**派生链验证**:
```
✅ Spec → Code → Docs （正确）
❌ Spec → Docs （跳过代码，错误）
❌ Code without Spec （无规格，错误）
```

#### 2.5.2 原则合规检查

对照 `mission.md#principles`：

| 原则 | 检查内容 |
|------|----------|
| `spec_as_truth` | 规格是否是唯一权威来源 |
| `sync_is_trust` | 代码是否与规格同步 |
| `simplicity_over_cleverness` | 是否有过度抽象 |
| `small_steps_big_impact` | 改动范围是否可控 |
| `human_readable_first` | 产出是否人类可读 |
| `ai_as_partner` | 是否有人类确认点 |

#### 2.5.3 反目标检测

对照 `mission.md#anti_goals`：

| 反目标 | 检测规则 |
|--------|----------|
| `feature_creep` | 代码中存在无对应 FR 的功能 |
| `sync_breaking` | 代码变更未触发规格更新 |
| `over_engineering` | 抽象层数超过必要 |
| `black_box_magic` | 关键决策缺乏注释 |
| `ai_replacement_mindset` | 自动化流程缺乏人类确认点 |

#### 2.5.4 对齐分数计算

```javascript
// 对齐分数模型（来自 mission.md#alignment）
const score = {
  purpose_alignment: 0.3,      // 是否服务人机协作使命
  principle_compliance: 0.3,   // 是否遵守核心原则
  anti_goal_avoidance: 0.25,   // 是否避开反目标
  vision_contribution: 0.15    // 是否推动愿景实现
};

// 最终分数 = 加权求和
// 阈值: >= 0.7 通过, < 0.7 失败
```

**输出示例**：
```
📊 原则验证结果

SEED 四字诀: ✅ S ✅ E ✅ E ✅ D
派生链: ✅ Spec → Code → Docs

原则合规: 6/6 通过
反目标检测: 0 违规

对齐分数: 0.92 ✅ (阈值: 0.70)
```

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

## SEED 原则验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| SEED 四字诀 | ✅ S ✅ E ✅ E ✅ D | 核心哲学验证 |
| 派生链 | ✅ Spec→Code→Docs | 正确派生顺序 |
| 原则合规 | ✅ 6/6 | 所有原则遵守 |
| 反目标 | ✅ 0 违规 | 无反目标违规 |
| 对齐分数 | ✅ 0.92 | 阈值: 0.70 |

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
2. 运行 `/mob-seed:emit --docs` 更新文档
```

### 步骤7: 归档提示（重要）

**当所有检查通过且规格处于 `implementing` 状态时**，必须提示用户：

```markdown
## ✅ 所有检查通过

规格 `{spec-name}` 已完全同步，可以归档。

**下一步操作**:
```bash
/mob-seed:archive {proposal-path}
```

⚠️ **重要**:
- 本命令 (`/mob-seed:defend`) 只做检查，不执行归档
- 归档操作请使用 `/mob-seed:archive`，它会：
  1. 合并规格到 `openspec/specs/`（真相源）
  2. 移动提案到 `openspec/archive/`
  3. 更新状态为 `archived`
```

**禁止**: 在此命令中手动执行 `mv` 或修改文件位置。

## 示例用法

```bash
# 检查同步状态
/mob-seed:defend specs/user-auth.fspec.md

# 检查并自动修复
/mob-seed:defend specs/user-auth.fspec.md --fix

# 生成详细报告
/mob-seed:defend specs/user-auth.fspec.md --report

# 严格模式（CI 中使用）
/mob-seed:defend specs/user-auth.fspec.md --strict
```

### 步骤8: ACE 观察收集（自动）

> **ACE 自演化机制**：此步骤自动执行，无需用户干预。

根据守护检查结果自动收集观察：

```javascript
// 调用 ACE 收集器
const aceResult = collectFromDefend({
  syncStatus: syncReport,
  driftDetections: driftReport,
  principleViolations: principleReport.violations
});

// 输出收集结果（仅在有观察时显示）
if (aceResult.count > 0) {
  console.log(`💡 ACE: 收集 ${aceResult.count} 条观察`);
}

// 检查反思阈值
const threshold = checkReflectionThreshold();
if (threshold.shouldReflect) {
  console.log(`💡 ACE: 同类问题已出现 ${threshold.count} 次，建议进行反思分析`);
}
```

**收集规则**：

| 触发条件 | 观察类型 | 说明 |
|----------|----------|------|
| 规格漂移 | spec_drift | 记录代码与规格不一致 |
| 原则违规 | principle_violation | 记录 SEED 原则违规 |
| 反目标触发 | anti_goal_triggered | 记录反目标行为 |

**输出位置**：`.seed/observations/obs-{YYYYMMDD}-{slug}.md`（YAML frontmatter + Markdown 格式）

## 注意事项

- `/mob-seed:defend` 是**只读**命令，不会修改文件位置
- 归档操作请使用 `/mob-seed:archive`
- 参见 CLAUDE.md 经验教训 #7 和 #8

## Git Hooks 集成

### 分层检查策略

不同 Git 操作触发不同深度的检查：

| 操作 | 检查深度 | 耗时 | 可跳过 |
|------|----------|------|--------|
| `commit` | 快速检查 | ~1s | ✅ `--force` |
| `push` | 增量检查 | ~5s | ❌ |
| `PR` | 完整检查 | ~30s | ❌ |

### pre-commit hook

**快速检查**：仅检查 staged 文件，支持场景检测

```bash
#!/bin/bash
# .git/hooks/pre-commit
# 完整代码见 skills/mob-seed/hooks/pre-commit

# 跳过检查（紧急情况）
if [ "$SKIP_SEED_CHECK" = "1" ]; then
    echo "⚠️ SEED 检查已跳过"
    exit 0
fi

# 四层回退模式查找脚本（自动检测运行场景）
# Layer 0: $SEED_PLUGIN_PATH/lib/hooks/   → [用户项目] 环境变量配置
# Layer 1: skills/mob-seed/lib/hooks/     → [开发模式] mob-seed dogfooding
# Layer 2: .seed/scripts/                 → [兼容模式] 旧版本
# Layer 3: ~/.claude/plugins/.../lib/hooks/ → [用户项目] Claude Code 插件

# 场景标识输出示例：
# 🔍 SEED 快速检查... [开发模式] mob-seed dogfooding
# 🔍 SEED 快速检查... [用户项目] Claude Code 插件
```

### pre-push hook

**增量检查**：检查所有未推送的 commits，支持场景检测

```bash
#!/bin/bash
# .git/hooks/pre-push
# 完整代码见 skills/mob-seed/hooks/pre-push

# 使用相同的四层回退策略查找脚本
# 场景标识输出示例：
# 🔍 SEED 增量检查... [开发模式] mob-seed dogfooding
# 🔍 SEED 增量检查... [用户项目] Claude Code 插件
```

### 场景检测说明

| 场景 | 代号 | 颜色 | 描述 |
|------|------|------|------|
| 开发模式 | `dogfooding` | 青色 | mob-seed 项目自身开发 |
| 用户项目（环境变量） | `user-env` | 洋红 | init 时设置 SEED_PLUGIN_PATH |
| 用户项目（插件路径） | `user-plugin` | 洋红 | Claude Code 插件默认路径 |
| 兼容模式 | `compat` | 黄色 | 旧版本符号链接 |
| 脚本缺失 | `missing` | 红色 | 找不到验证脚本 |

详细文档见: `skills/mob-seed/hooks/README.md`

### CI 集成 (PR 完整检查)

```yaml
# .github/workflows/seed-defend.yml
name: SEED Defend

on:
  pull_request:
    branches: [main]

jobs:
  seed-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: SEED Full Check
        run: |
          echo "🔍 SEED 完整检查..."
          node .seed/scripts/full-defend.js --no-cache --report
        env:
          SEED_STRICT: true

      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: seed-defend-report
          path: output/mob-seed/defend-report-*.json
```

## 检查场景对比

| 场景 | 触发 | 范围 | 缓存 | 原则检查 | 对齐分数 |
|------|------|------|------|----------|----------|
| 开发中 commit | pre-commit | staged 文件 | ✅ | 快速 | ❌ |
| 推送前 push | pre-push | 未推送 commits | ✅ | 完整 | ❌ |
| PR 创建 | CI | 全项目 | ❌ | 完整 | ✅ |
| 定期扫描 | Cron | 全项目 | ❌ | 完整 | ✅ |

## 安装 Git Hooks

```bash
# 自动安装（通过 init 命令）
/mob-seed:init

# 手动安装（从技能目录）
# mob-seed 项目（dogfooding）:
cp skills/mob-seed/hooks/pre-commit .git/hooks/
cp skills/mob-seed/hooks/pre-push .git/hooks/
chmod +x .git/hooks/pre-*

# 用户项目（从 Claude Code 插件）:
cp ~/.claude/plugins/mobfish-ai/mob-seed/skills/mob-seed/hooks/pre-* .git/hooks/
chmod +x .git/hooks/pre-*
```
