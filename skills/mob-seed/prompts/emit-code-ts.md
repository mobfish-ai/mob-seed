# TypeScript/Deno 代码派生指导

> SEED E阶段 - 从规格派生 TypeScript 代码

## 核心原则

1. **类型优先**: 先定义类型，再实现逻辑
2. **严格模式**: 启用 strict，禁止 any
3. **规格驱动**: 代码结构完全由规格决定
4. **Deno 优先**: 优先使用 Deno 运行时和标准库

## 派生流程

```
规格 (.fspec.md)
     │
     ▼
┌─────────────────┐
│ 1. 类型定义     │ → src/{name}.types.ts
│    - interface  │
│    - type alias │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. 核心实现     │ → src/{name}.ts
│    - 函数实现   │
│    - 类实现     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. 模块导出     │ → src/{name}/mod.ts
│    - re-export  │
└─────────────────┘
```

## 规格 → TypeScript 映射

### 功能需求 → 函数签名

```markdown
规格:
- [ ] FR-001: 用户可以使用邮箱和密码登录

TypeScript:
```typescript
/**
 * 用户登录
 * @see FR-001
 */
export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  // 实现
}
```

### 接口定义 → TypeScript Interface

```markdown
规格:
## 接口定义
interface User {
  id: string;
  email: string;
}

TypeScript:
```typescript
/** 用户信息 */
export interface User {
  readonly id: string;
  email: string;
}
```

### 约束 → 类型约束

```markdown
规格:
约束:
- 邮箱格式必须有效
- 密码长度 8-32 字符

TypeScript:
```typescript
/** 邮箱类型（品牌类型） */
type Email = string & { readonly __brand: 'Email' };

/** 密码类型 */
type Password = string & { readonly __brand: 'Password' };

/** 验证并创建 Email */
function createEmail(value: string): Email {
  if (!isValidEmail(value)) {
    throw new ValidationError('email', 'Invalid email format');
  }
  return value as Email;
}
```

## 代码模板

### 类型定义文件 ({name}.types.ts)

```typescript
/**
 * {模块名} 类型定义
 * @module {moduleName}/types
 * @see specs/{specName}.fspec.md
 * @generated-from specs/{name}.fspec.md
 */

/** {类型描述} */
export interface {TypeName} {
  readonly id: string;
  name: string;
  createdAt: Date;
}

/** {类型描述} */
export type {TypeAlias} = {
  [key: string]: unknown;
};

/** 函数参数类型 */
export interface {FunctionName}Params {
  param1: string;
  param2?: number;
}

/** 函数返回类型 */
export interface {FunctionName}Result {
  success: boolean;
  data?: unknown;
  error?: Error;
}
```

### 实现文件 ({name}.ts)

```typescript
/**
 * {模块描述}
 * @module {moduleName}
 * @see specs/{specName}.fspec.md
 * @generated-from specs/{name}.fspec.md
 */

import type {
  {TypeName},
  {FunctionName}Params,
  {FunctionName}Result
} from './{name}.types.ts';

/**
 * {函数描述}
 * @see FR-{xxx}
 */
export async function {functionName}(
  params: {FunctionName}Params
): Promise<{FunctionName}Result> {
  const { param1, param2 = 0 } = params;

  // 参数校验
  if (!param1) {
    return {
      success: false,
      error: new Error('param1 is required'),
    };
  }

  // 业务逻辑
  try {
    const result = await doSomething(param1, param2);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
```

### 模块入口 (mod.ts)

```typescript
/**
 * {模块名} 公共 API
 * @module {moduleName}
 * @see specs/{specName}.fspec.md
 */

// 导出类型
export type * from './{name}.types.ts';

// 导出实现
export { {functionName} } from './{name}.ts';
```

## Deno 特定规范

### 导入规范

```typescript
// ✅ Deno 标准库 (jsr)
import { assertEquals } from "jsr:@std/assert@^1.0.0";

// ✅ 相对导入 (带扩展名)
import { helper } from "./utils.ts";

// ✅ URL 导入
import { serve } from "https://deno.land/std@0.220.0/http/server.ts";

// ❌ 避免
import { something } from "npm:package";  // 尽量用 Deno 原生
```

### deno.json 配置

```json
{
  "name": "@scope/{name}",
  "version": "1.0.0",
  "exports": "./mod.ts",
  "tasks": {
    "test": "deno test --allow-read --allow-write",
    "check": "deno check mod.ts",
    "fmt": "deno fmt",
    "lint": "deno lint"
  },
  "imports": {
    "@std/assert": "jsr:@std/assert@^1.0.0",
    "@std/testing": "jsr:@std/testing@^1.0.0"
  },
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

## 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件名 | kebab-case.ts | `user-service.ts` |
| 类型文件 | {name}.types.ts | `user.types.ts` |
| 模块入口 | mod.ts | `mod.ts` |
| 接口名 | PascalCase | `UserService` |
| 类型别名 | PascalCase | `UserId` |
| 函数名 | camelCase | `validateEmail` |
| 常量 | UPPER_SNAKE | `MAX_RETRY` |

## 类型安全检查清单

- [ ] 无 `any` 类型
- [ ] 无 `@ts-ignore` / `@ts-expect-error`
- [ ] 所有函数有明确返回类型
- [ ] 所有参数有类型注解
- [ ] 使用 `unknown` 替代 `any` 处理未知类型
- [ ] 使用 `readonly` 保护不可变数据
- [ ] 使用品牌类型区分相同底层类型

## 派生标记

```typescript
/**
 * @generated-from specs/{name}.fspec.md
 * @generated-at 2026-01-01T10:00:00+08:00
 * @seed-version 1.0.0
 *
 * ⚠️ 此文件由 SEED 自动派生，请勿手动修改
 * 如需修改，请更新规格文件后重新派生
 */
```
