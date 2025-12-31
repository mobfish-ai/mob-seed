---
description: SEED 状态 - 查看项目的 SEED 同步状态（支持 OpenSpec 生命周期）
allowed-tools: Read, Bash, Glob, Grep
argument-hint: [spec-path] [--verbose] [--json] [--openspec]
---

# mob-seed-status

执行内容：$ARGUMENTS

## 📦 依赖资源

- 技能目录: `.claude/skills/mob-seed/`
- 工具模块: `adapters/seed-utils.js`
- 生命周期模块: `lib/lifecycle/parser.js`
- **项目配置**: `.seed/config.json`（由 `/mob-seed-init` 生成）

## 执行步骤

### 步骤0: 检查初始化状态并加载配置

1. **检查 SEED 是否已初始化**：
   - 检查 `.seed/config.json` 是否存在
   - 如不存在，提示用户运行 `/mob-seed-init`

2. **检测 OpenSpec 模式**：
   - 检查 `config.openspec.enabled` 是否为 `true`
   - 或者检查 `openspec/` 目录是否存在
   - 如果是 OpenSpec 模式，使用 `lib/lifecycle/parser.js` 中的 `getStatusOverview()`

3. **加载配置获取路径**：
```javascript
const config = loadSeedConfig();
const isOpenSpec = config.openspec?.enabled || fs.existsSync('openspec/');
const SPECS_DIR = isOpenSpec ? 'openspec/specs' : config.paths.specs;
const CHANGES_DIR = isOpenSpec ? 'openspec/changes' : null;
const OUTPUT_DIR = config.paths.output;
```

4. **动态检测技能目录**：
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
| `[spec-path]` | 规格文件或目录 | `{config.paths.specs}/` |
| `--verbose` | 显示详细信息 | false |
| `--json` | JSON 格式输出 | false |
| `--openspec` | 强制使用 OpenSpec 模式 | auto |

### 步骤2: 扫描规格文件

**标准模式**：扫描 `{config.paths.specs}/` 目录下所有 `.fspec.md` 文件。

**OpenSpec 模式**：使用 `getStatusOverview()` 扫描：
- `openspec/specs/` - 已归档规格
- `openspec/changes/` - 变更提案（按生命周期状态分组）

### 步骤3: 检查每个规格的状态

对每个规格文件检查：

1. **生命周期状态**（OpenSpec 模式）：draft / review / implementing / archived
2. **派生状态**: 是否有对应的 manifest
3. **代码状态**: 派生代码是否存在
4. **测试状态**: 派生测试是否存在
5. **同步状态**: 是否有漂移

### 步骤4: 汇总统计

```
📊 SEED 状态摘要

| 规格 | 派生 | 代码 | 测试 | 同步 |
|------|------|------|------|------|
| user-auth | ✅ | ✅ | ⚠️ | ⚠️ |
| order-mgmt | ✅ | ✅ | ✅ | ✅ |
| payment | ❌ | ❌ | ❌ | - |

统计:
- 总规格: 3
- 已派生: 2
- 完全同步: 1
- 需要关注: 2
```

### 步骤5: 输出结果

根据模式（标准/OpenSpec）和参数选择输出格式。

---

#### 标准模式输出

##### 简洁模式（默认）

```
📊 SEED 状态: 2/3 规格已派生，1 需要关注

user-auth    ✅ 派生 ⚠️ 测试缺失
order-mgmt   ✅ 完全同步
payment      ❌ 未派生
```

##### 详细模式（--verbose）

```
📊 SEED 状态详情

## user-auth (v1.2.0)

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 规格 | ✅ | specs/user-auth.fspec.md |
| 派生 | ✅ | output/mob-seed/user-auth/manifest.json |
| 代码 | ✅ | src/user-auth/index.js |
| 测试 | ⚠️ | 缺少 AC-003 测试 |
| 文档 | ✅ | docs/user-auth.md |

FR 覆盖: 5/5 (100%)
AC 覆盖: 4/5 (80%)

---
```

##### JSON 模式（--json）

```json
{
  "summary": {
    "total": 3,
    "emitted": 2,
    "synced": 1,
    "needsAttention": 2
  },
  "specs": [
    {
      "name": "user-auth",
      "version": "1.2.0",
      "status": {
        "emitted": true,
        "code": true,
        "test": false,
        "synced": false
      }
    }
  ]
}
```

