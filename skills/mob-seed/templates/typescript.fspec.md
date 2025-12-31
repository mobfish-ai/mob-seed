# {功能名称} 规格

> 版本: 1.0.0
> 创建时间: YYYY-MM-DD
> 最后更新: YYYY-MM-DD
> 模板: typescript
> 技术栈: TypeScript / Deno

---

## 概述 (Overview)

### 功能描述
{简要描述功能用途}

### 目标用户
{目标用户群体}

### 核心价值
{解决什么问题，带来什么价值}

### 技术栈
- **运行时**: Deno / Node.js
- **语言**: TypeScript
- **测试**: Deno Test / Vitest
- **构建**: deno compile / tsc

---

## 需求 (Requirements)

### 功能需求 (Functional Requirements)

- [ ] FR-001: {需求描述}
- [ ] FR-002: {需求描述}

### 非功能需求 (Non-Functional Requirements)

- [ ] NFR-001: 类型安全 - 严格模式无 any
- [ ] NFR-002: 性能 - {性能要求}
- [ ] NFR-003: 兼容性 - Deno 1.40+ / Node 18+

---

## 约束 (Constraints)

### 技术约束
- 语言: TypeScript 5.0+
- 运行时: Deno 1.40+ 或 Node.js 18+
- 严格模式: `"strict": true`
- 模块系统: ESM

### 编码规范
- 命名: camelCase (变量/函数), PascalCase (类型/接口)
- 导出: 使用 named exports
- 类型: 优先使用 interface，避免 any

### 依赖约束
- 优先使用 Deno 标准库
- 第三方依赖需声明在 deno.json 或 package.json

---

## 验收标准 (Acceptance Criteria)

### AC-001: {标准名称}
- **Given**: {前置条件}
- **When**: {操作}
- **Then**:
  - {期望结果1}
  - {期望结果2}

### AC-002: 类型检查通过
- **Given**: 代码已编写完成
- **When**: 运行 `deno check` 或 `tsc --noEmit`
- **Then**:
  - 无类型错误
  - 无 any 类型警告

---

## 接口定义 (Interface Definitions)

```typescript
// 主要类型定义
interface {TypeName} {
  field1: string;
  field2: number;
}

// 函数签名
function {functionName}(param: ParamType): ReturnType;
```

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | src/{name}.ts | 主模块 |
| 类型 | src/{name}.types.ts | 类型定义 |
| 测试 | test/{name}.test.ts | 单元测试 |
| 文档 | docs/{name}.md | 使用文档 |

---

## 依赖 (Dependencies)

### 前置规格
- 无

### 外部依赖
```json
{
  "imports": {
    "@std/assert": "jsr:@std/assert@^1.0.0"
  }
}
```

---

## 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0.0 | YYYY-MM-DD | 初始版本 | {作者} |
