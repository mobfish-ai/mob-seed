---
version: 1.0.0
status: draft
created: 2026-01-03
updated: 2026-01-03
type: refactor
priority: critical
---

# 架构修正：通用能力归位

## 概述

**问题**：当前 `.seed/scripts/` 中的 Git Hooks 脚本只存在于 mob-seed 项目自己，用户项目无法使用这些通用能力。

**根本原因**：混淆了"mob-seed 作为项目"和"mob-seed 作为工具"
- 所有在 mob-seed 开发的功能都是为了**赋能用户项目**
- 通用能力应该在 `skills/mob-seed/lib/`（技能库）
- `.seed/` 只是 mob-seed 自己使用工具的实例化

**影响范围**：
- ❌ 用户无法使用缓存检查功能
- ❌ 用户无法使用快速检查功能
- ❌ 用户无法使用增量检查功能
- ❌ `commands/defend.md` 文档与实际不符

## 功能需求 (FR)

### FR-001: 移动通用能力到技能库（采用分层架构）

**描述**：将 `.seed/scripts/` 中的通用脚本移动到 `skills/mob-seed/lib/`，按功能分层组织。

**新目录结构**（方案 L - 按功能分层）：

```
skills/mob-seed/lib/
├── validation/              # 验证逻辑（纯函数）
│   ├── quick.js             # 快速验证（无缓存）
│   ├── incremental.js       # 增量验证（使用缓存）
│   ├── full.js              # 完整验证
│   └── validators/
│       ├── spec-sync.js     # 规格同步验证
│       └── code-sync.js     # 代码同步验证
├── cache/                   # 缓存管理
│   ├── reader.js            # 缓存读取
│   ├── writer.js            # 缓存写入
│   └── validator.js         # 缓存验证
├── hooks/                   # Git Hooks 逻辑
│   ├── pre-commit.js        # pre-commit 逻辑
│   └── pre-push.js          # pre-push 逻辑
└── cli/                     # CLI 入口
    ├── validate-quick.js    # 快速验证 CLI
    ├── validate-incremental.js  # 增量验证 CLI
    └── validate-cache.js    # 缓存验证 CLI
```

**文件映射**（方案 H - 统一动词-对象命名）：

| 当前路径 | 新路径（库） | 新路径（CLI） | 重命名规则 |
|----------|------------|--------------|-----------|
| `.seed/scripts/check-cache.js` | `lib/cache/validator.js` | `lib/cli/validate-cache.js` | 动词-名词 ✅ |
| `.seed/scripts/quick-defend.js` | `lib/validation/quick.js` | `lib/cli/validate-quick.js` | 动词-副词 ✅ |
| `.seed/scripts/incremental-defend.js` | `lib/validation/incremental.js` | `lib/cli/validate-incremental.js` | 动词-副词 ✅ |
| `.seed/scripts/update-cache.js` | `lib/cache/writer.js` | 无 CLI（库函数） | 动词-名词 ✅ |

**命名规范**：
- 统一模式：`动词-对象` (validate-quick, validate-cache)
- 避免混合模式：不使用 `quick-defender`, `cache-checker`
- CLI 与库分离：`lib/validation/quick.js` (库) + `lib/cli/validate-quick.js` (CLI)
- 功能分层：validation/, cache/, hooks/, cli/

**实现**：`skills/mob-seed/lib/` 多个子目录

**Breaking Changes**（方案 J - 版本化废弃）：
- ⚠️ v3.3.0: `.seed/scripts/` 路径废弃（警告 + 自动转发）
- ⚠️ v3.4.0: 移除转发（错误提示 + 3 个月缓冲）
- ⚠️ v4.0.0: 移除所有旧代码（+6 个月）

---

### FR-002: 扩展 defend 命令选项

**描述**：添加命令选项，提供统一的用户接口

**新增选项**：

| 选项 | 功能 | 调用库（验证逻辑） |
|------|------|------------------|
| `--quick` | 快速检查（无缓存） | `lib/validation/quick.js` |
| `--incremental` | 增量检查（使用缓存） | `lib/validation/incremental.js` |
| `--cached` | 仅使用缓存 | `lib/cache/validator.js` |

**使用示例**：

```bash
# 用户项目中使用（推荐）
/mob-seed defend --quick             # 快速检查 staged 文件
/mob-seed defend --incremental       # 增量检查未推送的文件
/mob-seed defend --cached            # 检查缓存是否有效

# 组合使用
/mob-seed defend --incremental --fix # 增量检查并自动修复
```

