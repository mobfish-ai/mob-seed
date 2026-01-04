---
name: mob-seed:init
description: SEED 初始化 - 创建 OpenSpec 标准目录结构
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
argument-hint: [--force]
---

# mob-seed:init

执行内容：$ARGUMENTS

## 📦 依赖资源

```
{SKILL_DIR}/                # 技能目录（自动检测）
├── lib/lifecycle/
│   └── parser.js           # 规格解析
├── lib/mission/
│   └── loader.js           # Mission 加载器
├── adapters/
│   └── seed-utils.js       # 工具模块
├── scripts/
│   ├── resolve-skill-path.js  # 路径解析器
│   └── detect-project.js      # 项目检测
└── templates/
    └── openspec/           # OpenSpec 模板
        ├── mission.md    # Mission Statement 模板
        ├── project.md      # 项目约定模板
        └── AGENTS.md       # AI 工作流模板
```

### 技能目录检测优先级

> **重要**: 按以下优先级检测技能目录，确保 plugin 安装方式优先

| 优先级 | 路径 | 说明 |
|--------|------|------|
| 1 | `~/.claude/plugins/marketplaces/mobfish-ai/` | Plugin marketplace 安装 |
| 2 | `~/.claude/plugins/cache/mobfish-ai/mob-seed/{version}/` | Plugin cache |
| 3 | `~/.claude/skills/mob-seed/` | 用户全局技能 |
| 4 | `.claude/skills/mob-seed/` | 项目本地技能 |

## 设计理念

**OpenSpec 原生 + 零侵入**：
- 创建 OpenSpec 标准目录结构
- 只创建 `.seed/` 隐藏目录存放配置
- 智能扫描识别现有项目结构

## 执行步骤

### 步骤0: 检查参数

**参数检查**：
- 无参数：进入 **OpenSpec 初始化**（步骤 1）
- `--force`：强制重新初始化

**检查已初始化**：
- 如果 `.seed/config.json` 存在且无 `--force`：显示当前配置，询问是否重新初始化
- 如果有 `--force`：备份后重新初始化

### 步骤1: 创建 OpenSpec 目录结构

创建 OpenSpec 标准目录结构：

```
project/
├── openspec/
│   ├── specs/                    # 真相源（已实现的规格）
│   │   └── .gitkeep
│   ├── changes/                  # 变更提案（开发中的规格）
│   │   └── .gitkeep
│   ├── project.md                # 项目约定
│   └── AGENTS.md                 # AI 工作流指令
├── .seed/
│   ├── config.json               # SEED 配置
│   └── mission.md              # Mission Statement（项目使命）
└── ...
```

**执行操作**：

#### 1.1 解析技能目录路径

**首先**，按优先级检测技能目录：

```bash
# 按优先级检测技能目录
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
    echo "请确保已通过 plugin 或 skill 安装 mob-seed"
    exit 1
fi

echo "✓ 使用技能目录: $SKILL_DIR"
```

#### 1.2 智能检测项目结构

运行智能检测脚本（使用检测到的 SKILL_DIR）：
```bash
node "$SKILL_DIR/scripts/detect-project.js" . --config > /tmp/mob-seed-detected-config.json
node "$SKILL_DIR/scripts/detect-project.js" . --project-md > /tmp/mob-seed-detected-project.md
```

**说明**：
- 自动检测项目的 `src/`, `test/`, `docs/` 目录位置
- 从 `package.json` 提取项目信息（名称、描述、技术栈）
- 生成适配当前项目的配置和文档

#### 1.3 创建目录结构

1. 创建 `openspec/specs/` 目录
2. 创建 `openspec/changes/` 目录

#### 1.4 复制和生成配置文件

> **⚠️ 关键原则**: 直接使用检测脚本的输出文件，**禁止**手动解析或重构配置

3. **AGENTS.md**（使用 SKILL_DIR）:
   ```bash
   cp "$SKILL_DIR/templates/openspec/AGENTS.md" openspec/AGENTS.md
   ```

4. **project.md**: 直接使用检测脚本生成的文件
   ```bash
   cat /tmp/mob-seed-detected-project.md > openspec/project.md
   ```

5. **config.json**: 直接使用检测脚本生成的 JSON
   ```bash
   mkdir -p .seed
   cat /tmp/mob-seed-detected-config.json > .seed/config.json
   ```
   - ✅ **强制使用检测结果**，避免被 CLAUDE.md 或其他因素误导
   - ❌ **禁止手动解析** `/tmp/mob-seed-detected-config.json` 再重新构造
   - ❌ **禁止读取** CLAUDE.md 中的路径配置

6. **mission.md**: 复制模板并替换时间戳（使用 SKILL_DIR）
   ```bash
   cp "$SKILL_DIR/templates/openspec/mission.yaml" .seed/mission.md
   # 替换 {{TIMESTAMP}} 为当前 ISO 时间戳
   sed -i '' "s/{{TIMESTAMP}}/$(date -u +%Y-%m-%dT%H:%M:%SZ)/" .seed/mission.md
   ```
   - ⚠️ **重要**: 使用 `templates/openspec/mission.yaml`，**不是** mob-seed 自己的 `.seed/mission.md`

