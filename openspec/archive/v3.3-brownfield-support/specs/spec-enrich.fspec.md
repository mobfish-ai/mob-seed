---
status: archived
archived: 2026-01-03
created: 2026-01-03
updated: 2026-01-03
architecture_decisions_completed: true
---

# spec-enrich - 智能补充规格细节

## 概述 (Overview)

从测试文件和代码分析智能补充规格细节（FR、AC），提升从代码提取的规格质量。

**核心能力**：
- 从测试用例自动提取 AC（Acceptance Criteria）
- AI 分析代码逻辑生成 FR（Functional Requirements）建议
- 从 JSDoc 和方法签名推断参数说明
- 智能填充占位符
- 标注 AI 生成内容（需要人工审核）

**适用场景**：
- `spec extract` 生成的规格质量提升
- 代码有测试但无文档的场景
- 快速生成规格初稿

---

## 架构决策检查清单 (Architecture Decisions)

> **重要**: 所有架构决策已完成。以下记录了关键决策和理由。

### 1. 目录结构设计

**决策点**: 新增代码应该放在哪个目录？

- [x] 按功能分层（推荐：`lib/spec/enrich.js`）
- [ ] 按模块分组
- [ ] 扁平结构

**选择**: 按功能分层，放在 `lib/spec/`

**理由**:
- `enrich.js` 是规格操作的一部分，与 `from-code.js`、`parser.js` 同级
- 职责清晰：规格生成（from-code）→ 规格补充（enrich）→ 规格解析（parser）
- 未来可能有 `lib/spec/validate.js`、`lib/spec/merge.js` 等，统一在 `lib/spec/` 目录

---

### 2. 命名规范

**决策点**: 文件和函数如何命名？

- [x] 动词模式（推荐：`enrich.js`）
- [ ] 动词-对象模式（`enrich-spec.js`）
- [ ] 对象-动词模式（`spec-enricher.js`）

**选择**: 动词模式 `enrich.js`

**理由**:
- 动作明确：enrich（补充/增强）
- 与同级文件一致：`from-code.js`（动词短语）、`parser.js`（名词但动作明确）
- 简洁且不产生歧义（在 `lib/spec/` 目录下，已经明确是规格操作）

---

### 3. 库与 CLI 分离

**决策点**: 是否需要分离库函数和 CLI 入口？

- [x] **是** - 分离（推荐：复用性高的核心逻辑）
  - 库函数：`lib/spec/enrich.js`
  - CLI 包装：`lib/cli/spec-enrich.js`
- [ ] **否** - 混合

**选择**: 分离

**适用场景**:
- **CLI 调用**: `/mob-seed spec enrich engines-solo.fspec.md`
- **brownfield 调用**: `/mob-seed brownfield` 自动提取规格后批量补充
- **API 集成**: 其他工具可导入 `enrich()` 函数
- **测试**: 库函数可独立测试，无需模拟 CLI 环境

---

### 4. 错误处理策略

**决策点**: 如何处理错误和失败？

- [x] 优雅降级（推荐：AI 失败→模板占位符，测试文件不存在→跳过）
- [ ] 快速失败
- [ ] 静默失败

**选择**: 优雅降级

**降级路径**:
```
AI 分析成功（最佳）
    ↓ AI 调用失败/超时
使用测试文件提取（次佳）
    ↓ 测试文件不存在
生成模板占位符（最小可用）
    ↓ 完全失败
保持原规格不变 + 警告
```

**具体策略**:
- **AI 失败**: 记录警告，使用测试文件提取或模板
- **测试文件不存在**: 跳过 AC 提取，仅尝试 AI 生成 FR
- **规格文件损坏**: 返回错误，不修改原文件
- **网络超时**: 重试 1 次，失败后降级

**理由**:
- 即使 AI 不可用（离线、API 限流），也能提供基本补充
- 部分补充好于完全失败
- 明确标注质量等级，引导用户审核

---

### 5. 退出码设计

**决策点**: CLI 工具如何返回状态？

- [x] 分层退出码（0=成功, 1=部分成功, 2=系统错误, 3=配置错误）
- [ ] 简单退出码
- [ ] 不关心退出码