**实现**：`commands/defend.md` 扩展

---

### FR-003: 分离库和 CLI 接口（方案 I）

**描述**：将验证逻辑（库）和命令行入口（CLI）分离，提供清晰的接口层次。

**调用模式**：

```bash
# 1. 通过命令（推荐，简单）
/mob-seed defend --quick

# 2. 直接调用 CLI（Git Hooks，中等）
PLUGIN_PATH=$(claude which mob-seed)
node "$PLUGIN_PATH/lib/cli/validate-quick.js" --files="$STAGED_FILES"

# 3. 导入库函数（高级，程序化）
const validate = require('mob-seed/lib/validation/quick');
const result = await validate({ files: ['lib/test.js'] });
```

**库接口**（纯函数，可复用）：

```javascript
// lib/validation/quick.js
const { z } = require('zod');

/**
 * 选项 Schema（类型安全）
 */
const OptionsSchema = z.object({
  files: z.array(z.string()).optional(),
  fix: z.boolean().default(false),
  silent: z.boolean().default(false)
});

/**
 * 快速验证（无缓存）
 * @param {object} options - 验证选项
 * @returns {Promise<{passed: boolean, errors: [], warnings: []}>}
 */
async function validate(options = {}) {
  const opts = OptionsSchema.parse(options);

  // 实现验证逻辑...
  const errors = [];
  const warnings = [];

  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

// 元数据（用于工具发现）
validate.meta = {
  name: 'validate-quick',
  description: 'Fast SEED validation without cache',
  version: '1.0.0'
};

module.exports = validate;
module.exports.OptionsSchema = OptionsSchema;
```

**CLI 接口**（命令行包装）：

```javascript
#!/usr/bin/env node
// lib/cli/validate-quick.js
const validate = require('../validation/quick');
const { parseArgs } = require('node:util');

/**
 * CLI 入口
 */
async function main() {
  const { values, positionals } = parseArgs({
    options: {
      files: { type: 'string', multiple: true },
      fix: { type: 'boolean', default: false },
      silent: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: true
  });

  if (values.help) {
    console.log(`
Usage: validate-quick [options] [files...]

Options:
  --files <path>   Files to validate (multiple)
  --fix            Auto-fix issues
  --silent         Suppress output
  -h, --help       Show this help
    `);
    process.exit(0);
  }

  try {
    const result = await validate({
      files: values.files || positionals,
      fix: values.fix,
      silent: values.silent
    });

    if (!values.silent) {
      if (result.passed) {
        console.log('✅ Validation passed');
      } else {
        console.error('❌ Validation failed:');
        result.errors.forEach(err => console.error(`  - ${err}`));
      }
    }

    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
```

**分离优势**：
- ✅ 库函数可单独测试（无 CLI 依赖）
- ✅ 库函数可在其他代码中导入（可复用）
- ✅ CLI 逻辑简单（仅解析参数 + 调用库）
- ✅ 符合 Unix 哲学（Do One Thing Well）

**实现**：
- 库函数：`lib/validation/*.js`, `lib/cache/*.js`
- CLI 包装：`lib/cli/*.js`

---

### FR-004: 更新规格派生路径

**描述**：更新 `automation/git-hooks.fspec.md` 的派生产物路径

**变更**：

```diff
## 派生产物

| 类型 | 路径 | 说明 |
|------|------|------|
- | 脚本 | .seed/scripts/check-cache.js | 缓存检查 |
- | 脚本 | .seed/scripts/quick-defend.js | 快速检查 |
- | 脚本 | .seed/scripts/incremental-defend.js | 增量检查 |
- | 脚本 | .seed/scripts/update-cache.js | 更新缓存 |
+ | 库（验证） | skills/mob-seed/lib/validation/quick.js | 快速验证逻辑 |
+ | 库（验证） | skills/mob-seed/lib/validation/incremental.js | 增量验证逻辑 |
+ | 库（缓存） | skills/mob-seed/lib/cache/validator.js | 缓存验证 |
+ | 库（缓存） | skills/mob-seed/lib/cache/writer.js | 缓存更新 |
+ | CLI | skills/mob-seed/lib/cli/validate-quick.js | 快速验证 CLI |
+ | CLI | skills/mob-seed/lib/cli/validate-incremental.js | 增量验证 CLI |
+ | CLI | skills/mob-seed/lib/cli/validate-cache.js | 缓存验证 CLI |
+ | Hooks | skills/mob-seed/lib/hooks/pre-commit.js | pre-commit 逻辑 |
+ | Hooks | skills/mob-seed/lib/hooks/pre-push.js | pre-push 逻辑 |
```

