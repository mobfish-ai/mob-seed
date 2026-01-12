---
name: mob-seed:init
description: SEED 初始化 - 创建 OpenSpec 标准目录结构
allowed-tools: Bash, Read, AskUserQuestion
argument-hint: [--force]
---

# mob-seed:init

执行内容：$ARGUMENTS

## ⚠️ 强制执行规则

> **重要**: 本命令必须通过脚本执行，**禁止** AI 自行实现初始化逻辑。

| 规则 | 说明 |
|------|------|
| ✅ 必须使用脚本 | 调用 `init-project.js` |
| ❌ 禁止手动创建文件 | 不要自己 mkdir、touch、echo |
| ❌ 禁止自定义目录结构 | 使用脚本输出的结构 |
| ❌ 禁止跳过 mission.md | 必须创建此文件 |

## 执行步骤

### 步骤 0: 版本显示（遵循 SKILL.md 强制启动行为）

> 遵循 SKILL.md "🚀 强制启动行为" 章节定义，显示版本和场景信息。

### 步骤 1: 解析技能目录

```bash
# 按优先级检测技能目录
SKILL_DIR=""

if [ -d "$HOME/.claude/plugins/marketplaces/mobfish-ai/skills/mob-seed" ]; then
    SKILL_DIR="$HOME/.claude/plugins/marketplaces/mobfish-ai/skills/mob-seed"
elif [ -d "$HOME/.claude/plugins/cache/mobfish-ai/mob-seed" ]; then
    LATEST=$(ls -1 "$HOME/.claude/plugins/cache/mobfish-ai/mob-seed" 2>/dev/null | sort -V | tail -1)
    [ -n "$LATEST" ] && SKILL_DIR="$HOME/.claude/plugins/cache/mobfish-ai/mob-seed/$LATEST/skills/mob-seed"
elif [ -d "skills/mob-seed" ]; then
    SKILL_DIR="skills/mob-seed"  # 开发模式
elif [ -d "$HOME/.claude/skills/mob-seed" ]; then
    SKILL_DIR="$HOME/.claude/skills/mob-seed"
elif [ -d ".claude/skills/mob-seed" ]; then
    SKILL_DIR=".claude/skills/mob-seed"
fi

echo "技能目录: $SKILL_DIR"
```

### 步骤 2: 执行初始化脚本

> **这是唯一正确的方法。禁止手动实现初始化逻辑。**

```bash
# 运行初始化脚本（强制使用）
node "$SKILL_DIR/scripts/init-project.js" . $ARGUMENTS
```

**脚本会自动完成**:
1. ✅ 检测项目结构（src/test/docs 目录）
2. ✅ 创建 `openspec/` 目录（specs, changes, AGENTS.md, project.md）
3. ✅ 创建 `.seed/config.json`（配置文件）
4. ✅ 创建 `.seed/mission.md`（使命声明）⭐ 关键
5. ✅ 创建 `.seed/observations/`（ACE 观察目录）
6. ✅ 安装 Git Hooks（如果是 Git 仓库）
7. ✅ 验证所有必需文件已创建

### 步骤 3: 验证初始化结果

脚本执行后，检查输出确认：

```
必需文件清单:
✓ .seed/config.json
✓ .seed/mission.md          ← 必须存在！
✓ .seed/observations/index.json
✓ openspec/specs/.gitkeep
✓ openspec/changes/.gitkeep
✓ openspec/project.md
✓ openspec/AGENTS.md
```

**如果任何文件缺失，初始化失败！**

## 参数说明

| 参数 | 说明 |
|------|------|
| （无参数） | 标准初始化 |
| `--force` | 强制重新初始化（覆盖现有配置） |

## 示例

```bash
# 标准初始化
/mob-seed:init

# 强制重新初始化
/mob-seed:init --force
```

## 预期输出

```
═══════════════════════════════════════════════════════════════
🌱 SEED 项目初始化
═══════════════════════════════════════════════════════════════
📂 项目目录: /path/to/project
🔧 技能目录: /path/to/skills/mob-seed

🔍 检测项目结构...
   项目名称: my-project
   源码目录: src
   测试目录: test

📁 步骤 1: 创建 OpenSpec 目录结构...
   ✓ openspec/AGENTS.md
   ✓ openspec/project.md
   ✓ openspec/specs/
   ✓ openspec/changes/

⚙️  步骤 2: 创建 .seed 配置...
   ✓ .seed/config.json
   ✓ .seed/mission.md (从模板创建)

🧠 步骤 3: 创建 ACE 自演化目录...
   ✓ .seed/observations/index.json

🔗 步骤 4: 安装 Git Hooks...
   ✓ .git/hooks/pre-commit
   ✓ .git/hooks/pre-push

✅ 步骤 5: 验证初始化结果...
   ✅ 所有必需文件已创建

═══════════════════════════════════════════════════════════════
✅ SEED 初始化完成！

📁 已创建目录结构:

openspec/
├── specs/          # 真相源（已实现的规格）
├── changes/        # 变更提案（开发中的规格）
├── project.md      # 项目约定
└── AGENTS.md       # AI 工作流

.seed/
├── config.json     # SEED 配置
├── mission.md      # 项目使命声明 ⭐
└── observations/   # ACE 观察目录

💡 下一步:
   1. 编辑 .seed/mission.md 定义项目使命和原则
   2. 检查 openspec/project.md（已自动填充基本信息）
   3. 创建规格提案: /mob-seed:spec "feature-name"
   4. 查看状态: /mob-seed
═══════════════════════════════════════════════════════════════
```

## 故障排除

### 问题: 脚本找不到

**原因**: 技能目录检测失败

**解决**:
```bash
# 手动指定技能目录
SKILL_DIR="$HOME/.claude/plugins/marketplaces/mobfish-ai/skills/mob-seed"
node "$SKILL_DIR/scripts/init-project.js" .
```

### 问题: mission.md 未创建

**原因**: 模板文件缺失

**解决**: 脚本会自动创建基本版本的 mission.md

### 问题: 项目已初始化

**解决**: 使用 `--force` 参数重新初始化

---

## 技术细节（仅供参考）

### 脚本位置

```
{SKILL_DIR}/scripts/init-project.js
```

### 脚本依赖

```
{SKILL_DIR}/
├── scripts/
│   ├── init-project.js    # 初始化脚本 ⭐
│   └── detect-project.js  # 项目检测
└── templates/
    └── openspec/
        ├── mission.md     # Mission 模板 (frontmatter + markdown)
        ├── project.md     # 项目约定模板
        └── AGENTS.md      # AI 工作流模板
```

### 必需文件清单

| 文件 | 说明 | 必需 |
|------|------|------|
| `.seed/config.json` | SEED 配置 | ✅ |
| `.seed/mission.md` | 项目使命声明 | ✅ |
| `.seed/observations/index.json` | ACE 观察索引 | ✅ |
| `openspec/specs/.gitkeep` | 规格目录 | ✅ |
| `openspec/changes/.gitkeep` | 变更目录 | ✅ |
| `openspec/project.md` | 项目约定 | ✅ |
| `openspec/AGENTS.md` | AI 工作流 | ✅ |