**选择**: 分层退出码

**码值定义**:
```javascript
const ExitCode = {
  SUCCESS: 0,           // 全部成功（AI + 测试）
  PARTIAL_SUCCESS: 1,   // 部分成功（AI 失败但测试成功，或反之）
  SYSTEM_ERROR: 2,      // 文件 I/O 错误、规格解析失败
  CONFIG_ERROR: 3,      // AI 配置无效（API key 缺失）
  SPEC_NOT_FOUND: 4     // 规格文件不存在
};
```

**场景示例**:
```bash
# 场景 1: 完全成功
/mob-seed spec enrich engines-solo.fspec.md
# AI 生成 FR ✅, 测试提取 AC ✅
# 退出码: 0

# 场景 2: 部分成功
/mob-seed spec enrich engines-solo.fspec.md
# AI 超时 ❌, 测试提取 AC ✅
# 退出码: 1

# 场景 3: 系统错误
/mob-seed spec enrich nonexistent.fspec.md
# 规格文件不存在
# 退出码: 4
```

**理由**:
- CI/CD 可区分"完全成功"和"部分成功"
- 部分成功时，用户可手动补充缺失部分
- 不应因 AI 调用失败而返回错误码 2（测试提取仍然成功）

---

### 6. Git Hooks 集成方式

**决策点**: 如果需要 Git Hooks，如何调用？

- [ ] 三层回退
- [ ] 单一方式
- [x] 不需要 Git Hooks

**选择**: 不需要 Git Hooks

**理由**:
- `spec enrich` 是**主动操作**（用户手动触发），不是被动检查
- 通常在以下时机使用：
  1. `spec extract` 后立即补充
  2. 发现规格质量低时手动触发
  3. `brownfield` 批量处理时自动调用
- 不需要每次 commit 时自动补充规格

---

### 7. 测试覆盖率要求

**决策点**: 各模块的测试覆盖率目标？

- [x] 按风险分级（推荐：High 95%+, Medium 85%+, Low 75%+）
- [ ] 统一标准
- [ ] 无强制要求

**选择**: 按风险分级

**风险分级**:
- 🔴 High Risk (≥95%):
  - `lib/spec/enrich.js` - 核心逻辑，AI 调用和测试解析
  - `lib/parsers/test-parser.js` - 测试文件解析，影响 AC 质量
- 🟡 Medium Risk (≥85%):
  - `lib/ai/prompt-builder.js` - AI 提示构建
  - `lib/cli/spec-enrich.js` - CLI 参数处理
- 🟢 Low Risk (≥75%):
  - `lib/spec/templates.js` - AC/FR 模板（固定逻辑）

**理由**:
- AI 调用逻辑复杂（重试、超时、错误处理），必须高覆盖
- 测试解析错误会导致 AC 缺失，影响规格完整性
- CLI 和模板逻辑相对简单

---

### 8. 废弃策略

**决策点**: 如果需要废弃旧功能，如何平滑过渡？

- [ ] 版本化废弃
- [ ] 立即废弃
- [x] 不需要废弃

**选择**: 不需要废弃

**理由**:
- 这是 v3.3 **新增功能**，无需废弃旧功能
- 未来如果需要废弃某个选项（如 `--no-ai`），将采用版本化策略：
  - v3.x: deprecate + warn
  - v4.0: break + error
  - v4.1: remove

---

## 功能需求 (Functional Requirements)

### FR-001: 从测试文件提取 AC

**需求**:
解析对应的测试文件，将测试用例描述转换为 AC（Acceptance Criteria）。

**输入**:
```bash
/mob-seed spec enrich engines-solo.fspec.md
```

**测试文件**:
```javascript
// test/engines/solo.test.js

const { test } = require('node:test');
const assert = require('node:assert');
const SoloEngine = require('../../lib/engines/solo');

test('should execute single prompt', async () => {
  const engine = new SoloEngine();
  const result = await engine.execute('Hello');
  assert(result.result);
  assert.strictEqual(typeof result.result, 'string');
});

test('should track token usage', async () => {
  const engine = new SoloEngine();
  const result = await engine.execute('Test');
  assert(result.usage);
  assert.strictEqual(typeof result.usage.tokens, 'number');
});

test('should throw error for invalid model', async () => {
  const engine = new SoloEngine({ model: 'invalid-model' });
  await assert.rejects(
    () => engine.execute('Test'),
    { name: 'Error', message: /Unknown model/ }
  );
});
```

