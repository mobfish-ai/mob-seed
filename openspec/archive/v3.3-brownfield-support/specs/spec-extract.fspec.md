---
status: archived
archived: 2026-01-03
created: 2026-01-03
updated: 2026-01-03
architecture_decisions_completed: true
---

# spec-extract - 从代码提取规格

## 概述 (Overview)

从已有代码（brownfield projects）反向生成 OpenSpec 规格文件，支持单文件和批量处理。

**核心能力**：
- AST 精确解析（避免正则误匹配）
- 从 JSDoc 提取概述和类结构
- 从测试文件提取 AC 候选
- 生成规格模板（draft 状态）
- 明确标注需要人工审核的部分

**适用场景**：
- 为已有项目（如 mars-nexus）建立规格库
- 代码先行开发后补规格
- 遗留代码规格化

---

## 架构决策检查清单 (Architecture Decisions)

> **重要**: 所有架构决策已完成。以下记录了关键决策和理由。

### 1. 目录结构设计

**决策点**: 新增代码应该放在哪个目录？

- [x] 按功能分层（推荐：`lib/spec/`, `lib/parsers/`, `lib/cli/`）
- [ ] 按模块分组
- [ ] 扁平结构

**选择**: 按功能分层

**理由**:
- `lib/spec/` - 规格操作核心逻辑（from-code.js, enrich.js, parser.js）
- `lib/parsers/` - 语言解析器（ast-javascript.js, 未来可扩展 ast-typescript.js, ast-python.js）
- `lib/cli/` - CLI 包装器（spec-extract.js）
- 清晰的职责边界，易于扩展新语言支持

---

### 2. 命名规范

**决策点**: 文件和函数如何命名？

- [x] 动词-对象模式（推荐：`extract-spec.js`, `parse-ast.js`）
- [ ] 对象-动词模式
- [ ] 名词模式

**选择**: 动词-对象模式

**理由**:
- `from-code.js` - 从代码生成规格（核心逻辑）
- `enrich.js` - 补充规格细节
- `parser.js` - 解析规格文件
- 动词优先，明确表达功能

---

### 3. 库与 CLI 分离

**决策点**: 是否需要分离库函数和 CLI 入口？

- [x] **是** - 分离（推荐：复用性高的核心逻辑）
  - 库函数：`lib/spec/from-code.js`
  - CLI 包装：`lib/cli/spec-extract.js`
- [ ] **否** - 混合

**选择**: 分离

**适用场景**:
- CLI: `/mob-seed spec extract lib/engines/solo.js`
- API 调用: 其他工具（如 `/mob-seed brownfield`）需要调用提取逻辑
- 测试: 库函数可单独测试，无需启动 CLI

---

### 4. 错误处理策略

**决策点**: 如何处理错误和失败？

- [x] 优雅降级（推荐：AST 解析失败→回退到简单正则）
- [ ] 快速失败
- [ ] 静默失败

**选择**: 优雅降级

**降级路径**:
```
AST 解析（精确）
    ↓ 失败（语法错误、不支持的语法）
简单正则（模糊）
    ↓ 失败（完全无法解析）
空模板 + 警告（最小可用）
```

**理由**:
- 即使代码有语法错误，也能生成基本模板
- 明确标注质量等级（AST/Regex/Template）
- 避免因个别文件失败导致整个批量提取中断

---

### 5. 退出码设计

**决策点**: CLI 工具如何返回状态？

- [x] 分层退出码（0=成功, 1=部分失败, 2=系统错误, 3=配置错误）
- [ ] 简单退出码
- [ ] 不关心退出码

**选择**: 分层退出码

**码值定义**:
```javascript
const ExitCode = {
  SUCCESS: 0,           // 全部成功提取
  PARTIAL_FAILURE: 1,   // 部分文件失败（但生成了模板）
  SYSTEM_ERROR: 2,      // 文件读取失败、AST 解析器错误
  CONFIG_ERROR: 3,      // 配置无效、路径不存在
  INVALID_INPUT: 4      // 输入参数无效
};
```

**理由**:
- 批量提取时，部分失败不应视为完全失败
- CI/CD 可基于退出码判断是否需要人工介入

---