**实现**：`openspec/specs/automation/git-hooks.fspec.md`

---

### FR-005: 更新命令文档示例

**描述**：更新 `commands/defend.md` 中所有脚本路径引用

**变更**：

```diff
### Git pre-commit hook

- node .seed/scripts/check-cache.js --files="$SPEC_FILES"
- node .seed/scripts/quick-defend.js --files="$SPEC_FILES"
+ # 方式 1: 通过命令（推荐，简单）
+ /mob-seed defend --quick
+
+ # 方式 2: 直接调用 CLI（高级，Git Hooks）
+ PLUGIN_PATH=$(claude which mob-seed)
+ node "$PLUGIN_PATH/lib/cli/validate-quick.js" --files="$STAGED_FILES"
+
+ # 方式 3: 导入库函数（高级，程序化）
+ const validate = require('mob-seed/lib/validation/quick');
+ const result = await validate({ files: ['lib/test.js'] });
```

**实现**：`commands/defend.md`

---

### FR-006: Git Hooks 三层回退策略（方案 F）

**描述**：更新 `.seed/hooks/pre-commit` 和 `.seed/hooks/pre-push`，采用三层回退策略，确保在各种环境下都能正常工作。

**受影响文件**：

| 文件 | 引用次数 | 修改行 |
|------|----------|--------|
| `.seed/hooks/pre-commit` | 8 处 | 44, 46, 53, 54 (旧路径全部替换) |
| `.seed/hooks/pre-push` | 4 处 | 54, 55, 63, 64 (旧路径全部替换) |

**三层回退策略**：

```
Layer 1: 用户配置优先（最高优先级）
  └─> 读取 .seed/config.json 的 hooks 字段
       ├─> 如果配置了自定义 Hook 命令，执行并返回
       └─> 否则继续 Layer 2

Layer 2: 命令调用（推荐方式）
  └─> 检查 /mob-seed 命令是否可用
       ├─> 可用：执行 /mob-seed defend --quick
       └─> 不可用：继续 Layer 3

Layer 3: 标准库路径（回退方案）
  └─> 查找 mob-seed 插件目录
       ├─> 尝试 $HOME/.claude/skills/mob-seed
       ├─> 尝试 ./skills/mob-seed
       └─> 执行 node $PLUGIN_DIR/lib/cli/validate-quick.js
```

**变更**：

```diff
### .seed/hooks/pre-commit

- # 检查缓存脚本是否存在
- if [ -f ".seed/scripts/check-cache.js" ]; then
-     if node .seed/scripts/check-cache.js --files="$SPEC_FILES"; then
-         echo -e "${GREEN}✅ 使用缓存结果（文件未变更）${NC}"
-         exit 0
-     fi
- fi
-
- # 快速同步检查
- if [ -f ".seed/scripts/quick-defend.js" ]; then
-     if ! node .seed/scripts/quick-defend.js --files="$SPEC_FILES"; then
-         echo -e "${RED}❌ SEED 检查失败${NC}"
-         exit 1
-     fi
- fi

+ #!/bin/bash
+ # SEED 快速检查（pre-commit）
+
+ # Layer 1: 用户配置优先
+ if [ -f ".seed/config.json" ]; then
+     HOOK_CMD=$(node -e "
+         try {
+             const cfg = require('./.seed/config.json');
+             const cmd = cfg.hooks?.preCommit;
+             if (cmd) console.log(cmd);
+         } catch(e) {}
+     " 2>/dev/null)
+
+     if [ -n "$HOOK_CMD" ]; then
+         $HOOK_CMD
+         exit $?
+     fi
+ fi
+
+ # Layer 2: 命令调用（推荐）
+ if command -v mob-seed >/dev/null 2>&1; then
+     mob-seed defend quick
+     exit $?
+ fi
+
+ # Layer 3: 标准库路径（回退）
+ PLUGIN_DIR="${HOME}/.claude/skills/mob-seed"
+ if [ ! -d "$PLUGIN_DIR" ]; then
+     PLUGIN_DIR="./skills/mob-seed"
+ fi
+
+ if [ -f "$PLUGIN_DIR/lib/cli/validate-quick.js" ]; then
+     node "$PLUGIN_DIR/lib/cli/validate-quick.js"
+     exit $?
+ fi
+
+ # 失败提示
+ echo "❌ 错误: 无法找到 mob-seed"
+ echo "请确保 mob-seed 已安装或检查 .seed/config.json"
+ exit 1
```