**生成 AC**:
```markdown
### AC-001: 执行单个提示

> **提取自测试**: test/engines/solo.test.js:7 - "should execute single prompt"

**场景**:
```
Given: SoloEngine 实例
When: 执行 execute('Hello')
Then: 返回结果包含 result 字段
  AND result 类型为 string
```

**验证**:
```javascript
const engine = new SoloEngine();
const result = await engine.execute('Hello');
assert(result.result);
assert.strictEqual(typeof result.result, 'string');
```

---

### AC-002: Token 使用追踪

> **提取自测试**: test/engines/solo.test.js:14 - "should track token usage"

**场景**:
```
Given: SoloEngine 实例
When: 执行任意提示
Then: 返回结果包含 usage 字段
  AND usage.tokens 类型为 number
```

**验证**:
```javascript
const engine = new SoloEngine();
const result = await engine.execute('Test');
assert(result.usage);
assert.strictEqual(typeof result.usage.tokens, 'number');
```

---

### AC-003: 无效模型错误处理

> **提取自测试**: test/engines/solo.test.js:21 - "should throw error for invalid model"

**场景**:
```
Given: SoloEngine 使用无效模型名
When: 执行 execute('Test')
Then: 抛出 Error
  AND 错误消息包含 "Unknown model"
```

**验证**:
```javascript
const engine = new SoloEngine({ model: 'invalid-model' });
await assert.rejects(
  () => engine.execute('Test'),
  { name: 'Error', message: /Unknown model/ }
);
```
```

**实现**:
- 推断测试文件路径：`lib/engines/solo.js` → `test/engines/solo.test.js`
- 解析测试文件 AST，提取 `test('description')` 调用
- 提取断言语句（`assert.*`）作为验证步骤
- 生成 Given-When-Then 格式的场景
- 保留原测试代码作为验证示例
- 标注来源（文件路径 + 行号 + 描述）

---

### FR-002: AI 分析生成 FR 建议

**需求**:
使用 AI 分析代码逻辑，生成 FR（Functional Requirements）描述建议。

**输入规格**:
```markdown
### FR-001: 执行单个提示

**需求**:
> ⚠️ **待补充**: 请基于代码逻辑描述此功能需求

**方法签名**:
```javascript
async execute(prompt, options = {})
```
```

**代码**:
```javascript
// lib/engines/solo.js

class SoloEngine {
  /**
   * 执行单个提示
   */
  async execute(prompt, options = {}) {
    const model = options.model || this.defaultModel;
    const provider = this.getProvider(model);

    const response = await provider.complete(prompt, {
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 2000
    });

    return {
      result: response.text,
      usage: {
        tokens: response.usage.totalTokens
      }
    };
  }
}
```

**AI 提示**:
```
分析以下代码，生成功能需求描述：

代码：
[code snippet]

现有规格：
[current FR with placeholder]

要求：
1. 描述方法的主要功能（What）
2. 说明关键参数和返回值（How）
3. 提及重要的业务逻辑（Why）
4. 使用简洁的语言（2-3 句话）
```

**AI 生成 FR**:
```markdown
### FR-001: 执行单个提示

**需求**:
> 🤖 **AI 生成**: 请人工审核并修改

SoloEngine 提供单模型提示执行能力。通过 `execute()` 方法，接收用户提示和可选配置（模型、温度、token 限制），调用相应的模型提供商完成生成，并返回响应文本和 token 使用统计。

**关键逻辑**:
- 模型选择：优先使用 `options.model`，否则使用默认模型
- 参数传递：temperature (默认 0.7), maxTokens (默认 2000)
- 响应封装：返回结构化对象 `{result, usage}`

**方法签名**:
```javascript
async execute(prompt, options = {})
```

**参数**:
- `prompt` (string): 用户输入提示
- `options` (object): 可选配置
  - `model` (string): 模型名称（可选，默认使用实例默认模型）
  - `temperature` (number): 温度参数（0-1，默认 0.7）
  - `maxTokens` (number): 最大 token 数（默认 2000）

**返回值**:
```javascript
{
  result: string,        // 模型响应文本
  usage: {
    tokens: number       // 总 token 使用量
  }
}
```
```

