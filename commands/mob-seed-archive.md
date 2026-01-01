---
description: SEED 归档 - 将完成的变更提案归档到真相源（implementing → archived）
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, TodoWrite, AskUserQuestion
argument-hint: <proposal-name> [--all] [--dry-run] [--force]
---

# mob-seed-archive - 归档变更提案

执行内容：$ARGUMENTS

---

## 核心原则

> **Archive（归档）**: 将 `changes/` 中已完成的 Delta 规格合并到 `specs/` 真相源。

---

## 📦 依赖资源

```
.claude/skills/mob-seed/
├── lib/lifecycle/
│   ├── types.js            # 生命周期类型定义
│   ├── parser.js           # 规格解析器
│   └── archiver.js         # 归档逻辑（本命令使用）
└── adapters/
    └── seed-utils.js       # 工具模块
```

**项目配置**: `.seed/config.json`（由 `/mob-seed-init` 生成）

---

## 执行步骤

### 步骤 0: 检查初始化状态并加载配置

1. **检查 SEED 是否已初始化**：
   - 检查 `.seed/config.json` 是否存在
   - 如不存在，提示用户运行 `/mob-seed-init`

2. **验证 OpenSpec 模式**：
   - 归档命令仅在 OpenSpec 模式下可用
   - 检查 `config.openspec.enabled` 或 `openspec/` 目录

3. **加载配置获取路径**：
```javascript
const config = loadSeedConfig();
if (!config.openspec?.enabled && !fs.existsSync('openspec/')) {
  throw new Error('归档命令需要 OpenSpec 模式，请先运行 mob-seed-init --openspec');
}
const SPECS_DIR = 'openspec/specs';
const CHANGES_DIR = 'openspec/changes';
const ARCHIVE_DIR = config.openspec?.archiveDir || 'openspec/archive';
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

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<proposal-name>` | 变更提案名称 | 必填（除非 --all） |
| `--all` | 归档所有已完成的提案 | false |
| `--dry-run` | 预览归档操作，不执行 | false |
| `--force` | 强制归档（跳过测试检查） | false |

### 步骤 2: 验证归档前置条件

对每个待归档的提案检查：

1. **状态检查**（必须是 implementing）：
   ```javascript
   const { parseSpecFile } = require('./lib/lifecycle/parser');
   const { canTransition } = require('./lib/lifecycle/types');

   const proposalPath = `openspec/changes/${proposalName}/proposal.md`;
   const spec = parseSpecFile(proposalPath);

   if (spec.metadata.state !== 'implementing') {
     throw new Error(`提案 ${proposalName} 状态为 ${spec.metadata.state}，需要先完成实现阶段`);
   }

   if (!canTransition('implementing', 'archived')) {
     throw new Error('状态转换无效');
   }
   ```

2. **测试检查**（除非 --force）：
   - 检查对应的测试是否存在
   - 检查最近一次测试是否通过
   - 如果测试失败，提示用户先修复

3. **文件完整性检查**：
   - [ ] proposal.md 存在
   - [ ] specs/ 目录下至少有一个 .fspec.md
   - [ ] 派生的代码文件存在

### 步骤 3: 解析 Delta 规格

对提案中的每个 .fspec.md 文件：

```javascript
const { parseDeltaRequirements } = require('./lib/lifecycle/parser');

const deltaSpecs = [];
for (const specFile of proposalSpecs) {
  const content = fs.readFileSync(specFile, 'utf-8');
  deltaSpecs.push({
    file: specFile,
    added: parseDeltaRequirements(content, 'ADDED'),
    modified: parseDeltaRequirements(content, 'MODIFIED'),
    removed: parseDeltaRequirements(content, 'REMOVED')
  });
}
```

### 步骤 4: 执行归档操作

#### 4.1 合并 Delta 到真相源

```javascript
const { mergeDeltaToSpec } = require('./lib/lifecycle/archiver');

for (const delta of deltaSpecs) {
  // 确定目标规格文件
  const domain = extractDomain(delta.file);  // 从路径提取领域
  const targetSpec = `openspec/specs/${domain}/spec.fspec.md`;

  // 合并操作
  await mergeDeltaToSpec(targetSpec, delta);
}
```