### 6. Git Hooks 集成方式

**决策点**: 如果需要 Git Hooks，如何调用？

- [ ] 三层回退
- [ ] 单一方式
- [x] 不需要 Git Hooks

**选择**: 不需要 Git Hooks

**理由**:
- spec-extract 是主动操作（手动触发），不是被动检查
- 通常在项目初始化或大规模重构时使用，不需要每次 commit 触发

---

### 7. 测试覆盖率要求

**决策点**: 各模块的测试覆盖率目标？

- [x] 按风险分级（推荐：High 95%+, Medium 85%+, Low 75%+）
- [ ] 统一标准
- [ ] 无强制要求

**选择**: 按风险分级

**风险分级**:
- 🔴 High Risk (≥95%):
  - `lib/parsers/ast-javascript.js` - AST 解析核心，错误会导致规格质量低
  - `lib/spec/from-code.js` - 提取逻辑，影响所有生成的规格
- 🟡 Medium Risk (≥85%):
  - `lib/spec/parser.js` - 规格文件 I/O
  - `lib/cli/spec-extract.js` - CLI 参数处理
- 🟢 Low Risk (≥75%):
  - `lib/spec/templates.js` - 模板生成（固定逻辑）

---

### 8. 废弃策略

**决策点**: 如果需要废弃旧功能，如何平滑过渡？

- [ ] 版本化废弃
- [ ] 立即废弃
- [x] 不需要废弃

**选择**: 不需要废弃

**理由**:
- 这是 v3.3 新增功能，无需废弃旧功能
- 未来如果废弃某个选项（如 `--regex-fallback`），将采用版本化策略

---

## 功能需求 (Functional Requirements)

### FR-001: 单文件规格提取

**需求**:
从单个代码文件提取规格模板。

**输入**:
```bash
/mob-seed spec extract lib/engines/solo.js
```

**输出**:
```
✅ 从 lib/engines/solo.js 提取规格

生成文件: openspec/changes/v3.3-brownfield-support/specs/engines-solo.fspec.md
状态: draft
质量: AST (精确解析)

提取内容:
  ✅ 类名: SoloEngine
  ✅ 方法: 12 个
  ✅ JSDoc: 8 个
  ⚠️ FR 占位符: 4 个（需要补充）
  ⚠️ AC 占位符: 12 个（建议运行 /mob-seed spec enrich）

下一步:
  1. 审核生成的规格文件
  2. 补充 FR 和 AC（或运行 /mob-seed spec enrich）
  3. 运行测试验证
```

**规格文件示例**:
```markdown
---
status: archived
archived: 2026-01-03
created: 2026-01-03
codePath: lib/engines/solo.js
extractionMethod: AST
extractionQuality: high
---

# SoloEngine - 单模型编排引擎

## 概述 (Overview)

> **提取自代码**: lib/engines/solo.js
> **提取方法**: AST 解析
> **质量等级**: High（精确解析）

SoloEngine 提供单模型执行编排能力。

## 功能需求 (Functional Requirements)

### FR-001: 执行单个提示

**需求**:
> ⚠️ **待补充**: 请基于代码逻辑描述此功能需求

**方法签名**:
```javascript
async execute(prompt, options = {})
```

**参数**:
- `prompt` (string): 输入提示
- `options` (object): 配置选项
  - `model` (string): 模型名称
  - `temperature` (number): 温度参数

**返回值**:
```javascript
{
  result: string,
  usage: { tokens: number }
}
```

---

## 验收标准 (Acceptance Criteria)

### AC-001: 基本执行

**场景**:
```
Given: 输入提示 "Hello"
When: 执行 execute("Hello")
Then: 返回模型响应
  AND 记录 token 使用量
```

> ⚠️ **建议**: 运行 `/mob-seed spec enrich engines-solo.fspec.md` 从测试文件自动提取 AC
```

**实现**:
- 读取文件内容
- 调用 AST 解析器提取类/方法/JSDoc
- 生成规格模板（包含占位符）
- 保存到 `openspec/changes/{proposal}/specs/{filename}.fspec.md`

---

### FR-002: 批量规格提取

**需求**:
从目录批量提取规格。

