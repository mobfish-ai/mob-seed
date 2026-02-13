# Changelog

本项目遵循 [Semantic Versioning](https://semver.org/) 语义化版本规范。

## [Unreleased]

---

## [3.11.0] - 2026-02-13

### Changed

**Insight 关联检索与来源追溯 (跨项目一致性修复)**

- **统一 source.type 枚举**: 基于 230+ 条洞见的实际使用统计，统一为 12 种类型:
  `blog | expert_opinion | experience | documentation | paper | discussion | video | interview | report | article | community | ai_generated`
  - 同步更新: `commands/insight.md`, `prompts/insight-import.md`, `templates/insight.md`
- **更新 model_era**: `claude-opus-4.5` → `claude-opus-4-6`
- **commands/insight.md**: 内联模板替换为引用 `templates/insight.md`，避免模板分叉
- **来源类型说明表**: 从 7 种扩展到 12 种，覆盖实际使用的所有类型

### Added

**模板和导入流程增强**

- **templates/insight.md**: "相关变更" 扩展为三个子章节:
  - `### 关联洞见` — 要求 Grep 搜索并用 `[[wikilink]]` 链接
  - `### 来源追溯` — 原文 URL/archive 链接
  - `### 潜在行动` — 规格/文档/代码改进
- **prompts/insight-import.md**: 同步更新模板和质量检查清单
- **质量检查清单新增 3 项**:
  - `□ 关联洞见已检索并链接`
  - `□ 来源追溯已链接`
  - `□ 元数据从原文明确提取（无推测）`

---

## [3.10.0] - 2026-01-22

### Changed

**Insight Index v2.0 双索引架构**

为优化大规模洞见管理性能，重构索引系统为双索引架构：

- **精简主索引 `index.json`**: 仅保留 `{id, status, date, file}` 四个字段，用于快速列表和状态查询
- **标签倒排索引 `tags-index.json`**: 按标签快速查找洞见，仅索引出现 2 次以上的标签
- **完整元数据存储**: 所有详细信息（author, affiliation, source, tags 等）保存在 `.md` 文件的 YAML frontmatter 中

**索引操作优化**
- `getIndex()` 返回精简索引，减少内存占用
- `syncInsightIndex()` 同时更新主索引和标签索引
- `findSimilarInsights()` 从实际 `.md` 文件读取完整元数据进行比较
- `updateTagsIndexForInsight()` 增量更新标签索引

**代码变更**
- `lib/ace/insight-index.js` - 索引管理核心重构 (+375 行)
- `lib/ace/insight-dedup.js` - 适配 v2.0 索引格式
- `commands/insight.md` - 更新索引架构文档

### Removed

- `lib/ace/insight-title-generator.js` - 移除未使用的标题生成器模块 (-130 行)

### Tests

- 新增/更新测试: 661+ 行
- `test/ace/insight-index.test.js` - v2.0 索引测试
- `test/ace/insight-dedup.test.js` - 适配 v2.0 格式
- `test/ace/insight-importer.test.js` - 适配 v2.0 格式
- 全部测试: 1854 pass / 0 fail

---

## [3.9.0] - 2026-01-20

### Added

**文件导入功能**
- 支持从本地文件导入洞见（Markdown、文本文件）
- 智能标题提取：从文件名、frontmatter、首行标题自动提取
- 新增 `prompts/insight-import.md` 导入提示模板

**洞见去重机制**
- `lib/ace/insight-dedup.js` - 新增去重模块 (377 行)
  - 基于标题、标签、关键词的多维相似度计算
  - Jaccard 相似度 + Levenshtein 距离
  - 可配置阈值和权重
- 导入前自动检测相似洞见，防止重复导入

**规格文件**
- `openspec/archive/v3.9-file-import/specs/file-import.fspec.md` - 文件导入规格

### Changed

- `lib/ace/insight-extractor.js` - 增强内容提取能力 (+96 行)
- `lib/ace/insight-importer.js` - 集成去重检查和文件导入 (+332 行)
- `templates/insight.md` - 更新洞见模板 (+103 行)

### Tests

- `test/ace/insight-dedup.test.js` - 去重模块测试 (640 行)
- `test/ace/insight-importer.test.js` - 文件导入测试 (+401 行)
- 全部测试: 1748 pass / 0 fail

---

## [3.8.2] - 2026-01-15

### Fixed

- 修复 Claude Code 插件缓存目录版本检测失败问题
  - `lib/hooks/scenario.js` - 改进场景检测逻辑
  - `lib/runtime/version-checker.js` - 增强版本检测容错

---

## [3.8.1] - 2026-01-13

### Fixed

- 移除 `config.json` 中硬编码的 `version` 字段（版本应从 `package.json` 读取）

### Added

- `test/scripts/detect-project.test.js` - 项目检测脚本测试 (260 行)
- `test/scripts/verify-init.test.js` - 初始化验证脚本测试 (118 行)

---

## [3.8.0] - 2026-01-12

### Added

- **Insights 索引验证**: 新增 `scripts/verify-insights.js` 脚本，验证 `.seed/insights/index.json` 与实际 `.md` 文件的一致性
  - 支持自动修复模式 (`--fix`) 重建索引
  - 支持外部知识库（通过符号链接）
  - 新增 npm scripts: `insights:verify`, `insights:sync`
- **Git hooks 版本检查**: pre-commit hook 现在自动检查版本文件一致性，阻止版本不一致的提交

### Changed

- **版本检查简化**: 移除版本缓存机制，直接请求 npm registry
  - 简化 `version-checker.js`: 导出函数从 9 个减少到 5 个
  - 代码行数减少 105 行 (-44%)
  - 移除 `release.sh` 中的缓存清理步骤
  - 移除 `bump-version.js` 中的缓存清理逻辑
  - 缓存移除理由: 维护成本 > 缓存收益 (2-5 秒/天)
- **CLAUDE.md**: 新增教训 23 - "简化优于优化：版本缓存移除案例"

### Fixed

- 增量检查脚本现在支持 `scripts/` 目录的测试路径映射
  - `skills/mob-seed/scripts/*.js` → `skills/mob-seed/test/scripts/*.test.js`

---

## [3.6.0] - 2026-01-11

### Added

**External Insights 外部洞见积累机制**
- `/mob-seed:insight` - 新增顶级命令，用于外部知识导入和管理
- 洞见生命周期管理: `evaluating → piloting → adopted/partial/rejected → obsolete`
- 模型时代追踪: claude-3-opus, claude-3.5-sonnet, claude-opus-4, claude-opus-4.5
- 快速导入功能: 从 URL 或文本自动提取元数据

**核心模块 (10 个文件)**
- `lib/ace/insight-config.js` - ACE 输出目录配置解析（支持环境变量、本地配置）
- `lib/ace/insight-types.js` - 洞见类型定义和常量
- `lib/ace/insight-parser.js` - 洞见文件解析器（YAML frontmatter + Markdown）
- `lib/ace/insight-generator.js` - 洞见文件生成器
- `lib/ace/insight-index.js` - 洞见索引管理
- `lib/ace/insight-lifecycle.js` - 生命周期状态机
- `lib/ace/insight-review.js` - 模型时代复审
- `lib/ace/insight-manager.js` - 洞见管理核心（CRUD + 统计）
- `lib/ace/insight-extractor.js` - URL/文本内容提取（支持域名到类型/可信度映射）
- `lib/ace/insight-importer.js` - 快速导入编排器

**测试文件 (8 个文件，293 个测试)**
- 完整覆盖所有核心模块
- 包含边界条件和错误处理测试

**提示和模板**
- `prompts/insight-import.md` - URL/文本导入 AI 提示
- `prompts/insight-evaluate.md` - 辩证评估引导提示
- `templates/insight.md` - 洞见文件模板

**命令文件**
- `commands/insight.md` - 顶级命令定义

### Changed

- SKILL.md 关联命令表新增 `/mob-seed:insight` 条目
- ACE 存储结构新增 `insights/` 目录支持

### Tests

- ACE 模块测试: 708 tests (新增 293)
- 全部测试: 1387+ pass / 0 fail

---

## [3.5.0] - 2026-01-04

### Added

**Runtime Version 运行时版本检测**
- 支持运行时获取插件版本号
- fspec 格式统一化

### Changed

- CLAUDE.md 新增教训 #20: 禁止跳过 SEED Hook 检查

---

## [3.4.0] - 2026-01-04

### Added

**场景检测模块**
- `lib/hooks/scenario.js` - 运行环境检测（5 种场景）
  - DOGFOODING: mob-seed 项目内开发
  - USER_ENV: 用户通过 SEED_PLUGIN_PATH 环境变量配置
  - USER_PLUGIN: 用户通过 Claude Code 插件安装
  - COMPAT: 兼容模式（.seed/scripts 存在）
  - MISSING: 脚本未找到
- 四层回退策略：Layer 0 (env var) → Layer 1 (dogfooding) → Layer 2 (compat) → Layer 3 (plugin)
- 场景标签显示：`[开发模式]`、`[用户项目]`、`[兼容模式]`

**Git Hooks 整合**
- `skills/mob-seed/hooks/` - 统一 hooks 目录
  - `pre-commit` - 快速检查（带场景标识）
  - `pre-push` - 增量检查（带场景标识）
  - `ace-pre-commit` / `ace-pre-push` - ACE 闭环钩子
  - `README.md` - hooks 使用文档

**测试补充（57 个新测试）**
- `test/hooks/scenario.test.js` - 场景检测测试 (21 tests)
- `test/hooks/quick-defender.test.js` - 快速检查测试 (22 tests)
- `test/hooks/cache-checker.test.js` - 缓存检查测试 (17 tests)
- `test/hooks/cache-updater.test.js` - 缓存更新测试 (13 tests)
- `test/hooks/incremental-defender.test.js` - 增量检查测试 (27 tests)

### Changed

**脚本整合（单一真相源）**
- 所有脚本迁移到 `skills/mob-seed/scripts/`：
  - `check-cache.js`, `quick-defend.js`, `incremental-defend.js`, `update-cache.js`
  - `reverse-engineer.js`, `verify-*.js` 等验证脚本
- 项目级目录现在是符号链接：
  - `.seed/scripts/` → `../skills/mob-seed/scripts/`
  - `.seed/hooks/` → `../skills/mob-seed/hooks/`

**命令更新**
- `commands/defend.md` - 新增 Git Hooks 场景检测文档
- `commands/init.md` - 更新 hooks 安装流程（使用 skills/mob-seed/hooks/）

**hooks 模块更新**
- `lib/hooks/quick-defender.js` - 集成场景检测
- `lib/hooks/incremental-defender.js` - 集成场景检测
- `lib/hooks/index.js` - 导出 scenario 模块

### Tests

- hooks 模块测试：100 tests (新增 57)
- 全部测试：1387 pass / 0 fail

---

## [3.3.0] - 2026-01-04

### Added

**Brownfield Migration（一键迁移）**

现有项目无需手动编写规格，一键从代码逆向生成完整规格。

**Phase 1: spec extract 命令**
- `lib/spec/from-code.js` - 代码提取主入口
- `lib/spec/parser.js` - 规格文件 I/O
- `lib/parsers/ast-javascript.js` - JavaScript AST 解析器
- `lib/cli/spec-extract.js` - CLI 包装
- `scripts/reverse-engineer.js` - AST 逆向工程脚本
  - `extractMethodsAST()` - 方法提取
  - `extractJSDoc()` - JSDoc 提取
  - @babel/parser 可选依赖（回退到正则）

**Phase 2: spec enrich 命令**
- `lib/spec/enrich.js` - 规格补充引擎
- `lib/parsers/test-parser.js` - 测试文件解析
- `lib/cli/spec-enrich.js` - CLI 包装
- 从测试用例提取验收标准
- AI 辅助生成功能需求
- 质量标注（`[Tests]`/`[JSDoc]`/`[AI]`/`[Template]`）

**Phase 3: brownfield 命令**
- `lib/brownfield/orchestrator.js` - 工作流编排
- `lib/brownfield/project-detector.js` - 项目结构检测
- `lib/brownfield/state-manager.js` - 状态管理/断点续传
- `lib/brownfield/report-generator.js` - 迁移报告生成
- `lib/cli/brownfield.js` - CLI 包装
- 支持 `--dry-run`、`--incremental`、`--continue` 选项

**Phase 4: defend 双向同步**
- `lib/defend/drift-detector.js` - 偏离检测引擎
  - 检测类型：method_added, method_removed, signature_changed, parameter_added, parameter_removed
  - 严重性分级：high, medium, low
- `lib/defend/update-proposer.js` - 更新提案生成
  - 保护区域（requirements, acceptance_criteria）禁止自动更新
  - 风险评估和自动应用判断
- `lib/defend/bidirectional-sync.js` - 双向同步引擎
  - `--sync-direction=spec`: 规格→代码（验证）
  - `--sync-direction=code`: 代码→规格（反向同步）
  - `--sync-direction=bidirectional`: 双向检测

**新增规格文件 (6 个)**
- `openspec/changes/v3.3-brownfield-support/specs/architecture-refactor.fspec.md`
- `openspec/changes/v3.3-brownfield-support/specs/spec-extract.fspec.md`
- `openspec/changes/v3.3-brownfield-support/specs/spec-enrich.fspec.md`
- `openspec/changes/v3.3-brownfield-support/specs/brownfield.fspec.md`
- `openspec/changes/v3.3-brownfield-support/specs/defend-bidirectional.fspec.md`
- `openspec/changes/v3.3-brownfield-support/specs/reverse-engineer-ast.fspec.md`

**最佳实践集成**
- `docs/best-practices-review.md` - 架构决策复盘
- `docs/best-practices-integration.md` - 检查清单集成方案
- `scripts/verify-architecture-decisions.js` - 架构决策验证脚本

### Changed

**架构重构 (REFACTOR-001)**
- 通用能力从 `.seed/scripts/` 迁移到 `skills/mob-seed/lib/hooks/`
  - `check-cache.js` → `hooks/cache-checker.js`
  - `quick-defend.js` → `hooks/quick-defender.js`
  - `incremental-defend.js` → `hooks/incremental-defender.js`
  - `update-cache.js` → `hooks/cache-updater.js`
- `commands/defend.md` 扩展 `--quick`、`--incremental`、`--cached` 选项
- 用户项目现在可以正常调用这些能力

**文档更新**
- README.md / README.zh-CN.md 新增 Brownfield Migration 章节 (+125 行)
- CLAUDE.md 新增经验教训 #19: 架构重构遵循渐进式五步法

### Tests

- 新增测试用例：约 200+ 个
- 测试覆盖：
  - `test/spec/from-code.test.js` - spec extract 测试
  - `test/spec/enrich.test.js` - spec enrich 测试
  - `test/brownfield/*.test.js` - brownfield 模块测试 (76 tests)
  - `test/defend/drift-detector.test.js` - 偏离检测测试 (27 tests)
  - `test/defend/update-proposer.test.js` - 更新提案测试 (33 tests)
  - `test/defend/bidirectional-sync.test.js` - 双向同步测试 (27 tests)

---

## [3.2.1] - 2026-01-03

### Changed

**初始化流程强化**
- `commands/init.md` - 步骤 1.3 改为强制使用检测脚本输出（35 行变更）
  - 添加明确的 bash 命令示例：`cat /tmp/xxx.json > .seed/config.json`
  - 新增关键原则说明框：禁止手动解析或重构配置
  - 所有配置文件都使用 `cat` 或 `cp` 直接复制，零中间环节
- `CLAUDE.md` - lesson #17 扩展禁止事项（3 行新增）
  - ✅ 直接使用检测脚本的输出文件
  - ❌ 禁止手动解析 JSON 再重新构造配置（易被 CLAUDE.md 误导）
  - ❌ 禁止读取 CLAUDE.md 中的路径配置覆盖检测结果

**改进收益**：
- 完全避免人为错误
- 不受 CLAUDE.md 或其他文档误导
- 配置 100% 来自智能检测脚本

---

## [3.2.0] - 2026-01-03

### Added

**智能项目初始化**
- `scripts/detect-project.js` - 智能检测项目结构 (408 行)
  - 自动检测 src/test/docs 目录（支持多种命名约定：src/lib/server/app, test/tests/__tests__)
  - 从 package.json 提取项目信息（名称、描述、版本、仓库）
  - 自动识别技术栈（语言、运行时、框架、测试工具、构建工具）
  - 生成适配当前项目的 config.json 和 project.md

