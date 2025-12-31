# CI 执行指导

> SEED E阶段 - CI/CD 集成模式

## 核心原则

1. **零容忍**: 任何失败都导致 CI 失败
2. **确定性**: 相同输入必须产生相同结果
3. **可审计**: 完整的执行日志和报告
4. **快速反馈**: 尽早发现问题

## CI 模式特点

| 特点 | 开发模式 | CI 模式 |
|------|----------|---------|
| 失败处理 | 继续执行 | 立即终止 |
| 覆盖率 | 可选 | 必须 |
| Lint | 警告 | 错误 |
| 输出 | 可读格式 | JSON 格式 |

## CI 配置

### 阈值配置

```json
{
  "ci": {
    "coverage": {
      "lines": 80,
      "branches": 70,
      "functions": 80
    },
    "lint": {
      "maxWarnings": 0,
      "maxErrors": 0
    },
    "timeout": 300000
  }
}
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SEED_CI` | 是否 CI 模式 | false |
| `SEED_COVERAGE_THRESHOLD` | 覆盖率阈值 | 80 |
| `SEED_TIMEOUT` | 超时时间(ms) | 300000 |

## CI 流程

```
┌─────────────────────────────────────────────────────────────┐
│                    CI 执行流程                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 环境验证                                                 │
│     ├── 检查 Node.js 版本 ≥ 18                              │
│     ├── 检查依赖锁文件一致性                                │
│     └── 验证清单文件存在                                    │
│                                                              │
│  2. 依赖安装                                                 │
│     └── npm ci (使用锁文件精确安装)                         │
│                                                              │
│  3. 代码检查                                                 │
│     ├── 语法检查 (node --check)                             │
│     ├── Lint 检查 (eslint --max-warnings=0)                 │
│     └── 类型检查 (tsc --noEmit，如适用)                     │
│                                                              │
│  4. 测试执行                                                 │
│     ├── 单元测试 (node --test)                              │
│     ├── 覆盖率收集 (c8)                                     │
│     └── 覆盖率阈值检查                                      │
│                                                              │
│  5. 报告生成                                                 │
│     ├── JUnit XML (测试报告)                                │
│     ├── Cobertura XML (覆盖率报告)                          │
│     └── SEED JSON (完整报告)                                │
│                                                              │
│  6. 退出码                                                   │
│     ├── 0 = 全部通过                                        │
│     └── 1 = 有失败                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## CI 脚本模板

### GitHub Actions

```yaml
name: SEED CI

on:
  push:
    paths:
      - 'specs/**'
      - 'src/**'
      - 'test/**'

jobs:
  seed-ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: SEED Validate
        run: npx mob-seed validate specs/*.fspec.md

      - name: SEED Emit
        run: npx mob-seed emit specs/*.fspec.md --all

      - name: SEED Execute (CI)
        run: npx mob-seed exec specs/*.fspec.md --ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/cobertura-coverage.xml
```

### GitLab CI

```yaml
seed-ci:
  image: node:20
  script:
    - npm ci
    - npx mob-seed validate specs/*.fspec.md
    - npx mob-seed emit specs/*.fspec.md --all
    - npx mob-seed exec specs/*.fspec.md --ci
  artifacts:
    reports:
      junit: output/mob-seed/junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
```

## CI 报告格式

### JUnit XML (测试)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="SEED Tests" tests="12" failures="1" time="5.23">
  <testsuite name="user-auth" tests="12" failures="1">
    <testcase name="AC-001: 登录成功" time="0.15"/>
    <testcase name="AC-002: 密码错误" time="0.12">
      <failure message="AssertionError">
        Expected: null
        Actual: undefined
      </failure>
    </testcase>
  </testsuite>
</testsuites>
```

### SEED JSON (完整)

```json
{
  "version": "1.0.0",
  "timestamp": "2024-12-28T10:35:00+08:00",
  "environment": {
    "node": "v20.10.0",
    "platform": "linux",
    "ci": true
  },
  "specs": [
    {
      "name": "user-auth",
      "path": "specs/user-auth.fspec.md",
      "status": "failed",
      "tests": { ... },
      "coverage": { ... },
      "lint": { ... }
    }
  ],
  "summary": {
    "total": 1,
    "passed": 0,
    "failed": 1,
    "exitCode": 1
  }
}
```

## 失败处理

### 退出码含义

| 退出码 | 含义 |
|--------|------|
| 0 | 全部检查通过 |
| 1 | 测试失败 |
| 2 | 覆盖率不达标 |
| 3 | Lint 错误 |
| 4 | 语法/类型错误 |
| 5 | 清单/环境错误 |

### 失败通知模板

```markdown
## ❌ SEED CI 失败

**规格**: user-auth.fspec.md
**失败原因**: 测试失败 (1/12)

### 失败详情

| 测试 | 错误 |
|------|------|
| AC-002: 密码错误 | AssertionError: expected null |

### 修复建议

1. 检查 `test/user-auth/index.test.js:45` 的断言
2. 确认 spec 中 AC-002 的 Then 条件

[查看完整报告](./output/mob-seed/ci-report.json)
```
