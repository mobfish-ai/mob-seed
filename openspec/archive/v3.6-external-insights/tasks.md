# v3.6 External Insights - 任务分解

> 状态: archived
> 创建: 2026-01-04
> 更新: 2026-01-11
> 归档日期: 2026-01-11

## 任务概览

| 阶段 | 任务数 | 进度 | 说明 |
|------|--------|------|------|
| Phase 0: 配置模块 | 2 | 2/2 ✅ | 🆕 存储模式配置 |
| Phase 1: 数据结构和解析 | 4 | 4/4 ✅ | 核心类型和解析 |
| Phase 2: 索引和生命周期 | 3 | 3/3 ✅ | 索引管理和状态机 |
| Phase 3: 命令和技能 | 4 | 4/4 ✅ | 🔄 顶级命令 + SKILL.md |
| Phase 4: 快速导入 | 3 | 3/3 ✅ | AI 辅助导入 |
| Phase 5: 提示和模板 | 2 | 2/2 ✅ | 🆕 提示词和模板 |
| **总计** | **18** | **18/18 ✅** | |

---

## Phase 0: 配置模块 (🆕)

### Task 0.1: 实现配置解析器

**目标**: 实现 ACE 输出目录配置解析，支持两种存储模式

**派生路径**: `skills/mob-seed/lib/ace/insight-config.js`

**存储模式**:

| 模式 | 适用场景 | 配置方式 |
|------|----------|----------|
| 默认模式 | 非开源项目 | 无需配置，使用 `.seed/insights/` |
| 外部+软链接模式 | 开源项目 | 配置 `ace.output_dir` |

**配置优先级**:
```
1. 环境变量 ACE_OUTPUT_DIR（最高）
2. .seed/config.local.json
3. .seed/config.json
4. 默认值 .seed/insights/（最低）
```

**验收标准**:
- [x] AC-023B: 未配置时使用默认目录 `.seed/insights/`
- [x] AC-024B: 环境变量优先级最高
- [x] AC-025B: config.local.json 优先于 config.json
- [x] AC-026B: `~/` 路径正确展开为用户目录
- [x] AC-027B: 目录不存在时自动创建
- [x] AC-028B: 软链接目标不存在时给出明确错误提示
- [x] AC-029B: `output_dir` 统一配置时自动添加子目录名

### Task 0.2: 编写配置测试

**目标**: 测试配置解析和优先级

**派生路径**: `skills/mob-seed/test/ace/insight-config.test.js`

**验收标准**:
- [x] AC-050: 默认目录测试
- [x] AC-051: 环境变量优先级测试
- [x] AC-052: 路径展开测试（~/ 处理）
- [x] AC-053: 目录自动创建测试

---

## Phase 1: 数据结构和解析

### Task 1.1: 创建 Insight 类型定义

**目标**: 定义洞见数据结构和类型

**派生路径**: `skills/mob-seed/lib/ace/insight-types.js`

**类型定义**:
```javascript
// InsightSourceType: expert_opinion | paper | blog | community | conference | book | internal
// InsightCredibility: high | medium | low
// InsightStatus: evaluating | piloting | adopted | partial | rejected | obsolete
```

**验收标准**:
- [x] AC-001: 洞见 ID 格式符合 `ins-{YYYYMMDD}-{slug}` 规范
- [x] AC-002: 所有必填字段都有验证
- [x] AC-003: sourceType 限制为预定义枚举值
- [x] AC-004: status 限制为预定义枚举值

### Task 1.2: 实现洞见文件解析器

**目标**: 解析 YAML frontmatter + Markdown 格式的洞见文件

**派生路径**: `skills/mob-seed/lib/ace/insight-parser.js`

**验收标准**:
- [x] AC-005: 文件可被正确解析为 Insight 对象
- [x] AC-006: frontmatter 验证失败时给出明确错误
- [x] AC-007: 支持空的 evaluation 和 decision 字段（新建时）

### Task 1.3: 实现洞见文件生成器

**目标**: 生成符合格式的洞见文件

