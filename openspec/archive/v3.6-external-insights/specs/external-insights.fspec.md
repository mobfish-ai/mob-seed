---
id: external-insights
version: 1.1.0
status: archived
created: 2026-01-04
updated: 2026-01-11
归档日期: 2026-01-11
tech_stack: JavaScript
derived_path: skills/mob-seed/lib/ace/
priority: P1
---

# Feature: External Insights - 外部洞见积累机制

## 概述 (Overview)

扩展 ACE 机制，支持外部洞见的系统性收集、辩证评估和选择性采纳。外部洞见来源包括专家意见、论文、博客、社区讨论等，通过标准化格式存储，支持时效性管理和模型升级复审。

### 目标用户

- 使用 mob-seed 的开发者
- 项目维护者
- 技术决策者

### 业务约束

- 支持两种存储模式：
  - **默认模式**: 存储在 `.seed/insights/`，适用于非开源项目
  - **外部+软链接模式**: 存储在外部目录，通过软链接在项目内访问，适用于开源项目
- 格式使用 YAML frontmatter + Markdown
- 每个洞见有唯一 ID（格式：ins-{YYYYMMDD}-{slug}）
- 洞见状态机：evaluating → adopted | partial | rejected → obsolete
- 使用顶级命令 `/mob-seed:insight`（非 spec 子命令）

---

## Functional Requirements

### FR-001: 洞见数据结构

系统应定义标准化的洞见数据结构。

**数据结构**:

```typescript
interface Insight {
  id: string;                    // ins-{YYYYMMDD}-{slug}
  source: InsightSource;         // 来源信息（结构化）
  date: string;                  // 收集日期 ISO 8601
  status: InsightStatus;         // 状态
  modelEra: string;              // 适用的模型时代
  reviewTrigger?: string;        // 复审触发条件
  tags: string[];                // 标签
  content: string;               // 原始洞见内容
  evaluation?: string;           // 评估笔记
  decision?: string;             // 采纳决策
}

interface InsightSource {
  title: string;                 // 来源标题/描述
  type: InsightSourceType;       // 来源类型
  author?: string;               // 作者/分享者
  affiliation?: string;          // 所属机构/公司
  date: string;                  // 原始发布/分享日期
  context?: string;              // 获取场景（会议、私聊、公开演讲等）
  url?: string;                  // 来源链接（可选）
  credibility: InsightCredibility; // 可信度评级
  secondary_sources?: SecondarySource[]; // 二次来源（转载、报道等）
}

interface SecondarySource {
  name: string;                  // 来源名称（如 InfoQ、公众号名）
  author?: string;               // 二次来源作者
  date: string;                  // 发布日期
  url?: string;                  // 链接
}

type InsightSourceType =
  | 'expert_opinion'   // 专家意见
  | 'paper'            // 论文
  | 'blog'             // 博客文章
  | 'community'        // 社区讨论
  | 'conference'       // 会议/演讲
  | 'book'             // 书籍
  | 'internal';        // 内部总结

type InsightCredibility =
  | 'high'             // 高：知名专家、权威论文
  | 'medium'           // 中：行业从业者、技术博客
  | 'low';             // 低：未验证来源、匿名分享

type InsightStatus =
  | 'evaluating'       // 评估中
  | 'piloting'         // 试点中
  | 'adopted'          // 已采纳
  | 'partial'          // 部分采纳
  | 'rejected'         // 已拒绝
  | 'obsolete';        // 已过时
```

**验收标准**:

- [ ] AC-001: 洞见 ID 格式符合 `ins-{YYYYMMDD}-{slug}` 规范
- [ ] AC-002: 所有必填字段都有验证
- [ ] AC-003: sourceType 限制为预定义枚举值
- [ ] AC-004: status 限制为预定义枚举值

### FR-002: 洞见文件格式

系统应支持 YAML frontmatter + Markdown 格式的洞见文件。

**文件格式**:

```markdown
---
id: ins-20260104-agent-scaffolding
source:
  title: "Agent 研发经验分享"
  type: expert_opinion
  author: "张三"
  affiliation: "某 AI Agent 创业公司"
  date: 2026-01-04
  context: "技术交流会议"
  url: ""
  credibility: high
date: 2026-01-04
status: evaluating
model_era: claude-opus-4.5
review_trigger: "claude-5.0 发布"
tags: [architecture, scaffolding, context-management]
---

## 原始洞见

[洞见的原始内容，保持原貌]

## 评估笔记

| 观点 | 适用性 | 理由 |
|------|--------|------|
| ... | ... | ... |

## 采纳决策

- ✅ 采纳：...
- ⏸️ 观望：...
- ❌ 不采纳：...

## 相关变更

- [链接到相关的变更提案或 commit]
```

