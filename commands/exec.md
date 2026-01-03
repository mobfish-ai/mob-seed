---
name: mob-seed:exec
description: SEED E阶段 - 自动执行派生的代码和测试
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
argument-hint: <spec-path> [--test] [--build] [--all] [--watch] [--ci]
---

# mob-seed:exec

执行内容：$ARGUMENTS

## 📦 依赖资源

- 技能目录: `.claude/skills/mob-seed/`
- 执行提示: `prompts/exec-runner.md`
- CI 配置: `prompts/exec-ci.md`
- 执行脚本: `scripts/exec-runner.js`
- **项目配置**: `.seed/config.json`（由 `/mob-seed:init` 生成）

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
| `--test` | 只执行测试 | - |
| `--build` | 只执行构建 | - |
| `--all` | 执行全部（测试+构建+检查）| 默认 |
| `--watch` | 监听模式 | - |
| `--ci` | CI 模式（严格检查）| - |

### 步骤2: 查找派生产物

根据规格文件查找已派生的代码和测试：

```
output/mob-seed/seed-manifest.json  # 派生清单
├── code → src/{module}/index.js
├── test → test/{module}/index.test.js
└── docs → docs/{module}/index.md
```

### 步骤3: 执行测试（--test 或 --all）

1. 检查测试文件是否存在
2. 运行 `node --test` 执行测试
3. 收集测试结果
4. 生成测试报告

### 步骤4: 执行构建（--build 或 --all）

1. 检查代码文件语法
2. 运行类型检查（如有 TypeScript）
3. 运行 lint 检查
4. 生成构建报告

### 步骤5: CI 模式（--ci）

CI 模式下的额外检查：

- 测试覆盖率阈值检查
- 代码风格强制检查
- 提交信息格式检查
- 生成 CI 报告（JSON 格式）

### 步骤6: 输出执行报告

```
output/mob-seed/
├── exec-report-{timestamp}.json   # 详细报告
└── exec-summary-{timestamp}.md    # 可读摘要
```

## 输出格式

### 执行摘要

```markdown
# 执行报告: {模块名}

## 测试结果
- ✅ 通过: 10
- ❌ 失败: 0
- ⏭️ 跳过: 2

## 构建结果
- ✅ 语法检查: 通过
- ✅ 类型检查: 通过
- ⚠️ Lint: 3 警告

## 覆盖率
- 行覆盖: 85%
- 分支覆盖: 78%
```

### 步骤7: ACE 观察收集（自动）

> **ACE 自演化机制**：此步骤自动执行，无需用户干预。

根据执行结果自动收集观察：

```javascript
// 调用 ACE 收集器
const aceResult = collectFromExecute({
  testResult: testReport,
  coverageGaps: coverageReport.gaps,
  buildErrors: buildReport.errors
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
| 测试失败 | test_failure | 记录失败模式、堆栈 |
| 覆盖率缺口 | coverage_gap | 记录未覆盖的代码路径 |
| 构建错误 | build_error | 记录编译/类型错误 |

**输出位置**：`.seed/observations/obs-{YYYYMMDD}-{slug}.md`（YAML frontmatter + Markdown 格式）

## 示例用法

```bash
# 执行全部检查
/mob-seed:exec specs/user-auth.fspec.md

# 只执行测试
/mob-seed:exec specs/user-auth.fspec.md --test

# CI 模式
/mob-seed:exec specs/user-auth.fspec.md --ci

# 监听模式（开发时使用）
/mob-seed:exec specs/user-auth.fspec.md --watch
```
