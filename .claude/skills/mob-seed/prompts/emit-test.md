# 测试派生指导

> SEED E阶段 - 从规格派生测试

## 核心原则

1. **验收驱动**: 测试用例直接来自验收标准
2. **完整覆盖**: 每个 AC 至少一个测试
3. **独立可运行**: 测试之间无依赖
4. **可读性**: 测试描述清晰表达意图

## 派生流程

```
┌─────────────────────────────────────────────────────────────┐
│                   测试派生流程                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 解析规格                                                 │
│     ├── 提取验收标准 (AC)                                    │
│     ├── 解析 Given-When-Then                                │
│     └── 提取派生路径                                         │
│                                                              │
│  2. 生成测试结构                                             │
│     ├── describe 块对应功能模块                              │
│     ├── it 块对应验收标准                                    │
│     └── 设置 beforeEach/afterEach                           │
│                                                              │
│  3. 生成测试用例                                             │
│     ├── Given → 测试前置设置                                 │
│     ├── When → 执行操作                                      │
│     └── Then → 断言验证                                      │
│                                                              │
│  4. 添加边界测试                                             │
│     ├── 参数边界                                             │
│     ├── 错误处理                                             │
│     └── 并发场景                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## AC → 测试映射规则

### 基本映射

```markdown
规格:
### AC-001: 登录成功
- Given: 用户已注册，且输入正确的邮箱和密码
- When: 用户点击登录按钮
- Then:
  - 页面跳转到首页
  - 显示用户名
  - 设置登录状态 Cookie

测试:
```javascript
describe('用户登录', () => {
  describe('AC-001: 登录成功', () => {
    it('should redirect to home page on successful login', async () => {
      // Given: 用户已注册
      const user = await createTestUser({
        email: 'test@example.com',
        password: 'password123'
      });

      // When: 用户点击登录按钮
      const result = await login('test@example.com', 'password123');

      // Then: 页面跳转到首页
      assert.strictEqual(result.redirect, '/home');
      // Then: 显示用户名
      assert.strictEqual(result.username, user.name);
      // Then: 设置登录状态 Cookie
      assert.ok(result.cookies.includes('session'));
    });
  });
});
```

### 错误场景

```markdown
规格:
### AC-002: 密码错误
- Given: 用户已注册
- When: 用户输入错误密码
- Then:
  - 显示错误提示 "密码错误"
  - 保持在登录页面

测试:
```javascript
describe('AC-002: 密码错误', () => {
  it('should show error message for wrong password', async () => {
    // Given
    await createTestUser({ email: 'test@example.com', password: 'correct' });

    // When
    const result = await login('test@example.com', 'wrong');

    // Then
    assert.strictEqual(result.error, '密码错误');
    assert.strictEqual(result.redirect, null);
  });
});
```

## 测试模板

### 单元测试

```javascript
/**
 * {模块} 测试
 * @generated-from specs/{name}.fspec.md
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

describe('{模块名称}', () => {
  // 测试上下文
  let context;

  beforeEach(async () => {
    // Given: 通用前置条件
    context = await setupTestContext();
  });

  afterEach(async () => {
    // 清理
    await cleanupTestContext(context);
  });

  describe('AC-001: {验收标准}', () => {
    it('should {期望行为}', async () => {
      // Given: 特定前置条件
      // ...

      // When: 执行操作
      const result = await someAction();

      // Then: 验证结果
      assert.strictEqual(result.status, 'success');
    });
  });
});
```

### API 测试

```javascript
/**
 * {API} 测试
 * @generated-from specs/{name}.fspec.md
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

describe('API: {端点}', () => {
  let server;

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await server.close();
  });

  describe('AC-001: 正常请求', () => {
    it('should return 200 with valid data', async () => {
      // Given
      const payload = { field: 'value' };

      // When
      const response = await fetch(`${server.url}/api/endpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Then
      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.ok(data.id);
    });
  });

  describe('AC-002: 参数校验', () => {
    it('should return 400 for invalid payload', async () => {
      // Given
      const invalidPayload = {};

      // When
      const response = await fetch(`${server.url}/api/endpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      // Then
      assert.strictEqual(response.status, 400);
    });
  });
});
```

## 测试覆盖要求

### 必须覆盖

| 来源 | 覆盖要求 |
|------|----------|
| AC-xxx | 每个 AC 至少 1 个测试 |
| FR-xxx | 核心功能测试 |
| 约束 | 边界值测试 |

### 建议覆盖

| 场景 | 说明 |
|------|------|
| 空值/null | 参数为空时的行为 |
| 边界值 | 最大/最小值 |
| 并发 | 多请求同时处理 |
| 超时 | 超时情况处理 |

## 断言规范

```javascript
// ✅ 使用 Node.js 内置 assert
import assert from 'node:assert';

// 严格相等
assert.strictEqual(actual, expected);

// 深度相等（对象/数组）
assert.deepStrictEqual(actual, expected);

// 真值检查
assert.ok(value);

// 异常检查
await assert.rejects(async () => {
  await shouldThrow();
}, /expected error message/);

// 不抛异常
await assert.doesNotReject(async () => {
  await shouldNotThrow();
});
```

## 派生标记

```javascript
/**
 * @generated-from specs/{name}.fspec.md
 * @generated-at 2024-12-28T10:30:00+08:00
 * @seed-version 1.0.0
 *
 * ⚠️ 此测试文件由 SEED 自动派生
 * 验收标准变更时会自动更新
 */
```