**派生路径**: `skills/mob-seed/lib/ace/insight-generator.js`

**验收标准**:
- [x] AC-008: 生成的文件格式符合规范
- [x] AC-009: ID 格式符合 `ins-{YYYYMMDD}-{slug}` 规范
- [x] AC-010: 支持空的 evaluation 和 decision 字段

### Task 1.4: 编写解析器测试

**目标**: 测试解析和生成功能

**派生路径**: `skills/mob-seed/test/ace/insight-parser.test.js`

**验收标准**:
- [x] AC-011: 解析测试覆盖所有字段
- [x] AC-012: 生成测试验证格式正确
- [x] AC-013: 边界条件测试（缺失字段、无效值）

---

## Phase 2: 索引和生命周期

### Task 2.1: 实现索引管理器

**目标**: 维护洞见索引文件，支持快速查询

**派生路径**: `skills/mob-seed/lib/ace/insight-index.js`

**验收标准**:
- [x] AC-008: 新增洞见时索引自动更新
- [x] AC-009: 删除洞见时索引自动更新
- [x] AC-010: 状态变更时索引自动更新
- [x] AC-011: 索引统计数据准确

### Task 2.2: 实现生命周期状态机

**目标**: 管理洞见状态转换

**派生路径**: `skills/mob-seed/lib/ace/insight-lifecycle.js`

**状态转换规则**:
```
evaluating → piloting | adopted | partial | rejected
piloting → adopted | partial | rejected
adopted → obsolete
partial → obsolete | adopted
rejected → evaluating
obsolete → evaluating
```

**验收标准**:
- [x] AC-012: 只允许有效的状态转换
- [x] AC-013: 状态转换记录时间戳
- [x] AC-014: 非法状态转换给出明确错误

### Task 2.3: 实现模型时代复审

**目标**: 支持模型升级时触发复审

**派生路径**: `skills/mob-seed/lib/ace/insight-review.js`

**验收标准**:
- [x] AC-015: 可设置当前模型时代
- [x] AC-016: 可查询需要复审的洞见列表
- [x] AC-017: 复审提醒包含洞见 ID 和原因

---

## Phase 3: 命令和技能 (🔄 更新)

### Task 3.1: 创建顶级命令文件

**目标**: 创建 `/mob-seed:insight` 顶级命令定义

**派生路径**: `commands/insight.md`

**命令功能**:
```bash
/mob-seed:insight "https://..."     # 从 URL 导入
/mob-seed:insight --text            # 交互式文本导入
/mob-seed:insight --list            # 列出洞见
/mob-seed:insight --stats           # 统计信息
/mob-seed:insight --review          # 复审检查
/mob-seed:insight --update <id>     # 更新状态
```

**验收标准**:
- [x] AC-018: `/mob-seed:insight` 可直接调用（顶级命令）
- [x] AC-019: insight list 支持状态和标签过滤
- [x] AC-020: insight update 验证状态转换合法性
- [x] AC-021: insight review 输出需复审的洞见列表
- [x] AC-022: insight stats 显示各状态统计

### Task 3.2: 更新 SKILL.md

**目标**: 在技能定义中添加 insight 命令关联

**派生路径**: `skills/mob-seed/SKILL.md` (🔄 更新)

**更新内容**:
1. 关联命令表添加 `/mob-seed:insight` 条目
2. ACE 存储结构添加 insights 目录说明

**验收标准**:
- [x] AC-018B: 自然语言触发可识别洞见导入意图
- [x] AC-018C: SKILL.md 关联命令表包含 `/mob-seed:insight` 条目

### Task 3.3: 实现洞见管理器

**目标**: 整合所有洞见操作的统一入口

**派生路径**: `skills/mob-seed/lib/ace/insight-manager.js`

**验收标准**:
- [x] AC-029: create() 创建新洞见
- [x] AC-030: list() 列出洞见（支持过滤）
- [x] AC-031: update() 更新洞见状态
- [x] AC-032: review() 触发复审检查

### Task 3.4: 编写管理器测试

