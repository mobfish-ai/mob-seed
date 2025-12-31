# {功能名称} 规格

> 版本: 1.0.0
> 创建时间: YYYY-MM-DD
> 最后更新: YYYY-MM-DD
> 模板: javascript
> 技术栈: JavaScript / Node.js

---

## 概述 (Overview)

### 功能描述
{简要描述功能用途}

### 目标用户
{目标用户群体}

### 核心价值
{解决什么问题，带来什么价值}

### 技术栈
- **运行时**: Node.js 18+
- **语言**: JavaScript (ESM)
- **测试**: Node.js Test Runner
- **包管理**: npm / pnpm

---

## 需求 (Requirements)

### 功能需求 (Functional Requirements)

- [ ] FR-001: {需求描述}
- [ ] FR-002: {需求描述}

### 非功能需求 (Non-Functional Requirements)

- [ ] NFR-001: 性能 - {性能要求}
- [ ] NFR-002: 兼容性 - Node.js 18+

---

## 约束 (Constraints)

### 技术约束
- 运行时: Node.js 18+
- 模块系统: ESM (type: "module")
- 无外部运行时依赖（仅开发依赖）

### 编码规范
- 命名: camelCase (变量/函数), PascalCase (类)
- 导出: 使用 named exports
- 注释: 使用 JSDoc 格式

### 依赖约束
- 优先使用 Node.js 内置模块
- 第三方依赖需在 package.json 声明

---

## 验收标准 (Acceptance Criteria)

### AC-001: {标准名称}
- **Given**: {前置条件}
- **When**: {操作}
- **Then**:
  - {期望结果1}
  - {期望结果2}

### AC-002: {标准名称}
- **Given**: {前置条件}
- **When**: {操作}
- **Then**:
  - {期望结果}

---

## 接口定义 (Interface Definitions)

```javascript
/**
 * @typedef {Object} TypeName
 * @property {string} field1
 * @property {number} field2
 */

/**
 * @param {ParamType} param
 * @returns {ReturnType}
 */
function functionName(param) {}
```

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | src/{name}.js | 主模块 |
| 测试 | test/{name}.test.js | 单元测试 |
| 文档 | docs/{name}.md | 使用文档 |

---

## 依赖 (Dependencies)

### 前置规格
- 无

### 外部依赖
```json
{
  "type": "module",
  "engines": { "node": ">=18" }
}
```

---

## 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0.0 | YYYY-MM-DD | 初始版本 | {作者} |
