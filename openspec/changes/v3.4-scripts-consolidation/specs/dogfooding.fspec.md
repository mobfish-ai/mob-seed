---
id: dogfooding
version: 1.0.0
status: draft
created: 2026-01-04
updated: 2026-01-04
---

# Dogfooding 机制规格 (Dogfooding Mechanism)

## 概述 (Overview)

实现 mob-seed 项目自身使用发布产品的机制（dogfooding），通过符号链接指向 `skills/mob-seed/`，确保单一真相源。

## 动机 (Motivation)

### 问题

1. **重复维护**: `.seed/scripts/` 和 `skills/mob-seed/scripts/` 可能出现不一致
2. **测试不足**: 开发时使用的脚本与发布的脚本可能不同
3. **安装干扰**: 在 mob-seed 项目内安装 SEED 可能覆盖开发文件

### 目标

- **单一真相源**: `skills/mob-seed/` 是唯一的工具来源
- **自我验证**: mob-seed 使用自己发布的产品
- **无干扰**: 内部开发工具与发布产品分离

## 架构设计 (Architecture)

```
mob-seed/
├── scripts/                       # 内部开发工具（不发布）
│   ├── bump-version.js
│   ├── release.sh
│   └── check-proposal-tasks-sync.js
│
├── skills/mob-seed/               # 发布产品（唯一真相源）
│   ├── lib/                       # 分层库
│   │   ├── validation/
│   │   ├── cache/
│   │   ├── hooks/
│   │   └── cli/
│   ├── scripts/                   # 用户工具
│   │   ├── verify-archive.js
│   │   ├── verify-seed-sync.js
│   │   └── ...
│   └── hooks/                     # Hook 模板
│       ├── pre-commit
│       ├── pre-push
│       └── ...
│
└── .seed/                         # dogfooding 配置
    ├── config.json                # 常规配置文件
    ├── mission.md                 # 使命声明
    ├── scripts → ../skills/mob-seed/scripts  # 符号链接
    └── hooks → ../skills/mob-seed/hooks      # 符号链接
```

## 功能需求 (Functional Requirements)

### FR-001: 符号链接创建

**描述**: 在 `.seed/` 目录创建指向发布产品的符号链接。

**链接配置**:

| 链接路径 | 目标路径 | 说明 |
|----------|----------|------|
| `.seed/scripts` | `../skills/mob-seed/scripts` | 脚本工具 |
| `.seed/hooks` | `../skills/mob-seed/hooks` | Hook 模板 |

**验收标准**:
- [ ] AC-001: `.seed/scripts` 是指向 `../skills/mob-seed/scripts` 的符号链接
- [ ] AC-002: `.seed/hooks` 是指向 `../skills/mob-seed/hooks` 的符号链接
- [ ] AC-003: 链接可正常解析（`ls -la .seed/scripts/` 显示内容）
- [ ] AC-004: 链接使用相对路径（便于仓库移动）

### FR-002: Git 追踪配置

**描述**: 确保符号链接被 Git 正确追踪。

**验收标准**:
- [ ] AC-001: 符号链接被 Git 追踪（不在 .gitignore 中）
- [ ] AC-002: `git status` 正确显示链接状态
- [ ] AC-003: `git clone` 后链接自动恢复

### FR-003: 功能验证

**描述**: 验证 dogfooding 后所有功能正常工作。

**验证清单**:

| 功能 | 验证命令 | 预期结果 |
|------|----------|----------|
| 脚本访问 | `ls .seed/scripts/` | 显示所有脚本 |
| Hook 访问 | `ls .seed/hooks/` | 显示所有 hooks |
| defend 命令 | `/mob-seed:defend` | 正常执行 |
| Git commit | `git commit` | 触发 pre-commit |
| Git push | `git push` | 触发 pre-push |

**验收标准**:
- [ ] AC-001: 所有验证命令通过
- [ ] AC-002: 无路径解析错误
- [ ] AC-003: 无权限错误

### FR-004: 内部工具隔离

**描述**: 确保内部开发工具不受影响。

**验收标准**:
- [ ] AC-001: `scripts/bump-version.js` 可正常执行
- [ ] AC-002: `scripts/release.sh` 可正常执行
- [ ] AC-003: 内部工具不被 SEED 命令覆盖

## 实施步骤 (Implementation Steps)

### 步骤 1: 清理源目录

```bash
# 删除原始目录（确保内容已迁移到 skills/mob-seed/）
rm -rf .seed/scripts/
rm -rf .seed/hooks/
```

### 步骤 2: 创建符号链接

```bash
# 创建符号链接（使用相对路径）
cd .seed/
ln -s ../skills/mob-seed/scripts scripts
ln -s ../skills/mob-seed/hooks hooks
```

### 步骤 3: 验证链接

```bash
# 验证链接正确
ls -la .seed/scripts/
ls -la .seed/hooks/

# 验证文件可访问
cat .seed/scripts/verify-archive.js | head -5
```

### 步骤 4: 更新 Git

```bash
# 添加链接到 Git
git add .seed/scripts .seed/hooks

# 验证状态
git status
```

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 符号链接 | `.seed/scripts` | 指向 skills/mob-seed/scripts |
| 符号链接 | `.seed/hooks` | 指向 skills/mob-seed/hooks |

## 依赖关系 (Dependencies)

- 依赖 `scripts-consolidation.fspec.md` 先完成脚本整合
- 依赖 `architecture-refactor.fspec.md` 中的分层库结构

## 测试策略 (Testing Strategy)

### 功能测试

| 测试场景 | 验证内容 |
|----------|----------|
| 链接创建 | 符号链接正确创建 |
| 链接解析 | 链接指向正确目标 |
| 功能正常 | 通过链接访问的工具正常工作 |

### 边界测试

| 测试场景 | 验证内容 |
|----------|----------|
| 仓库克隆 | 克隆后链接自动恢复 |
| 仓库移动 | 移动后链接仍然有效（相对路径） |
| 权限检查 | 链接目标文件权限正确 |

## 风险与缓解 (Risks and Mitigations)

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| Windows 兼容性 | 中 | 高 | 文档说明需要管理员权限 |
| 链接断裂 | 低 | 高 | 使用相对路径 |
| Git 追踪问题 | 低 | 中 | 明确不在 .gitignore 中 |

## Windows 注意事项

Windows 上创建符号链接需要管理员权限或开发者模式：

```powershell
# 开启开发者模式后
mklink /D .seed\scripts ..\skills\mob-seed\scripts
mklink /D .seed\hooks ..\skills\mob-seed\hooks
```

或使用 Git Bash：
```bash
# Git Bash 使用 MSYS 方式创建链接
ln -s ../skills/mob-seed/scripts .seed/scripts
ln -s ../skills/mob-seed/hooks .seed/hooks
```
