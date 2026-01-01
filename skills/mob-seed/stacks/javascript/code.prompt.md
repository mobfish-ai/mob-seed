# JavaScript 代码派生指导

> SEED E阶段 - 从规格派生 JavaScript 代码

## 核心原则

1. **规格驱动**: 代码结构完全由规格决定
2. **最小实现**: 只实现规格中定义的功能
3. **可测试性**: 生成的代码必须可测试
4. **ESM 优先**: 使用 ES Modules

## 派生流程

```
规格 (.fspec.md)
     │
     ▼
┌─────────────────┐
│ 1. 解析规格     │
│    - 提取 FR    │
│    - 提取 NFR   │
│    - 提取路径   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. 生成代码     │ → src/{name}.js
│    - 函数签名   │
│    - JSDoc 注释 │
│    - 业务逻辑   │
└─────────────────┘
```

## 规格 → 代码映射

### 功能需求 → 函数

```markdown
规格:
- [ ] FR-001: 用户可以使用邮箱和密码登录

代码:
```javascript
/**
 * 用户登录
 * @see FR-001
 * @param {string} email - 用户邮箱
 * @param {string} password - 用户密码
 * @returns {Promise<LoginResult>}
 */
export async function login(email, password) {
  // 实现逻辑
}
```

### 约束 → 校验逻辑

```markdown
规格:
约束:
- 邮箱格式必须符合 RFC 5322
- 密码长度 8-32 字符

代码:
```javascript
const validators = {
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  password: (value) => value.length >= 8 && value.length <= 32,
};
```

## 代码模板

```javascript
/**
 * {模块描述}
 * @module {moduleName}
 * @see specs/{specName}.fspec.md
 * @generated-from specs/{name}.fspec.md
 */

/**
 * {函数描述}
 * @see {FR-xxx}
 * @param {Type} param - {参数描述}
 * @returns {ReturnType}
 */
export async function functionName(param) {
  // 参数校验
  if (!param) {
    throw new Error('参数不能为空');
  }

  // 业务逻辑
  try {
    const result = await doSomething(param);
    return result;
  } catch (error) {
    throw new Error(`操作失败: ${error.message}`);
  }
}
```

## 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `user-login.js` |
| 函数名 | camelCase | `validateEmail` |
| 类名 | PascalCase | `UserService` |
| 常量 | UPPER_SNAKE | `MAX_RETRY` |

## 派生标记

```javascript
/**
 * @generated-from specs/{name}.fspec.md
 * @generated-at 2026-01-01T10:00:00+08:00
 * @seed-version 1.0.0
 *
 * ⚠️ 此文件由 SEED 自动派生，请勿手动修改
 */
```
