# {项目名称}

> 本文件定义项目的基本约定，供 AI 工具和团队成员参考。
> 文件位置: `openspec/project.md`

---

## 项目概述

### 名称
{项目名称}

### 描述
{一两句话描述项目的核心功能和目标用户}

### 仓库
{GitHub/GitLab 仓库地址}

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 语言 | {JavaScript/TypeScript/Python/...} | {版本号} |
| 运行时 | {Node.js/Deno/Python/...} | {版本号} |
| 框架 | {Express/Vue/React/...} | {版本号} |
| 测试 | {Jest/Vitest/Pytest/...} | {版本号} |
| 构建 | {Vite/Webpack/esbuild/...} | {版本号} |

---

## 目录结构

```
{项目根目录}/
├── openspec/               # OpenSpec 规格目录
│   ├── specs/              # 真相源（已实现的规格）
│   ├── changes/            # 变更提案（开发中的规格）
│   └── project.md          # 本文件
├── src/                    # 源代码
│   └── ...
├── test/                   # 测试代码
│   └── ...
└── docs/                   # 文档
    └── ...
```

---

## 开发规范

### 代码风格
- 使用 {ESLint/Prettier/...} 进行代码检查
- 提交前运行: `{lint命令}`

### 提交规范
- 使用约定式提交 (Conventional Commits)
- 格式: `{type}({scope}): {description}`
- 类型: feat, fix, docs, refactor, test, chore

### 分支策略
- 主分支: `main`
- 功能分支: `feature/{feature-name}`
- 修复分支: `fix/{issue-id}`

---

## 命令参考

| 命令 | 说明 |
|------|------|
| `{dev命令}` | 启动开发服务器 |
| `{build命令}` | 构建生产版本 |
| `{test命令}` | 运行测试 |
| `{lint命令}` | 代码检查 |

---

## 联系方式

- 维护者: {姓名/团队}
- 邮箱: {email}
- Issue: {issue tracker 地址}

---

## 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0.0 | {YYYY-MM-DD} | 初始版本 |