**实现**:
- 读取代码文件和现有规格
- 构建 AI 提示（包含代码片段、JSDoc、方法签名）
- 调用 AI API（支持 Gemini、OpenAI、Claude）
- 解析 AI 响应，提取 FR 描述
- 标注 "🤖 AI 生成"，提示需要审核
- 更新规格文件

---

### FR-003: 批量补充规格

**需求**:
支持批量补充多个规格文件。

**输入**:
```bash
/mob-seed spec enrich --all

# 或指定目录
/mob-seed spec enrich openspec/changes/v3.3-brownfield-support/specs/
```

**输出**:
```
✅ 批量补充规格

进度: ████████████████████ 100% (10/10)

结果:
  ✅ engines-solo.fspec.md
     - AC: 3 个（从测试提取）
     - FR: 2 个（AI 生成）

  ⚠️ engines-adversarial.fspec.md
     - AC: 5 个（从测试提取）
     - FR: 0 个（AI 超时）

  ✅ spec-from-code.fspec.md
     - AC: 0 个（无测试文件）
     - FR: 4 个（AI 生成）

统计:
  规格文件: 10 个
  AC 总数: 38 个（从 8 个测试文件提取）
  FR 总数: 26 个（AI 生成）
  AI 成功率: 80% (8/10)

下一步:
  1. 审核 AI 生成的 FR（标记为 🤖）
  2. 补充无测试文件的模块的 AC
  3. 运行测试验证规格准确性
```

**实现**:
- 扫描规格目录（`.fspec.md` 文件）
- 并发补充（控制并发数，避免 AI API 限流）
- 进度显示
- 汇总统计

---

### FR-004: 智能占位符填充

**需求**:
识别规格中的占位符，智能填充内容。

**占位符类型**:

| 占位符 | 识别模式 | 填充方式 |
|--------|----------|----------|
| FR 待补充 | `> ⚠️ **待补充**` | AI 分析代码生成 |
| AC 待补充 | `- [ ]` 空 AC | 从测试提取或生成模板 |
| 参数说明缺失 | `- param (type)` 无描述 | 从 JSDoc `@param` 提取 |
| 返回值缺失 | 无 `**返回值**` 章节 | 从 JSDoc `@returns` 提取 |

**示例**:

**Before**:
```markdown
### FR-001: 执行单个提示

**需求**:
> ⚠️ **待补充**: 请基于代码逻辑描述此功能需求

**参数**:
- `prompt` (string)
- `options` (object)
```

**After**:
```markdown
### FR-001: 执行单个提示

**需求**:
> 🤖 **AI 生成**: 请人工审核并修改

执行单个提示，调用模型生成响应...

**参数**:
- `prompt` (string): 用户输入提示 ← 🤖 AI 生成
- `options` (object): 可选配置 ← 🤖 AI 生成
  - `model` (string): 模型名称 ← 从 JSDoc 提取
  - `temperature` (number): 温度参数 ← 从 JSDoc 提取
```

**实现**:
- 解析规格文件，识别占位符
- 按优先级填充：
  1. JSDoc → 参数/返回值说明（最可靠）
  2. 测试文件 → AC（高可靠）
  3. AI 分析 → FR 描述（需审核）
- 标注填充来源（JSDoc / 测试 / AI）

---

### FR-005: 质量等级标注

**需求**:
标注补充内容的质量等级，指导人工审核优先级。

**质量等级**:

| 来源 | 可靠性 | 标注 | 说明 |
|------|--------|------|------|
| **测试文件** | 高 (90%+) | `> **提取自测试**: path:line` | AC 来自实际测试用例 |
| **JSDoc** | 高 (90%+) | `> **提取自 JSDoc**` | 参数说明来自代码注释 |
| **AI 生成** | 中 (70%+) | `> 🤖 **AI 生成**: 请人工审核` | FR 描述需要验证 |
| **模板** | 低 (50%+) | `> ⚠️ **待补充**` | 占位符，需要手动填写 |

