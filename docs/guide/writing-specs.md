# 规格编写指南

> 如何编写高质量的 fspec 规格文件

## 文件结构

```markdown
# Feature: 功能名称

> 状态: draft | review | implementing | archived
> 版本: 1.0.0
> 技术栈: JavaScript | TypeScript
> 派生路径: src/path/
> 优先级: P0 | P1 | P2

## 概述

简要描述功能目的和范围。

## ADDED Requirements

### REQ-001: 需求标题

The system SHALL [做什么].

**Scenario: 场景名称**
- WHEN 前置条件
- AND 附加条件
- THEN 期望结果
- AND 附加结果

**Acceptance Criteria:**
- [ ] AC-001: 验收标准描述
- [ ] AC-002: 验收标准描述

## 导出接口

## 配置项

## 依赖

## 测试要点
```

## Delta 语法

规格文件使用 Delta 语法标记变更类型：

| 标记 | 说明 | 示例 |
|------|------|------|
| `ADDED` | 新增需求 | `## ADDED Requirements` |
| `MODIFIED` | 修改需求 | `## MODIFIED Requirements` |
| `REMOVED` | 删除需求 | `## REMOVED Requirements` |
| `CLARIFIED` | 澄清细节 | `## CLARIFIED Requirements` |

## Scenario 编写

### 基本格式

```markdown
**Scenario: 场景名称**
- WHEN 触发条件
- AND 附加条件（可选）
- THEN 期望结果
- AND 附加结果（可选）
```

### 好的示例

```markdown
**Scenario: 用户登录成功**
- WHEN 用户输入正确的用户名和密码
- AND 账户处于激活状态
- THEN 返回 JWT 令牌
- AND 记录登录日志
```

### 不好的示例

```markdown
**Scenario: 登录**
- WHEN 登录
- THEN 成功
```

问题：描述过于模糊，无法派生测试。

## Acceptance Criteria

### 格式

```markdown
**Acceptance Criteria:**
- [ ] AC-001: 描述可验证的标准
- [ ] AC-002: 描述可验证的标准
```

### 原则

1. **可验证**: 必须能通过测试验证
2. **具体**: 避免模糊描述
3. **独立**: 每个 AC 独立验证
4. **完整**: 覆盖所有边界情况

### 好的示例

```markdown
**Acceptance Criteria:**
- [ ] AC-001: 用户名为空时返回 400 错误
- [ ] AC-002: 密码错误时返回 401 错误
- [ ] AC-003: 登录成功返回有效 JWT（含 userId, exp）
```

### 不好的示例

```markdown
**Acceptance Criteria:**
- [ ] AC-001: 登录功能正常工作
- [ ] AC-002: 处理错误情况
```

问题：无法验证"正常工作"和"处理错误"。

## 元数据

### 状态流转

```
draft → review → implementing → archived
```

| 状态 | 说明 |
|------|------|
| draft | 草稿，可自由修改 |
| review | 评审中，等待确认 |
| implementing | 实现中，代码开发 |
| archived | 已归档，进入稳定规格 |

### 技术栈

支持的技术栈：

| 值 | 说明 |
|-----|------|
| JavaScript | Node.js JavaScript |
| TypeScript | TypeScript |
| React | React 组件 |
| Vue | Vue 组件 |

### 派生路径

指定代码生成的目标路径：

```markdown
> 派生路径: src/auth/
> 派生路径: lib/core/
> 派生路径: components/
```

## 最佳实践

1. **先写 Scenario 再写 AC**: Scenario 描述行为，AC 描述验证点
2. **保持原子性**: 一个 REQ 对应一个核心功能
3. **使用 Delta 语法**: 明确标记变更类型
4. **包含边界情况**: 不只是 happy path
5. **写可执行的描述**: 能直接转换为测试

## 相关文档

- [快速开始](./getting-started.md)
- [SEED 方法论](../concepts/seed-methodology.md)
