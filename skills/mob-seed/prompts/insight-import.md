# Insight Import Prompt

> 用于 AI 辅助从 URL 或文本导入洞见时的提示词模板

---

## URL 导入流程

当用户提供 URL 时，按以下步骤处理：

### 1. 内容抓取

```
🔍 正在抓取: {url}
```

### 2. 元数据提取

从网页内容中提取以下信息：

| 字段 | 提取策略 | 备注 |
|------|----------|------|
| 标题 | og:title > title > h1 | 优先级从高到低 |
| 作者 | meta author > article:author | 可能缺失 |
| 机构 | og:site_name > publisher | 可能缺失 |
| 日期 | article:published_time > time | 默认今天 |
| 类型 | 根据域名推断 | 见类型映射表 |
| 可信度 | 根据来源评估 | 见可信度评估 |
| 标签 | meta keywords + 内容分析 | 自动生成 |

### 3. 类型映射

| 域名模式 | 来源类型 |
|----------|----------|
| arxiv.org, nature.com, science.org | paper |
| docs.*.com, developer.mozilla.org | documentation |
| medium.com, dev.to, *.blog.* | blog |
| twitter.com, reddit.com, news.ycombinator.com | discussion |
| speakerdeck.com, youtube.com | expert_opinion |

### 4. 可信度评估

| 来源特征 | 可信度 | 说明 |
|----------|--------|------|
| 学术期刊、官方文档 | high | 经过同行评审或官方维护 |
| 知名技术博客、专业社区 | medium | 需要验证但通常可靠 |
| 社交媒体、匿名来源 | low | 需要严格验证 |

### 5. 输出格式

```
📄 提取结果:
   标题: {title}
   作者: {author} ({affiliation})
   日期: {date}
   类型: {type}
   可信度: {credibility}
   标签: [{tags}]

✅ 洞见已创建: {insight_id}
   位置: {file_path}
   状态: evaluating (待评估)

💡 下一步:
   - 编辑文件完成评估笔记
   - 使用 /mob-seed:insight --update <id> 更新状态
```

---

## 文本导入流程

当用户使用 `--text` 模式时：

### 1. 引导输入

```
📝 请粘贴洞见内容：

> 粘贴后按 Enter 两次结束输入
```

### 2. 来源信息收集

收集以下信息：

```
📋 请提供来源信息:

1. 来源类型:
   [ ] expert_opinion - 专家意见
   [ ] paper - 学术论文
   [ ] blog - 技术博客
   [ ] documentation - 官方文档
   [ ] discussion - 社区讨论
   [ ] experience - 实践经验
   [ ] ai_generated - AI 生成

2. 作者 (可选): _______________

3. 日期 (YYYY-MM-DD，可选): _______________

4. 可信度:
   [ ] high - 权威来源
   [ ] medium - 需要验证
   [ ] low - 未验证

5. 标签 (逗号分隔，可选): _______________
```

### 3. AI 辅助提取

如果用户未提供完整信息，AI 应尝试从内容中提取：

- **标题**: 第一行（去除 markdown 标记）
- **作者**: 查找 "By xxx" 或 "作者: xxx" 模式
- **日期**: 查找日期格式 YYYY-MM-DD
- **标签**: 根据高频关键词生成

### 4. 确认并创建

```
📋 确认导入信息:

   标题: {title}
   作者: {author}
   日期: {date}
   类型: {type}
   可信度: {credibility}
   标签: [{tags}]

确认创建? [Y/n]
```

---

## 预览模式 (--dry-run)

在实际创建文件前预览：

```
📋 预览模式 (Dry Run)

将创建以下洞见:
   ID: {insight_id}
   位置: {file_path}

📄 元数据:
   标题: {title}
   ...

⚠️ 这是预览，未创建实际文件
   移除 --dry-run 参数以创建文件
```

---

## 错误处理

### URL 无法访问

```
❌ 无法抓取 URL: {error}

💡 可能的原因:
   - 网络连接问题
   - URL 需要登录访问
   - 网站阻止了抓取

建议: 使用 --text 模式手动输入内容
```

### 元数据提取失败

```
⚠️ 无法自动提取部分元数据

缺失字段:
   - 作者
   - 日期

请手动补充以上信息，或编辑生成的洞见文件。
```

### 重复洞见

```
❌ 洞见已存在: {insight_id}

现有洞见位置: {existing_file_path}

💡 如需更新，请直接编辑现有文件
```

---

## 快捷用法

```bash
# 从 URL 快速导入
/mob-seed:insight "https://example.com/article"

# 预览模式
/mob-seed:insight "https://example.com/article" --dry-run

# 文本导入
/mob-seed:insight --text

# 带标签导入
/mob-seed:insight "https://..." --tags "ai,coding"
```
