# 架构迁移方案最佳实践审查

> 审查所有架构迁移决策，确保符合最佳实践和安全标准

## 决策点清单

| # | 决策点 | 当前方案 | 最佳实践分析 | 优先级 |
|---|--------|----------|------------|--------|
| 1 | Git Hooks 调用方式 | 方案 A + B 回退 | ✅ 已审查 | 🔴 P0 |
| 2 | 文件重命名规范 | 动词-名词 | ✅ 已审查 | 🔴 P0 |
| 3 | 模块导出接口 | 标准化接口 | ✅ 已审查 | 🔴 P0 |
| 4 | 过渡期策略 | 7 天兼容提示 | ✅ 已审查 | 🟡 P1 |
| 5 | 测试覆盖率目标 | 90% | ✅ 已审查 | 🟡 P1 |
| 6 | 目录结构 | lib/hooks/ | ✅ 已审查 | 🔴 P0 |
| 7 | 命令选项设计 | --quick/--incremental | ✅ 已审查 | 🟢 P2 |
| 8 | 错误处理策略 | exit code 0/1 | ✅ 已审查 | 🟡 P1 |

---

## 决策 1: Git Hooks 调用方式 ⭐

### 当前方案

```bash
# 方案 A: 通过命令（推荐）
if command -v /mob-seed >/dev/null 2>&1; then
    /mob-seed defend --quick
# 方案 B: 直接调用库（回退）
else
    PLUGIN_PATH=$(claude which mob-seed 2>/dev/null || echo "skills/mob-seed")
    node "$PLUGIN_PATH/lib/hooks/quick-defender.js" --files="$SPEC_FILES"
fi
```

### 最佳实践分析

#### ❌ 问题
1. **复杂度**: Git Hook 代码从 4 行 → 10+ 行
2. **维护成本**: 两套路径都要测试
3. **路径假设**: `claude which` 依赖特定环境

### 🎯 最佳实践建议

**推荐: 方案 F（配置优先 + 标准路径回退）**

```bash
#!/bin/bash
# .seed/hooks/pre-commit

set -e

# 1. 优先读取用户配置
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

# 2. 回退到命令调用
if command -v mob-seed >/dev/null 2>&1; then
    mob-seed defend quick
    exit $?
fi

# 3. 回退到标准插件路径
PLUGIN_DIR="${HOME}/.claude/skills/mob-seed"
if [ -f "$PLUGIN_DIR/lib/cli/validate-quick.js" ]; then
    node "$PLUGIN_DIR/lib/cli/validate-quick.js"
    exit $?
fi

# 4. 失败提示
echo "❌ 错误: 无法找到 mob-seed"
echo "请运行: claude plugins install mob-seed"
exit 1
```

**配置示例** (`.seed/config.json`):
```json
{
  "hooks": {
    "preCommit": "mob-seed defend quick",
    "prePush": "mob-seed defend incremental"
  }
}
```

**优势**:
- ✅ 用户可自定义命令
- ✅ 标准路径 `~/.claude/skills/` 明确
- ✅ 三层回退确保鲁棒性

---

## 决策 2: 文件重命名规范 ⭐

### 当前方案

| 旧名称 | 新名称 | 问题 |
|--------|--------|------|
| check-cache.js | cache-checker.js | 名词-动词er |
| quick-defend.js | quick-defender.js | 形容词-名词 |
| incremental-defend.js | incremental-defender.js | 形容词-名词 |
| update-cache.js | cache-updater.js | 名词-动词er |

### ❌ 问题
- 不一致: 混合三种模式
- 冗余: `-er` 后缀不必要

### 🎯 最佳实践建议

**推荐: 方案 H（统一动词-对象模式）**

| 旧名称 | 新名称 | 模式 | 说明 |
|--------|--------|------|------|
| check-cache.js | **validate-cache.js** | 动词-名词 | 验证缓存 |
| quick-defend.js | **validate-quick.js** | 动词-副词 | 快速验证 |
| incremental-defend.js | **validate-incremental.js** | 动词-副词 | 增量验证 |
| update-cache.js | **update-cache.js** | 动词-名词 | 保持不变 ✅ |