---

#### OpenSpec 模式输出

##### 简洁模式（默认）

```
📊 OpenSpec 状态概览

已归档规格: 2
变更提案: 3 (📝 1 草稿 | 🔍 1 审查 | 🔨 1 实现中)

📝 草稿
  add-2fa          v1.0.0  → 待提交审查

🔍 审查中
  add-oauth        v1.0.0  → 待批准实现

🔨 实现中
  update-password  v1.1.0  → 代码 ✅ 测试 ⚠️

✅ 已归档
  user-login       v1.0.0
  user-register    v1.2.0
```

##### 详细模式（--verbose）

```
📊 OpenSpec 状态详情

═══════════════════════════════════════
📝 草稿阶段 (1 个提案)
═══════════════════════════════════════

## add-2fa (v1.0.0)
路径: openspec/changes/add-2fa/
创建: 2025-12-30
更新: 2025-12-31

| 文件 | 状态 |
|------|------|
| proposal.md | ✅ |
| tasks.md | ❌ 缺失 |
| specs/*.fspec.md | 1 个规格 |

操作: `/mob-seed-spec add-2fa --submit` 提交审查

═══════════════════════════════════════
🔍 审查阶段 (1 个提案)
═══════════════════════════════════════

## add-oauth (v1.0.0)
路径: openspec/changes/add-oauth/
状态: 等待批准

Delta 摘要:
- ADDED: 2 个需求 (REQ-001, REQ-002)
- MODIFIED: 0
- REMOVED: 0

操作: `/mob-seed-emit add-oauth` 批准并派生

═══════════════════════════════════════
🔨 实现阶段 (1 个提案)
═══════════════════════════════════════

## update-password (v1.1.0)
路径: openspec/changes/update-password/

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 规格 | ✅ | 1 个 .fspec.md |
| 派生 | ✅ | manifest.json |
| 代码 | ✅ | src/auth/password.js |
| 测试 | ⚠️ | 缺少 AC-002 测试 |

操作: 完成测试后 `/mob-seed-defend update-password` 归档

═══════════════════════════════════════
✅ 已归档 (2 个规格)
═══════════════════════════════════════

| 规格 | 版本 | 路径 |
|------|------|------|
| user-login | v1.0.0 | openspec/specs/auth/login.fspec.md |
| user-register | v1.2.0 | openspec/specs/auth/register.fspec.md |
```

##### JSON 模式（--json）

```json
{
  "mode": "openspec",
  "summary": {
    "totalSpecs": 2,
    "totalChanges": 3,
    "byState": {
      "draft": 1,
      "review": 1,
      "implementing": 1,
      "archived": 2
    }
  },
  "archived": [
    {
      "title": "用户登录",
      "version": "1.0.0",
      "path": "openspec/specs/auth/login.fspec.md"
    }
  ],
  "changes": {
    "draft": [
      {
        "name": "add-2fa",
        "version": "1.0.0",
        "path": "openspec/changes/add-2fa/",
        "hasProposalMd": true,
        "hasTasksMd": false,
        "specs": ["2fa.fspec.md"]
      }
    ],
    "review": [...],
    "implementing": [...]
  }
}
```

## 示例用法

### 标准模式

```bash
# 查看所有规格状态
/mob-seed-status

# 查看特定规格
/mob-seed-status specs/user-auth.fspec.md

# 详细信息
/mob-seed-status --verbose

# JSON 输出（用于脚本处理）
/mob-seed-status --json
```

### OpenSpec 模式

```bash
# 查看 OpenSpec 生命周期状态
/mob-seed-status --openspec

# 详细查看所有提案状态
/mob-seed-status --openspec --verbose

# 查看特定变更提案
/mob-seed-status openspec/changes/add-oauth

# JSON 输出（CI/CD 集成）
/mob-seed-status --openspec --json
```

## 状态图标说明

| 图标 | 含义 | 适用阶段 |
|------|------|----------|
| 📝 | 草稿 | draft |
| 🔍 | 审查中 | review |
| 🔨 | 实现中 | implementing |
| ✅ | 已归档/通过 | archived/passed |
| ⚠️ | 需要关注 | 测试缺失/漂移 |
| ❌ | 缺失/失败 | 未派生/测试失败 |