**ACE 观察**
- `.seed/observations/obs-20260103-init-improvements.md` - 记录初始化问题和解决方案

### Fixed

**模板通用化**
- `templates/openspec/mission.yaml` - 移除 mob-seed 特定哲学内容
  - 修改标题：从 "The Covenant Between Human Intent and AI Intelligence" 改为 "Defining Purpose, Principles, and Evolution Boundaries"
  - 添加通用说明，适用于所有项目类型
- `templates/openspec/AGENTS.md` - 更新到 v3.0 命令格式 (完全重写，204 行变更)
  - 所有命令从 `/mob-seed-*` 格式更新为 `/mob-seed:*` 格式
  - 简化 OpenSpec 生命周期说明（Draft → Implementing → Archived）
  - 新增故障排除章节

### Changed

**初始化流程优化**
- `commands/init.md` - 新增智能检测步骤
  - 步骤 1.1: 运行检测脚本自动生成配置
  - 步骤 1.3: 明确使用通用 mission 模板（而非 mob-seed 自己的 mission）
  - 输出示例展示检测结果
- `CLAUDE.md` - 新增 lesson #17: init 命令必须智能检测项目结构
  - 禁止硬编码路径默认值
  - 禁止复制 mob-seed 配置到用户项目
  - 能自动填充的信息不要让用户手动填写

