# 内部开发工具

此目录包含 mob-seed 项目自身开发使用的工具脚本，**不发布给用户**。

## 脚本清单

| 脚本 | 用途 |
|------|------|
| `bump-version.js` | 版本号同步（更新所有 package.json 和配置文件） |
| `check-proposal-tasks-sync.js` | 检查提案和任务清单同步状态 |
| `release.sh` | 发布流程自动化 |

## 用户工具位置

用户可使用的工具位于 `skills/mob-seed/scripts/`：

- `verify-*.js` - 各类验证工具
- `verify-insights.js` - 验证 insights 索引与实际文件同步
- `reverse-engineer.js` - Brownfield 逆向工程
- `detect-project.js` - 项目类型检测
- 等等

## 使用方式

```bash
# 版本号同步
node scripts/bump-version.js 3.4.0 --release

# 检查提案任务同步
node scripts/check-proposal-tasks-sync.js

# 验证 insights 索引
npm run insights:verify

# 同步 insights 索引（自动修复）
npm run insights:sync

# 发布
./scripts/release.sh
```