**frontmatter 标记**:
```yaml
enriched: true
enrichment_sources:
  - tests: test/engines/solo.test.js (3 AC)
  - ai: Gemini 2.5 Pro (2 FR)
  - jsdoc: 8 params
```

**实现**:
- 更新规格 frontmatter 记录补充来源
- 在内容前添加标注（`> **提取自测试**` 等）
- 生成审核检查清单

---

## 验收标准 (Acceptance Criteria)

### AC-001: 从测试文件提取 AC

**场景**:
```
Given: 规格文件 engines-solo.fspec.md
  AND 对应测试文件 test/engines/solo.test.js 有 3 个测试用例
When: 运行 /mob-seed spec enrich engines-solo.fspec.md
Then: 生成 3 个 AC
  AND 每个 AC 标注来源（文件路径 + 行号 + 描述）
  AND AC 场景为 Given-When-Then 格式
  AND 包含测试代码作为验证示例
  AND frontmatter 记录 `enrichment_sources.tests`
```

**验证**:
```bash
/mob-seed spec enrich engines-solo.fspec.md

# 检查生成的 AC
grep "提取自测试: test/engines/solo.test.js" engines-solo.fspec.md
# 期望: 3 处匹配

# 检查 frontmatter
grep "enrichment_sources:" engines-solo.fspec.md
grep "tests: test/engines/solo.test.js (3 AC)" engines-solo.fspec.md
```

---

### AC-002: AI 生成 FR 描述

**场景**:
```
Given: 规格文件有 FR 占位符 `> ⚠️ **待补充**`
  AND AI 配置正确（API key 有效）
When: 运行补充
Then: AI 分析代码生成 FR 描述
  AND FR 标注 `> 🤖 **AI 生成**: 请人工审核`
  AND frontmatter 记录 `enrichment_sources.ai`
  AND 退出码 = 0
```

**验证**:
```bash
# 检查 AI 生成标记
grep "🤖 **AI 生成**" engines-solo.fspec.md

# 检查 frontmatter
grep "ai: Gemini 2.5 Pro" engines-solo.fspec.md
```

---

### AC-003: AI 失败优雅降级

**场景**:
```
Given: AI API 不可用（网络超时或 API key 无效）
When: 运行补充
Then: 跳过 AI 生成
  AND 保留原有占位符
  AND 显示警告 "⚠️ AI 生成失败，保留占位符"
  AND 继续提取测试文件 AC
  AND 退出码 = 1（部分成功）
```

**验证**:
```bash
# 模拟 AI 失败
export GEMINI_API_KEY=""

/mob-seed spec enrich engines-solo.fspec.md
echo $?  # 期望: 1

# 检查是否仍提取测试
grep "提取自测试" engines-solo.fspec.md
# 期望: 有 AC
```

---

### AC-004: 批量补充进度显示

**场景**:
```
Given: 目录 specs/ 有 10 个规格文件
When: 运行 /mob-seed spec enrich --all
Then: 显示进度条
  AND 逐个报告每个文件的补充结果
  AND 最后显示统计汇总
  AND 退出码 = 0（全部成功）或 1（部分失败）
```

**验证**:
```bash
/mob-seed spec enrich --all
# 期望输出:
# 进度: ████████████████████ 100% (10/10)
# 统计: AC 总数: 38, FR 总数: 26
```

---

### AC-005: 智能占位符填充

**场景**:
```
Given: 规格有多种占位符
  AND 有 JSDoc、测试文件、AI 可用
When: 运行补充
Then: 参数说明从 JSDoc 提取（优先级最高）
  AND AC 从测试提取（优先级次高）
  AND FR 描述由 AI 生成（优先级最低）
  AND 所有占位符都被填充或标注
```

**验证**:
```javascript
// 检查参数说明来自 JSDoc
grep "从 JSDoc 提取" engines-solo.fspec.md

// 检查 AC 来自测试
grep "提取自测试" engines-solo.fspec.md

// 检查 FR 来自 AI
grep "🤖 **AI 生成**" engines-solo.fspec.md
```

