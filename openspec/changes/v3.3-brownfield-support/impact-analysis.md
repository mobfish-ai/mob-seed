# 架构修正完整影响分析

> 变更: 移动 `.seed/scripts/*.js` → `skills/mob-seed/lib/` (分层架构)
> 原因: 确保所有功能赋能用户项目，而非只在 mob-seed 自己可用
> 最佳实践: 基于 `best-practices-review.md` 的 8 个关键决策

## 影响层面汇总

| # | 层面 | 影响范围 | 风险等级 | 修复优先级 |
|---|------|----------|----------|------------|
| 1 | 核心脚本文件 | 4 个文件移动+重命名 | 🔴 高 | P0 |
| 2 | Git Hooks | 2 个 hook 文件，8 处路径引用 | 🔴 高 | P0 |
| 3 | 命令系统 | defend.md 文档+命令实现 | 🔴 高 | P0 |
| 4 | 规格文件 | git-hooks.fspec.md 派生路径 | 🟡 中 | P1 |
| 5 | 测试 | 新增 hook 测试 | 🟡 中 | P1 |
| 6 | 用户项目兼容 | 迁移指南+兼容提示 | 🟡 中 | P1 |
| 7 | 文档 | CLAUDE.md 新增教训 | 🟢 低 | P2 |
| 8 | 历史文档 | CHANGELOG, archive (仅参考) | ⚪ 无 | - |
| 9 | 依赖 | 无新增依赖 | ⚪ 无 | - |
| 10 | 版本号 | 升级到 3.3.0 | 🟢 低 | P2 |

---

## 详细影响分析

### 1. 核心脚本文件（P0 优先）

#### 当前状态
```
.seed/scripts/
├── check-cache.js              # 112 行
├── quick-defend.js             # 89 行
├── incremental-defend.js       # 134 行
└── update-cache.js             # 67 行
```

#### 目标状态（分层架构）
```
skills/mob-seed/lib/
├── validation/              # 验证逻辑（纯函数）
│   ├── quick.js            # 快速检查
│   ├── incremental.js      # 增量检查
│   └── full.js             # 完整检查
├── cache/                   # 缓存管理
│   ├── validator.js        # 检查缓存
│   ├── reader.js           # 读取缓存
│   └── writer.js           # 更新缓存
├── hooks/                   # Git Hooks 逻辑
│   ├── pre-commit.js       # pre-commit 集成
│   └── pre-push.js         # pre-push 集成
└── cli/                     # CLI 入口
    ├── validate-quick.js   # quick 命令包装
    ├── validate-incremental.js  # incremental 命令包装
    └── validate-cache.js   # cache 命令包装
```

#### 变更要求
- ✅ 按功能分层移动文件（validation/, cache/, hooks/, cli/）
- ✅ 重命名为统一命名规范（动词-对象：validate-quick, validate-incremental）
- ✅ 分离库函数与 CLI 入口（方案 I）
- ✅ 统一模块导出接口（Zod schema + 标准化返回值）
- ✅ 更新所有内部引用路径

#### 风险
- 🔴 **破坏性变更**: 旧路径立即失效
- 🔴 **回退困难**: 移动后难以回滚

#### 缓解措施
- 先创建新文件，再删除旧文件（两阶段迁移）
- 旧路径保留兼容性提示脚本（7天过渡期）

---

### 2. Git Hooks（P0 优先）

#### 受影响文件

**`.seed/hooks/pre-commit`** (8 处引用):
```bash
# 第 44 行: 检查脚本是否存在
if [ -f ".seed/scripts/check-cache.js" ]; then

# 第 46 行: 调用缓存检查
if node .seed/scripts/check-cache.js --files="$SPEC_FILES"; then

# 第 53 行: 检查脚本是否存在
if [ -f ".seed/scripts/quick-defend.js" ]; then

# 第 54 行: 调用快速检查
if ! node .seed/scripts/quick-defend.js --files="$SPEC_FILES"; then
```

**`.seed/hooks/pre-push`** (4 处引用):
```bash
# 第 54 行
if [ -f ".seed/scripts/incremental-defend.js" ]; then

# 第 55 行
if ! node .seed/scripts/incremental-defend.js --files="$SPEC_FILES"; then

# 第 63 行
if [ -f ".seed/scripts/update-cache.js" ]; then

# 第 64 行
node .seed/scripts/update-cache.js --files="$SPEC_FILES" 2>/dev/null || true
```

#### 修复方案（三层回退策略 - 方案 F）