```diff
### .seed/hooks/pre-push

- # 增量检查（使用缓存）
- if [ -f ".seed/scripts/incremental-defend.js" ]; then
-     if ! node .seed/scripts/incremental-defend.js --files="$SPEC_FILES"; then
-         echo -e "${RED}❌ SEED 检查失败，推送被阻止${NC}"
-         exit 1
-     fi
- fi
-
- # 更新缓存
- if [ -f ".seed/scripts/update-cache.js" ]; then
-     node .seed/scripts/update-cache.js --files="$SPEC_FILES" 2>/dev/null || true
- fi

+ #!/bin/bash
+ # SEED 增量检查（pre-push）
+
+ # Layer 1: 用户配置优先
+ if [ -f ".seed/config.json" ]; then
+     HOOK_CMD=$(node -e "
+         try {
+             const cfg = require('./.seed/config.json');
+             const cmd = cfg.hooks?.prePush;
+             if (cmd) console.log(cmd);
+         } catch(e) {}
+     " 2>/dev/null)
+
+     if [ -n "$HOOK_CMD" ]; then
+         $HOOK_CMD
+         exit $?
+     fi
+ fi
+
+ # Layer 2: 命令调用（推荐）
+ if command -v mob-seed >/dev/null 2>&1; then
+     mob-seed defend incremental
+     exit $?
+ fi
+
+ # Layer 3: 标准库路径（回退）
+ PLUGIN_DIR="${HOME}/.claude/skills/mob-seed"
+ if [ ! -d "$PLUGIN_DIR" ]; then
+     PLUGIN_DIR="./skills/mob-seed"
+ fi
+
+ if [ -f "$PLUGIN_DIR/lib/cli/validate-incremental.js" ]; then
+     node "$PLUGIN_DIR/lib/cli/validate-incremental.js"
+     exit $?
+ fi
+
+ # 失败提示
+ echo "❌ 错误: 无法找到 mob-seed"
+ echo "请确保 mob-seed 已安装或检查 .seed/config.json"
+ exit 1
```

**配置示例**（用户可选）：

```json
// .seed/config.json
{
  "hooks": {
    "preCommit": "/mob-seed defend --quick --fix",
    "prePush": "/mob-seed defend --incremental"
  }
}
```

**优势**：
- ✅ 用户可自定义 Hook 命令（最高优先级）
- ✅ 命令优先（简单易用）
- ✅ 库路径回退（兼容性强）
- ✅ 明确错误提示（帮助用户调试）

**实现**：`.seed/hooks/pre-commit`, `.seed/hooks/pre-push`

---

### FR-007: 新增测试文件（方案 K + O - 按风险分级 + 优雅降级）

**描述**：为所有验证、缓存模块新增单元测试和集成测试，覆盖率目标按风险分级，错误处理采用优雅降级策略。

**新增文件（按风险分级）**：

| 文件 | 类型 | 风险等级 | 覆盖率目标 | 理由 |
|------|------|----------|-----------|------|
| `test/validation/quick.test.js` | 单元测试 | 🔴 High | **95%+** | 关键路径，commit 阻塞 |
| `test/validation/incremental.test.js` | 单元测试 | 🔴 High | **95%+** | 关键路径，push 阻塞 |
| `test/cache/validator.test.js` | 单元测试 | 🟡 Medium | **85%+** | 缓存失败可回退 |
| `test/cache/reader.test.js` | 单元测试 | 🟡 Medium | **85%+** | 读取失败可回退 |
| `test/cache/writer.test.js` | 单元测试 | 🟢 Low | **75%+** | 写入失败不影响主流程 |
| `test/cli/validate-quick.test.js` | 单元测试 | 🟡 Medium | **85%+** | CLI 逻辑简单 |
| `test/integration/validation-flow.test.sh` | 集成测试 | 🔴 High | **100%** | 端到端流程验证 |

**测试内容（库函数，类型安全）**：

```javascript
// test/validation/quick.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const validate = require('../../lib/validation/quick');

test('validate exports correct interface', () => {
  assert.strictEqual(typeof validate, 'function');
  assert.strictEqual(typeof validate.meta, 'object');
  assert.strictEqual(validate.meta.name, 'validate-quick');
  assert.strictEqual(typeof validate.OptionsSchema, 'object');
});

test('validate() with valid files', async () => {
  const result = await validate({ files: ['lib/test.js'] });
  assert.strictEqual(typeof result.passed, 'boolean');
  assert(Array.isArray(result.errors));
  assert(Array.isArray(result.warnings));
});

test('validate() validates options with Zod', async () => {
  await assert.rejects(
    () => validate({ files: 'not-an-array' }),
    /Expected array, received string/
  );
});
```