---

### AC-006: 质量等级标注

**场景**:
```
Given: 补充完成的规格
When: 查看规格内容
Then: 每个补充内容都有质量标注
  AND frontmatter 记录所有补充来源
  AND 可区分哪些需要人工审核（AI 生成）
  AND 可区分哪些可信度高（测试、JSDoc）
```

**验证**:
```bash
# 检查质量标注
grep "提取自测试" engines-solo.fspec.md   # 高可靠
grep "提取自 JSDoc" engines-solo.fspec.md # 高可靠
grep "🤖 **AI 生成**" engines-solo.fspec.md # 需审核
grep "⚠️ **待补充**" engines-solo.fspec.md  # 未填充

# 检查 frontmatter
grep "enrichment_sources:" engines-solo.fspec.md
```

---

## 技术设计 (Technical Design)

### 核心模块

```
lib/
├── spec/
│   └── enrich.js              # 主入口，协调补充流程
├── parsers/
│   └── test-parser.js         # 测试文件解析器
├── ai/
│   ├── prompt-builder.js      # AI 提示构建
│   └── client.js              # AI API 客户端
└── cli/
    └── spec-enrich.js         # CLI 包装器
```

### 库函数接口

```javascript
// lib/spec/enrich.js

const { z } = require('zod');

const OptionsSchema = z.object({
  specPath: z.string(),
  extractTests: z.boolean().default(true),
  useAI: z.boolean().default(true),
  aiProvider: z.enum(['gemini', 'openai', 'claude']).default('gemini')
});

/**
 * 补充规格细节
 *
 * @param {object} options - 配置选项
 * @returns {Promise<{success: boolean, stats: object}>}
 */
async function enrichSpec(options) {
  const opts = OptionsSchema.parse(options);

  // 1. 读取规格文件
  const spec = await specParser.read(opts.specPath);

  // 2. 提取测试文件 AC
  let acCount = 0;
  if (opts.extractTests) {
    const testPath = inferTestPath(spec.frontmatter.codePath);
    if (fs.existsSync(testPath)) {
      const tests = await testParser.extract(testPath);
      spec.acceptanceCriteria = generateACFromTests(tests);
      acCount = spec.acceptanceCriteria.length;
    }
  }

  // 3. AI 生成 FR
  let frCount = 0;
  if (opts.useAI) {
    try {
      const code = await fs.readFile(spec.frontmatter.codePath, 'utf8');
      const prompt = promptBuilder.buildFRPrompt(code, spec);
      const aiResponse = await aiClient.complete(prompt, {
        provider: opts.aiProvider
      });
      spec.functionalRequirements = parseFRFromAI(aiResponse);
      frCount = spec.functionalRequirements.length;
    } catch (error) {
      // 优雅降级：AI 失败不影响测试提取
      console.warn(`⚠️ AI 生成失败: ${error.message}`);
    }
  }

  // 4. 更新 frontmatter
  spec.frontmatter.enriched = true;
  spec.frontmatter.enrichment_sources = {
    tests: testPath ? `${testPath} (${acCount} AC)` : null,
    ai: frCount > 0 ? `${opts.aiProvider} (${frCount} FR)` : null
  };

  // 5. 保存更新后的规格
  await specParser.write(opts.specPath, spec);

  return {
    success: true,
    stats: {
      acExtracted: acCount,
      frGenerated: frCount
    }
  };
}

module.exports = enrichSpec;
module.exports.OptionsSchema = OptionsSchema;
```

### CLI 包装器

```javascript
#!/usr/bin/env node
// lib/cli/spec-enrich.js

const enrichSpec = require('../spec/enrich');
const { parseArgs } = require('node:util');

const ExitCode = {
  SUCCESS: 0,
  PARTIAL_SUCCESS: 1,
  SYSTEM_ERROR: 2,
  CONFIG_ERROR: 3,
  SPEC_NOT_FOUND: 4
};

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      all: { type: 'boolean' },
      'no-tests': { type: 'boolean' },
      'no-ai': { type: 'boolean' },
      'ai-provider': { type: 'string', default: 'gemini' },
      help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: true
  });

  if (values.help) {
    console.log(`
