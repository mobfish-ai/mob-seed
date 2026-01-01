# SEED Commands (SEED 命令系统)

> SEED 方法论的 Claude Code 命令集

## 概述

SEED 方法论的 Claude Code 命令集，提供完整的规格驱动开发工作流。

## 命令架构

```
/mob-seed                 # 主入口（智能路由）
├── /mob-seed-init        # 项目初始化
├── /mob-seed-spec        # S: 规格定义
├── /mob-seed-emit        # E: 自动派生
├── /mob-seed-exec        # E: 自动执行
├── /mob-seed-defend      # D: 守护规范
├── /mob-seed-status      # 状态查看
├── /mob-seed-diff        # 差异对比
├── /mob-seed-sync        # 强制同步
├── /mob-seed-archive     # 归档提案
└── /mob-seed-edit        # 编辑触发
```

## 命令参考

### /mob-seed

主入口命令，智能路由到 SEED 工作流。

**用法:**

```bash
/mob-seed "功能描述"
/mob-seed --spec          # 只执行规格定义阶段
/mob-seed --emit          # 只执行派生阶段
/mob-seed --exec          # 只执行测试阶段
/mob-seed --defend        # 只执行守护阶段
/mob-seed --quick         # 使用 Quick Flow
/mob-seed --full          # 使用 Full Flow
```

**参数:**

| 参数 | 说明 |
|------|------|
| --spec | 只执行规格定义阶段 |
| --emit | 只执行派生阶段 |
| --exec | 只执行测试阶段 |
| --defend | 只执行守护阶段 |
| --quick | 强制使用 Quick Flow |
| --full | 强制使用 Full Flow |

### /mob-seed-init

项目初始化命令。

**用法:**

```bash
/mob-seed-init
/mob-seed-init --force    # 强制重新初始化
```

**功能:**

- 创建 `openspec/` 目录结构
- 创建 `openspec/specs/` 规格目录
- 创建 `openspec/changes/` 变更目录
- 生成 `.seed/config.json` 配置文件

### /mob-seed-spec

规格定义命令。

**用法:**

```bash
/mob-seed-spec --proposal "feature-name"   # 创建变更提案
/mob-seed-spec --submit "feature-name"     # 提交审查
```

**功能:**

- 使用模板创建规格文件
- 创建变更提案目录结构
- 管理规格状态

### /mob-seed-emit

派生命令，从规格生成代码/测试/文档。

**用法:**

```bash
/mob-seed-emit "feature-name"
```

**功能:**

- 生成代码到 `src/` 目录
- 生成测试到 `test/` 目录
- 生成文档到 `docs/` 目录
- 创建 `seed-manifest.json` 映射文件

### /mob-seed-exec

执行命令，运行派生的测试。

**用法:**

```bash
/mob-seed-exec "feature-name"
```

**功能:**

- 检测测试框架类型
- 运行对应的测试命令
- 输出测试结果摘要

### /mob-seed-defend

守护命令，检查派生物合规性。

**用法:**

```bash
/mob-seed-defend "feature-name"
```

**功能:**

- 检查代码 hash 与 manifest 记录
- 报告漂移的文件
- 提供修复建议

### /mob-seed-status

状态查看命令。

**用法:**

```bash
/mob-seed-status
/mob-seed-status --verbose   # 详细模式
/mob-seed-status --json      # JSON 输出
```

**功能:**

- 显示所有规格的派生状态
- 显示 OpenSpec 生命周期状态
- 支持多种输出格式

### /mob-seed-diff

差异对比命令。

**用法:**

```bash
/mob-seed-diff "feature-name"
```

**功能:**

- 列出未实现的 FR
- 列出未测试的 AC
- 计算同步率

### /mob-seed-sync

同步命令。

**用法:**

```bash
/mob-seed-sync --direction=spec    # 正向同步 (规格→代码)
/mob-seed-sync --direction=code    # 逆向同步 (代码→规格)
/mob-seed-sync --dry-run           # 预览模式
```

**功能:**

- 支持 spec→code 和 code→spec 方向
- 支持预览模式
- 支持逆向同步

### /mob-seed-archive

归档命令。

**用法:**

```bash
/mob-seed-archive "feature-name"
```

**功能:**

- 检查前置条件（测试通过、代码完成）
- 合并 Delta 规格到真相源
- 移动提案目录到 `archive/`

### /mob-seed-edit

编辑触发命令。

**用法:**

```bash
/mob-seed-edit "feature-name"
```

**功能:**

- 触发规格编辑
- 编辑后自动派生

## 相关链接

- [规格文件](../../openspec/specs/commands/commands.fspec.md)
- [命令目录](../../commands/)