**完整实现**:
```bash
#!/bin/bash
# .seed/hooks/pre-commit

# Layer 1: 用户配置优先
if [ -f ".seed/config.json" ]; then
    HOOK_CMD=$(node -e "
        try {
            const cfg = require('./.seed/config.json');
            const cmd = cfg.hooks?.preCommit;
            if (cmd) console.log(cmd);
        } catch(e) {}
    " 2>/dev/null)

    if [ -n "$HOOK_CMD" ]; then
        $HOOK_CMD
        exit $?
    fi
fi

# Layer 2: 命令调用（推荐）
if command -v mob-seed >/dev/null 2>&1; then
    mob-seed defend quick
    exit $?
fi

# Layer 3: 标准库路径（回退）
PLUGIN_DIR="${HOME}/.claude/skills/mob-seed"
if [ ! -d "$PLUGIN_DIR" ]; then
    PLUGIN_DIR="./skills/mob-seed"
fi

if [ -f "$PLUGIN_DIR/lib/cli/validate-quick.js" ]; then
    node "$PLUGIN_DIR/lib/cli/validate-quick.js"
    exit $?
fi

# 失败提示
echo "❌ 错误: 无法找到 mob-seed"
echo "请确保 mob-seed 已安装或检查 .seed/config.json"
exit 1
```

**三层设计优势**:
- ✅ 最大灵活性：用户可自定义 hook 命令
- ✅ 简洁性：推荐使用命令调用
- ✅ 可靠性：多层回退确保总能找到实现
- ✅ 可调试性：清晰的错误提示

---

### 3. 命令系统（P0 优先）

#### `commands/defend.md` 受影响行号

| 行号 | 当前内容 | 修复方式 |
|------|----------|----------|
| 380 | `node .seed/scripts/check-cache.js` | 改为命令选项 `--cached` |
| 386 | `node .seed/scripts/quick-defend.js` | 改为命令选项 `--quick` |
| 412 | `node .seed/scripts/incremental-defend.js` | 改为命令选项 `--incremental` |
| 421 | `node .seed/scripts/update-cache.js` | 内部自动调用 |
| 453 | `node .seed/scripts/full-defend.js` | 改为默认行为 |

#### 新增命令选项（分层架构）

```markdown
### 步骤 1.2: 解析选项（扩展）

**新增选项**:

| 选项 | 说明 | 库函数 | CLI 包装 |
|------|------|--------|----------|
| `--quick` | 快速检查（无缓存） | lib/validation/quick.js | lib/cli/validate-quick.js |
| `--incremental` | 增量检查（使用缓存） | lib/validation/incremental.js | lib/cli/validate-incremental.js |
| `--cached` | 仅检查缓存 | lib/cache/validator.js | lib/cli/validate-cache.js |

**三种调用方式**:

```bash
# 方式 1: 命令调用（推荐）
/mob-seed defend --quick
/mob-seed defend --incremental --fix
/mob-seed defend --cached

# 方式 2: CLI 直接调用（Git Hooks）
PLUGIN_PATH=$(claude which mob-seed)
node "$PLUGIN_PATH/lib/cli/validate-quick.js" --files="lib/test.js"

# 方式 3: 库函数导入（高级）
node -e "
  const validate = require('mob-seed/lib/validation/quick');
  validate({ files: ['lib/test.js'] }).then(result => {
    console.log('Passed:', result.passed);
    process.exit(result.passed ? 0 : 1);
  });
"
```
```

#### 命令实现更新（分层架构）

```javascript
// commands/defend.md → 步骤 2: 执行检查

// 命令内部调用 CLI 包装器（方式 2）
const { spawn } = require('child_process');
const path = require('path');

if (options.quick) {
  const cliPath = path.join(__dirname, '../../lib/cli/validate-quick.js');
  const result = spawn('node', [cliPath, ...processedArgs]);
  // spawn 调用安全，避免命令注入
}

// 或直接调用库函数（方式 3）
if (options.quick) {
  const validate = require('../../lib/validation/quick');
  result = await validate({ files, fix: options.fix });
}
```

---

### 4. 规格文件（P1 优先）

#### `openspec/specs/automation/git-hooks.fspec.md`

**第 6 行（派生路径）**:
```diff
- > 派生路径: .seed/hooks/, .seed/scripts/
+ > 派生路径: .seed/hooks/, skills/mob-seed/lib/validation/, lib/cache/, lib/hooks/, lib/cli/
```

#### 规格内容更新