Usage: spec-enrich <spec-file> [options]

Options:
  --all                补充所有规格文件
  --no-tests           不从测试文件提取 AC
  --no-ai              不使用 AI 生成 FR
  --ai-provider <name> AI 提供商（gemini/openai/claude，默认 gemini）
  -h, --help           显示帮助
    `);
    process.exit(ExitCode.SUCCESS);
  }

  if (values.all) {
    await enrichAll(values);
  } else {
    const specPath = positionals[0];
    if (!specPath) {
      console.error('❌ 错误: 请指定规格文件');
      process.exit(ExitCode.CONFIG_ERROR);
    }
    await enrichSingle(specPath, values);
  }
}

async function enrichSingle(specPath, options) {
  if (!fs.existsSync(specPath)) {
    console.error(`❌ 错误: 规格文件不存在: ${specPath}`);
    process.exit(ExitCode.SPEC_NOT_FOUND);
  }

  try {
    const result = await enrichSpec({
      specPath,
      extractTests: !options['no-tests'],
      useAI: !options['no-ai'],
      aiProvider: options['ai-provider']
    });

    console.log(`✅ 补充完成: ${specPath}`);
    console.log(`  AC: ${result.stats.acExtracted} 个（从测试提取）`);
    console.log(`  FR: ${result.stats.frGenerated} 个（AI 生成）`);

    process.exit(ExitCode.SUCCESS);
  } catch (error) {
    console.error(`❌ 补充失败: ${error.message}`);
    process.exit(ExitCode.SYSTEM_ERROR);
  }
}

async function enrichAll(options) {
  const specFiles = await globFiles('openspec/changes/**/specs/*.fspec.md');

  console.log(`✅ 批量补充规格\n`);

  let totalAC = 0, totalFR = 0;
  let successCount = 0;

  for (let i = 0; i < specFiles.length; i++) {
    const file = specFiles[i];
    const progress = Math.floor((i / specFiles.length) * 20);
    const bar = '█'.repeat(progress) + ' '.repeat(20 - progress);
    process.stdout.write(`\r进度: ${bar} ${Math.floor((i / specFiles.length) * 100)}% (${i}/${specFiles.length})`);

    try {
      const result = await enrichSpec({
        specPath: file,
        extractTests: !options['no-tests'],
        useAI: !options['no-ai'],
        aiProvider: options['ai-provider']
      });

      totalAC += result.stats.acExtracted;
      totalFR += result.stats.frGenerated;
      successCount++;
    } catch (error) {
      console.error(`\n⚠️ ${file} → 失败: ${error.message}`);
    }
  }

  console.log(`\n\n统计:`);
  console.log(`  规格文件: ${specFiles.length} 个`);
  console.log(`  AC 总数: ${totalAC} 个`);
  console.log(`  FR 总数: ${totalFR} 个`);
  console.log(`  成功率: ${Math.floor((successCount / specFiles.length) * 100)}%`);

  process.exit(ExitCode.SUCCESS);
}

if (require.main === module) {
  main();
}

module.exports = main;
module.exports.ExitCode = ExitCode;
```

### 测试解析器

```javascript
// lib/parsers/test-parser.js

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

/**
 * 从测试文件提取测试用例
 *
 * @param {string} testFilePath - 测试文件路径
 * @returns {Array<{description: string, code: string, line: number}>}
 */
async function extract(testFilePath) {
  const code = await fs.readFile(testFilePath, 'utf8');
  const ast = parser.parse(code, {
    sourceType: 'module'
  });

  const tests = [];

  traverse(ast, {
    CallExpression(path) {
      // 匹配 test('description', ...)
      if (path.node.callee.name === 'test' && path.node.arguments.length >= 2) {
        const description = path.node.arguments[0].value;
        const callback = path.node.arguments[1];

        tests.push({
          description,
          code: extractFunctionBody(callback),
          line: path.node.loc.start.line
        });
      }
    }
  });

  return tests;
}

function extractFunctionBody(node) {
  // 提取函数体代码
  // 简化实现，实际需要处理 AST
  return '...';
}

module.exports = { extract };
```

