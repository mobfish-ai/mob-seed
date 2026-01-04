---
id: init-hooks
version: 1.0.0
status: draft
created: 2026-01-04
updated: 2026-01-04
---

# Init 命令 Hooks 安装规格 (Init Command Hooks Installation)

## 概述 (Overview)

扩展 `/mob-seed:init` 命令，在初始化时自动安装 Git hooks 到用户项目的 `.git/hooks/` 目录。

## 动机 (Motivation)

### 问题

1. **手动安装**: 用户需要手动复制 hooks 到 `.git/hooks/`
2. **容易遗漏**: 初始化后忘记配置 hooks
3. **路径问题**: hooks 中的脚本引用路径可能错误

### 目标

- **自动化**: init 时自动安装 hooks
- **可选性**: 支持 `--no-hooks` 跳过
- **正确性**: 自动配置正确的脚本路径

## 功能需求 (Functional Requirements)

### FR-001: 自动安装 Hooks

**描述**: `/mob-seed:init` 自动将 hook 模板安装到 `.git/hooks/`。

**安装流程**:

```
/mob-seed:init
    │
    ├── 创建 .seed/config.json
    ├── 创建 .seed/mission.md
    │
    ├── 检测 .git/ 目录
    │   └── 不存在 → 警告并跳过 hooks 安装
    │
    ├── 安装 hooks
    │   ├── 复制 pre-commit → .git/hooks/pre-commit
    │   ├── 复制 pre-push → .git/hooks/pre-push
    │   └── 设置执行权限 (chmod +x)
    │
    └── 配置脚本路径
        └── 替换模板中的 {SEED_SCRIPTS_PATH} 占位符
```

**验收标准**:
- [ ] AC-001: init 后 `.git/hooks/pre-commit` 存在
- [ ] AC-002: init 后 `.git/hooks/pre-push` 存在
- [ ] AC-003: hooks 有执行权限 (755)
- [ ] AC-004: hooks 中的脚本路径正确

### FR-002: 跳过 Hooks 安装

**描述**: 支持 `--no-hooks` 选项跳过 hooks 安装。

**使用场景**:
- CI/CD 环境不需要 hooks
- 用户有自定义 hooks 配置
- 调试时暂时禁用

**验收标准**:
- [ ] AC-001: `--no-hooks` 跳过 hooks 安装
- [ ] AC-002: 跳过时输出提示信息
- [ ] AC-003: 其他初始化步骤正常执行

### FR-003: 路径配置

**描述**: 根据项目配置生成正确的脚本路径。

**路径解析优先级**:

1. **config.json 配置**: 读取 `.seed/config.json` 中的 `paths.scripts`
2. **命令安装位置**: Claude Code 命令安装目录
3. **默认路径**: `.seed/scripts/`

**模板占位符**:

```bash
#!/bin/bash
# pre-commit hook

# 路径将在安装时替换
SEED_SCRIPTS="${SEED_SCRIPTS_PATH}"

# 执行检查
"$SEED_SCRIPTS/quick-defend.js" --files="$(git diff --cached --name-only)"
```

**验收标准**:
- [ ] AC-001: 路径占位符被正确替换
- [ ] AC-002: 替换后的路径可访问
- [ ] AC-003: 支持绝对路径和相对路径

### FR-004: 现有 Hooks 处理

**描述**: 处理用户已有的 hooks 文件。

**策略**:

| 情况 | 行为 |
|------|------|
| 无现有 hook | 直接安装 |
| 有现有 hook（相同内容） | 跳过，提示已安装 |
| 有现有 hook（不同内容） | 备份为 `.bak` 后安装，提示用户 |

**验收标准**:
- [ ] AC-001: 不覆盖用户自定义 hooks
- [ ] AC-002: 备份文件命名为 `{hook}.bak`
- [ ] AC-003: 输出详细的处理信息

### FR-005: ACE Hooks 可选安装

**描述**: 支持安装 ACE 扩展 hooks。

**选项**: `--with-ace`

**安装的额外 hooks**:
- `ace-pre-commit` - 观察记录检查
- `ace-pre-push` - 反思阈值检查