**理由**:
1. **一致性**: 所有文件都是"动词-修饰词"
2. **Unix 惯例**: grep, sed, awk 都是动词命名
3. **清晰性**: 文件名即动作

---

## 决策 3: 模块导出接口 ⭐

### 当前方案

```javascript
module.exports = {
  name: string,
  description: string,
  async run(files, options),
  async cli(args)
};
```

### ❌ 问题
1. **职责混淆**: 一个模块同时是库和 CLI
2. **参数不统一**: run(files, options) vs cli(args)
3. **缺少验证**: 没有参数 schema

### 🎯 最佳实践建议

**推荐: 方案 I（分离库和 CLI）**

#### 库接口 (`lib/validation/quick.js`):
```javascript
/**
 * 快速验证 SEED 规格同步
 * @module validation/quick
 */

const { z } = require('zod');

const OptionsSchema = z.object({
  files: z.array(z.string()).optional(),
  fix: z.boolean().default(false),
  silent: z.boolean().default(false)
});

/**
 * 执行快速验证
 * @param {object} options - 验证选项
 * @returns {Promise<Result>}
 */
async function validate(options = {}) {
  const opts = OptionsSchema.parse(options);

  // 实现...

  return {
    passed: true,
    errors: [],
    warnings: []
  };
}

validate.meta = {
  name: 'validate-quick',
  description: 'Fast SEED validation without cache',
  version: '1.0.0'
};

module.exports = validate;
module.exports.OptionsSchema = OptionsSchema;
```

#### CLI 接口 (`lib/cli/validate-quick.js`):
```javascript
#!/usr/bin/env node
/**
 * CLI wrapper for validate-quick
 */

const validate = require('../validation/quick');
const { parseArgs } = require('node:util');

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
  --files <files...>  Files to validate
  --fix               Auto-fix issues
  --silent            Suppress output
  -h, --help          Show help
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
        console.error('❌ Validation failed');
        result.errors.forEach(err => {
          console.error(`  ${err.file}:${err.line || '?'} - ${err.message}`);
        });
      }
    }

    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
```

**优势**:
- ✅ 单一职责: 库专注逻辑，CLI 专注交互
- ✅ 可测试性: 库函数纯粹
- ✅ 参数验证: 使用 zod 类型安全
- ✅ 标准化: 使用 Node.js 原生 parseArgs

---

## 决策 4: 过渡期策略

### 当前方案

7 天过渡期，旧路径保留兼容性提示

### ❌ 问题
- 时间武断（为什么是 7 天？）
- 突然失效会中断用户工作流

### 🎯 最佳实践建议

**推荐: 方案 J（版本化弃用策略）**

```
v3.3.0 (当前):  旧路径 → 警告 + 自动转发（完全兼容）
v3.4.0 (+3个月): 旧路径 → 错误提示（破坏性变更）
v4.0.0 (+6个月): 移除旧路径代码（清理）
```

**兼容包装器** (`.seed/scripts/quick-defend.js`):
```javascript
#!/usr/bin/env node
/**
 * 兼容性包装器 - v3.3.0 弃用，v3.4.0 移除
 */

const path = require('path');
const { spawn } = require('child_process');

console.warn(`
⚠️  警告: .seed/scripts/quick-defend.js 已在 v3.3.0 弃用

此路径将在 v3.4.0 (约 3 个月后) 移除。

请更新为:
  mob-seed defend quick

或直接调用:
  node ~/.claude/skills/mob-seed/lib/cli/validate-quick.js

正在自动转发...
`);

// 安全转发（使用 spawn 避免注入）
const newPath = path.join(
  process.env.HOME,
  '.claude/skills/mob-seed/lib/cli/validate-quick.js'
);

const child = spawn('node', [newPath, ...process.argv.slice(2)], {
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('转发失败:', err.message);
  process.exit(2);
});
```