---

## [3.1.0] - 2026-01-03

### Added

**ACE 无缝融合** (4 层集成)
- `L1 Skill 核心层`: SKILL.md 原则定义，AI 阅读后自动激活 ACE 模式
- `L2 命令嵌入层`: 6 个命令（seed/spec/emit/exec/defend/archive）嵌入 ACE 提示
- `L3 对话拦截层`: 会话开始/结束自动触发观察收集
- `L4 Hooks 保障层`: Git pre-commit/pre-push 强制验证

**归档流程增强**
- `findSpecFiles(dir)` - 递归查找规格文件
- `markCheckboxesComplete(filePath)` - 标记 checkbox + 自动添加归档日期
- 归档时自动更新真相源 `specs/` 目录的状态和 checkbox

### Fixed

- **归档辅助函数缺失**: `archiver.js` 调用了未定义的函数，导致归档不完整
- **规格状态不一致**: 14 个 ACE 规格文件状态从 `draft` 修复为 `archived`
- **归档日期缺失**: 批量补全 v3.1-ace-fusion 归档的归档日期

### Changed

- 命令文档格式更新，新增 ACE 集成说明
- SKILL.md 新增 ACE 反思循环和观察系统说明
- Git hooks 目录结构调整

---

## [3.0.0] - 2026-01-02

