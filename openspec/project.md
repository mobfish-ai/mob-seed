# mob-seed

> 本文件定义项目的基本约定，供 AI 工具和团队成员参考。
> 文件位置: `openspec/project.md`

---

## 项目概述

### 名称
mob-seed

### 描述
SEED 方法论的 Claude Code 插件实现，提供规格驱动开发的完整工作流，与 OpenSpec 规范完全兼容。

### 仓库
https://github.com/mobfish-ai/mob-seed

---

## 技术栈

| 类别   | 技术               | 版本     |
| ------ | ------------------ | -------- |
| 语言   | JavaScript         | ES2022   |
| 运行时 | Node.js            | >=18.0.0 |
| 框架   | Claude Code Plugin | 1.0.0    |
| 测试   | Node Test Runner   | built-in |
| 构建   | N/A                | -        |

---

## 目录结构

```
mob-seed/
├── openspec/               # OpenSpec 规格目录
│   ├── specs/              # 真相源（已实现的规格）
│   ├── changes/            # 变更提案（开发中的规格）
│   └── project.md          # 本文件
├── skills/                 # Claude Code Skills
│   └── mob-seed/           # SEED 方法论 Skill
├── commands/               # Claude Code Commands
│   └── mob-seed-*.md       # 各个命令定义
└── output/                 # 输出模板
    └── ...
```

---

## 开发规范

### 代码风格
- 使用 ESLint 进行代码检查
- 提交前运行: `npm test`

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

| 命令               | 说明             |
| ------------------ | ---------------- |
| `npm test`         | 运行测试         |
| `/mob-seed-init`   | 初始化 SEED 项目 |
| `/mob-seed-spec`   | 创建/管理规格    |
| `/mob-seed-emit`   | 派生代码         |
| `/mob-seed-status` | 查看状态         |

---

## 联系方式

- 维护者: mobfish-ai
- 邮箱: kelvin@mobfish.ai
- Issue: https://github.com/mobfish-ai/mob-seed/issues

---

## 变更记录

| 版本  | 日期       | 变更内容 |
| ----- | ---------- | -------- |
| 1.0.0 | 2025-12-31 | 初始版本 |