---

## 派生产物 (Derived Outputs)

> **路径规范**: 遵循 `.seed/config.json` 中的 `paths` 配置。

| 类型 | 路径 | 说明 |
|------|------|------|
| **库函数** | `skills/mob-seed/lib/spec/enrich.js` | 核心补充逻辑 |
| | `skills/mob-seed/lib/parsers/test-parser.js` | 测试解析 |
| | `skills/mob-seed/lib/ai/prompt-builder.js` | AI 提示构建 |
| | `skills/mob-seed/lib/ai/client.js` | AI API 客户端 |
| **CLI 包装** | `skills/mob-seed/lib/cli/spec-enrich.js` | CLI 入口 |
| **测试** | `skills/mob-seed/test/spec/enrich.test.js` | 核心逻辑测试 (🔴 ≥95%) |
| | `skills/mob-seed/test/parsers/test-parser.test.js` | 解析器测试 (🔴 ≥95%) |
| | `skills/mob-seed/test/ai/prompt-builder.test.js` | 提示构建测试 (🟡 ≥85%) |
| | `skills/mob-seed/test/cli/spec-enrich.test.js` | CLI 测试 (🟡 ≥85%) |
| **命令文档** | `commands/spec.md` | 新增"操作 5: enrich"章节 |
| **提示模板** | `skills/mob-seed/prompts/enrich-fr.md` | AI FR 生成提示 |

---

## 依赖 (Dependencies)

**复用现有**:
- `@babel/parser`（已有，用于 spec-extract）
- `@babel/traverse`（已有，用于 spec-extract）
- `zod`（已有，用于参数验证）

**AI 客户端**:
- Gemini: 使用 `@google/generative-ai`（可能已有）
- OpenAI: 使用 `openai`（可能已有）
- Claude: 使用 `@anthropic-ai/sdk`（可能已有）

**不新增依赖**（复用或内置实现）。

---

## 成功标准 (Success Criteria)

### 核心功能
- [ ] 从测试文件提取 AC 成功（AC-001）
- [ ] AI 生成 FR 描述成功（AC-002）
- [ ] AI 失败优雅降级（AC-003）
- [ ] 批量补充显示进度和统计（AC-004）
- [ ] 智能占位符填充（AC-005）
- [ ] 质量等级标注（AC-006）

### 质量保证
- [ ] 🔴 High Risk 模块测试覆盖率 ≥95%
  - `lib/spec/enrich.js`
  - `lib/parsers/test-parser.js`
- [ ] 🟡 Medium Risk 模块测试覆盖率 ≥85%
  - `lib/ai/prompt-builder.js`
  - `lib/cli/spec-enrich.js`

### 实际验证
- [ ] AC 自动化率 > 60%（mars-nexus 82 个模块）
- [ ] FR 自动化率 > 50%（有 JSDoc 的模块）
- [ ] AI 成功率 > 80%（网络正常情况）
- [ ] 补充后规格质量提升 2x（占位符减少 50%+）

### 文档完整
- [ ] `commands/spec.md` 新增"操作 5: enrich"章节
- [ ] `prompts/enrich-fr.md` AI 提示模板完整
- [ ] 命令帮助文本完整（--help）

---

## 风险与缓解 (Risks and Mitigation)

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| AI API 限流 | 批量补充失败 | 中 | 控制并发数，实现重试机制 |
| AI 生成内容不准确 | FR 误导开发 | 高 | 明确标注需审核，提供质量等级 |
| 测试描述不清晰 | AC 质量低 | 中 | 保留原测试代码，引导用户改进 |
| 无测试文件 | 无法提取 AC | 中 | 生成模板占位符，提示编写测试 |
| AI 成本 | 大规模使用成本高 | 低 | 提供 `--no-ai` 选项，用户可选择 |

---

## 后续演进 (Future Enhancements)

v3.4 可能增强：
- 支持更多 AI 提供商（DeepSeek、本地模型）
- 从 Git commit 历史推断 FR
- 多轮 AI 对话优化 FR 质量
- 用户反馈学习（标注哪些 AI 生成需要修改）
- 自动验证 AI 生成内容（与代码逻辑对比）
