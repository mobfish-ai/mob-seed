# 最佳实践审核流程内置设计

> **目标**: 将最佳实践审核流程内置到 fspec 创建过程中，确保所有新规格都遵循架构最佳实践
> **来源**: v3.3 架构重构中的 best-practices-review.md 经验总结

## 动机 (Motivation)

### 当前问题

**问题 1**: 最佳实践事后应用
```
当前流程：
创建 fspec → 编写规格 → 发现问题 → 回头审查 → 大量返工
               ↑                                    ↓
               └────────────────────────────────────┘
               时间浪费，容易遗漏
```

**问题 2**: 架构决策隐性化
- 最佳实践只在 CLAUDE.md 经验教训中
- 每次创建 fspec 都要手动检查
- 容易遗漏关键架构决策点

**真实案例**:
- `architecture-refactor.fspec.md` 初稿：直接写了 `lib/hooks/` 结构
- 最佳实践审查后：发现需要分层 `lib/validation/`, `lib/cache/`, `lib/cli/`
- 返工量：8 个主要章节全部重写

### 目标

**前置审核**：在创建 fspec 时就引导考虑最佳实践
```
新流程：
创建 fspec → 最佳实践检查清单 → 编写规格 → 一次性完成
             ↓                      ↑
             引导架构决策           ↓
             └──────────────────────┘
             一次做对
```

## 设计方案

### 方案 A: 内置检查清单（轻量级）

#### 实现方式

在 `/mob-seed:spec create` 命令中，自动为新 fspec 添加"架构决策检查清单"章节：