**测试内容（CLI 包装，使用 spawn）**：

```javascript
// test/cli/validate-quick.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const path = require('path');

const CLI_PATH = path.join(__dirname, '../../lib/cli/validate-quick.js');

function runCLI(args) {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args]);
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.on('close', (code) => resolve({ code, stdout }));
  });
}

test('CLI exits with 0 on success', async () => {
  const result = await runCLI(['--help']);
  assert.strictEqual(result.code, 0);
});

test('CLI shows help message', async () => {
  const result = await runCLI(['--help']);
  assert(result.stdout.includes('Usage:'));
});
```

**测试内容（错误处理，优雅降级）**：

```javascript
// test/cache/validator.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const validator = require('../../lib/cache/validator');

test('cache failure degrades gracefully', async () => {
  // 模拟缓存读取失败
  const result = await validator.validate({
    cacheCorrupted: true
  });

  // 应该记录警告但不失败
  assert.strictEqual(result.degraded, true);
  assert.strictEqual(result.fallbackUsed, 'full-validation');
  assert(result.warnings.includes('Cache unavailable'));
});

test('cache validator uses layered exit codes', async () => {
  // 0 = success, 1 = validation fail, 2 = system error
  const codes = {
    success: 0,
    validationFail: 1,
    systemError: 2,
    configError: 3
  };

  assert.strictEqual(validator.ExitCode.SUCCESS, 0);
  assert.strictEqual(validator.ExitCode.VALIDATION_FAILED, 1);
  assert.strictEqual(validator.ExitCode.SYSTEM_ERROR, 2);
});
```

**实现**：`skills/mob-seed/test/` 多个子目录

---

## 验收标准 (AC)

### AC-001: 文件移动并分层完成

**场景**：

```
Given: .seed/scripts/ 中有 4 个脚本
When: 执行重构
Then: 所有脚本按功能分层移动到 skills/mob-seed/lib/
  AND 文件名遵循统一命名规范（动词-对象）
  AND 库函数与 CLI 入口分离
  AND .seed/scripts/ 被清空（或只留 mob-seed 专用脚本）
```

**验证**：

```bash
# 检查新目录结构
tree skills/mob-seed/lib/
# 期望输出：
# lib/
# ├── validation/
# │   ├── quick.js
# │   ├── incremental.js
# │   └── full.js
# ├── cache/
# │   ├── validator.js
# │   ├── reader.js
# │   └── writer.js
# ├── hooks/
# │   ├── pre-commit.js
# │   └── pre-push.js
# └── cli/
#     ├── validate-quick.js
#     ├── validate-incremental.js
#     └── validate-cache.js

# 检查旧位置（mob-seed 项目）
ls .seed/scripts/
# 应为空或只有 mob-seed 专用脚本

# 验证命名规范
ls skills/mob-seed/lib/cli/ | grep -E "^validate-"
# 期望全部匹配（统一 validate- 前缀）
```

---

### AC-002: 命令选项可用

**场景**：

```
Given: 用户项目已初始化 mob-seed
When: 运行 /mob-seed defend --quick
Then: 调用 lib/validation/quick.js
  AND 返回检查结果
  AND 不报错"文件不存在"
```

**验证**：

```bash
cd ~/test-project
/mob-seed defend --quick
# 期望输出: ✅ Validation passed 或具体错误
```

---

### AC-003: 三种调用方式都可用

**场景 1：命令调用（推荐）**：

```
Given: mob-seed 命令已安装
When: 运行 /mob-seed defend --quick
Then: 执行快速验证
  AND 返回 exit code（0=通过，1=失败）
```

**场景 2：CLI 直接调用（Git Hooks）**：

```
Given: mob-seed 库已安装
When: 调用 node $PLUGIN_PATH/lib/cli/validate-quick.js
Then: 执行检查
  AND 返回分层 exit code（0/1/2/3）
```

**场景 3：库函数导入（程序化）**：

```
Given: Node.js 程序需要验证
When: const validate = require('mob-seed/lib/validation/quick'); await validate({...})
Then: 返回结构化结果 {passed, errors, warnings}
  AND 可在程序中进一步处理
```

**验证**：