### ⚠️ Breaking Changes
- **ACE 集成**: 新增 Observe/Reflect/Curate 闭环，扩展 SEED 方法论
- **规格目录扩展**: `.seed/observations/` 和 `.seed/reflections/` 新增目录

### Added

**ACE 核心模块** (11 个新模块，约 5000+ 行代码)
- `lib/ace/observation.js` - 观察对象和索引管理 (702 行)
- `lib/ace/observation-collector.js` - 自动收集测试失败/规格偏离 (380 行)
- `lib/ace/observation-stats.js` - 观察统计分析 (367 行)
- `lib/ace/observe-handler.js` - 手动观察命令处理 (527 行)
- `lib/ace/triage-handler.js` - 观察分类归档 (702 行)
- `lib/ace/reflection.js` - 反思生成和管理
- `lib/ace/reflection-trigger.js` - 阈值触发器
- `lib/ace/feature-extractor.js` - 模式特征提取
- `lib/ace/similarity-matcher.js` - 历史模式匹配
- `lib/ace/feedback-collector.js` - 效果反馈收集
- `lib/spec/proposal-validator.js` - 提案完整性验证

**新增规格文件** (16 个 ACE 规格)
- `openspec/changes/v3.0-ace-integration/specs/ace/observation.fspec.md`
- `openspec/changes/v3.0-ace-integration/specs/ace/observation-collector.fspec.md`
- `openspec/changes/v3.0-ace-integration/specs/ace/spec-observe-command.fspec.md`
- `openspec/changes/v3.0-ace-integration/specs/ace/spec-triage-command.fspec.md`
- `openspec/changes/v3.0-ace-integration/specs/ace/status-panel-enhance.fspec.md`
- `openspec/changes/v3.0-ace-integration/specs/ace/task-generation.fspec.md`
- `openspec/changes/v3.0-ace-integration/specs/ace/reflection.fspec.md`
- `openspec/changes/v3.0-ace-integration/specs/ace/reflection-trigger.fspec.md`
- `openspec/changes/v3.0-ace-integration/specs/ace/spec-reflect-command.fspec.md`
- `openspec/changes/v3.0-ace-integration/specs/ace/pattern-learning.fspec.md`
- `openspec/changes/v3.0-ace-integration/specs/ace/auto-propose.fspec.md`
- `openspec/changes/v3.0-ace-integration/specs/ace/llm-reflect.fspec.md`
- `openspec/changes/v3.0-ace-integration/specs/ace/proposal-validation.fspec.md`
- `openspec/changes/v3.0-ace-integration/specs/ace/doc-update.fspec.md`

