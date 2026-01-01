# TypeScript/Deno 测试派生指导

> SEED E阶段 - 从规格派生 TypeScript 测试

## 核心原则

1. **AC 驱动**: 每个验收标准对应一组测试
2. **Deno Test**: 使用 Deno 内置测试框架
3. **类型安全**: 测试代码同样严格类型检查
4. **隔离性**: 每个测试独立，无副作用

## 测试框架

### Deno Test (推荐)

```typescript
import { assertEquals, assertThrows } from "jsr:@std/assert@^1.0.0";
import { describe, it, beforeEach } from "jsr:@std/testing@^1.0.0/bdd";
```

### Vitest (Node.js 项目)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
```

## 规格 → 测试映射

### 验收标准 → 测试描述

```markdown
规格:
### AC-001: 默认输出
- Given: 脚本无参数
- When: 用户执行脚本
- Then: 输出 "Hello, World!"

测试:
```typescript
describe("AC-001: 默认输出", () => {
  it("should output 'Hello, World!' when no arguments provided", () => {
    // Given: 无参数
    const args: string[] = [];

    // When: 执行
    const result = greet(args);

    // Then: 验证输出
    assertEquals(result, "Hello, World!");
  });
});
```

### 功能需求 → 功能测试

```markdown
规格:
- [ ] FR-001: 用户可以使用邮箱和密码登录

测试:
```typescript
describe("FR-001: 用户登录", () => {
  it("should login successfully with valid credentials", async () => {
    const result = await login("user@example.com", "password123");
    assertEquals(result.success, true);
  });

  it("should fail with invalid email", async () => {
    const result = await login("invalid-email", "password123");
    assertEquals(result.success, false);
    assertEquals(result.error?.field, "email");
  });

  it("should fail with wrong password", async () => {
    const result = await login("user@example.com", "wrong");
    assertEquals(result.success, false);
  });
});
```

## 测试模板

### 基础测试文件 ({name}.test.ts)

```typescript
/**
 * {模块名} 测试
 * @see specs/{specName}.fspec.md
 * @generated-from specs/{name}.fspec.md
 */

import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from "jsr:@std/assert@^1.0.0";
import { describe, it, beforeEach, afterEach } from "jsr:@std/testing@^1.0.0/bdd";

import { functionName } from "../src/{name}.ts";
import type { TypeName } from "../src/{name}.types.ts";

describe("{模块名}", () => {
  // 测试上下文
  let context: TestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    context.cleanup();
  });

  describe("AC-001: {验收标准名称}", () => {
    it("should {期望行为}", () => {
      // Given
      const input = "test";

      // When
      const result = functionName(input);

      // Then
      assertEquals(result, expected);
    });

    it("should handle edge case: {边界情况}", () => {
      // Given
      const input = "";

      // When & Then
      assertThrows(
        () => functionName(input),
        Error,
        "Expected error message"
      );
    });
  });

  describe("AC-002: {验收标准名称}", () => {
    it("should {期望行为}", async () => {
      // Given
      const params = { key: "value" };

      // When
      const result = await asyncFunction(params);

      // Then
      assertExists(result);
      assertEquals(result.status, "success");
    });
  });
});
```

### 异步测试

```typescript
describe("异步操作", () => {
  it("should resolve with data", async () => {
    const result = await fetchData();
    assertExists(result.data);
  });

  it("should reject on error", async () => {
    await assertRejects(
      async () => await fetchData({ invalid: true }),
      Error,
      "Invalid params"
    );
  });

  it("should timeout after 5 seconds", async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      await fetchData({ signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  });
});
```

### Mock 和 Stub

```typescript
import { stub, spy, assertSpyCalls } from "jsr:@std/testing@^1.0.0/mock";

describe("使用 Mock", () => {
  it("should call dependency", () => {
    // 创建 spy
    const logSpy = spy(console, "log");

    // 执行
    doSomething();

    // 验证调用
    assertSpyCalls(logSpy, 1);
    logSpy.restore();
  });

  it("should use stubbed value", () => {
    // 创建 stub
    const fetchStub = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("mocked"))
    );

    try {
      const result = await fetchData();
      assertEquals(result, "mocked");
    } finally {
      fetchStub.restore();
    }
  });
});
```

## 测试命名规范

```typescript
describe("{模块/功能名}", () => {
  describe("{AC-xxx}: {验收标准}", () => {
    it("should {期望行为} when {条件}", () => {});
    it("should {期望行为} given {前置条件}", () => {});
    it("should throw {错误} if {错误条件}", () => {});
    it("should not {不期望行为} when {条件}", () => {});
  });
});
```

## 运行测试

### Deno

```bash
# 运行所有测试
deno test

# 运行特定文件
deno test test/{name}.test.ts

# 带权限
deno test --allow-read --allow-write

# 生成覆盖率
deno test --coverage=cov_profile
deno coverage cov_profile

# 监视模式
deno test --watch
```

### 配置 (deno.json)

```json
{
  "tasks": {
    "test": "deno test --allow-read --allow-write",
    "test:watch": "deno test --watch",
    "test:cov": "deno test --coverage=cov && deno coverage cov"
  }
}
```

## 测试覆盖要求

| 指标 | 最低要求 |
|------|----------|
| 行覆盖率 | 80% |
| 分支覆盖率 | 70% |
| 函数覆盖率 | 90% |
| AC 覆盖率 | 100% |

## 派生标记

```typescript
/**
 * @generated-from specs/{name}.fspec.md
 * @generated-at 2026-01-01T10:00:00+08:00
 * @seed-version 1.0.0
 * @covers AC-001, AC-002, AC-003
 *
 * ⚠️ 此文件由 SEED 自动派生，请勿手动修改
 */
```
