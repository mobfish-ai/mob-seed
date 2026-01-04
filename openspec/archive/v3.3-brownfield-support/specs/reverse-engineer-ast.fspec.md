---
status: archived
archived: 2026-01-03
created: 2026-01-03
updated: 2026-01-03
architecture_decisions_completed: true
---

# reverse-engineer - AST 反向工程工具脚本

## 概述 (Overview)

基于 Babel AST 的精确代码分析工具，从 JavaScript 代码中提取结构化信息，为规格生成提供高质量数据。

**核心能力**：
- AST 精确解析（@babel/parser）
- 方法签名提取（函数名、参数、返回类型）
- JSDoc 注释提取（描述、@param、@returns）
- 测试用例提取（test() 描述）
- 依赖关系分析（import/require 语句）

**适用场景**：
- `spec extract` 命令的底层引擎
- 批量代码分析和文档生成
- 代码质量检查工具集成

---

## 架构决策检查清单 (Architecture Decisions)

> **重要**: 所有架构决策已完成。以下记录了关键决策和理由。

### 1. 目录结构设计

**决策点**: 新增代码应该放在哪个目录？

- [x] 按功能分层（`scripts/reverse-engineer.js` - 工具脚本）
- [ ] 按模块分组
- [ ] 扁平结构

**选择**: 按功能分层

**理由**:
- `scripts/reverse-engineer.js` - 独立可执行工具脚本
- 不放在 `lib/` 因为它是 CLI 工具，而非库函数
- 可被 `lib/spec/from-code.js` 调用，也可独立运行

---

### 2. 命名规范

**决策点**: 文件和函数如何命名？

- [x] 动词-对象模式（`reverse-engineer.js`, `extractMethods()`）
- [ ] 对象-动词模式
- [ ] 名词模式

**选择**: 动词-对象模式

**理由**:
- `reverse-engineer.js` - 明确表达"反向工程"动作
- `extractMethods()`, `extractJSDoc()` - 动词开头，清晰表达功能
- 与现有脚本命名一致（exec-runner.js, detect-project.js）

---

### 3. 库与 CLI 分离

**决策点**: 是否需要分离库函数和 CLI 入口？

- [ ] **是** - 分离
- [x] **否** - 混合（工具脚本，同时支持两种调用方式）

**选择**: 混合

**适用场景**:
- **CLI 调用**: `node scripts/reverse-engineer.js lib/engines/solo.js`
- **库调用**: `const { extractMethods } = require('scripts/reverse-engineer.js')`
- 作为工具脚本，无需严格分离，减少文件数量

---

### 4. 错误处理策略

**决策点**: 如何处理错误和失败？

- [x] 优雅降级（AST 解析失败 → 返回空结果 + 错误标记）
- [ ] 快速失败
- [ ] 静默失败

**选择**: 优雅降级

**降级路径**:
```
AST 解析
    ↓ 失败（语法错误）
返回 { methods: [], errors: ['Syntax error at line X'] }
    ↓
调用方可选择继续处理其他文件或中止
```

**理由**:
- 批量处理时，单个文件失败不应中断整个流程
- 错误信息返回给调用方，由调用方决定如何处理
- 保证工具的健壮性

---

### 5. 退出码设计

**决策点**: CLI 工具如何返回状态？

- [x] 分层退出码
- [ ] 简单退出码
- [ ] 不关心退出码

**选择**: 分层退出码

**码值定义**:
```javascript
const ExitCode = {
  SUCCESS: 0,           // 全部成功解析
  PARTIAL_FAILURE: 1,   // 部分文件失败（但返回了可用数据）
  SYSTEM_ERROR: 2,      // 文件读取失败、依赖缺失
  SYNTAX_ERROR: 3,      // 代码语法错误无法解析
  INVALID_INPUT: 4      // 输入参数无效
};
```

---

### 6. Git Hooks 集成方式

**决策点**: 如果需要 Git Hooks，如何调用？

- [ ] 三层回退
- [ ] 单一方式
- [x] 不需要 Git Hooks（独立工具脚本）

**选择**: 不需要 Git Hooks

**理由**: 作为按需调用的工具脚本，不涉及 Git Hooks 集成

---

### 7. 测试覆盖率要求