**新增 ACE 命令**
- `/mob-seed:spec observe` - 手动添加观察
- `/mob-seed:spec triage` - 观察分类归档
- `/mob-seed:spec reflect` - 触发反思分析
- `/mob-seed:spec promote` - 将反思升级为提案

**文档更新**
- `docs/concepts/ace-overview.md` - ACE 概念说明文档
- `docs/concepts/openspec-lifecycle.md` - 更新包含 ACE 闭环
- README.md / README.zh-CN.md - 新增 ACE 章节
- CLAUDE.md - 新增 ACE 开发指南

**验证脚本**
- `scripts/verify-task-progress.js` - 任务进度验证
- `scripts/verify-docs.js` - 文档完整性验证
- `scripts/verify-seed-sync.js` - SEED 同步验证
- `scripts/verify-archive.js` - 归档完整性验证

### Changed
- 状态面板增强：显示观察统计信息
- Execute 命令：自动收集测试失败观察
- Defend 命令：自动检测规格偏离观察
- 配置扩展：新增 `ace` 配置节

### Fixed
- 归档流程：修复规格文件状态和 AC checkbox 遗漏
- 程序化验证：建立归档执行标准
- 版本管理：实施单源版本管理方案

### Tests
- 1029+ tests passed (新增约 3000+ 行测试代码)
- ACE 模块测试覆盖：observation, collector, stats, handler, triage