**输入**:
```bash
/mob-seed spec extract lib/engines/
```

**输出**:
```
✅ 批量提取: lib/engines/

进度: ████████████████████ 100% (4/4)

结果:
  ✅ solo.js → engines-solo.fspec.md (AST)
  ✅ dual.js → engines-dual.fspec.md (AST)
  ⚠️ adversarial.js → engines-adversarial.fspec.md (Regex, 语法错误 line 45)
  ❌ legacy.js → 跳过（无法解析）

统计:
  成功: 2/4 (AST)
  降级: 1/4 (Regex)
  失败: 1/4

下一步:
  1. 审核 adversarial.js 规格（Regex 质量较低）
  2. 手动创建 legacy.js 规格
  3. 批量运行 /mob-seed spec enrich --all
```

**实现**:
- 递归扫描目录（`.js`, `.ts` 文件）
- 并发提取（控制并发数，避免 AST 解析器过载）
- 进度显示
- 汇总报告

---

### FR-003: 提取质量等级

**需求**:
明确标注提取质量，指导人工审核优先级。

**质量等级**:

| 等级 | 方法 | 准确率 | 说明 |
|------|------|--------|------|
| **High** | AST | 95%+ | 精确解析，方法签名、参数、返回值全部准确 |
| **Medium** | Regex | 80%+ | 模糊匹配，可能误判方法边界 |
| **Low** | Template | 50%+ | 仅生成空模板，全部需要手动填写 |

**frontmatter 标记**:
```yaml
extractionMethod: AST | Regex | Template
extractionQuality: high | medium | low
```

**实现**:
- AST 解析成功 → High
- AST 失败 + Regex 成功 → Medium
- 全部失败 → Low (Template)

---

### FR-004: 从 JSDoc 提取概述

**需求**:
利用代码中的 JSDoc 注释生成规格概述和 FR 描述。

**示例代码**:
```javascript
/**
 * SoloEngine - 单模型编排引擎
 *
 * 提供单个模型的执行和响应处理能力。
 *
 * @class
 */
class SoloEngine {
  /**
   * 执行单个提示
   *
   * @param {string} prompt - 输入提示
   * @param {object} options - 配置选项
   * @param {string} options.model - 模型名称
   * @returns {Promise<{result: string, usage: object}>}
   */
  async execute(prompt, options = {}) {
    // ...
  }
}
```

**生成规格**:
```markdown
## 概述 (Overview)

SoloEngine - 单模型编排引擎

提供单个模型的执行和响应处理能力。

## 功能需求 (Functional Requirements)

### FR-001: 执行单个提示

**需求**: 执行单个提示

**方法签名**:
```javascript
async execute(prompt, options = {})
```

**参数**:
- `prompt` (string): 输入提示
- `options` (object): 配置选项
  - `model` (string): 模型名称

**返回值**:
```javascript
Promise<{result: string, usage: object}>
```
```

**实现**:
- 解析 JSDoc 标签（@param, @returns, @class, @description）
- 生成结构化的 FR 和概述
- 如果无 JSDoc，生成占位符

---

### FR-005: 从测试文件提取 AC 候选

**需求**:
分析对应的测试文件，将测试用例描述作为 AC 候选。

**测试文件示例**:
```javascript
// test/engines/solo.test.js

test('should execute single prompt', async () => {
  const engine = new SoloEngine();
  const result = await engine.execute('Hello');
  assert(result.result);
});

test('should track token usage', async () => {
  // ...
});
```

**生成规格 AC**:
```markdown
### AC-001: 基本执行

> **提取自测试**: test/engines/solo.test.js:5

**场景**:
```
Given: SoloEngine 实例
When: 执行 execute('Hello')
Then: 返回结果包含 result 字段
```

### AC-002: Token 使用追踪

> **提取自测试**: test/engines/solo.test.js:11

**场景**:
```
Given: SoloEngine 实例
When: 执行任意提示
Then: 返回结果包含 usage 字段
```
```

**实现**:
- 根据代码路径推断测试路径（`lib/engines/solo.js` → `test/engines/solo.test.js`）
- 解析测试文件，提取 `test('...')` 描述
- 生成 AC 模板（标注来源）
- 如果无测试文件，生成占位符 AC