**决策点**: 各模块的测试覆盖率目标？

- [x] 按风险分级
- [ ] 统一标准
- [ ] 无强制要求

**选择**: 按风险分级

**风险分级**:
- 🔴 High Risk (≥95%):
  - `extractMethodsAST()` - AST 解析核心，错误会导致信息提取失败
  - `extractJSDoc()` - JSDoc 解析，影响文档质量
- 🟡 Medium Risk (≥85%):
  - `extractImports()` - 依赖关系提取
  - `parseTestFile()` - 测试用例提取
- 🟢 Low Risk (≥75%):
  - CLI 参数处理
  - 输出格式化

---

### 8. 废弃策略

**决策点**: 如果需要废弃旧功能，如何平滑过渡？

- [ ] 版本化废弃
- [ ] 立即废弃
- [x] 不需要废弃（新增工具）

**选择**: 不需要废弃

**理由**: 这是 v3.3 新增工具，无历史包袱

---

## 需求 (Requirements)

### 功能需求 (Functional Requirements)

- [ ] FR-001: **精确 AST 解析** - 使用 @babel/parser 解析 JavaScript 代码为 AST
  - 输入: JavaScript 文件路径
  - 输出: AST 对象或错误信息
  - 成功率: ≥99%（排除语法错误文件）

- [ ] FR-002: **方法签名提取** - 从 AST 中提取所有函数/方法的签名
  - 提取内容: 函数名、参数列表、返回类型（JSDoc）、是否 async/generator
  - 支持: 函数声明、函数表达式、箭头函数、类方法
  - 准确率: ≥98%

- [ ] FR-003: **JSDoc 注释提取** - 提取函数的 JSDoc 注释
  - 提取字段: @description, @param, @returns, @throws, @example
  - 关联: 自动关联到对应函数
  - 格式化: 转换为规格模板所需格式

- [ ] FR-004: **测试用例提取** - 从测试文件提取 test() 描述
  - 支持: test(), it(), describe() 嵌套结构
  - 提取: 测试描述、测试类型（单元/集成）
  - 输出: AC 候选列表

- [ ] FR-005: **依赖关系分析** - 提取 import/require 语句
  - 区分: 内部依赖 vs 外部依赖
  - 提取: 模块路径、导入成员
  - 用途: 生成规格的"依赖"章节

### 非功能需求 (Non-Functional Requirements)

- [ ] NFR-001: **性能** - 单文件解析时间 < 100ms（1000 行代码）
- [ ] NFR-002: **内存** - 处理 10MB 文件时内存占用 < 50MB
- [ ] NFR-003: **可扩展性** - 支持添加新的提取器（如 TypeScript）

---

## 约束 (Constraints)

### 技术约束

- **语言**: CommonJS（与现有脚本一致）
- **依赖**: @babel/parser ^7.23.0, @babel/traverse ^7.23.0
- **Node.js**: ≥18.0.0

### 业务约束

- **向后兼容**: 不影响现有 SEED 工作流
- **准确率要求**: 方法识别准确率 > 95%（vs 正则方案 ~85%）

---

## 验收标准 (Acceptance Criteria)

### AC-001: AST 解析成功率

- **Given**: 100 个语法正确的 JavaScript 文件
- **When**: 使用 extractMethodsAST() 解析
- **Then**:
  - 99+ 个文件成功解析
  - 失败文件返回清晰错误信息
  - 解析时间 < 100ms/文件

### AC-002: 方法签名提取准确性

- **Given**: 包含多种函数定义的测试文件
  ```javascript
  function foo(a, b) {}           // 函数声明
  const bar = (x) => x * 2;       // 箭头函数
  class Baz { method() {} }       // 类方法
  async function* gen() {}        // async generator
  ```
- **When**: 提取方法签名
- **Then**:
  - 识别所有 4 个函数/方法
  - 正确提取参数列表
  - 正确标记 async/generator 属性

### AC-003: JSDoc 完整提取

- **Given**: 带有 JSDoc 注释的函数
  ```javascript
  /**
   * Calculate sum of two numbers
   * @param {number} a - First number
   * @param {number} b - Second number
   * @returns {number} Sum of a and b
   * @throws {TypeError} If inputs are not numbers
   */
  function add(a, b) { return a + b; }
  ```