**优势**:
- ✅ 语义化版本: 遵循 SemVer
- ✅ 平滑过渡: 3 个月缓冲
- ✅ 自动转发: 不中断工作流
- ✅ 安全: 使用 spawn 避免命令注入

---

## 决策 5: 测试覆盖率目标

### 当前方案

所有模块统一 90% 覆盖率

### ❌ 问题
- 一刀切，忽略模块风险差异
- 高覆盖率 ≠ 高质量

### 🎯 最佳实践建议

**推荐: 方案 K（基于风险的策略）**

| 模块 | 风险等级 | 覆盖率目标 | 原因 |
|------|----------|------------|------|
| validate-quick | 🔴 高 | 95%+ | 阻断提交 |
| validate-incremental | 🔴 高 | 95%+ | 阻断推送 |
| validate-cache | 🟡 中 | 85%+ | 失败可降级 |
| update-cache | 🟢 低 | 75%+ | 辅助功能 |

**额外要求**:
- 🔴 关键路径 100%: 错误处理、边界条件
- 🟡 集成测试: E2E 真实场景
- 🟢 变更覆盖: PR 必须增加测试

**测试金字塔**:
```
        E2E (10%)
       /         \
    Integration (30%)
   /                 \
  Unit (60%)
```

---

## 决策 6: 目录结构 ⭐

### 当前方案

```
skills/mob-seed/lib/hooks/
├── cache-checker.js
├── quick-defender.js
├── incremental-defender.js
└── cache-updater.js
```

### ❌ 问题
- 扁平化，缺乏分组
- 扩展性差

### 🎯 最佳实践建议

**推荐: 方案 L（按功能分层）**

```
skills/mob-seed/lib/
├── validation/              # 验证逻辑
│   ├── quick.js            # 快速验证
│   ├── incremental.js      # 增量验证
│   ├── full.js             # 完整验证
│   └── validators/         # 可扩展验证器
│       ├── spec-sync.js
│       └── code-sync.js
│
├── cache/                   # 缓存管理
│   ├── reader.js
│   ├── writer.js
│   └── validator.js
│
├── hooks/                   # Git Hooks 逻辑
│   ├── pre-commit.js
│   └── pre-push.js
│
└── cli/                     # CLI 入口
    ├── validate-quick.js
    ├── validate-incremental.js
    └── validate-cache.js
```

**优势**:
- ✅ 关注点分离
- ✅ 扩展性好
- ✅ 测试镜像结构

---

## 决策 7: 命令选项设计

### 当前方案

```bash
/mob-seed defend --quick
/mob-seed defend --incremental
/mob-seed defend --cached
```

### ❌ 问题
- 选项互斥但未强制
- 无默认行为

### 🎯 最佳实践建议

**推荐: 方案 N（子命令模式）**

```bash
/mob-seed defend quick                # 快速检查
/mob-seed defend incremental          # 增量检查
/mob-seed defend full                 # 完整检查
/mob-seed defend                      # 默认=full

# 选项可组合
/mob-seed defend incremental --cache  # 增量+缓存
/mob-seed defend quick --fix          # 快速+修复
```

**优势**:
- ✅ Git 风格: 符合 `git commit` 惯例
- ✅ 清晰性: 模式是位置参数
- ✅ 扩展性: 易于添加 `watch`, `ci` 等

---

## 决策 8: 错误处理策略

### 当前方案

```javascript
process.exit(result.passed ? 0 : 1);
```

### ❌ 问题
- 只有 0/1，无法区分错误类型
- 缺少降级和重试

### 🎯 最佳实践建议

**推荐: 方案 O（分层错误码 + 降级）**