---

## [2.1.1] - 2026-01-01

### Fixed
- 修复 README 命令名称未更新问题 (`/mob-seed-*` → `/mob-seed:*`)
- 同步更新中英文 README 命令表格
- 更新 CLAUDE.md 命令表格和当前状态
- 新增经验教训 #13: CHANGELOG 必须基于 Git 历史

---

## [2.1.0] - 2026-01-01

### ⚠️ Breaking Changes
- **命令系统重构**: 统一为子命令模式 (`/mob-seed:*`)
  - `/mob-seed-spec` → `/mob-seed:spec`
  - `/mob-seed-emit` → `/mob-seed:emit`
  - `/mob-seed-exec` → `/mob-seed:exec`
  - `/mob-seed-defend` → `/mob-seed:defend`
  - `/mob-seed-init` → `/mob-seed:init`
  - `/mob-seed-archive` → `/mob-seed:archive`
  - 移除: `/mob-seed-status`, `/mob-seed-diff`, `/mob-seed-sync`, `/mob-seed-edit`

### Added

**新增核心模块**
- `lib/mission/integration.js` - Mission 集成模块 (333 行测试)
- `lib/ux/interactive-prompt.js` - 交互式提示模块 (248 行测试)
- `lib/ux/progress-panel.js` - 进度面板模块 (113 行测试)
- `lib/workflow/state-evolution.js` - 状态演进模块 (300 行测试)
- `lib/workflow/unified-command.js` - 统一命令模块 (386 行测试)