**验收标准**:

- [ ] AC-005: 文件可被正确解析为 Insight 对象
- [ ] AC-006: frontmatter 验证失败时给出明确错误
- [ ] AC-007: 支持空的 evaluation 和 decision 字段（新建时）

### FR-003: 洞见索引管理

系统应维护洞见索引文件，支持快速查询。

**索引结构**:

```json
{
  "version": "1.0.0",
  "updated": "2026-01-04T12:00:00Z",
  "insights": [
    {
      "id": "ins-20260104-agent-scaffolding",
      "source": "Agent 研发专家分享",
      "sourceType": "expert_opinion",
      "status": "evaluating",
      "modelEra": "claude-opus-4.5",
      "tags": ["architecture", "scaffolding"],
      "file": "ins-20260104-agent-scaffolding.md"
    }
  ],
  "stats": {
    "total": 1,
    "byStatus": {
      "evaluating": 1,
      "adopted": 0,
      "partial": 0,
      "rejected": 0,
      "obsolete": 0
    }
  }
}
```

**验收标准**:

- [ ] AC-008: 新增洞见时索引自动更新
- [ ] AC-009: 删除洞见时索引自动更新
- [ ] AC-010: 状态变更时索引自动更新
- [ ] AC-011: 索引统计数据准确

### FR-004: 洞见生命周期管理

系统应支持洞见状态转换，遵循定义的生命周期。

**状态转换规则**:

```
evaluating → piloting    (开始试点)
evaluating → adopted     (直接采纳)
evaluating → partial     (部分采纳)
evaluating → rejected    (拒绝)

piloting → adopted       (试点成功)
piloting → partial       (部分成功)
piloting → rejected      (试点失败)

adopted → obsolete       (模型升级后过时)
partial → obsolete       (模型升级后过时)
partial → adopted        (后续全部采纳)

rejected → evaluating    (重新评估)
obsolete → evaluating    (重新评估)
```

**验收标准**:

- [ ] AC-012: 只允许有效的状态转换
- [ ] AC-013: 状态转换记录时间戳
- [ ] AC-014: 非法状态转换给出明确错误

### FR-005: 模型时代标注与复审

系统应支持标注洞见适用的模型时代，并在模型升级时触发复审。

**复审机制**:

1. 每个洞见标注 `modelEra`（如 `claude-opus-4.5`）
2. 可选设置 `reviewTrigger`（如 `claude-5.0 发布`）
3. 配置中记录当前模型时代
4. 当模型升级时，扫描需要复审的洞见

**验收标准**:

- [ ] AC-015: 可设置当前模型时代
- [ ] AC-016: 可查询需要复审的洞见列表
- [ ] AC-017: 复审提醒包含洞见 ID 和原因

### FR-006: 顶级命令 `/mob-seed:insight`

系统应提供独立的顶级命令用于洞见管理。

**命令设计**:

```bash
# 导入洞见（默认行为）
/mob-seed:insight "https://example.com/article"
/mob-seed:insight --text

# 管理操作（通过 flag）
/mob-seed:insight --list [--status evaluating] [--tag architecture]
/mob-seed:insight --update ins-20260104-xxx --status adopted
/mob-seed:insight --review [--model-upgrade claude-5.0]
/mob-seed:insight --stats
```

**为什么是顶级命令**:

| 原设计 | 新设计 | 理由 |
|--------|--------|------|
| `/mob-seed:spec insight` | `/mob-seed:insight` | 独立功能，非规格子命令 |
| 嵌套在 ACE 下 | 与 SEED 平行 | 知识积累独立于规格定义 |

**命令体系**:

```
mob-seed 命令：
├── /mob-seed:spec      ← S: 规格定义
├── /mob-seed:emit      ← E: 自动派生
├── /mob-seed:exec      ← E: 自动执行
├── /mob-seed:defend    ← D: 守护规范
└── /mob-seed:insight   ← 🆕 外部洞见（顶级）
```

**验收标准**:

- [ ] AC-018: `/mob-seed:insight` 可直接调用（顶级命令，通过 `commands/insight.md`）
- [ ] AC-018B: 自然语言触发可识别洞见导入意图（"记录这个洞见"、"导入这篇文章"）
- [ ] AC-018C: `SKILL.md` 关联命令表包含 `/mob-seed:insight` 条目
- [ ] AC-019: insight list 支持状态和标签过滤
- [ ] AC-020: insight update 验证状态转换合法性
- [ ] AC-021: insight review 输出需复审的洞见列表
- [ ] AC-022: insight stats 显示各状态统计