需要更新所有 REQ 中提到的脚本路径（分层架构）：
- REQ-004: 快速检查脚本 → `lib/validation/quick.js` + `lib/cli/validate-quick.js`
- REQ-005: 增量检查脚本 → `lib/validation/incremental.js` + `lib/cli/validate-incremental.js`
- REQ-006: 缓存检查脚本 → `lib/cache/validator.js` + `lib/cli/validate-cache.js`
- REQ-007: 缓存更新脚本 → `lib/cache/writer.js`
- REQ-008: Git Hooks 集成 → `lib/hooks/pre-commit.js`, `lib/hooks/pre-push.js`

---

### 5. 测试（P1 优先）

#### 新增测试文件（按风险分级）

```
skills/mob-seed/test/
├── validation/              # 🔴 High Risk: ≥95% 覆盖率
│   ├── quick.test.js
│   ├── incremental.test.js
│   └── full.test.js
├── cache/                   # 🟡 Medium Risk: ≥85% 覆盖率
│   ├── validator.test.js
│   ├── reader.test.js
│   └── writer.test.js       # 🟢 Low Risk: ≥75%
├── cli/                     # 🟡 Medium Risk: ≥85% 覆盖率
│   ├── validate-quick.test.js
│   ├── validate-incremental.test.js
│   └── validate-cache.test.js
└── integration/             # 集成测试
    ├── three-call-methods.test.js
    ├── git-hooks-integration.test.js
    └── graceful-degradation.test.js
```

#### 测试覆盖要求（基于风险）