```bash
# 方式 1: 命令
/mob-seed defend --quick
echo $?  # 期望: 0 或 1

# 方式 2: CLI 直接调用
PLUGIN_PATH=$(claude which mob-seed)
node "$PLUGIN_PATH/lib/cli/validate-quick.js" --files="lib/test.js"
echo $?  # 期望: 0/1/2/3（分层错误码）

# 方式 3: 库函数导入
node -e "
  const validate = require('mob-seed/lib/validation/quick');
  validate({ files: ['lib/test.js'] }).then(result => {
    console.log('Passed:', result.passed);
    console.log('Errors:', result.errors.length);
    process.exit(result.passed ? 0 : 1);
  });
"
echo $?  # 期望: 0 或 1
```

---

### AC-004: 规格派生路径正确

**场景**：

```
Given: automation/git-hooks.fspec.md 已更新
When: 运行 /mob-seed emit
Then: 派生到 skills/mob-seed/lib/hooks/
  AND 不派生到 .seed/scripts/
```

**验证**：

```bash
grep "派生产物" openspec/specs/automation/git-hooks.fspec.md
# 期望包含: skills/mob-seed/lib/hooks/
# 不应包含: .seed/scripts/
```

---

### AC-005: 文档示例更新

**场景**：

```
Given: commands/defend.md 已更新
When: 用户阅读文档
Then: 所有示例使用新路径
  AND 不包含 .seed/scripts/ 引用
  AND 提供两种调用方式（命令 + 直接库）
```

**验证**：

```bash
grep -n ".seed/scripts" commands/defend.md
# 期望无输出（或只在"已废弃"章节）
```

---

### AC-006: 向后兼容提示

**场景**：

```
Given: 用户项目使用旧路径
When: 执行 Git Hook 调用 .seed/scripts/xxx.js
Then: 提示错误并引导用户更新
```

**可选实现**（友好提示）：

```javascript
// lib/hooks/compatibility-check.js
if (process.env.USING_OLD_PATH) {
  console.error(`
❌ 错误: .seed/scripts/ 路径已废弃（v3.3+）

请更新 Git Hook：
  旧: node .seed/scripts/quick-defend.js
  新: /mob-seed defend --quick

或直接调用库:
  node $(claude which mob-seed)/lib/hooks/quick-defender.js
  `);
  process.exit(1);
}
```

---

### AC-007: Git Hooks 正常工作

**场景**：

```
Given: Git Hooks 已更新为新路径
When: 用户执行 git commit 或 git push
Then: 自动触发相应的 SEED 检查
  AND 使用正确的库路径
  AND 检查结果准确
```

**验证**：

```bash
# 测试 pre-commit hook
cd ~/test-project
echo "test" >> lib/test.js
git add lib/test.js
git commit -m "test"
# 期望: 自动触发 /mob-seed defend --quick 或直接调用 lib/hooks/quick-defender.js

# 测试 pre-push hook
git push origin main
# 期望: 自动触发 /mob-seed defend --incremental 或直接调用 lib/hooks/incremental-defender.js
```

**检查点**：

- [ ] pre-commit 触发快速检查
- [ ] pre-push 触发增量检查
- [ ] 检查失败时正确阻止操作
- [ ] 检查通过时允许操作继续

---

### AC-008: 测试通过

**场景**：

```
Given: 所有 hook 脚本已实现
When: 运行测试套件
Then: 所有单元测试通过
  AND 所有集成测试通过
  AND 测试覆盖率 > 90%
```

**验证**：

```bash
# 运行所有 hook 测试
cd skills/mob-seed
node --test test/hooks/*.test.js

# 期望输出示例:
# ✔ cache-checker exports correct interface
# ✔ cache-checker.run() with valid cache
# ✔ cache-checker.run() with invalid cache
# ✔ quick-defender exports correct interface
# ✔ quick-defender.run() with valid files
# ✔ quick-defender.run() with invalid files
# ...
#
# tests 32
# pass  32

# 运行集成测试
bash test/integration/hooks-integration.test.sh

# 期望输出:
# ✔ Command invocation test passed
# ✔ Direct library invocation test passed
# ✔ Git hooks integration test passed
```

**检查点**：

- [ ] cache-checker.test.js 全部通过
- [ ] quick-defender.test.js 全部通过
- [ ] incremental-defender.test.js 全部通过
- [ ] cache-updater.test.js 全部通过
- [ ] hooks-integration.test.sh 全部通过
- [ ] 代码覆盖率报告显示 > 90%

---

## 技术设计

### 目录结构（分层架构）