### FR-006B: 存储模式配置

系统应支持两种存储模式：默认模式和外部+软链接模式。配置覆盖所有 ACE 相关目录。

**涉及目录**:

| 目录 | 内容 |
|------|------|
| `observations/` | 内部观察记录 |
| `reflections/` | 模式分析 |
| `insights/` | 外部洞见（本提案新增） |
| `learning/` | 学习记录 |

**模式 1：默认模式**

无需配置，ACE 内容存储在 `.seed/` 下对应子目录，适用于非开源项目。

**模式 2：外部+软链接模式**

适用于开源项目，ACE 内容存储在外部目录，通过软链接在项目内访问：

```bash
# 1. 创建外部知识库
mkdir -p ~/knowledge/my-project/{observations,reflections,insights,learning}

# 2. 配置 ACE 输出目录（统一配置）
export ACE_OUTPUT_DIR="$HOME/knowledge/my-project"
# 或
echo '{"ace":{"output_dir":"~/knowledge/my-project"}}' > .seed/config.local.json

# 3. 创建软链接
ln -s ~/knowledge/my-project/observations .seed/observations
ln -s ~/knowledge/my-project/reflections .seed/reflections
ln -s ~/knowledge/my-project/insights .seed/insights
ln -s ~/knowledge/my-project/learning .seed/learning

# 4. 确保 .gitignore 包含
# .seed/config.local.json
# .seed/observations
# .seed/reflections
# .seed/insights
# .seed/learning
```

**配置加载优先级**:

```
1. 环境变量 ACE_OUTPUT_DIR（统一目录）
   - 或单独: OBSERVATIONS_OUTPUT_DIR, INSIGHTS_OUTPUT_DIR 等
2. .seed/config.local.json（gitignored）
3. .seed/config.json
4. 默认值 .seed/{dir}/
```

**配置结构**:

```json
// 统一配置
{ "ace": { "output_dir": "~/knowledge/my-project" } }

// 或分别配置
{
  "ace": {
    "observations_dir": "...",
    "reflections_dir": "...",
    "insights_dir": "...",
    "learning_dir": "..."
  }
}
```

**验收标准**:

- [ ] AC-023B: 未配置时使用默认目录 `.seed/{dir}/`
- [ ] AC-024B: 环境变量优先级最高
- [ ] AC-025B: config.local.json 优先于 config.json
- [ ] AC-026B: `~/` 路径正确展开为用户目录
- [ ] AC-027B: 目录不存在时自动创建
- [ ] AC-028B: 软链接目标不存在时给出明确错误提示
- [ ] AC-029B: `output_dir` 统一配置时自动添加子目录名

### FR-007: 洞见快速导入

系统应提供便捷的洞见导入机制，支持从 URL 或原始文本生成结构化洞见文件。

**输入方式**:

| 方式 | 输入 | 处理 |
|------|------|------|
| URL 导入 | 网页链接 | 抓取内容 → 提取元数据 → 生成洞见 |
| 文本导入 | 粘贴的文章/分享内容 | 解析文本 → 提取元数据 → 生成洞见 |

**命令格式**:

```bash
# 从 URL 导入（默认行为）
/mob-seed:insight "https://example.com/article"

# 从文本导入（交互式粘贴）
/mob-seed:insight --text

# 指定来源类型
/mob-seed:insight "https://..." --type expert_opinion

# 预览模式（不创建文件）
/mob-seed:insight "https://..." --dry-run
```

**AI 辅助提取**:

导入时 AI 自动尝试提取：

| 字段 | 提取策略 |
|------|----------|
| title | 文章标题 / 分享主题 |
| author | 作者署名 / 分享者 |
| affiliation | 作者所属机构（若有） |
| date | 发布日期 / 分享日期 |
| type | 根据来源域名或内容特征推断 |
| credibility | 根据作者背景和来源评估 |
| tags | 根据内容关键词生成 |
| content | 核心观点提取和结构化 |

**生成流程**:

```
输入 (URL/文本)
    ↓
抓取/解析内容
    ↓
AI 提取元数据
    ↓
生成洞见草稿 (status: evaluating)
    ↓
用户确认/编辑
    ↓
保存洞见文件
    ↓
更新索引
```

**验收标准**:

- [ ] AC-023: 支持从 URL 抓取并生成洞见文件
- [ ] AC-024: 支持从粘贴文本生成洞见文件
- [ ] AC-025: 自动提取的元数据准确率 ≥ 80%
- [ ] AC-026: 生成的洞见文件符合 FR-002 格式要求
- [ ] AC-027: 支持 --dry-run 预览模式
- [ ] AC-028: 导入失败时给出明确错误提示

---

## Non-Functional Requirements

### NFR-001: 性能

- 索引更新应在 100ms 内完成
- 列表查询应在 50ms 内返回

### NFR-002: 兼容性

- 与现有 ACE observations/reflections 机制并存
- 不影响现有 SEED 工作流

### NFR-003: 可扩展性

- 支持未来添加新的 sourceType
- 支持未来添加新的 status

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ace/insight-types.js | 类型定义和验证 |
| 代码 | skills/mob-seed/lib/ace/insight-parser.js | 洞见文件解析 |
| 代码 | skills/mob-seed/lib/ace/insight-generator.js | 洞见文件生成 |
| 代码 | skills/mob-seed/lib/ace/insight-index.js | 索引管理 |
| 代码 | skills/mob-seed/lib/ace/insight-lifecycle.js | 生命周期状态机 |
| 代码 | skills/mob-seed/lib/ace/insight-review.js | 模型时代复审 |
| 代码 | skills/mob-seed/lib/ace/insight-manager.js | 洞见管理核心逻辑 |
| 代码 | skills/mob-seed/lib/ace/insight-extractor.js | 内容提取器 |
| 代码 | skills/mob-seed/lib/ace/insight-importer.js | 快速导入 |
| 代码 | skills/mob-seed/lib/ace/insight-config.js | 🆕 配置解析（含 output_dir） |
| 测试 | skills/mob-seed/test/ace/insight-parser.test.js | 解析测试 |
| 测试 | skills/mob-seed/test/ace/insight-index.test.js | 索引测试 |
| 测试 | skills/mob-seed/test/ace/insight-lifecycle.test.js | 生命周期测试 |
| 测试 | skills/mob-seed/test/ace/insight-manager.test.js | 管理器测试 |
| 测试 | skills/mob-seed/test/ace/insight-extractor.test.js | 提取器测试 |
| 测试 | skills/mob-seed/test/ace/insight-importer.test.js | 导入测试 |
| 测试 | skills/mob-seed/test/ace/insight-config.test.js | 🆕 配置测试 |
| 命令 | commands/insight.md | 🆕 顶级命令定义（完整执行流程） |
| 技能更新 | skills/mob-seed/SKILL.md | 🔄 关联命令表 + ACE 存储结构 |
| 提示 | skills/mob-seed/prompts/insight-import.md | 🆕 导入时 AI 提示 |
| 提示 | skills/mob-seed/prompts/insight-evaluate.md | 🆕 评估引导提示 |
| 模板 | skills/mob-seed/templates/insight.md | 🆕 洞见文件模板 |

---

## 技术决策

### TD-001: 独立目录 vs 复用 observations

**决策**: 使用独立的 `.seed/insights/` 目录

**理由**:
- 外部洞见与内部观察性质不同
- 生命周期和处理流程不同
- 便于独立管理和归档

### TD-002: 复审触发机制

**决策**: 配置驱动 + 手动触发

**理由**:
- 模型升级时机难以自动检测
- 手动触发更可控
- 可结合 CI/CD 在版本升级时提醒

### TD-003: 快速导入体验设计

**决策**: AI 原生 + 最小交互

**设计原则**:

| 原则 | 说明 |
|------|------|
| 零配置 | 粘贴即用，无需预先设置 |
| 智能推断 | AI 自动填充所有可推断字段 |
| 渐进确认 | 先生成再编辑，而非先填表 |
| 容错友好 | 部分提取失败不阻塞流程 |

**极简用例**:

```
用户: /mob-seed:insight --text
     [粘贴一段内容]

AI:   ✅ 已生成洞见: ins-20260104-xxx
      📄 文件: knowledge/insights/ins-20260104-xxx.md  # 使用配置的 output_dir

      提取信息:
      ├── 标题: xxx
      ├── 作者: xxx (推断)
      ├── 类型: expert_opinion
      └── 标签: [a, b, c]

      💡 建议: 请检查并补充评估笔记
```

**理由**:
- 降低使用门槛，鼓励积累
- 符合 SEED 哲学：AI 做重复劳动，人做判断决策
- 评估笔记和采纳决策是人类核心价值，不自动生成