| 模块 | 风险级别 | 覆盖率目标 | 单元测试 | 集成测试 |
|------|----------|------------|----------|----------|
| validation/quick.js | 🔴 High | 95%+ | ✅ 必须 | ✅ 必须 |
| validation/incremental.js | 🔴 High | 95%+ | ✅ 必须 | ✅ 必须 |
| cache/validator.js | 🟡 Medium | 85%+ | ✅ 必须 | ✅ 必须 |
| cache/reader.js | 🟡 Medium | 85%+ | ✅ 必须 | ⚪ 可选 |
| cache/writer.js | 🟢 Low | 75%+ | ✅ 必须 | ⚪ 可选 |
| cli/*.js | 🟡 Medium | 85%+ | ✅ 必须 | ✅ 必须 |

#### 集成测试场景（方案 O: 优雅降级）

```bash
# test/integration/three-call-methods.test.js

# 测试 1: 命令调用
/mob-seed defend --quick
assert_exit_code $? 0

# 测试 2: CLI 直接调用
PLUGIN_PATH=$(claude which mob-seed)
node "$PLUGIN_PATH/lib/cli/validate-quick.js" --files="lib/test.js"
assert_exit_code $? 0

# 测试 3: 库函数导入
node -e "const v = require('mob-seed/lib/validation/quick'); v({}).then(r => process.exit(r.passed ? 0 : 1));"
assert_exit_code $? 0
```

```javascript
// test/integration/graceful-degradation.test.js
test('cache failure degrades gracefully', async () => {
  // 模拟缓存损坏
  const result = await validator.validate({ cacheCorrupted: true });

  // 应降级到完整验证
  assert.strictEqual(result.degraded, true);
  assert.strictEqual(result.fallbackUsed, 'full-validation');
  assert(result.warnings.includes('Cache unavailable'));
});

test('layered exit codes', () => {
  assert.strictEqual(ExitCode.SUCCESS, 0);
  assert.strictEqual(ExitCode.VALIDATION_FAILED, 1);
  assert.strictEqual(ExitCode.SYSTEM_ERROR, 2);
  assert.strictEqual(ExitCode.CONFIG_ERROR, 3);
  assert.strictEqual(ExitCode.TIMEOUT, 124);
  assert.strictEqual(ExitCode.INTERRUPTED, 130);
});
```

---

### 6. 用户项目兼容（P1 优先）

#### 问题场景

用户项目可能已经：
1. 直接在 Git Hooks 中调用 `.seed/scripts/*.js`
2. 在自定义脚本中引用这些路径
3. 文档中记录了这些路径

#### 迁移指南（三种调用方式）

**自动检测**:
```bash
# 检测用户项目是否使用旧路径
grep -rn "\.seed/scripts" .git/hooks/ 2>/dev/null
```

**迁移步骤**:
```markdown
## 用户项目迁移步骤（如果使用旧路径）

### 步骤 1: 更新 Git Hooks（推荐：三层回退）

```bash
# 旧的 .git/hooks/pre-commit
node .seed/scripts/quick-defend.js --files="$STAGED_FILES"

# 新的 .git/hooks/pre-commit（三层回退策略）
#!/bin/bash
# Layer 1: 用户配置
if [ -f ".seed/config.json" ]; then
    HOOK_CMD=$(node -e "try { const cfg = require('./.seed/config.json'); console.log(cfg.hooks?.preCommit || ''); } catch(e) {}" 2>/dev/null)
    if [ -n "$HOOK_CMD" ]; then
        $HOOK_CMD
        exit $?
    fi
fi

# Layer 2: 命令调用
if command -v mob-seed >/dev/null 2>&1; then
    mob-seed defend quick
    exit $?
fi

# Layer 3: 直接库调用
PLUGIN_DIR="${HOME}/.claude/skills/mob-seed"
[ ! -d "$PLUGIN_DIR" ] && PLUGIN_DIR="./skills/mob-seed"
if [ -f "$PLUGIN_DIR/lib/cli/validate-quick.js" ]; then
    node "$PLUGIN_DIR/lib/cli/validate-quick.js"
    exit $?
fi

echo "❌ 错误: 无法找到 mob-seed"
exit 1
```

### 步骤 2: 用户配置自定义（可选）

```json
// .seed/config.json
{
  "hooks": {
    "preCommit": "npm run lint && npm test",
    "prePush": "/mob-seed defend --incremental"
  }
}
```

### 步骤 3: 清理旧文件（可选）

```bash
# 如果用户项目有 .seed/scripts/（不应该有）
rm -rf .seed/scripts/
```
```

#### 版本化废弃策略（方案 M）

```
v3.3.0 (当前) - Deprecate + Warn
├── 旧路径保留兼容性提示脚本
├── 警告信息指引迁移
└── 文档标注 "已废弃"

↓ +3 months

v3.4.0 - Break + Error
├── 旧路径删除提示脚本
├── 直接报错并拒绝执行
└── 强制用户迁移

↓ +3 months

v4.0.0 - Remove
└── 完全删除所有旧路径引用
```

#### 兼容性提示脚本（v3.3.0）

在旧路径保留友好提示：

```javascript
// .seed/scripts/quick-defend.js（兼容性提示，v3.3.0-v3.4.0）
console.error(`
⚠️ 警告: .seed/scripts/ 路径已废弃（v3.3.0+），将在 v3.4.0 移除

请立即更新调用方式：

方式 1: 命令调用（推荐）
  /mob-seed defend --quick

方式 2: CLI 直接调用（Git Hooks）
  node $(claude which mob-seed)/lib/cli/validate-quick.js

方式 3: 库函数导入（高级）
  const validate = require('mob-seed/lib/validation/quick');

详见: https://github.com/mobfish-ai/mob-seed/releases/v3.3.0
`);
process.exit(1);
```

---

### 7. 文档（P2 优先）

#### CLAUDE.md 新增教训

```markdown
### 18. 通用能力必须归位到技能库（分层架构）

**问题**: Git Hooks 脚本放在 `.seed/scripts/` 导致只有 mob-seed 自己可用，用户项目无法使用。

**根本原因**: 混淆了"mob-seed 作为项目"和"mob-seed 作为工具"
- 所有在 mob-seed 开发的功能都是为了**赋能用户项目**
- 通用能力应该在 `skills/mob-seed/lib/`（技能库）
- `.seed/` 只是 mob-seed 自己使用工具的实例化

**修复**: v3.3 架构重构（基于最佳实践审查）
- 分层移动：`.seed/scripts/*.js` → `skills/mob-seed/lib/validation/`, `lib/cache/`, `lib/cli/`
- 三种调用方式：
  1. 命令：`/mob-seed defend --quick`
  2. CLI：`node $(claude which mob-seed)/lib/cli/validate-quick.js`
  3. 库：`require('mob-seed/lib/validation/quick')`
- 三层回退：配置 → 命令 → 库路径
- 版本化废弃：v3.3 (warn) → v3.4 (error) → v4.0 (remove)

**架构原则（分层）**:
```
┌───────────────────────────────────────────────────────┐
│ skills/mob-seed/lib/              ← 技能库（所有用户） │
│   ├── validation/                 ← 验证逻辑（纯函数） │
│   ├── cache/                      ← 缓存管理           │
│   ├── hooks/                      ← Git Hooks 集成     │
│   └── cli/                        ← CLI 包装器         │
│                                                        │
│ .seed/                            ← 实例（mob-seed）   │
│   ├── config.json                 ← 项目配置           │
│   │   └── hooks.preCommit         ← Layer 1 配置       │
│   └── hooks/                      ← Git Hooks 引用库   │
│       └── pre-commit              ← 三层回退策略       │
└───────────────────────────────────────────────────────┘
```

**最佳实践参考**:
- 详见 `openspec/changes/v3.3-brownfield-support/best-practices-review.md`
- 8 个关键决策确保架构可扩展、可维护

**教训**:
- ✅ 功能开发前问："这能让所有用户项目使用吗？"
- ✅ 按功能分层（validation/, cache/, hooks/, cli/）
- ✅ 分离库函数与 CLI 入口
- ✅ 提供多层回退策略
- ❌ 不要把工具代码放在实例目录
```

---

### 8. 历史文档（无需修改）

以下文件包含旧路径引用，但无需修改（归档/历史记录）：

| 文件 | 引用次数 | 处理方式 |
|------|----------|----------|
| `CHANGELOG.md` | 若干 | 保持原样（历史记录） |
| `openspec/archive/v2.1-release-automation/proposal.md` | 若干 | 保持原样（归档文件） |
| `openspec/changes/v3.3-brownfield-support/proposal.md` | 若干 | 文档说明，无需修改 |
| `openspec/changes/v3.3-brownfield-support/specs/architecture-refactor.fspec.md` | 若干 | 规格文件，记录变更 |

---

### 9. 依赖（无需修改）

#### 分析结果

- ✅ 不需要新增 npm 依赖
- ✅ 使用现有能力（Node.js 内置模块）
- ✅ 无外部工具依赖

#### package.json 状态

```json
{
  "dependencies": {}  // 无需修改
}
```

---

### 10. 版本号（P2 优先）

#### 需要更新的文件（4 个）

| 文件 | 当前版本 | 目标版本 |
|------|----------|----------|
| `package.json` | 3.2.1 | 3.3.0 |
| `.claude-plugin/plugin.json` | 3.2.1 | 3.3.0 |
| `.claude-plugin/marketplace.json` | 3.2.1 | 3.3.0 |
| `skills/mob-seed/package.json` | 3.2.1 | 3.3.0 |

#### 使用同步脚本

```bash
# 使用发布模式更新版本
node scripts/bump-version.js 3.3.0 --release

# 自动完成:
# 1. 验证在项目根目录
# 2. 更新所有 4 个版本文件
# 3. git add 所有版本文件
# 4. 输出发布检查清单
```

---

## 修复执行清单

### 阶段 0: 准备（预计 0.5 小时）

- [ ] 创建 `skills/mob-seed/lib/hooks/` 目录
- [ ] 创建 `skills/mob-seed/test/hooks/` 目录
- [ ] 备份当前 `.seed/scripts/` 文件

### 阶段 1: 核心迁移（预计 2 小时）

- [ ] 移动 4 个脚本文件到新路径
- [ ] 重命名文件为统一命名规范
- [ ] 更新模块导出接口（标准化）
- [ ] 更新内部引用路径

### 阶段 2: Git Hooks 更新（预计 1 小时）

- [ ] 更新 `.seed/hooks/pre-commit` (8 处引用)
- [ ] 更新 `.seed/hooks/pre-push` (4 处引用)
- [ ] 测试 Git Hooks 集成

### 阶段 3: 命令系统扩展（预计 1.5 小时）

- [ ] 更新 `commands/defend.md` 文档
- [ ] 添加 `--quick`, `--incremental`, `--cached` 选项
- [ ] 更新所有示例代码
- [ ] 测试命令选项

### 阶段 4: 规格文件更新（预计 0.5 小时）

- [ ] 更新 `git-hooks.fspec.md` 派生路径
- [ ] 更新规格内容中的路径引用
- [ ] 验证规格一致性

### 阶段 5: 测试（预计 3 小时）

- [ ] 编写 cache-checker 单元测试
- [ ] 编写 quick-defender 单元测试
- [ ] 编写 incremental-defender 单元测试
- [ ] 编写 cache-updater 单元测试
- [ ] 编写集成测试
- [ ] 运行完整测试套件

### 阶段 6: 用户兼容（预计 1 小时）

- [ ] 编写迁移指南
- [ ] 创建兼容性提示脚本（过渡期）
- [ ] 文档说明迁移步骤

### 阶段 7: 文档和发布（预计 1 小时）

- [ ] 更新 CLAUDE.md（教训 #18）
- [ ] 更新 CHANGELOG.md（v3.3.0）
- [ ] 更新版本号（4 个文件）
- [ ] 清理旧文件（`.seed/scripts/`）

---

## 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| Git Hooks 失效 | 高 | 🔴 严重 | 两阶段迁移+兼容提示 |
| 用户项目无法使用 | 中 | 🟡 中等 | 迁移指南+自动检测 |
| 测试覆盖不足 | 中 | 🟡 中等 | 强制 90% 覆盖率 |
| 路径引用遗漏 | 低 | 🟢 轻微 | 全局搜索验证 |

---

## 验证清单

### 文件系统验证

```bash
# 1. 检查新位置
ls skills/mob-seed/lib/hooks/
# 期望输出:
# cache-checker.js
# quick-defender.js
# incremental-defender.js
# cache-updater.js

# 2. 检查旧位置（mob-seed 项目）
ls .seed/scripts/
# 应为空或只有兼容性提示脚本

# 3. 检查测试
ls skills/mob-seed/test/hooks/
# 期望输出: 4 个 .test.js 文件
```

### 功能验证

```bash
# 4. 命令选项测试
/mob-seed defend --quick
/mob-seed defend --incremental
/mob-seed defend --cached

# 5. Git Hooks 测试
git add test.js
git commit -m "test"  # 应触发检查
```

### 文档验证

```bash
# 6. 检查路径引用
grep -rn "\.seed/scripts" openspec/specs/ commands/ | \
  grep -v "archive\|CHANGELOG\|proposal"
# 应无输出（除归档和变更提案）

# 7. 检查版本号一致性
node scripts/bump-version.js --check
```

---

## 成功标准

### 核心功能（分层架构）
- [ ] 所有脚本按功能分层移动到 `lib/validation/`, `lib/cache/`, `lib/hooks/`, `lib/cli/`
- [ ] 文件名遵循统一命名规范（动词-对象：validate-quick, validate-incremental）
- [ ] 库函数与 CLI 入口完全分离
- [ ] 所有命令选项可用（--quick, --incremental, --cached）
- [ ] 三种调用方式都可用：命令、CLI 直接调用、库函数导入

### Git Hooks（三层回退策略）
- [ ] `.seed/hooks/pre-commit` 采用三层回退策略（配置 → 命令 → 库）
- [ ] `.seed/hooks/pre-push` 采用三层回退策略（配置 → 命令 → 库）
- [ ] 用户配置字段 `.seed/config.json` 的 `hooks.preCommit/prePush` 工作正常
- [ ] Git Hooks 自动触发检查（commit/push）
- [ ] 检查失败时正确阻止操作

### 测试（按风险分级）
- [ ] 🔴 High Risk: validation/quick.js ≥ 95% 覆盖率
- [ ] 🔴 High Risk: validation/incremental.js ≥ 95% 覆盖率
- [ ] 🟡 Medium Risk: cache/validator.js ≥ 85% 覆盖率
- [ ] 🟡 Medium Risk: cache/reader.js ≥ 85% 覆盖率
- [ ] 🟢 Low Risk: cache/writer.js ≥ 75% 覆盖率
- [ ] 🟡 Medium Risk: cli/*.js ≥ 85% 覆盖率
- [ ] 集成测试通过（命令 + CLI + 库函数 + 优雅降级）

### 文档和规格
- [ ] `automation/git-hooks.fspec.md` 派生路径更新为分层结构
- [ ] `commands/defend.md` 文档更新为三种调用方式
- [ ] CLAUDE.md 教训 #18 反映最佳实践
- [ ] 全局搜索无旧路径引用（除归档/CHANGELOG）

### 用户验证
- [ ] 用户项目（mars-nexus）验证三种调用方式可用
- [ ] 版本化废弃策略实施（v3.3 → v3.4 → v4.0）
- [ ] 无破坏性影响（v3.3 提示脚本兼容）
- [ ] 版本号同步（4 个文件）

### 最佳实践符合性
- [ ] 所有决策符合 `best-practices-review.md` 的 8 个关键决策
- [ ] 分层架构（方案 L）
- [ ] 统一命名（方案 H）
- [ ] 库/CLI 分离（方案 I）
- [ ] 三层回退（方案 F）
- [ ] 风险分级测试（方案 K）
- [ ] 优雅降级（方案 O）
- [ ] 版本化废弃（方案 M）

---

## 估算

- **总工时**: 10.5 小时
- **风险缓冲**: +2 小时
- **实际估算**: 1.5 天（12.5 小时）