**验收标准**:
- [ ] AC-001: 默认不安装 ACE hooks
- [ ] AC-002: `--with-ace` 安装 ACE hooks
- [ ] AC-003: ACE hooks 正确链接到主 hooks

## 命令接口 (Command Interface)

### 更新后的 init 命令

```
/mob-seed:init [options]

选项:
  --no-hooks     跳过 Git hooks 安装
  --with-ace     同时安装 ACE hooks
  --force        强制覆盖现有 hooks（不备份）
  --verbose      显示详细安装信息
```

### 输出示例

```
$ /mob-seed:init

✅ SEED 初始化完成

📁 创建的文件:
   .seed/config.json
   .seed/mission.md

🪝 Git Hooks 安装:
   ✅ .git/hooks/pre-commit (已安装)
   ✅ .git/hooks/pre-push (已安装)

💡 下一步:
   1. 编辑 .seed/mission.md 定义项目使命
   2. 运行 /mob-seed:spec create <feature> 创建第一个规格
```

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | `skills/mob-seed/lib/init/hooks-installer.js` | Hooks 安装逻辑 |
| 测试 | `skills/mob-seed/test/init/hooks-installer.test.js` | 安装测试 |
| 文档 | `commands/init.md` | 更新的命令文档 |

## 依赖关系 (Dependencies)

- 依赖 `scripts-consolidation.fspec.md` 提供 hook 模板位置
- 依赖现有 init 命令实现

## 测试策略 (Testing Strategy)

### 单元测试

| 测试文件 | 覆盖范围 |
|----------|----------|
| `hooks-installer.test.js` | 安装逻辑 |

### 集成测试

| 测试场景 | 验证内容 |
|----------|----------|
| 全新项目 | hooks 正确安装 |
| 有现有 hooks | 正确备份并安装 |
| --no-hooks | 跳过安装 |
| 非 Git 项目 | 优雅处理 |

### 端到端测试

| 测试场景 | 验证内容 |
|----------|----------|
| mars-nexus 安装 | 完整流程验证 |
| Git commit 触发 | pre-commit 执行 |
| Git push 触发 | pre-push 执行 |

## Hook 模板示例

### pre-commit

```bash
#!/bin/bash
# SEED pre-commit hook
# 自动生成，请勿手动编辑

set -e

# 脚本路径（安装时替换）
SEED_SCRIPTS="${SEED_SCRIPTS_PATH}"

# 获取 staged 文件
STAGED_FILES=$(git diff --cached --name-only)

if [ -z "$STAGED_FILES" ]; then
    exit 0
fi

# 执行快速检查
echo "🔍 SEED pre-commit 检查..."
node "$SEED_SCRIPTS/../lib/cli/validate-quick.js" --files="$STAGED_FILES"

# 检查结果
if [ $? -ne 0 ]; then
    echo "❌ SEED 检查失败，提交被阻止"
    echo "💡 运行 /mob-seed:defend 查看详情"
    exit 1
fi

echo "✅ SEED 检查通过"
```

### pre-push

```bash
#!/bin/bash
# SEED pre-push hook
# 自动生成，请勿手动编辑

set -e

# 脚本路径（安装时替换）
SEED_SCRIPTS="${SEED_SCRIPTS_PATH}"

# 获取未推送的 commits
UNPUSHED=$(git log @{u}.. --name-only --pretty=format: 2>/dev/null | sort -u | grep -v '^$' || true)

if [ -z "$UNPUSHED" ]; then
    exit 0
fi

# 执行增量检查
echo "🔍 SEED pre-push 检查..."
node "$SEED_SCRIPTS/../lib/cli/validate-incremental.js" --files="$UNPUSHED"

# 检查结果
if [ $? -ne 0 ]; then
    echo "❌ SEED 检查失败，推送被阻止"
    echo "💡 运行 /mob-seed:defend --incremental 查看详情"
    exit 1
fi

echo "✅ SEED 检查通过"
```

## 风险与缓解 (Risks and Mitigations)

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 覆盖用户 hooks | 中 | 高 | 备份机制 |
| 路径解析错误 | 中 | 高 | 多层回退 + 验证 |
| 权限问题 | 低 | 中 | 明确设置 chmod |
| Windows 兼容 | 中 | 中 | 使用 Git Bash |