---

### FR-006: 规格文件命名规则

**需求**:
自动生成规格文件名，确保一致性。

**命名规则**:
```
代码路径 → 规格文件名

lib/engines/solo.js          → engines-solo.fspec.md
lib/spec/from-code.js        → spec-from-code.fspec.md
lib/parsers/ast-javascript.js → parsers-ast-javascript.fspec.md
```

**规则**:
1. 去除 `lib/` 前缀
2. 去除 `.js` 后缀
3. 将 `/` 替换为 `-`
4. 添加 `.fspec.md` 后缀

**实现**:
```javascript
function generateSpecFilename(codePath) {
  return codePath
    .replace(/^lib\//, '')
    .replace(/\.js$/, '')
    .replace(/\//g, '-')
    + '.fspec.md';
}
```

---

## 验收标准 (Acceptance Criteria)

### AC-001: 单文件提取成功

**场景**:
```
Given: 存在文件 lib/engines/solo.js（有效 JavaScript）
When: 运行 /mob-seed spec extract lib/engines/solo.js
Then: 生成 openspec/changes/{proposal}/specs/engines-solo.fspec.md
  AND frontmatter.status = "draft"
  AND frontmatter.extractionMethod = "AST"
  AND frontmatter.extractionQuality = "high"
  AND 包含类名 "SoloEngine"
  AND 包含方法签名
  AND 退出码 = 0
```

**验证**:
```bash
/mob-seed spec extract lib/engines/solo.js
echo $?  # 期望: 0

# 检查生成文件
cat openspec/changes/v3.3-brownfield-support/specs/engines-solo.fspec.md
# 期望包含: status: draft, extractionMethod: AST
```

---

### AC-002: 批量提取进度显示

**场景**:
```
Given: 目录 lib/engines/ 有 4 个文件
When: 运行 /mob-seed spec extract lib/engines/
Then: 显示进度条
  AND 逐个报告每个文件的提取结果
  AND 最后显示统计汇总
  AND 退出码 = 0（全部成功）或 1（部分失败）
```

**验证**:
```bash
/mob-seed spec extract lib/engines/
# 期望输出:
# 进度: ████████████████████ 100% (4/4)
# 成功: 3/4, 降级: 1/4, 失败: 0/4
```

---

### AC-003: AST 解析失败优雅降级

**场景**:
```
Given: 文件 lib/legacy.js 有语法错误
When: 运行 /mob-seed spec extract lib/legacy.js
Then: AST 解析失败
  AND 回退到简单正则
  AND 生成规格文件（质量=medium）
  AND frontmatter.extractionMethod = "Regex"
  AND 显示警告 "⚠️ AST 解析失败，使用简单正则"
  AND 退出码 = 1（部分失败）
```

**验证**:
```bash
# 创建语法错误文件
echo "class Foo { method( { }" > lib/legacy.js

/mob-seed spec extract lib/legacy.js
echo $?  # 期望: 1

# 检查质量标记
grep "extractionMethod: Regex" openspec/.../specs/legacy.fspec.md
```

---

### AC-004: 从 JSDoc 提取概述

**场景**:
```
Given: 文件有完整的 JSDoc 注释
When: 运行提取
Then: 规格概述来自 JSDoc 类注释
  AND FR 描述来自 JSDoc 方法注释
  AND 参数说明来自 @param 标签
  AND 返回值说明来自 @returns 标签
```

**验证**:
```javascript
// 创建测试文件
/**
 * TestClass - 测试类
 * @class
 */
class TestClass {
  /**
   * 测试方法
   * @param {string} input - 输入参数
   * @returns {string} 输出结果
   */
  testMethod(input) {}
}

// 提取后检查
grep "TestClass - 测试类" specs/test-class.fspec.md
grep "input (string): 输入参数" specs/test-class.fspec.md
```

---

### AC-005: 从测试文件提取 AC

**场景**:
```
Given: 代码文件 lib/foo.js
  AND 测试文件 test/foo.test.js 有 3 个测试用例
When: 运行提取
Then: 生成 3 个 AC 模板
  AND 每个 AC 标注来源测试文件和行号
  AND 测试描述作为 AC 场景
```

