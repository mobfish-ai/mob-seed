# v3.1 ACE 无缝融合 - 任务清单

> 状态: archived
> 创建: 2026-01-03

## 任务列表

### 规格定义阶段

- [x] 创建 proposal.md 提案
- [x] 创建 ace-skill-integration.fspec.md (L1)
- [x] 创建 ace-command-embedding.fspec.md (L2)
- [x] 创建 ace-conversation-intercept.fspec.md (L3)
- [x] 创建 ace-hooks.fspec.md (L4)
- [x] 创建 tasks.md 任务清单

### 实现阶段

- [x] L1: 更新 SKILL.md 添加 ACE 核心行为定义
- [x] L2: 更新 exec.md 添加 ACE 收集步骤
- [x] L2: 更新 defend.md 添加 ACE 收集步骤
- [x] L3: 更新 seed.md 添加对话拦截层
- [x] L4: 创建 hooks/ace-pre-commit 脚本
- [x] L4: 创建 hooks/ace-pre-push 脚本
- [x] 更新 init.md 自动创建 ACE 目录和安装 hooks
- [x] ACE 修复: triage-handler.js 自动创建 tasks.md
- [x] ACE 修复: spec.md 添加提案完整性检查

### 验证阶段

- [x] 运行测试验证所有 AC
- [x] 端到端测试：新项目初始化 + ACE 自动触发

### 归档阶段

- [x] 运行 /mob-seed:defend 检查同步
- [x] 运行 /mob-seed:archive 归档提案

## 进度追踪

| 阶段 | 完成 | 总数 | 进度 |
|------|------|------|------|
| 规格 | 6 | 6 | 100% |
| 实现 | 9 | 9 | 100% |
| 验证 | 2 | 2 | 100% |
| 归档 | 2 | 2 | 100% |