**合并规则**：
| Delta 类型 | 操作 |
|------------|------|
| ADDED | 追加到目标规格的 Requirements 章节 |
| MODIFIED | 替换目标规格中对应的 REQ-XXX |
| REMOVED | 从目标规格中删除对应的 REQ-XXX |

#### 4.2 移动变更提案到归档目录

```javascript
const timestamp = new Date().toISOString().slice(0, 7);  // YYYY-MM
const archivePath = `${ARCHIVE_DIR}/${timestamp}/${proposalName}`;

fs.mkdirSync(archivePath, { recursive: true });
fs.renameSync(
  `openspec/changes/${proposalName}`,
  archivePath
);
```

#### 4.3 更新状态为 archived

```javascript
const { updateSpecState } = require('./lib/lifecycle/parser');

// 更新归档副本中的状态
updateSpecState(`${archivePath}/proposal.md`, 'archived');

// ⚠️ 重要：同时更新真相源 (openspec/specs/) 中的规格状态
for (const specFile of mergedSpecFiles) {
  updateSpecState(specFile, 'archived');
}
```

#### 4.4 更新 AC 完成状态（重要）

```javascript
const { markACsCompleted } = require('./lib/lifecycle/parser');

// 将所有已通过验证的 AC 标记为完成
for (const specFile of mergedSpecFiles) {
  // 替换 `- [ ] AC-xxx` 为 `- [x] AC-xxx`
  markACsCompleted(specFile);
}
```

**说明**：归档意味着所有 AC 都已通过验证，因此自动标记为完成。

### 步骤 5: 生成归档报告

```
🗄️ 归档完成: add-oauth

━━━ Delta 合并摘要 ━━━
目标规格: openspec/specs/auth/spec.fspec.md

ADDED:
  ✅ REQ-001: OAuth2 登录支持
  ✅ REQ-002: Token 刷新机制

MODIFIED:
  ✅ REQ-003: 密码策略 (v1.0 → v1.1)

REMOVED:
  ✅ REQ-004: 旧版 Session 认证

━━━ 文件变更 ━━━
移动: openspec/changes/add-oauth/
   → openspec/archive/2025-12/add-oauth/

━━━ 状态转换 ━━━
🔨 implementing → ✅ archived

提示: 使用 /mob-seed-status 查看最新状态
```

---

## 归档目录结构

```
openspec/
├── specs/                    # 真相源（归档后更新）
│   └── auth/
│       └── spec.fspec.md     # ← Delta 合并到这里
├── changes/                  # 变更提案（归档后清空）
│   └── (空)
└── archive/                  # 归档历史
    └── 2025-12/
        └── add-oauth/        # ← 提案移动到这里
            ├── proposal.md   # 状态: archived
            ├── tasks.md
            └── specs/
                └── oauth.fspec.md
```

---

## 使用示例

```bash
# 归档指定提案
/mob-seed-archive add-oauth

# 预览归档操作（不实际执行）
/mob-seed-archive add-oauth --dry-run

# 归档所有已完成的提案
/mob-seed-archive --all

# 强制归档（跳过测试检查）
/mob-seed-archive add-oauth --force
```

---

## 进度显示

| 图标 | 含义 |
|------|------|
| 🗄️ | 归档操作 |
| ✅ | 成功 |
| ⏳ | 进行中 |
| ⚠️ | 警告 |
| ❌ | 失败 |

示例输出：
```
🌱 SEED 归档阶段
━━━ 🗄️ 归档提案 ━━━
提案: add-oauth
状态: implementing

⏳ 检查前置条件...
  ✅ 状态检查通过
  ✅ 测试检查通过 (15/15)
  ✅ 文件完整性通过

⏳ 解析 Delta 规格...
  📄 specs/oauth.fspec.md
    ADDED: 2, MODIFIED: 1, REMOVED: 1

⏳ 合并到真相源...
  ✅ openspec/specs/auth/spec.fspec.md

⏳ 移动到归档目录...
  ✅ openspec/archive/2025-12/add-oauth/

✅ 归档完成
🔨 implementing → ✅ archived
```

---

## 错误处理

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| 状态不是 implementing | 提案未完成实现 | 完成代码和测试后再归档 |
| 测试未通过 | 存在失败的测试 | 修复测试或使用 --force |
| 目标规格不存在 | 首次添加该领域 | 自动创建目标规格文件 |
| 冲突的 REQ-ID | 修改的需求 ID 不存在 | 检查 Delta 规格是否正确 |