- **When**: 提取 JSDoc
- **Then**:
  - description: "Calculate sum of two numbers"
  - params: [{ name: 'a', type: 'number', desc: 'First number' }, ...]
  - returns: { type: 'number', desc: 'Sum of a and b' }
  - throws: [{ type: 'TypeError', desc: 'If inputs are not numbers' }]

### AC-004: 测试用例提取

- **Given**: 测试文件
  ```javascript
  describe('Calculator', () => {
    test('should add two numbers', () => { ... });
    it('should subtract two numbers', () => { ... });
  });
  ```
- **When**: 提取测试用例
- **Then**:
  - AC候选: ['should add two numbers', 'should subtract two numbers']
  - 关联: 标记为 'Calculator' 组

### AC-005: 依赖关系提取

- **Given**: 包含多种 import 的文件
  ```javascript
  import fs from 'fs';
  import { parse } from './parser.js';
  const yaml = require('yaml');
  ```
- **When**: 提取依赖关系
- **Then**:
  - 外部依赖: ['fs', 'yaml']
  - 内部依赖: ['./parser.js']
  - 导入成员: { 'fs': 'default', './parser.js': ['parse'] }

### AC-006: 错误处理

- **Given**: 语法错误的 JavaScript 文件
  ```javascript
  function broken( { // 缺少右括号
  ```
- **When**: 尝试解析
- **Then**:
  - 返回 { success: false, errors: ['Syntax error: ...'] }
  - 退出码: 3 (SYNTAX_ERROR)
  - 不抛出未捕获异常

---

## 派生产物 (Derived Outputs)

> **路径规范**: 所有路径必须遵循 `.seed/config.json` 中的 `paths` 配置。

| 类型 | 路径 | 说明 |
|------|------|------|
| 工具脚本 | skills/mob-seed/scripts/reverse-engineer.js | 主入口（可执行） |
| 测试 | skills/mob-seed/test/scripts/reverse-engineer.test.js | 单元测试 |
| 依赖 | skills/mob-seed/package.json | 添加 @babel 依赖 |

---

## 技术设计 (Technical Design)

### 核心函数接口

```javascript
// scripts/reverse-engineer.js

/**
 * 提取方法签名（AST 精确解析）
 * @param {string} codePath - 代码文件路径
 * @returns {Promise<ExtractResult>}
 */
async function extractMethodsAST(codePath) {
  const code = await fs.readFile(codePath, 'utf8');

  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']  // 支持 JSX 和 TS
    });

    const methods = [];

    traverse(ast, {
      FunctionDeclaration(path) {
        methods.push(extractMethodInfo(path.node));
      },
      FunctionExpression(path) {
        methods.push(extractMethodInfo(path.node));
      },
      ArrowFunctionExpression(path) {
        methods.push(extractMethodInfo(path.node));
      },
      ClassMethod(path) {
        methods.push(extractMethodInfo(path.node, path.parent.id?.name));
      }
    });

    return {
      success: true,
      methods,
      source: 'AST',
      quality: 'high'
    };

  } catch (error) {
    return {
      success: false,
      methods: [],
      errors: [error.message],
      source: 'AST',
      quality: 'failed'
    };
  }
}

/**
 * 提取单个方法信息
 */
function extractMethodInfo(node, className = null) {
  return {
    name: node.id?.name || node.key?.name || '<anonymous>',
    className,
    params: node.params.map(p => ({
      name: p.name || p.left?.name,  // 支持默认参数
      type: extractTypeFromComment(node) || 'any'
    })),
    async: node.async || false,
    generator: node.generator || false,
    jsdoc: extractJSDocFromComments(node.leadingComments),
    loc: {
      start: node.loc.start.line,
      end: node.loc.end.line
    }
  };
}

/**
 * 提取 JSDoc 注释
 */
function extractJSDocFromComments(comments) {
  if (!comments || comments.length === 0) return null;

  const jsdocComment = comments.find(c => c.type === 'CommentBlock' && c.value.startsWith('*'));
  if (!jsdocComment) return null;

  const lines = jsdocComment.value.split('\n').map(line => line.trim());

  return {
    description: extractDescription(lines),
    params: extractParams(lines),
    returns: extractReturns(lines),
    throws: extractThrows(lines),
    examples: extractExamples(lines)
  };
}

/**
 * 提取测试用例
 */
async function extractTestCases(testPath) {
  const code = await fs.readFile(testPath, 'utf8');
  const ast = parser.parse(code, { sourceType: 'module' });

  const testCases = [];

  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee.name;

      if (['test', 'it', 'describe'].includes(callee)) {
        const description = path.node.arguments[0]?.value;
        const type = callee === 'describe' ? 'group' : 'test';

        testCases.push({ description, type });
      }
    }
  });

  return testCases;
}

/**
 * 提取 import 依赖
 */
async function extractImports(codePath) {
  const code = await fs.readFile(codePath, 'utf8');
  const ast = parser.parse(code, { sourceType: 'module' });

  const imports = {
    external: [],
    internal: []
  };

  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      const category = source.startsWith('.') ? 'internal' : 'external';

      imports[category].push({
        source,
        specifiers: path.node.specifiers.map(s => ({
          imported: s.imported?.name || 'default',
          local: s.local.name
        }))
      });
    },
    CallExpression(path) {
      if (path.node.callee.name === 'require') {
        const source = path.node.arguments[0]?.value;
        if (source) {
          const category = source.startsWith('.') ? 'internal' : 'external';
          imports[category].push({ source, specifiers: [] });
        }
      }
    }
  });

  return imports;
}
```

