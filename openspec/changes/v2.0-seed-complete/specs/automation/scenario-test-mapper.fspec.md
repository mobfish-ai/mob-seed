# Feature: Scenario → Test Mapper (场景测试映射器)

> 状态: implementing
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/automation/
> 优先级: P1
> 预计工作量: 2-3天

## 概述

从 fspec 文件中的 WHEN/THEN 场景描述自动生成测试代码骨架，支持多种测试框架。

## ADDED Requirements

### REQ-001: WHEN/THEN 语法解析

The system SHALL parse WHEN/THEN scenario syntax from fspec files.

**支持的语法格式:**

```markdown
**Scenario: 场景名称**
- WHEN 前置条件1
- AND 前置条件2
- THEN 期望结果1
- AND 期望结果2
```

**Scenario: 解析场景块**
- WHEN 读取包含 Scenario 块的 fspec 文件
- THEN 提取场景名称、WHEN 条件、THEN 断言
- AND 返回结构化的 Scenario 对象

**Acceptance Criteria:**
- [ ] AC-001: 识别 `**Scenario:**` 标记
- [ ] AC-002: 解析 WHEN/AND/THEN 行
- [ ] AC-003: 支持中英文混合描述

### REQ-002: 测试代码生成

The system SHALL generate test code from scenarios.

**映射规则:**

| Scenario 元素 | 测试代码 | 示例 |
|--------------|----------|------|
| Scenario 名称 | `describe()` 或 `test()` | `describe('用户登录')` |
| WHEN 条件 | `beforeEach` 或 setup | 设置测试环境 |
| AND (WHEN后) | 追加到 setup | 额外的前置条件 |
| THEN 断言 | `expect()` 语句 | `expect(result).toBe(...)` |
| AND (THEN后) | 追加断言 | 额外的期望结果 |

**Scenario: 生成 Jest 测试**
- WHEN 指定 framework='jest'
- AND 提供解析后的 Scenario
- THEN 生成 Jest 测试代码骨架
- AND 包含 TODO 注释标记待填充部分

**生成示例:**

```javascript
// 输入 Scenario:
// **Scenario: 用户登录成功**
// - WHEN 用户输入正确的用户名和密码
// - AND 点击登录按钮
// - THEN 显示欢迎消息
// - AND 跳转到首页

// 输出测试代码:
describe('用户登录成功', () => {
  beforeEach(() => {
    // WHEN: 用户输入正确的用户名和密码
    // TODO: 设置用户名和密码

    // AND: 点击登录按钮
    // TODO: 触发登录操作
  });

  it('should 显示欢迎消息', () => {
    // THEN: 显示欢迎消息
    // TODO: expect(...).toContain('欢迎')
  });

  it('should 跳转到首页', () => {
    // AND: 跳转到首页
    // TODO: expect(location).toBe('/')
  });
});
```

**Acceptance Criteria:**
- [ ] AC-004: 生成有效的 Jest 语法
- [ ] AC-005: 保留原始场景描述作为注释
- [ ] AC-006: TODO 标记待实现部分

### REQ-003: 多框架支持

The system SHALL support multiple test frameworks.

**支持的框架:**

| 框架 | 配置值 | 文件后缀 |
|------|--------|----------|
| Jest | jest | .test.js |
| Mocha | mocha | .spec.js |
| Node Test Runner | node | .test.js |
| Vitest | vitest | .test.ts |

**Scenario: 生成 Node Test Runner 测试**
- WHEN 指定 framework='node'
- THEN 使用 `node:test` 模块语法
- AND 使用 `node:assert` 断言

**Scenario: 生成 TypeScript 测试**
- WHEN 指定 typescript=true
- THEN 生成 .test.ts 文件
- AND 包含类型注解

**Acceptance Criteria:**
- [ ] AC-007: 支持至少 4 种框架
- [ ] AC-008: 自动检测项目使用的框架
- [ ] AC-009: 支持 TypeScript 输出

### REQ-004: 批量生成

The system SHALL batch generate tests from multiple scenarios.

**Scenario: 批量生成测试文件**
- WHEN 指定 fspec 文件或目录
- THEN 扫描所有 Scenario 块
- AND 按功能模块组织生成测试文件

**输出结构:**

```
test/
├── {module}/
│   ├── {feature}.test.js     # 从 fspec 生成
│   └── {feature}.manual.js   # 手动补充（不覆盖）
```

**Acceptance Criteria:**
- [ ] AC-010: 递归扫描 fspec 文件
- [ ] AC-011: 不覆盖已存在的 .manual.js 文件
- [ ] AC-012: 生成测试目录结构

### REQ-005: 智能断言推断

The system SHALL infer assertions from THEN descriptions.

**推断规则:**

| THEN 描述模式 | 推断的断言 |
|--------------|-----------|
| 显示/展示 XXX | `expect(...).toBeVisible()` |
| 返回 XXX | `expect(result).toBe(...)` |
| 包含 XXX | `expect(...).toContain(...)` |
| 等于 XXX | `expect(...).toEqual(...)` |
| 跳转到 XXX | `expect(location).toBe(...)` |
| 抛出 XXX 错误 | `expect(...).toThrow(...)` |

**Scenario: 智能推断断言类型**
- WHEN THEN 描述包含"显示欢迎消息"
- THEN 推断使用 `toContain` 或 `toBeVisible`
- AND 生成相应的断言骨架

**Acceptance Criteria:**
- [ ] AC-013: 识别常见断言模式
- [ ] AC-014: 生成合适的 expect 语法
- [ ] AC-015: 不确定时使用通用 TODO

### REQ-006: 增量更新

The system SHALL support incremental test updates.

**Scenario: 更新已存在的测试**
- WHEN fspec 中新增了 Scenario
- AND 测试文件已存在
- THEN 仅追加新 Scenario 的测试
- AND 保留已有的测试实现

**Scenario: 检测场景变更**
- WHEN fspec 中 Scenario 描述变更
- THEN 标记对应测试为需更新
- AND 不自动覆盖已实现的测试

**Acceptance Criteria:**
- [ ] AC-016: 基于 Scenario 名称匹配
- [ ] AC-017: 追加模式（不覆盖）
- [ ] AC-018: 变更检测报告

## 导出接口

```javascript
module.exports = {
  // 解析
  parseScenarios,         // (fspecContent) => Scenario[]
  parseScenarioBlock,     // (block) => Scenario

  // 生成
  generateTestCode,       // (scenario, options) => string
  generateTestFile,       // (scenarios, options) => string
  batchGenerate,          // (fspecDir, outputDir, options) => GenerateResult

  // 框架支持
  getFrameworkAdapter,    // (framework) => Adapter
  detectFramework,        // (projectDir) => string

  // 智能推断
  inferAssertion,         // (thenDescription) => AssertionHint

  // 增量更新
  diffScenarios,          // (oldScenarios, newScenarios) => Diff
  mergeTestFile,          // (existingCode, newScenarios) => string
};
```

## 配置项

```json
{
  "scenarioMapper": {
    "framework": "auto",
    "typescript": false,
    "outputDir": "test/",
    "preserveManual": true,
    "inferAssertions": true,
    "todoMarker": "TODO: "
  }
}
```

## 依赖

- `lib/lifecycle/parser.js` - fspec 解析
- 测试框架 SDK（可选）

## 测试要点

1. 各种 Scenario 语法解析
2. 多框架代码生成
3. 智能断言推断准确性
4. 增量更新不丢失代码
5. TypeScript 输出正确性