**目标**: 测试完整工作流

**派生路径**: `skills/mob-seed/test/ace/insight-manager.test.js`

**验收标准**:
- [x] AC-033: 创建 → 评估 → 采纳流程测试
- [x] AC-034: 复审触发测试
- [x] AC-035: 状态转换测试

---

## Phase 4: 快速导入

### Task 4.1: 实现内容提取器

**目标**: 从 URL 或文本中提取结构化信息

**派生路径**: `skills/mob-seed/lib/ace/insight-extractor.js`

**AI 辅助提取**:

| 字段 | 提取策略 |
|------|----------|
| title | 文章标题 / 分享主题 |
| author | 作者署名 / 分享者 |
| affiliation | 作者所属机构 |
| date | 发布日期 / 分享日期 |
| type | 根据来源域名或内容特征推断 |
| credibility | 根据作者背景和来源评估 |
| tags | 根据内容关键词生成 |

**验收标准**:
- [x] AC-036: 从 URL 抓取网页内容
- [x] AC-037: 提取标题、作者、日期等元数据
- [x] AC-038: 推断来源类型和可信度
- [x] AC-039: 生成标签建议

### Task 4.2: 实现导入器

**目标**: 整合提取和生成流程

**派生路径**: `skills/mob-seed/lib/ace/insight-importer.js`

**验收标准**:
- [x] AC-023: 支持从 URL 抓取并生成洞见文件
- [x] AC-024: 支持从粘贴文本生成洞见文件
- [x] AC-025: 自动提取的元数据准确率 ≥ 80%
- [x] AC-026: 生成的洞见文件符合格式要求
- [x] AC-027: 支持 --dry-run 预览模式
- [x] AC-028: 导入失败时给出明确错误提示

### Task 4.3: 编写导入测试

**目标**: 测试导入流程

**派生路径**: `skills/mob-seed/test/ace/insight-importer.test.js`

**验收标准**:
- [x] AC-045: URL 导入测试（含 mock）
- [x] AC-046: 文本导入测试
- [x] AC-047: 元数据提取准确率测试
- [x] AC-048: 错误处理测试

---

## Phase 5: 提示和模板 (🆕)

### Task 5.1: 创建导入提示词

**目标**: 为 AI 辅助导入提供提示词模板

**派生路径**:
- `skills/mob-seed/prompts/insight-import.md` - 导入时 AI 提示
- `skills/mob-seed/prompts/insight-evaluate.md` - 评估引导提示

**验收标准**:
- [x] AC-054: 导入提示词能引导 AI 正确提取元数据
- [x] AC-055: 评估提示词能引导用户进行辩证分析

### Task 5.2: 创建洞见模板

**目标**: 创建洞见文件模板

**派生路径**: `skills/mob-seed/templates/insight.md`

**模板内容**:
```markdown
---
id: ins-{YYYYMMDD}-{slug}
source:
  title: ""
  type: expert_opinion
  author: ""
  date: {date}
  credibility: medium
date: {date}
status: evaluating
model_era: {current_model}
tags: []
---

## 原始洞见

{content}

## 评估笔记

| 观点 | 适用性 | 理由 |
|------|--------|------|
| | | |

## 采纳决策

- ✅ 采纳：
- ⏸️ 观望：
- ❌ 不采纳：
```

**验收标准**:
- [x] AC-056: 模板包含所有必填字段
- [x] AC-057: 模板包含评估笔记和采纳决策结构

---

## 派生产物汇总