```javascript
/**
 * Exit codes (遵循 Linux 标准)
 */
const ExitCode = {
  SUCCESS: 0,                    // 检查通过
  VALIDATION_FAILED: 1,          // 验证失败
  SYSTEM_ERROR: 2,               // 系统错误
  CONFIG_ERROR: 3,               // 配置错误
  TIMEOUT: 124,                  // 超时
  INTERRUPTED: 130               // 用户中断
};

/**
 * 错误降级策略
 */
async function validate(options) {
  // 1. 尝试缓存
  try {
    const cached = await cache.read();
    if (cached?.valid) {
      return { passed: true, source: 'cache' };
    }
  } catch (error) {
    // 缓存失败 → 降级到完整检查
    console.warn('⚠️  Cache failed, using full validation');
  }

  // 2. 完整验证
  try {
    const result = await fullValidation(options);

    // 3. 更新缓存（失败不影响主流程）
    cache.write(result).catch(err => {
      console.warn('⚠️  Cache write failed:', err.message);
    });

    return result;

  } catch (error) {
    // 区分错误类型
    if (error.code === 'ENOENT') {
      throw new ConfigError('Config file not found');
    }
    throw new SystemError(error.message);
  }
}

/**
 * 自定义错误类
 */
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.exitCode = ExitCode.VALIDATION_FAILED;
  }
}

class SystemError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SystemError';
    this.exitCode = ExitCode.SYSTEM_ERROR;
  }
}

class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
    this.exitCode = ExitCode.CONFIG_ERROR;
  }
}

// 全局错误处理
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught error:', error.message);
  process.exit(error.exitCode || ExitCode.SYSTEM_ERROR);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  Interrupted');
  process.exit(ExitCode.INTERRUPTED);
});
```

**优势**:
- ✅ 语义化 exit code
- ✅ 降级策略保证可用性
- ✅ 兼容 Linux 标准

---

## 综合建议摘要

| 决策点 | 当前方案 | 最佳实践方案 | 采纳 | 优先级 |
|--------|----------|------------|------|--------|
| 1. Git Hooks 调用 | A + B 回退 | **方案 F: 配置优先 + 标准路径** | ✅ | 🔴 P0 |
| 2. 文件命名 | 动词-名词 | **方案 H: 统一动词-对象** | ✅ | 🔴 P0 |
| 3. 模块接口 | 混合接口 | **方案 I: 分离库和 CLI** | ✅ | 🔴 P0 |
| 4. 过渡期 | 7 天 | **方案 J: 版本化弃用（3 个月）** | ✅ | 🟡 P1 |
| 5. 测试覆盖率 | 90% | **方案 K: 基于风险的策略** | ✅ | 🟡 P1 |
| 6. 目录结构 | 扁平 hooks/ | **方案 L: 按功能分层** | ✅ | 🔴 P0 |
| 7. 命令选项 | --quick | **方案 N: 子命令模式** | ✅ | 🟢 P2 |
| 8. 错误处理 | 0/1 | **方案 O: 分层错误码** | ✅ | 🟡 P1 |

---

## 实施路径

### Phase 0: 架构决策（立即）

**必须先决定**:
1. ✅ 目录结构（方案 L）- 影响所有文件组织
2. ✅ 文件命名（方案 H）- 影响模块引用
3. ✅ 模块接口（方案 I）- 影响 API 设计

**输出**: 更新 architecture-refactor.fspec.md

### Phase 1: 核心实现（本次迭代）

4. ✅ Git Hooks 调用（方案 F）
5. ✅ 错误处理（方案 O）
6. ✅ 过渡期策略（方案 J）

**输出**: 可工作的迁移版本

### Phase 2: 优化（后续迭代）

7. ⏸️ 命令选项（方案 N）- 向后兼容，可渐进
8. ⏸️ 测试策略（方案 K）- 持续改进

---

## 安全检查清单

- [x] 避免 exec()，使用 spawn/execFile
- [x] 路径拼接使用 path.join
- [x] 用户输入验证（zod schema）
- [x] 错误码标准化
- [x] 信号处理（SIGINT）

---

## 下一步行动

1. [ ] 更新 `architecture-refactor.fspec.md` 采用最佳实践
2. [ ] 更新 `impact-analysis.md` 反映新目录结构
3. [ ] 创建 ADR (Architecture Decision Record) 文档
4. [ ] 获得用户确认后开始实施
