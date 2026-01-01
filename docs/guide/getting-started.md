# 快速开始

> mob-seed 入门指南

## 安装

### 前置条件

- Node.js >= 18
- Claude Code CLI
- Git

### 初始化项目

```bash
# 在项目根目录执行
/mob-seed:init
```

这将创建：
- `.seed/config.json` - 项目配置
- `.seed/mission.md` - 项目使命声明
- `openspec/` - 规格目录结构

## 基本工作流

### 1. 创建规格 (Spec)

```bash
/mob-seed:spec create user-auth
```

编辑生成的 `openspec/changes/user-auth/specs/user-auth.fspec.md`：

```markdown
# Feature: 用户认证

> 状态: draft
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: src/auth/

## ADDED Requirements

### REQ-001: 用户登录

The system SHALL authenticate users with username and password.

**Scenario: 登录成功**
- WHEN 用户输入正确的用户名和密码
- THEN 返回认证令牌

**Acceptance Criteria:**
- [ ] AC-001: 验证用户名密码
- [ ] AC-002: 生成 JWT 令牌
```

### 2. 派生代码 (Emit)

```bash
/mob-seed:emit openspec/changes/user-auth/specs/user-auth.fspec.md
```

自动生成：
- `src/auth/user-auth.js` - 源代码
- `test/auth/user-auth.test.js` - 测试代码
- `docs/api/user-auth.md` - API 文档

### 3. 执行测试 (Execute)

```bash
/mob-seed:exec
```

运行测试并更新 AC 状态。

### 4. 守护同步 (Defend)

```bash
/mob-seed:defend
```

检查规格与代码是否同步。

## 完整示例

```bash
# 1. 初始化
/mob-seed:init

# 2. 创建规格
/mob-seed:spec create my-feature

# 3. 编辑规格文件...

# 4. 派生代码
/mob-seed:emit openspec/changes/my-feature/specs/my-feature.fspec.md

# 5. 运行测试
/mob-seed:exec

# 6. 检查同步
/mob-seed:defend

# 7. 归档完成的提案
/mob-seed:archive my-feature
```

## 常用命令

| 命令 | 用途 |
|------|------|
| `/mob-seed` | 统一入口（智能引导） |
| `/mob-seed:init` | 初始化项目 |
| `/mob-seed:spec` | 创建/验证规格 |
| `/mob-seed:emit` | 派生代码/测试/文档 |
| `/mob-seed:exec` | 运行测试 |
| `/mob-seed:defend` | 守护同步 |
| `/mob-seed:archive` | 归档完成的提案 |

## 下一步

- [SEED 方法论](../concepts/seed-methodology.md)
- [规格编写指南](./writing-specs.md)
- [API 参考](../api/)