**新增规格文件 (Phase 2)**
- `openspec/specs/automation/release-flow.fspec.md` - 发布流程规格
- `openspec/specs/automation/version-sync.fspec.md` - 版本同步规格
- `openspec/specs/cache/session-cache.fspec.md` - 会话缓存规格
- `openspec/specs/mission/integration.fspec.md` - Mission 集成规格
- `openspec/specs/ux/interactive-mode.fspec.md` - 交互模式规格
- `openspec/specs/workflow/action-suggest.fspec.md` - 操作建议规格
- `openspec/specs/workflow/state-evolution.fspec.md` - 状态演进规格
- `openspec/specs/workflow/unified-command.fspec.md` - 统一命令规格

**发布自动化**
- `scripts/bump-version.js` - 版本号同步脚本 (334 行)
- `scripts/release.sh` - 发布流程脚本 (345 行)
- `scripts/check-proposal-tasks-sync.js` - 提案任务同步检查
- `.github/workflows/release.yml` - GitHub Release 工作流

**文档**
- `docs/guide/releasing.md` - 发布指南文档

### Changed
- 命令文件添加 `name:` 字段到 frontmatter（符合 Claude Code 插件规范）
- 修正 SEED 派生范围：从仅 API 文档扩展到全部文档类型
- Mission Statement 模块：使用正确的 parseMissionCore 函数
- 重构 openspec/AGENTS.md 和 CODEBASE_SPEC.md

### Fixed
- 修复年份引用：2025 → 2026
- 修复命令文件缺少 `name:` 字段问题
- 修复 Mission 模块 parseACE 别名保持向后兼容

### Removed
- 移除旧命令文件: `mob-seed-status.md`, `mob-seed-diff.md`, `mob-seed-sync.md`, `mob-seed-edit.md`, `mob-seed.md`

### Tests
- 494 tests passed (新增约 1380 行测试代码)

---

## [2.0.0] - 2026-01-01

### Added

**核心模块** (11 个)
- `lib/router/complexity-router.js` - 复杂度路由，自动判断任务规模
- `lib/sync/task-sync.js` - 任务同步，规格与 tasks.md 双向同步
- `lib/workflow/flow-router.js` - 流程路由，根据前置条件选择流程
- `lib/workflow/pre-impl-confirmation.js` - 实现前确认，防止误操作
- `lib/quality/fspec-linter.js` - 规格检查器，验证 fspec 语法
- `lib/quality/phase-gate.js` - 阶段门禁，确保流程顺序
- `lib/quality/debug-protocol.js` - 调试协议，结构化问题诊断
- `lib/ops/metrics.js` - 度量收集，统计派生效果
- `lib/ops/cancellation.js` - 取消机制，支持中断长任务
- `lib/ops/change-handler.js` - 变更处理，规格变更时自动触发
- `lib/automation/scenario-test-mapper.js` - 场景测试映射器

**OpenSpec 架构**
- `openspec/specs/` - 稳定规格目录（真相源）
- `openspec/changes/` - 进行中的变更提案
- `openspec/archive/` - 已完成的历史归档
- Delta 语法支持 (ADDED/MODIFIED/REMOVED/CLARIFIED)
- 生命周期管理 (draft → review → implementing → archived)

**Mission Statement**
- `.seed/mission.md` - 项目使命声明
- 定义项目目的、原则和反目标，用于指导 AI 辅助开发决策

**Git Hooks 自动化**
- `.seed/hooks/pre-commit` - 提交前快速检查
- `.seed/hooks/pre-push` - 推送前增量检查
- `.seed/scripts/check-cache.js` - 检查缓存
- `.seed/scripts/quick-defend.js` - 快速同步检查
- `.seed/scripts/incremental-defend.js` - 增量检查
- `.seed/scripts/update-cache.js` - 更新缓存