**验证**:
```javascript
// test/foo.test.js
test('should return true for valid input', () => {});
test('should throw error for invalid input', () => {});

// 提取后检查规格
grep "AC-001.*valid input" specs/foo.fspec.md
grep "AC-002.*invalid input" specs/foo.fspec.md
grep "提取自测试: test/foo.test.js" specs/foo.fspec.md
```

---

### AC-006: 规格文件命名一致性

**场景**:
```
Given: 代码路径 lib/spec/from-code.js
When: 运行提取
Then: 规格文件名 = "spec-from-code.fspec.md"
  AND 保存路径 = "openspec/changes/{proposal}/specs/spec-from-code.fspec.md"
```

**验证**:
```bash
/mob-seed spec extract lib/spec/from-code.js

ls openspec/changes/v3.3-brownfield-support/specs/spec-from-code.fspec.md
# 期望: 文件存在
```

---

## 技术设计 (Technical Design)

### 核心模块

```
lib/
├── spec/
│   ├── from-code.js        # 主入口，协调提取流程
│   ├── parser.js           # 规格文件 I/O
│   └── templates.js        # 模板生成
├── parsers/
│   ├── ast-javascript.js   # JavaScript AST 解析器
│   └── jsdoc-parser.js     # JSDoc 提取器
└── cli/
    └── spec-extract.js     # CLI 包装器
```

### 库函数接口

```javascript
// lib/spec/from-code.js

const { z } = require('zod');

const OptionsSchema = z.object({
  codePath: z.string(),
  outputDir: z.string().optional(),
  extractTests: z.boolean().default(true),
  fallbackToRegex: z.boolean().default(true)
});

/**
 * 从代码文件提取规格
 *
 * @param {object} options - 配置选项
 * @returns {Promise<{success: boolean, specPath: string, quality: string}>}
 */
async function extractFromCode(options) {
  const opts = OptionsSchema.parse(options);

  // 1. 读取代码文件
  const code = await fs.readFile(opts.codePath, 'utf8');

  // 2. 尝试 AST 解析
  let extraction;
  try {
    extraction = await astParser.parse(code);
    extraction.method = 'AST';
    extraction.quality = 'high';
  } catch (error) {
    // 3. 降级到正则
    if (opts.fallbackToRegex) {
      extraction = await regexParser.parse(code);
      extraction.method = 'Regex';
      extraction.quality = 'medium';
    } else {
      throw error;
    }
  }

  // 4. 提取 JSDoc
  extraction.jsdoc = jsdocParser.extract(code);

  // 5. 查找测试文件
  if (opts.extractTests) {
    const testPath = inferTestPath(opts.codePath);
    if (fs.existsSync(testPath)) {
      extraction.tests = await testParser.extract(testPath);
    }
  }

  // 6. 生成规格模板
  const spec = templates.generate(extraction);

  // 7. 保存规格文件
  const specPath = path.join(opts.outputDir, generateSpecFilename(opts.codePath));
  await fs.writeFile(specPath, spec);

  return {
    success: true,
    specPath,
    quality: extraction.quality
  };
}

module.exports = extractFromCode;
module.exports.OptionsSchema = OptionsSchema;
```

### CLI 包装器

```javascript
#!/usr/bin/env node
// lib/cli/spec-extract.js

const extractFromCode = require('../spec/from-code');
const { parseArgs } = require('node:util');
const path = require('path');
const fs = require('fs');

const ExitCode = {
  SUCCESS: 0,
  PARTIAL_FAILURE: 1,
  SYSTEM_ERROR: 2,
  CONFIG_ERROR: 3,
  INVALID_INPUT: 4
};

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      'output-dir': { type: 'string' },
      'no-tests': { type: 'boolean' },
      'no-fallback': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: true
  });

  if (values.help || positionals.length === 0) {
    console.log(`
Usage: spec-extract <file|dir> [options]