**输出**：
```
🔍 检测项目结构...
   ✓ 检测到 src 目录: server/
   ✓ 检测到 test 目录: test/
   ✓ 从 package.json 提取项目信息
   ✓ 检测技术栈: Node.js, Express

✅ OpenSpec 结构已创建

openspec/
├── specs/          # 真相源（已实现的规格）
├── changes/        # 变更提案
├── project.md      # 项目约定（已自动填充）
└── AGENTS.md       # AI 工作流

.seed/
├── config.json     # SEED 配置（已适配项目结构）
└── mission.md      # 项目使命声明模板（待填写）

📋 生成的配置:
{
  "paths": {
    "src": "server",      ← 自动检测
    "test": "test",
    "docs": "docs"
  }
}

下一步:
1. 编辑 .seed/mission.md 定义项目使命和原则
2. 检查 openspec/project.md（已自动填充基本信息）
3. 创建规格提案: /mob-seed:spec "feature-name"
4. 查看状态: /mob-seed:seed
```

### 步骤2: 创建 ACE 自演化目录（自动）

> **ACE 自演化机制**：此步骤自动执行，确保项目从一开始就具备自演进能力。

创建 ACE 观察目录结构：

```
.seed/
├── observations/                # ACE 观察存储
│   ├── index.json               # 观察索引（JSON 格式）
│   └── obs-*.md                 # 观察文件（YAML frontmatter + Markdown）
└── config.json                  # 包含 ACE 配置
```

**执行操作**：
1. 创建 `.seed/observations/` 目录
2. 初始化 `.seed/observations/index.json`：
```json
{
  "version": "1.0.0",
  "created": "ISO时间戳",
  "observations": []
}
```
4. 在 `config.json` 中添加 ACE 配置：
```json
{
  "ace": {
    "enabled": true,
    "reflect": {
      "thresholds": {
        "same_type": 3,
        "same_spec": 2,
        "time_window": "24h"
      }
    }
  }
}
```

**输出**：
```
✅ ACE 自演化目录已创建

.seed/observations/
├── index.json      # 观察索引（JSON 格式）
└── obs-*.md        # 观察文件（YAML frontmatter + Markdown）

💡 ACE: 项目已启用自演进能力
```

### 步骤3: 安装 ACE Git Hooks（可选）

检查项目是否为 Git 仓库，如果是则安装 ACE hooks：

**检查条件**：
```bash
if [ -d ".git" ]; then
  # 是 Git 仓库，安装 hooks
fi
```

**执行操作**：
1. 复制 `hooks/ace-pre-commit` 到 `.git/hooks/pre-commit`
2. 复制 `hooks/ace-pre-push` 到 `.git/hooks/pre-push`
3. 设置执行权限 `chmod +x .git/hooks/pre-*`

**如果 hooks 已存在**：
- 检查是否已包含 ACE 检查
- 如未包含，追加 ACE 检查到现有 hook
- 不覆盖用户自定义 hooks

**输出**：
```
✅ ACE Git Hooks 已安装

.git/hooks/
├── pre-commit      # 提交时检查待处理观察
└── pre-push        # 推送时检查反思阈值

💡 ACE: Git 操作将自动触发 ACE 检查
```

**如果不是 Git 仓库**：
```
ℹ️  非 Git 仓库，跳过 hooks 安装
   如需手动安装: cp hooks/ace-* .git/hooks/ && chmod +x .git/hooks/ace-*
```

### 步骤4: 保存配置并完成

```bash
mkdir -p .seed
# 写入配置文件
```

输出完成信息：

```
✅ SEED 初始化完成

配置文件: .seed/config.json

🧠 ACE 自演化: 已启用
   观察目录: .seed/observations/
   Git Hooks: 已安装

下一步:
1. 检查配置: cat .seed/config.json
2. 创建规格: /mob-seed:spec "功能名称"
3. 查看状态: /mob-seed:seed
```

## 参数说明

| 参数 | 说明 |
|------|------|
| （无参数） | **创建 OpenSpec 标准目录结构** |
| `--force` | 强制重新初始化（备份现有配置） |

## 示例用法

```bash
# 初始化 OpenSpec 结构（默认）
/mob-seed:init

# 强制重新初始化
/mob-seed:init --force
```

## 配置文件详解

`.seed/config.json` 完整格式：

```json
{
  "version": "2.0.0",
  "created": "ISO时间戳",
  "updated": "ISO时间戳",

  "openspec": {
    "enabled": true,
    "root": "openspec",
    "specsDir": "specs",
    "changesDir": "changes"
  },

  "mission": {
    "enabled": true,
    "path": ".seed/mission.md",
    "language": "en"
  },

  "paths": {
    "specs": "openspec/specs",
    "src": "src",
    "test": "test",
    "docs": "docs",
    "output": ".seed/output"
  },

  "patterns": {
    "spec": "*.fspec.md",
    "code": "*.js",
    "test": "*.test.js"
  },

  "emit": {
    "codeTemplate": "skeleton",
    "testTemplate": "jest",
    "docTemplate": "markdown"
  },

  "sync": {
    "autoBackup": true,
    "defaultDirection": "spec"
  }
}
```

**mission 配置说明**：
| 字段 | 说明 | 默认值 |
|------|------|--------|
| `enabled` | 是否启用 Mission Statement | `true` |
| `path` | Mission 文件路径 | `.seed/mission.md` |
| `language` | 默认显示语言 (`en`/`zh`) | `en` |
