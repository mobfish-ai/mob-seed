# ACE 知识库设置指南

> 如何配置 mob-seed 的私有 ACE（Agentic Context Engineering）知识库

---

## 为什么需要设置 ACE 知识库？

mob-seed 使用 **符号链接** 将开源项目与私有知识资产分离：

| 组件 | 性质 | 存储位置 |
|------|------|----------|
| mob-seed 项目 | 🔓 开源 | GitHub (MIT 许可证) |
| ACE 知识库 | 🔒 私有 | 您的本地/私有仓库 |

**好处**:
- 🔐 个人洞见、观察记录不泄露到公开仓库
- 🔄 同一知识库可被多个项目复用
- ☁️ 支持云同步、团队协作

---

## 快速设置（推荐）

### 方法一：自动设置向导（推荐）

```bash
# 在 mob-seed 项目根目录运行
node scripts/setup-ace.js
```

向导会自动：
1. 询问知识库存放路径
2. 创建目录结构（insights/observations/reflections/learning）
3. 创建符号链接
4. 更新 .gitignore

### 方法二：手动设置

```bash
# 1. 创建私有知识库目录
mkdir -p ~/ace-knowledge/{insights,observations,reflections,learning}

# 2. 创建符号链接
cd /path/to/mob-seed
ln -s ~/ace-knowledge/insights .seed/insights
ln -s ~/ace-knowledge/observations .seed/observations
ln -s ~/ace-knowledge/reflections .seed/reflections
ln -s ~/ace-knowledge/learning .seed/learning

# 3. 添加到 .gitignore
echo -e ".seed/insights\n.seed/observations\n.seed/reflections\n.seed/learning" >> .gitignore
```

---

## 验证设置

```bash
# 检查符号链接
ls -la .seed/

# 预期输出:
# insights -> /Users/yourname/ace-knowledge/insights
# observations -> /Users/yourname/ace-knowledge/observations
# reflections -> /Users/yourname/ace-knowledge/reflections
# learning -> /Users/yourname/ace-knowledge/learning

# 测试 ACE 功能
/mob-seed
# 应显示: 🌱 mob-seed v3.10.0 [开发模式]

/mob-seed:insight list
# 应显示: 📚 ACE 洞见列表（空或已有内容）
```

---

## 高级配置

### 场景 1：团队共享知识库

```bash
# 创建私有 Git 仓库
git init --bare /shared/team-ace-knowledge.git

# 每台团队成员电脑
 git clone /shared/team-ace-knowledge.git ~/team-ace
ln -s ~/team-ace/insights /path/to/mob-seed/.seed/insights
# ... 其他链接
```

### 场景 2：多设备同步（使用云盘）

```bash
# Dropbox
ln -s ~/Dropbox/ace-knowledge/insights .seed/insights

# iCloud
ln -s ~/Library/Mobile\ Documents/com~apple~CloudDocs/ace-knowledge/insights .seed/insights

# Google Drive
ln -s ~/Google\ Drive/ace-knowledge/insights .seed/insights
```

### 场景 3：CI/CD 环境

```bash
# 在 CI 中创建空目录（跳过 ACE 功能）
mkdir -p .seed/{insights,observations,reflections,learning}

# 或在 CI 中链接到缓存目录
ln -s $CI_CACHE_DIR/ace-knowledge/insights .seed/insights
```

### 场景 4：多个项目使用同一知识库

```
~/ace-knowledge/          # 中央知识库
├── insights/
├── observations/
├── reflections/
└── learning/

project-a/
└── .seed/
    ├── insights -> ~/ace-knowledge/insights  # 共享
    └── ...

project-b/
└── .seed/
    ├── insights -> ~/ace-knowledge/insights  # 共享
    └── ...
```

---

## 目录结构说明

| 目录 | 用途 | 示例内容 |
|------|------|----------|
| `insights/` | 外部洞见 | 从文章、视频提取的技术洞见 |
| `observations/` | 执行观察 | 测试失败、规格漂移记录 |
| `reflections/` | 反思分析 | 模式识别、根因分析 |
| `learning/` | 模式学习 | 历史样本、效果反馈 |

---

## 故障排除

### 问题：符号链接失效

```bash
# 症状：链接显示红色或指向不存在路径
ls -la .seed/insights
# -> insights -> /Users/oldname/ace-knowledge/insights (不存在)

# 解决：重新创建链接
rm .seed/insights
ln -s ~/ace-knowledge/insights .seed/insights
```

### 问题：ACE 命令报错 "目录不存在"

```bash
# 症状：/mob-seed:insight 报错
# 原因：符号链接未创建或指向错误位置

# 解决：运行设置向导
node scripts/setup-ace.js

# 或手动创建空目录
mkdir -p .seed/{insights,observations,reflections,learning}
```

### 问题：误将 ACE 数据提交到 Git

```bash
# 症状：git status 显示 .seed/insights 有变更

# 解决：
# 1. 从 Git 中移除（但保留本地文件）
git rm -r --cached .seed/insights

# 2. 确保 .gitignore 已更新
echo ".seed/insights" >> .gitignore

# 3. 提交更改
git commit -m "chore: remove ACE data from git"
```

---

## 最佳实践

### ✅ 应该做的

- [ ] 定期备份 ACE 知识库（特别是 insights/）
- [ ] 使用 Git 管理知识库历史（私有仓库）
- [ ] 在云盘中同步知识库（多设备访问）
- [ ] 与团队成员共享知识库（协作）

### ❌ 不应该做的

- [ ] 不要将 ACE 数据提交到公开仓库
- [ ] 不要删除符号链接指向的原始目录
- [ ] 不要在不同项目中使用不同版本的知识库

---

## 相关文档

- [SEED 方法论](../concepts/seed-methodology.md)
- [ACE 框架概述](../concepts/ace-overview.md)
- [外部洞见管理](../../commands/mob-seed/insight.md) - `/mob-seed:insight` 命令
- [项目设置](./getting-started.md)

---

*最后更新: 2026-01-29*