Options:
  --output-dir <path>  输出目录（默认：openspec/changes/{active}/specs/）
  --no-tests           不提取测试文件
  --no-fallback        禁用正则回退（AST 失败直接报错）
  -h, --help           显示帮助
    `);
    process.exit(ExitCode.SUCCESS);
  }

  const target = positionals[0];

  // 检查路径是否存在
  if (!fs.existsSync(target)) {
    console.error(`❌ 错误: 路径不存在: ${target}`);
    process.exit(ExitCode.INVALID_INPUT);
  }

  const stats = fs.statSync(target);

  if (stats.isFile()) {
    // 单文件提取
    await extractSingleFile(target, values);
  } else if (stats.isDirectory()) {
    // 批量提取
    await extractDirectory(target, values);
  } else {
    console.error(`❌ 错误: 无效的目标类型`);
    process.exit(ExitCode.INVALID_INPUT);
  }
}

async function extractSingleFile(filePath, options) {
  try {
    const result = await extractFromCode({
      codePath: filePath,
      outputDir: options['output-dir'],
      extractTests: !options['no-tests'],
      fallbackToRegex: !options['no-fallback']
    });

    console.log(`✅ 从 ${filePath} 提取规格`);
    console.log(`生成文件: ${result.specPath}`);
    console.log(`质量: ${result.quality}`);

    process.exit(ExitCode.SUCCESS);
  } catch (error) {
    console.error(`❌ 提取失败: ${error.message}`);
    process.exit(ExitCode.SYSTEM_ERROR);
  }
}

async function extractDirectory(dirPath, options) {
  // 递归扫描 .js 文件
  const files = await globFiles(dirPath, '**/*.js');

  console.log(`✅ 批量提取: ${dirPath}\n`);

  const results = { success: 0, degraded: 0, failed: 0 };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = Math.floor((i / files.length) * 20);
    const bar = '█'.repeat(progress) + ' '.repeat(20 - progress);
    process.stdout.write(`\r进度: ${bar} ${Math.floor((i / files.length) * 100)}% (${i}/${files.length})`);

    try {
      const result = await extractFromCode({
        codePath: file,
        outputDir: options['output-dir'],
        extractTests: !options['no-tests'],
        fallbackToRegex: !options['no-fallback']
      });

      if (result.quality === 'high') {
        results.success++;
      } else {
        results.degraded++;
      }
    } catch (error) {
      results.failed++;
      console.error(`\n❌ ${file} → 失败: ${error.message}`);
    }
  }

  console.log(`\n\n统计:`);
  console.log(`  成功: ${results.success}/${files.length} (AST)`);
  console.log(`  降级: ${results.degraded}/${files.length} (Regex)`);
  console.log(`  失败: ${results.failed}/${files.length}`);

  if (results.failed > 0) {
    process.exit(ExitCode.PARTIAL_FAILURE);
  } else {
    process.exit(ExitCode.SUCCESS);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
module.exports.ExitCode = ExitCode;
```

### AST 解析器

```javascript
// lib/parsers/ast-javascript.js

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

/**
 * 解析 JavaScript 代码为结构化信息
 *
 * @param {string} code - 源代码
 * @returns {object} 提取的结构信息
 */
function parse(code) {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'classProperties']
  });

  const extracted = {
    classes: [],
    functions: [],
    exports: []
  };

  traverse(ast, {
    ClassDeclaration(path) {
      const classInfo = {
        name: path.node.id.name,
        methods: [],
        properties: []
      };

      path.traverse({
        ClassMethod(methodPath) {
          classInfo.methods.push({
            name: methodPath.node.key.name,
            params: methodPath.node.params.map(p => p.name),
            async: methodPath.node.async,
            static: methodPath.node.static
          });
        }
      });

      extracted.classes.push(classInfo);
    },

    FunctionDeclaration(path) {
      extracted.functions.push({
        name: path.node.id.name,
        params: path.node.params.map(p => p.name),
        async: path.node.async
      });
    }
  });

  return extracted;
}

module.exports = { parse };
```

---

## 派生产物 (Derived Outputs)

> **路径规范**: 遵循 `.seed/config.json` 中的 `paths` 配置。
> 基准: `paths.src = "skills/mob-seed/lib"`, `paths.test = "skills/mob-seed/test"`

