# 代码派生指导

> SEED E阶段 - 从规格派生代码

## 核心原则

1. **规格驱动**: 代码结构完全由规格决定
2. **最小实现**: 只实现规格中定义的功能
3. **可测试性**: 生成的代码必须可测试
4. **一致性**: 遵循项目现有代码风格

## 派生流程

```
┌─────────────────────────────────────────────────────────────┐
│                   代码派生流程                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 解析规格                                                 │
│     ├── 提取功能需求 (FR)                                    │
│     ├── 提取非功能需求 (NFR)                                 │
│     └── 提取派生路径                                         │
│                                                              │
│  2. 分析代码结构                                             │
│     ├── 确定模块划分                                         │
│     ├── 确定函数/类结构                                      │
│     └── 确定依赖关系                                         │
│                                                              │
│  3. 生成代码框架                                             │
│     ├── 创建文件结构                                         │
│     ├── 生成函数签名                                         │
│     └── 添加 JSDoc/类型注解                                  │
│                                                              │
│  4. 实现业务逻辑                                             │
│     ├── 根据 FR 实现核心功能                                 │
│     ├── 根据 NFR 添加边界处理                                │
│     └── 添加错误处理                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 规格 → 代码映射规则

### 功能需求 → 函数/方法

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
async function login(email, password) {
  // 实现逻辑
}
```

### 非功能需求 → 边界处理

```markdown
规格:
- [ ] NFR-001: 登录接口响应时间 < 500ms

代码:
```javascript
/**
 * @see NFR-001 响应时间要求
 */
const LOGIN_TIMEOUT = 500; // ms

async function login(email, password) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOGIN_TIMEOUT);
  // ...
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

### 函数模块

```javascript
/**
 * {模块描述}
 * @module {moduleName}
 * @see specs/{specName}.fspec.md
 */

/**
 * {函数描述}
 * @see {FR-xxx}
 * @param {Type} param - {参数描述}
 * @returns {ReturnType}
 * @throws {ErrorType} {错误描述}
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
    // 错误处理
    throw new Error(`操作失败: ${error.message}`);
  }
}
```

### 类模块

```javascript
/**
 * {类描述}
 * @see specs/{specName}.fspec.md
 */
export class ClassName {
  /**
   * @param {Options} options - 配置选项
   */
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * {方法描述}
   * @see {FR-xxx}
   */
  async methodName() {
    // 实现
  }
}
```

## 代码风格要求

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `user-login.js` |
| 函数名 | camelCase | `validateEmail` |
| 类名 | PascalCase | `UserService` |
| 常量 | UPPER_SNAKE | `MAX_RETRY` |

### 注释要求

```javascript
/**
 * 必须包含:
 * - 函数/类描述
 * - @see 链接到规格
 * - @param 参数说明
 * - @returns 返回值说明
 * - @throws 错误说明（如有）
 */
```

### 错误处理

```javascript
// 使用自定义错误类
class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

// 统一错误格式
function handleError(error) {
  return {
    success: false,
    error: {
      code: error.code || 'UNKNOWN',
      message: error.message,
      field: error.field,
    },
  };
}
```

## 目录结构

根据规格类型生成对应目录：

```
src/
├── {module}/
│   ├── index.js          # 模块入口
│   ├── {feature}.js      # 功能实现
│   ├── validators.js     # 校验逻辑
│   └── types.js          # 类型定义
```

## 派生标记

所有派生代码必须包含标记：

```javascript
/**
 * @generated-from specs/{name}.fspec.md
 * @generated-at 2024-12-28T10:30:00+08:00
 * @seed-version 1.0.0
 *
 * ⚠️ 此文件由 SEED 自动派生，请勿手动修改
 * 如需修改，请更新规格文件后重新派生
 */
```