```markdown
---
status: draft
created: YYYY-MM-DD
architecture_decisions_completed: false  # ← 新增标记
---

# {Feature Name} Functional Specification

## 架构决策检查清单 (Architecture Decisions)

> **重要**: 在编写详细规格前，先完成以下架构决策检查。
> 完成所有检查后，将 frontmatter 中 `architecture_decisions_completed` 设为 `true`。

### 1. 目录结构设计

**决策点**: 新增代码应该放在哪个目录？

- [ ] 按功能分层（推荐：`lib/validation/`, `lib/cache/`, `lib/hooks/`, `lib/cli/`）
- [ ] 按模块分组（`lib/spec/`, `lib/defend/`, `lib/emit/`）
- [ ] 扁平结构（`lib/*.js`）

**选择**: ____________

**理由**: ____________

---

### 2. 命名规范

**决策点**: 文件和函数如何命名？

- [ ] 动词-对象模式（推荐：`validate-quick.js`, `parse-spec.js`）
- [ ] 对象-动词模式（`quick-validator.js`, `spec-parser.js`）
- [ ] 名词模式（`validator.js`, `parser.js`）

**选择**: ____________

**理由**: ____________

---

### 3. 库与 CLI 分离

**决策点**: 是否需要分离库函数和 CLI 入口？

- [ ] **是** - 分离（推荐：复用性高的核心逻辑）
  - 库函数：`lib/{module}/*.js`
  - CLI 包装：`lib/cli/*.js`
- [ ] **否** - 混合（CLI 和库在同一文件）

**选择**: ____________

**适用场景**: ____________

---

### 4. 错误处理策略

**决策点**: 如何处理错误和失败？

- [ ] 优雅降级（推荐：缓存失败→完整检查）
- [ ] 快速失败（立即抛出错误）
- [ ] 静默失败（记录日志但不中断）

**选择**: ____________

**降级路径**: ____________

---

### 5. 退出码设计

**决策点**: CLI 工具如何返回状态？

- [ ] 分层退出码（推荐：0=成功, 1=验证失败, 2=系统错误, 3=配置错误, 124=超时, 130=中断）
- [ ] 简单退出码（0=成功, 1=失败）
- [ ] 不关心退出码（始终返回 0）

**选择**: ____________

**码值定义**: ____________

---

### 6. Git Hooks 集成方式

**决策点**: 如果需要 Git Hooks，如何调用？

- [ ] 三层回退（推荐：配置 → 命令 → 库路径）
- [ ] 单一方式（只支持命令或只支持库）
- [ ] 不需要 Git Hooks

**选择**: ____________

**回退策略**: ____________

---

### 7. 测试覆盖率要求

**决策点**: 各模块的测试覆盖率目标？

- [ ] 按风险分级（推荐：High 95%+, Medium 85%+, Low 75%+）
- [ ] 统一标准（全部 90%+）
- [ ] 无强制要求

**选择**: ____________

**风险分级**:
- 🔴 High Risk (≥95%): ____________
- 🟡 Medium Risk (≥85%): ____________
- 🟢 Low Risk (≥75%): ____________

---

### 8. 废弃策略

**决策点**: 如果需要废弃旧功能，如何平滑过渡？

- [ ] 版本化废弃（推荐：v{n} deprecate → v{n+1} break → v{n+2} remove, +3 months each）
- [ ] 立即废弃（下一版本直接移除）
- [ ] 不需要废弃

**选择**: ____________

**时间线**: ____________

---

## 派生产物 (Derived Outputs)

> **在上述架构决策完成后，再填写此部分**

...
```

#### 优势

- ✅ 零额外工具：直接嵌入模板
- ✅ 强制思考：创建时就考虑架构
- ✅ 可追溯：每个 fspec 记录决策理由
- ✅ 渐进式：不完成检查清单也能继续（draft 状态）

#### 缺点

- ⚠️ 手动维护：需要手工勾选和填写
- ⚠️ 无强制：可以跳过检查

---

### 方案 B: 交互式向导（重量级）

#### 实现方式

扩展 `/mob-seed:spec create` 命令，添加交互式问答：

```bash
/mob-seed:spec create feature-name

# 输出：
📋 架构决策向导（8/8）

❓ 决策 1/8: 目录结构设计
新增代码应该放在哪个目录？

[A] 按功能分层（推荐）
    lib/validation/, lib/cache/, lib/hooks/, lib/cli/

[B] 按模块分组
    lib/spec/, lib/defend/, lib/emit/

[C] 扁平结构
    lib/*.js

选择 [A/B/C]: A
理由（可选，回车跳过）: 功能清晰，易于测试

✅ 决策 1/8 完成

❓ 决策 2/8: 命名规范
...

# 全部完成后生成规格
✅ 架构决策已完成，生成规格文件...

📄 已创建: openspec/changes/{proposal}/specs/{feature-name}.fspec.md
   包含架构决策记录
```

#### 优势

- ✅ 强制引导：无法跳过关键决策
- ✅ 即时反馈：选择后立即记录
- ✅ 标准化：所有 fspec 使用统一决策框架

#### 缺点

- ⚠️ 开发成本高：需要实现交互式 CLI
- ⚠️ 灵活性低：固定问题列表
- ⚠️ 不适用所有场景：简单功能也要回答 8 个问题

---

### 方案 C: 混合模式（推荐）

#### 实现方式

结合方案 A 和方案 B：
1. **默认**：使用方案 A 的检查清单模板
2. **可选**：提供 `--interactive` 参数启用方案 B 的向导

```bash
# 默认：嵌入检查清单
/mob-seed:spec create feature-name

# 交互式：启动向导
/mob-seed:spec create feature-name --interactive

# 跳过检查（快速创建）
/mob-seed:spec create feature-name --skip-review
```

#### 优势

- ✅ 灵活性：用户可选择适合的方式
- ✅ 渐进式：简单场景快速创建，复杂场景引导决策
- ✅ 向后兼容：默认行为不变

---

## 实施计划

### 阶段 1: 模板增强（0.5 天）

1. **更新 `templates/feature.fspec.md`**
   - 添加"架构决策检查清单"章节
   - 添加 frontmatter 字段 `architecture_decisions_completed: false`

2. **更新 `commands/spec.md` 的 spec create 指导**
   - 说明检查清单的使用方法
   - 提供每个决策点的参考链接

3. **创建参考文档 `docs/architecture-decisions.md`**
   - 详细说明 8 个决策点
   - 提供每个选项的优缺点对比
   - 链接到 best-practices-review.md

### 阶段 2: 验证钩子（1 天）

创建 `scripts/verify-architecture-decisions.js`：

```javascript
// 检查规格文件是否完成架构决策
// 集成到 /mob-seed:spec validate

const yaml = require('yaml');
const fs = require('fs');

function verifyArchitectureDecisions(specPath) {
  const content = fs.readFileSync(specPath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(content);

  const issues = [];

  // 检查 1: frontmatter 标记
  if (frontmatter.status !== 'draft' && !frontmatter.architecture_decisions_completed) {
    issues.push('⚠️ 架构决策未完成，但规格状态已非 draft');
  }

  // 检查 2: 检查清单未填写
  const checklistMatches = body.match(/- \[ \]/g);
  if (checklistMatches && checklistMatches.length > 4) {
    issues.push(`⚠️ 架构决策检查清单有 ${checklistMatches.length} 项未勾选`);
  }

  // 检查 3: 选择和理由未填写
  const emptyChoices = body.match(/\*\*选择\*\*: ____________/g);
  if (emptyChoices && emptyChoices.length > 2) {
    issues.push(`⚠️ 有 ${emptyChoices.length} 个架构决策未记录选择`);
  }

  return {
    passed: issues.length === 0,
    issues
  };
}
```

### 阶段 3: 交互式向导（2 天，可选）

如果采用方案 C，实现 `--interactive` 参数：
- 使用 `enquirer` 库实现交互式问答
- 自动填写检查清单
- 生成架构决策摘要

---

## 成功标准

- [ ] 所有新创建的 fspec 自动包含"架构决策检查清单"章节
- [ ] `templates/feature.fspec.md` 更新包含 8 个决策点
- [ ] `docs/architecture-decisions.md` 完成，详细说明每个决策点
- [ ] `scripts/verify-architecture-decisions.js` 可检测未完成的决策
- [ ] 集成到 `/mob-seed:spec validate` 命令
- [ ] CLAUDE.md 新增教训 #19："架构决策前置"

---

## 效果预期

### Before（当前）

```
时间线：
Day 1: 创建 fspec，直接写实现细节
Day 2-3: 编写代码
Day 4: Code Review 发现架构问题
Day 5: 重新设计架构
Day 6-7: 返工重写 fspec + 代码

总耗时: 7 天
返工率: 40%
```

### After（内置检查）

```
时间线：
Day 1: 创建 fspec，完成架构决策检查（+1 小时）
Day 1-2: 基于决策编写规格细节
Day 3-4: 编写代码（架构已确定）
Day 5: Code Review 通过

总耗时: 5 天
返工率: 5%
节省: 2 天 (28%)
```

---

## 推荐方案

**采用方案 C（混合模式）**：
- **阶段 1**：先实施模板增强（0.5 天）
- **验证**：在 v3.3 剩余规格（spec-extract, spec-enrich）中试用
- **阶段 2**：基于试用反馈，决定是否实施交互式向导

**试用指标**：
- 是否减少了架构返工？
- 检查清单是否覆盖了关键决策点？
- 是否有遗漏的决策点需要补充？