| 类型 | 路径 | 说明 |
|------|------|------|
| **库函数** | `skills/mob-seed/lib/spec/from-code.js` | 核心提取逻辑 |
| | `skills/mob-seed/lib/spec/parser.js` | 规格文件 I/O |
| | `skills/mob-seed/lib/spec/templates.js` | 模板生成 |
| | `skills/mob-seed/lib/parsers/ast-javascript.js` | AST 解析器 |
| | `skills/mob-seed/lib/parsers/jsdoc-parser.js` | JSDoc 提取 |
| **CLI 包装** | `skills/mob-seed/lib/cli/spec-extract.js` | CLI 入口 |
| **测试** | `skills/mob-seed/test/spec/from-code.test.js` | 核心逻辑测试 (🔴 ≥95%) |
| | `skills/mob-seed/test/parsers/ast-javascript.test.js` | AST 解析测试 (🔴 ≥95%) |
| | `skills/mob-seed/test/cli/spec-extract.test.js` | CLI 测试 (🟡 ≥85%) |
| | `skills/mob-seed/test/spec/templates.test.js` | 模板测试 (🟢 ≥75%) |
| **命令文档** | `commands/spec.md` | 新增"操作 4: extract"章节 |
| **依赖** | `skills/mob-seed/package.json` | 新增 `@babel/parser`, `@babel/traverse` |

---

## 依赖 (Dependencies)

**新增依赖** (`skills/mob-seed/package.json`):

```json
{
  "dependencies": {
    "@babel/parser": "^7.23.0",
    "@babel/traverse": "^7.23.0",
    "zod": "^3.22.0"
  }
}
```

**依赖理由**:
- `@babel/parser`: 精确解析 JavaScript 为 AST（避免正则误匹配）
- `@babel/traverse`: 遍历 AST 节点提取类/方法/注释
- `zod`: 参数验证（已用于其他模块，无需新增）

---

## 成功标准 (Success Criteria)

### 核心功能
- [ ] 单文件提取成功，生成 draft 规格（AC-001）
- [ ] 批量提取显示进度和统计（AC-002）
- [ ] AST 解析失败自动降级到正则（AC-003）
- [ ] 从 JSDoc 提取概述和 FR（AC-004）
- [ ] 从测试文件提取 AC 候选（AC-005）
- [ ] 规格文件命名一致性（AC-006）

### 质量保证
- [ ] 🔴 High Risk 模块测试覆盖率 ≥95%
  - `lib/spec/from-code.js`
  - `lib/parsers/ast-javascript.js`
- [ ] 🟡 Medium Risk 模块测试覆盖率 ≥85%
  - `lib/spec/parser.js`
  - `lib/cli/spec-extract.js`
- [ ] 🟢 Low Risk 模块测试覆盖率 ≥75%
  - `lib/spec/templates.js`

### 实际验证
- [ ] 为 mars-nexus 82 个模块生成规格（30 分钟内）
- [ ] 方法识别准确率 > 95%（AST 解析）
- [ ] JSDoc 提取率 > 90%（有 JSDoc 的文件）
- [ ] 测试提取率 > 80%（有测试文件的模块）

### 文档完整
- [ ] `commands/spec.md` 新增"操作 4: extract"章节
- [ ] 命令帮助文本完整（--help）
- [ ] README 新增 Brownfield Support 使用示例

---

## 风险与缓解 (Risks and Mitigation)

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| AST 解析失败率高 | 规格质量低 | 中 | 优雅降级到正则，明确标注质量 |
| 正则误匹配 | 生成错误的方法签名 | 中 | 仅在 AST 失败时使用，标注需要审核 |
| 无 JSDoc 导致 FR 空洞 | 需要大量手动补充 | 高 | 生成占位符，引导用户使用 enrich |
| 无测试文件导致 AC 缺失 | AC 完全依赖手动编写 | 中 | 生成占位符，提示编写测试的重要性 |
| 大规模批量提取性能 | 100+ 文件耗时过长 | 低 | 控制并发数，显示进度 |

---

## 后续演进 (Future Enhancements)

v3.4 可能增强：
- 支持 TypeScript（`@babel/parser` 已支持）
- 支持 Python、Java（使用 tree-sitter）
- AI 深度分析代码逻辑生成详细 FR
- 从 Git 历史推断 FR（分析 commit message）
- 增量提取（只提取变更的文件）