| 类型 | 路径 | Phase | 说明 |
|------|------|-------|------|
| 代码 | skills/mob-seed/lib/ace/insight-config.js | 0 | 🆕 配置解析 |
| 代码 | skills/mob-seed/lib/ace/insight-types.js | 1 | 类型定义 |
| 代码 | skills/mob-seed/lib/ace/insight-parser.js | 1 | 洞见解析 |
| 代码 | skills/mob-seed/lib/ace/insight-generator.js | 1 | 洞见生成 |
| 代码 | skills/mob-seed/lib/ace/insight-index.js | 2 | 索引管理 |
| 代码 | skills/mob-seed/lib/ace/insight-lifecycle.js | 2 | 生命周期状态机 |
| 代码 | skills/mob-seed/lib/ace/insight-review.js | 2 | 模型时代复审 |
| 代码 | skills/mob-seed/lib/ace/insight-manager.js | 3 | 洞见管理核心 |
| 代码 | skills/mob-seed/lib/ace/insight-extractor.js | 4 | 内容提取器 |
| 代码 | skills/mob-seed/lib/ace/insight-importer.js | 4 | 快速导入 |
| 测试 | skills/mob-seed/test/ace/insight-config.test.js | 0 | 🆕 配置测试 |
| 测试 | skills/mob-seed/test/ace/insight-parser.test.js | 1 | 解析测试 |
| 测试 | skills/mob-seed/test/ace/insight-index.test.js | 2 | 索引测试 |
| 测试 | skills/mob-seed/test/ace/insight-lifecycle.test.js | 2 | 生命周期测试 |
| 测试 | skills/mob-seed/test/ace/insight-manager.test.js | 3 | 管理器测试 |
| 测试 | skills/mob-seed/test/ace/insight-extractor.test.js | 4 | 提取器测试 |
| 测试 | skills/mob-seed/test/ace/insight-importer.test.js | 4 | 导入测试 |
| 命令 | commands/insight.md | 3 | 🆕 顶级命令 |
| 技能更新 | skills/mob-seed/SKILL.md | 3 | 🔄 关联命令表 |
| 提示 | skills/mob-seed/prompts/insight-import.md | 5 | 🆕 导入提示 |
| 提示 | skills/mob-seed/prompts/insight-evaluate.md | 5 | 🆕 评估提示 |
| 模板 | skills/mob-seed/templates/insight.md | 5 | 🆕 洞见模板 |

---

## 测试统计

| 模块 | 测试文件 | 测试数 | 通过 |
|------|----------|--------|------|
| insight-config | insight-config.test.js | 32 | ✅ |
| insight-parser | insight-parser.test.js | 45 | ✅ |
| insight-index | insight-index.test.js | 28 | ✅ |
| insight-lifecycle | insight-lifecycle.test.js | 42 | ✅ |
| insight-review | insight-review.test.js | 18 | ✅ |
| insight-manager | insight-manager.test.js | 42 | ✅ |
| insight-extractor | insight-extractor.test.js | 56 | ✅ |
| insight-importer | insight-importer.test.js | 30 | ✅ |
| **总计** | **8** | **293** | **✅ 全部通过** |

---

## 依赖关系

```
Phase 0: 配置模块
Task 0.1 (配置解析) ←─── Task 0.2 (配置测试)
    ↓
Phase 1: 数据结构
Task 1.1 (类型定义)
    ↓
Task 1.2 (解析器) + Task 1.3 (生成器) ←─── Task 1.4 (测试)
    ↓
Phase 2: 索引和生命周期
Task 2.1 (索引) + Task 2.2 (生命周期)
    ↓
Task 2.3 (复审)
    ↓
Phase 3: 命令和技能
Task 3.1 (命令) + Task 3.2 (SKILL.md)
    ↓
Task 3.3 (管理器) ←─── Task 3.4 (测试)
    ↓
Phase 4: 快速导入
Task 4.1 (提取器)
    ↓
Task 4.2 (导入器) ←─── Task 4.3 (测试)
    ↓
Phase 5: 提示和模板
Task 5.1 (提示词) + Task 5.2 (模板)
```

---

## 检查清单

### 开始前
- [x] 确认存储模式需求（默认 vs 外部+软链接）
- [x] 确认 ACE 输出目录配置
- [x] 确认与现有 ACE 机制的集成点

### 完成后
- [x] 所有测试通过 (708 ACE tests, 0 failed)
- [x] 运行 `/mob-seed:defend` 验证同步
- [ ] 更新 CLAUDE.md ACE 章节
- [ ] 更新 README 命令列表