```
skills/mob-seed/lib/
├── validation/                   # 验证逻辑（纯函数）
│   ├── quick.js                  # 快速验证（从 .seed/scripts/quick-defend.js 重构）
│   ├── incremental.js            # 增量验证（从 .seed/scripts/incremental-defend.js 重构）
│   ├── full.js                   # 完整验证（新增）
│   └── validators/               # 验证器
│       ├── spec-sync.js          # 规格同步验证
│       └── code-sync.js          # 代码同步验证
├── cache/                        # 缓存管理
│   ├── validator.js              # 缓存验证（从 .seed/scripts/check-cache.js 重构）
│   ├── reader.js                 # 缓存读取（从 check-cache.js 拆分）
│   └── writer.js                 # 缓存写入（从 .seed/scripts/update-cache.js 重构）
├── hooks/                        # Git Hooks 逻辑
│   ├── pre-commit.js             # pre-commit 编排逻辑
│   └── pre-push.js               # pre-push 编排逻辑
└── cli/                          # CLI 入口（命令行包装）
    ├── validate-quick.js         # 快速验证 CLI
    ├── validate-incremental.js   # 增量验证 CLI
    └── validate-cache.js         # 缓存验证 CLI
```

### 模块接口（库与 CLI 分离）

**库函数接口**（validation/, cache/）：

```javascript
// lib/validation/quick.js
const { z } = require('zod');

/**
 * 选项 Schema（类型安全）
 */
const OptionsSchema = z.object({
  files: z.array(z.string()).optional(),
  fix: z.boolean().default(false),
  silent: z.boolean().default(false)
});

/**
 * 快速验证（无缓存）
 * @param {object} options - 验证选项
 * @returns {Promise<{passed: boolean, errors: [], warnings: []}>}
 */
async function validate(options = {}) {
  const opts = OptionsSchema.parse(options);

  // 验证逻辑...
  const errors = [];
  const warnings = [];

  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

// 元数据（用于工具发现）
validate.meta = {
  name: 'validate-quick',
  description: 'Fast SEED validation without cache',
  version: '1.0.0'
};

module.exports = validate;
module.exports.OptionsSchema = OptionsSchema;
```

**CLI 接口**（cli/）：

```javascript
#!/usr/bin/env node
// lib/cli/validate-quick.js
const validate = require('../validation/quick');
const { parseArgs } = require('node:util');

/**
 * 分层 Exit Code（方案 O）
 */
const ExitCode = {
  SUCCESS: 0,
  VALIDATION_FAILED: 1,
  SYSTEM_ERROR: 2,
  CONFIG_ERROR: 3,
  TIMEOUT: 124,
  INTERRUPTED: 130
};

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      files: { type: 'string', multiple: true },
      fix: { type: 'boolean', default: false },
      silent: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: true
  });

  if (values.help) {
    console.log('Usage: validate-quick [options] [files...]');
    process.exit(ExitCode.SUCCESS);
  }

  try {
    const result = await validate({
      files: values.files || positionals,
      fix: values.fix,
      silent: values.silent
    });

    if (!values.silent) {
      if (result.passed) {
        console.log('✅ Validation passed');
      } else {
        console.error('❌ Validation failed:');
        result.errors.forEach(err => console.error(`  - ${err}`));
      }
    }

    process.exit(result.passed ? ExitCode.SUCCESS : ExitCode.VALIDATION_FAILED);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(ExitCode.SYSTEM_ERROR);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
module.exports.ExitCode = ExitCode;
```

### 命令集成

在 `commands/defend.md` 中集成：

```javascript
// 解析选项并调用库函数
if (options.quick) {
  const validate = require('../lib/validation/quick');
  result = await validate({ files, fix: options.fix });
}

if (options.incremental) {
  const validate = require('../lib/validation/incremental');
  result = await validate({ files, fix: options.fix });
}

if (options.cached) {
  const validateCache = require('../lib/cache/validator');
  result = await validateCache({ files });
}
```

---

## 测试策略

### 单元测试

```javascript
// test/hooks/quick-defender.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const quickDefender = require('../../lib/hooks/quick-defender');

test('quick-defender exports correct interface', () => {
  assert.strictEqual(typeof quickDefender.name, 'string');
  assert.strictEqual(typeof quickDefender.run, 'function');
  assert.strictEqual(typeof quickDefender.cli, 'function');
});

test('quick-defender.run() with valid files', async () => {
  const result = await quickDefender.run(['lib/test.js'], {});
  assert.strictEqual(typeof result.passed, 'boolean');
  assert(Array.isArray(result.errors));
});
```

### 集成测试