**文档体系**
- `docs/api/` - 17 个模块 API 文档
- `docs/guide/getting-started.md` - 快速开始指南
- `docs/guide/writing-specs.md` - 规格编写指南
- `docs/concepts/seed-methodology.md` - SEED 方法论
- `docs/concepts/openspec-lifecycle.md` - OpenSpec 生命周期

### Changed
- 完全移除 `--legacy` 和 `--migrate` 模式，仅支持 OpenSpec
- 重构命令系统为统一入口 `/mob-seed`
- 配置文件从 YAML 改为 JSON (`.seed/config.json`)

### Fixed
- 修复空壳生成问题，改为 Claude 提示模式
- 修复 ES Module 与 CJS 兼容性问题
- 修复配置路径解析问题

### Deprecated
- 移除 `mixins/` 目录（迁移到 OpenSpec）
- 移除 `agents/` 目录（重构为 workflow 模块）

---

## [1.2.0] - 2025-12-15

### Added
- 逆向同步功能：从代码生成规格 (`/mob-seed-sync`)
- GitHub Actions CI/CD 工作流
- 发布工作流自动化

---

## [1.1.0] - 2025-12-10

### Added
- 测试框架集成 (Node.js test runner)
- `package.json` 项目配置
- `install.sh` 手动安装脚本
- 插件市场支持 (Claude Plugins Official)

### Changed
- 移除 `--legacy` 模式，仅支持 OpenSpec
- 更新安装说明为插件市场两步安装方式

### Fixed
- 修复 `plugin.json` 路径和邮箱配置
- 修复插件市场 schema 格式

---

## [1.0.0] - 2025-12-01

### Added
- 初始版本发布
- SEED 方法论核心实现
  - Spec (规格) - `.fspec.md` 规格文件格式
  - Emit (派生) - 代码/测试/文档自动生成
  - Execute (执行) - 测试运行与 AC 更新
  - Defend (守护) - 同步状态检查
- 基础命令
  - `/mob-seed` - 统一入口
  - `/mob-seed-init` - 项目初始化
  - `/mob-seed-spec` - 规格管理
  - `/mob-seed-emit` - 派生生成
  - `/mob-seed-exec` - 测试执行
  - `/mob-seed-defend` - 同步守护
  - `/mob-seed-status` - 状态查看
- Hello World 示例项目

---

[Unreleased]: https://github.com/mobfish-ai/mob-seed/compare/v3.10.0...HEAD
[3.10.0]: https://github.com/mobfish-ai/mob-seed/compare/v3.9.0...v3.10.0
[3.9.0]: https://github.com/mobfish-ai/mob-seed/compare/v3.8.2...v3.9.0
[3.8.2]: https://github.com/mobfish-ai/mob-seed/compare/v3.8.1...v3.8.2
[3.8.1]: https://github.com/mobfish-ai/mob-seed/compare/v3.8.0...v3.8.1
[3.8.0]: https://github.com/mobfish-ai/mob-seed/compare/v3.6.0...v3.8.0
[3.6.0]: https://github.com/mobfish-ai/mob-seed/compare/v3.5.0...v3.6.0
[3.5.0]: https://github.com/mobfish-ai/mob-seed/compare/v3.4.0...v3.5.0
[3.4.0]: https://github.com/mobfish-ai/mob-seed/compare/v3.3.0...v3.4.0
[3.3.0]: https://github.com/mobfish-ai/mob-seed/compare/v3.2.1...v3.3.0
[3.2.1]: https://github.com/mobfish-ai/mob-seed/compare/v3.2.0...v3.2.1
[3.2.0]: https://github.com/mobfish-ai/mob-seed/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/mobfish-ai/mob-seed/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/mobfish-ai/mob-seed/compare/v2.1.1...v3.0.0
[2.1.1]: https://github.com/mobfish-ai/mob-seed/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/mobfish-ai/mob-seed/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/mobfish-ai/mob-seed/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/mobfish-ai/mob-seed/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/mobfish-ai/mob-seed/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/mobfish-ai/mob-seed/releases/tag/v1.0.0
