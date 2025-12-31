# 执行引擎指导

> SEED E阶段 - 自动执行派生产物

## 核心原则

1. **清单驱动**: 根据派生清单执行，不遗漏
2. **失败快速**: 遇错立即报告，不静默失败
3. **结果可追溯**: 完整记录执行过程和结果
4. **环境隔离**: 测试不影响生产数据

## 执行流程

```
┌─────────────────────────────────────────────────────────────┐
│                   执行引擎流程                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 加载清单                                                 │
│     ├── 读取 seed-manifest.json                             │
│     ├── 验证派生产物存在                                    │
│     └── 确定执行顺序                                        │
│                                                              │
│  2. 环境准备                                                 │
│     ├── 检查 Node.js 版本                                   │
│     ├── 检查依赖是否安装                                    │
│     └── 创建临时测试环境                                    │
│                                                              │
│  3. 执行测试                                                 │
│     ├── 运行单元测试                                        │
│     ├── 收集覆盖率数据                                      │
│     └── 生成测试报告                                        │
│                                                              │
│  4. 执行构建                                                 │
│     ├── 语法检查                                            │
│     ├── 类型检查（可选）                                    │
│     └── Lint 检查                                           │
│                                                              │
│  5. 生成报告                                                 │
│     ├── 汇总执行结果                                        │
│     ├── 输出 JSON 详情                                      │
│     └── 输出可读摘要                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 清单格式

```json
{
  "spec": "specs/user-auth.fspec.md",
  "emittedAt": "2024-12-28T10:30:00+08:00",
  "outputs": [
    {
      "type": "code",
      "path": "src/user-auth/index.js",
      "status": "created"
    },
    {
      "type": "test",
      "path": "test/user-auth/index.test.js",
      "status": "created"
    },
    {
      "type": "docs",
      "path": "docs/user-auth/index.md",
      "status": "created"
    }
  ]
}
```

## 测试执行

### 命令模板

```bash
# 单文件测试
node --test {test-path}

# 带覆盖率（需要 c8）
npx c8 node --test {test-path}

# 带超时限制
timeout 60 node --test {test-path}
```

### 结果解析

```javascript
// 解析测试输出
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  duration: 0,
  failures: []
};

// 从 node --test 输出解析
// ✔ test name (duration)
// ✖ test name (duration)
```

## 构建检查

### 语法检查

```bash
# 使用 Node.js 检查语法
node --check {code-path}
```

### Lint 检查（可选）

```bash
# 如果项目有 ESLint
npx eslint {code-path} --format json
```

## 报告格式

### JSON 详情

```json
{
  "spec": "user-auth",
  "executedAt": "2024-12-28T10:35:00+08:00",
  "duration": 5230,
  "tests": {
    "total": 12,
    "passed": 10,
    "failed": 1,
    "skipped": 1,
    "coverage": {
      "lines": 85.5,
      "branches": 78.2
    },
    "failures": [
      {
        "name": "should handle invalid input",
        "error": "AssertionError: expected null",
        "location": "test/user-auth/index.test.js:45"
      }
    ]
  },
  "build": {
    "syntax": "passed",
    "lint": {
      "errors": 0,
      "warnings": 3
    }
  }
}
```

### 可读摘要

```markdown
# 执行报告: user-auth

> 执行时间: 2024-12-28 10:35:00 | 耗时: 5.2s

## 📊 测试结果

| 指标 | 数值 |
|------|------|
| 总数 | 12 |
| ✅ 通过 | 10 |
| ❌ 失败 | 1 |
| ⏭️ 跳过 | 1 |

### 失败详情

1. **should handle invalid input**
   - 位置: `test/user-auth/index.test.js:45`
   - 错误: AssertionError: expected null

## 🔨 构建结果

| 检查项 | 状态 |
|--------|------|
| 语法检查 | ✅ 通过 |
| Lint | ⚠️ 3 警告 |

## 📈 覆盖率

| 类型 | 覆盖率 |
|------|--------|
| 行覆盖 | 85.5% |
| 分支覆盖 | 78.2% |
```

## 错误处理

| 错误类型 | 处理方式 |
|----------|----------|
| 清单不存在 | 提示先执行 emit |
| 派生文件缺失 | 列出缺失文件，建议重新 emit |
| 测试超时 | 报告超时，继续执行其他测试 |
| 语法错误 | 详细报告位置和原因 |

## 监听模式

```
watch 模式行为:
1. 监听 spec 文件变化 → 重新 emit + exec
2. 监听 code 文件变化 → 重新 exec
3. 监听 test 文件变化 → 重新 exec
```