```bash
# test/integration/validation-flow.test.sh

# 测试 Layer 1: 命令调用
/mob-seed defend --quick
assert_exit_code $? 0

# 测试 Layer 2: CLI 直接调用
PLUGIN_PATH=$(claude which mob-seed)
node "$PLUGIN_PATH/lib/cli/validate-quick.js" --files="lib/test.js"
assert_exit_code $? 0

# 测试 Layer 3: 库函数导入
node -e "
  const validate = require('$PLUGIN_PATH/lib/validation/quick');
  validate({ files: ['lib/test.js'] }).then(r => {
    process.exit(r.passed ? 0 : 1);
  });
"
assert_exit_code $? 0

# 测试优雅降级
node -e "
  const validator = require('$PLUGIN_PATH/lib/cache/validator');
  validator.validate({ cacheCorrupted: true }).then(r => {
    console.log('Degraded:', r.degraded);
    console.log('Fallback:', r.fallbackUsed);
    process.exit(r.degraded ? 0 : 1);
  });
"
assert_exit_code $? 0
```

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 旧路径引用遗漏 | 用户报错 | 全局搜索 `.seed/scripts` 确保清理 |
| Git Hooks 失效 | 提交阻塞失败 | 提供迁移脚本自动更新 Hooks |
| 文件名不一致 | 混淆用户 | 统一命名规范并文档化 |
| 向后兼容性 | 旧项目无法使用 | 提供友好错误提示 |

---

## 迁移指南（用户）

### 用户项目迁移步骤

如果用户项目已经使用旧路径（不太可能，因为本来就没用）：

1. **更新 Git Hooks**：

```bash
# 旧的 .git/hooks/pre-commit
node .seed/scripts/quick-defend.js --files="$STAGED_FILES"

# 新的 .git/hooks/pre-commit
/mob-seed defend --quick
```

2. **更新自定义脚本**（如果有）：

```bash
# 如果用户自己写了脚本调用 .seed/scripts/
# 改为调用技能库
PLUGIN_PATH=$(claude which mob-seed)
node "$PLUGIN_PATH/lib/hooks/quick-defender.js"
```

3. **清理旧文件**（可选）：

```bash
# 如果用户项目有 .seed/scripts/（不应该有）
rm -rf .seed/scripts/
```

---

## 成功标准

### 核心功能（分层架构）
- [ ] 所有脚本按功能分层移动到 `lib/validation/`, `lib/cache/`, `lib/hooks/`, `lib/cli/`
- [ ] 文件名遵循统一命名规范（动词-对象：validate-quick, validate-incremental）
- [ ] 库函数与 CLI 入口完全分离
- [ ] `/mob-seed defend --quick/--incremental/--cached` 可用
- [ ] 三种调用方式都可用：命令、CLI 直接调用、库函数导入

### Git Hooks（三层回退策略）
- [ ] `.seed/hooks/pre-commit` 采用三层回退策略（配置 → 命令 → 库）
- [ ] `.seed/hooks/pre-push` 采用三层回退策略（配置 → 命令 → 库）
- [ ] 用户配置字段 `.seed/config.json` 的 `hooks.preCommit/prePush` 工作正常
- [ ] Git Hooks 自动触发检查（commit/push）
- [ ] 检查失败时正确阻止操作

### 文档和规格
- [ ] `automation/git-hooks.fspec.md` 派生路径更新为分层结构
- [ ] `commands/defend.md` 文档更新为三种调用方式（5 处引用）
- [ ] 全局搜索无 `.seed/scripts/` 引用（除归档/CHANGELOG）
- [ ] 用户迁移指南完整（包含三种调用方式）

### 测试（按风险分级）
- [ ] 🔴 High Risk: validation/quick.js ≥ 95% 覆盖率
- [ ] 🔴 High Risk: validation/incremental.js ≥ 95% 覆盖率
- [ ] 🟡 Medium Risk: cache/validator.js ≥ 85% 覆盖率
- [ ] 🟡 Medium Risk: cache/reader.js ≥ 85% 覆盖率
- [ ] 🟢 Low Risk: cache/writer.js ≥ 75% 覆盖率
- [ ] 🟡 Medium Risk: cli/*.js ≥ 85% 覆盖率
- [ ] 集成测试通过（命令 + CLI + 库函数 + 优雅降级）

### 用户验证
- [ ] 用户项目（mars-nexus）验证三种调用方式可用
- [ ] 版本化废弃策略实施（v3.3 → v3.4 → v4.0）
- [ ] 无破坏性影响（v3.3 自动转发兼容）