### CLI 模式

```bash
# 提取方法签名
node scripts/reverse-engineer.js extract-methods lib/engines/solo.js

# 提取测试用例
node scripts/reverse-engineer.js extract-tests test/engines/solo.test.js

# 提取依赖关系
node scripts/reverse-engineer.js extract-imports lib/engines/solo.js

# 完整分析（所有信息）
node scripts/reverse-engineer.js analyze lib/engines/solo.js --output=json
```

### 输出格式

```json
{
  "success": true,
  "file": "lib/engines/solo.js",
  "analysis": {
    "methods": [
      {
        "name": "execute",
        "className": "SoloEngine",
        "params": [
          { "name": "prompt", "type": "string" },
          { "name": "options", "type": "object" }
        ],
        "async": true,
        "jsdoc": {
          "description": "Execute a solo mode operation",
          "params": [
            { "name": "prompt", "type": "string", "desc": "User prompt" }
          ],
          "returns": { "type": "Promise<Result>", "desc": "Execution result" }
        },
        "loc": { "start": 42, "end": 68 }
      }
    ],
    "imports": {
      "external": ["zod", "yaml"],
      "internal": ["./base-engine.js"]
    },
    "stats": {
      "totalMethods": 8,
      "withJSDoc": 6,
      "asyncMethods": 3
    }
  },
  "quality": "high",
  "source": "AST"
}
```

---

## 依赖 (Dependencies)

### 前置规格

- 无（独立工具）

### 外部依赖

```json
{
  "@babel/parser": "^7.23.0",
  "@babel/traverse": "^7.23.0"
}
```

### 内部依赖

- `lib/spec/parser.js` - 规格文件 I/O（调用方）

---

## 测试策略

### 单元测试

```javascript
// test/scripts/reverse-engineer.test.js

describe('extractMethodsAST', () => {
  test('should extract function declarations', async () => {
    const result = await extractMethodsAST('test/fixtures/functions.js');
    expect(result.success).toBe(true);
    expect(result.methods).toHaveLength(3);
    expect(result.methods[0].name).toBe('add');
  });

  test('should handle syntax errors gracefully', async () => {
    const result = await extractMethodsAST('test/fixtures/broken.js');
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});

describe('extractJSDocFromComments', () => {
  test('should extract complete JSDoc', () => {
    const ast = parser.parse('/** @param {number} x */ function foo(x) {}');
    const jsdoc = extractJSDocFromComments(ast.comments);
    expect(jsdoc.params[0].name).toBe('x');
    expect(jsdoc.params[0].type).toBe('number');
  });
});
```

### 测试覆盖率目标

- `extractMethodsAST()`: ≥95%
- `extractJSDoc()`: ≥95%
- `extractTestCases()`: ≥85%
- `extractImports()`: ≥85%

---

## 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0.0 | 2026-01-03 | 初始版本 | AI |
