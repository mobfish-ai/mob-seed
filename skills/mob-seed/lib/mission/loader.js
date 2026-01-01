/**
 * Mission Statement 加载器
 *
 * 负责加载、验证和评估 mission.md 文件（YAML frontmatter + Markdown）
 * 同时兼容旧版 mission.yaml 格式
 * 用于 ACE (Autonomous Code Evolution) 机制
 *
 * @module mission/loader
 * @see .seed/mission.md
 */

const fs = require('fs');
const path = require('path');

// 简单的 YAML 解析器（不依赖外部库）
// 支持基本的 YAML 格式：对象、数组、多行字符串
function parseYaml(content) {
  const lines = content.split('\n');
  const result = {};
  const stack = [{ obj: result, indent: -2 }];
  let currentKey = null;
  let multilineValue = null;
  let multilineIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 跳过空行和注释
    if (trimmed === '' || trimmed.startsWith('#')) {
      if (multilineValue !== null) {
        multilineValue += '\n';
      }
      continue;
    }

    // 计算缩进
    const indent = line.search(/\S/);

    // 处理多行字符串
    if (multilineValue !== null) {
      if (indent > multilineIndent) {
        multilineValue += line.slice(multilineIndent) + '\n';
        continue;
      } else {
        // 多行结束
        const current = stack[stack.length - 1];
        if (currentKey) {
          current.obj[currentKey] = multilineValue.trim();
        }
        multilineValue = null;
      }
    }

    // 处理数组项
    if (trimmed.startsWith('- ')) {
      const current = stack[stack.length - 1];
      const value = trimmed.slice(2);

      // 确保当前对象的当前键是数组
      if (currentKey && !Array.isArray(current.obj[currentKey])) {
        current.obj[currentKey] = [];
      }

      // 解析数组项
      if (value.includes(':')) {
        // 数组中的对象
        const obj = {};
        const [k, v] = value.split(':').map(s => s.trim());
        if (v) {
          obj[k] = parseValue(v);
        } else {
          obj[k] = null;
        }
        stack.push({ obj: obj, indent: indent, isArrayItem: true, parentKey: currentKey });
        current.obj[currentKey].push(obj);
      } else {
        // 简单数组项
        if (currentKey && Array.isArray(current.obj[currentKey])) {
          current.obj[currentKey].push(parseValue(value));
        }
      }
      continue;
    }

    // 处理键值对
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      // 调整栈
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const current = stack[stack.length - 1];

      if (value === '' || value === '|') {
        // 嵌套对象或多行字符串
        if (value === '|') {
          multilineValue = '';
          multilineIndent = indent + 2;
          currentKey = key;
        } else {
          current.obj[key] = {};
          stack.push({ obj: current.obj[key], indent: indent });
        }
      } else {
        // 简单值
        current.obj[key] = parseValue(value);
      }
      currentKey = key;
    }
  }

  // 处理末尾的多行字符串
  if (multilineValue !== null && currentKey) {
    const current = stack[stack.length - 1];
    current.obj[currentKey] = multilineValue.trim();
  }

  return result;
}

/**
 * 解析值
 * @param {string} value - 原始值
 * @returns {*} 解析后的值
 */
function parseValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  // 移除引号
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * 从 Markdown 文件中提取 YAML frontmatter
 * @param {string} content - 文件内容
 * @returns {{ frontmatter: string, body: string }} 分离的 frontmatter 和 body
 */
function extractFrontmatter(content) {
  const lines = content.split('\n');

  // 检查是否以 --- 开头
  if (lines[0].trim() !== '---') {
    return { frontmatter: '', body: content };
  }

  // 找到结束的 ---
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { frontmatter: '', body: content };
  }

  return {
    frontmatter: lines.slice(1, endIndex).join('\n'),
    body: lines.slice(endIndex + 1).join('\n')
  };
}

/**
 * 查找 mission 文件（支持 .md 和 .yaml）
 * @param {string} [startDir] - 起始目录
 * @returns {string|null} 文件路径或 null
 */
function findMissionPath(startDir = process.cwd()) {
  // 优先级1: .seed/mission.md (推荐)
  const seedMissionMd = path.join(startDir, '.seed/mission.md');
  if (fs.existsSync(seedMissionMd)) {
    return seedMissionMd;
  }

  // 优先级2: .seed/mission.yaml (兼容)
  const seedMission = path.join(startDir, '.seed/mission.yaml');
  if (fs.existsSync(seedMission)) {
    return seedMission;
  }

  // 优先级3: openspec/mission.md
  const openspecMissionMd = path.join(startDir, 'openspec/mission.md');
  if (fs.existsSync(openspecMissionMd)) {
    return openspecMissionMd;
  }

  // 优先级4: openspec/mission.yaml
  const openspecMission = path.join(startDir, 'openspec/mission.yaml');
  if (fs.existsSync(openspecMission)) {
    return openspecMission;
  }

  // 优先级5: mission.md（项目根）
  const rootMissionMd = path.join(startDir, 'mission.md');
  if (fs.existsSync(rootMissionMd)) {
    return rootMissionMd;
  }

  // 优先级6: mission.yaml（项目根）
  const rootMission = path.join(startDir, 'mission.yaml');
  if (fs.existsSync(rootMission)) {
    return rootMission;
  }

  return null;
}

/**
 * 加载 Mission Statement
 * @param {Object} [options] - 选项
 * @param {string} [options.missionPath] - 指定路径
 * @param {string} [options.startDir] - 起始目录
 * @returns {import('./types').Mission|null} Mission 对象或 null
 */
function loadMission(options = {}) {
  const { missionPath, startDir } = options;

  const resolvedPath = missionPath || findMissionPath(startDir);

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(resolvedPath, 'utf-8');

    let mission;

    // 根据文件类型解析
    if (resolvedPath.endsWith('.md')) {
      // Markdown 格式: 解析 YAML frontmatter
      const { frontmatter, body } = extractFrontmatter(content);
      if (!frontmatter) {
        console.warn(`警告: ${resolvedPath} 缺少 YAML frontmatter`);
        return null;
      }
      mission = parseYaml(frontmatter);
      // 保存 markdown body 供后续使用
      mission._body = body;
    } else {
      // YAML 格式: 直接解析
      mission = parseYaml(content);
    }

    // 添加元数据
    mission._meta = {
      path: resolvedPath,
      format: resolvedPath.endsWith('.md') ? 'markdown' : 'yaml',
      loadedAt: new Date().toISOString()
    };

    return mission;
  } catch (error) {
    console.warn(`警告: 无法解析 mission 文件: ${error.message}`);
    return null;
  }
}

/**
 * 验证 Mission Statement
 * @param {import('./types').Mission} mission - Mission 对象
 * @returns {import('./types').MissionValidationResult} 验证结果
 */
function validateMission(mission) {
  const errors = [];
  const warnings = [];

  if (!mission) {
    return { valid: false, errors: ['Mission 对象为空'], warnings: [] };
  }

  // 必需字段验证
  if (!mission.purpose) {
    errors.push('缺少 purpose 字段');
  } else if (!mission.purpose.statement) {
    errors.push('缺少 purpose.statement 字段');
  }

  if (!mission.principles || !Array.isArray(mission.principles)) {
    errors.push('缺少 principles 数组');
  } else if (mission.principles.length === 0) {
    errors.push('principles 数组不能为空');
  } else {
    mission.principles.forEach((p, i) => {
      if (!p.id) errors.push(`principles[${i}] 缺少 id`);
      if (!p.name) errors.push(`principles[${i}] 缺少 name`);
      if (!p.description) errors.push(`principles[${i}] 缺少 description`);
      if (p.id && !/^[a-z_]+$/.test(p.id)) {
        errors.push(`principles[${i}].id 必须是 snake_case 格式`);
      }
    });
  }

  if (!mission.anti_goals || !Array.isArray(mission.anti_goals)) {
    errors.push('缺少 anti_goals 数组');
  } else if (mission.anti_goals.length === 0) {
    errors.push('anti_goals 数组不能为空');
  } else {
    mission.anti_goals.forEach((ag, i) => {
      if (!ag.id) errors.push(`anti_goals[${i}] 缺少 id`);
      if (!ag.name) errors.push(`anti_goals[${i}] 缺少 name`);
      if (!ag.description) errors.push(`anti_goals[${i}] 缺少 description`);
    });
  }

  // 可选字段警告
  if (!mission.vision) {
    warnings.push('建议添加 vision 字段定义愿景');
  }

  if (!mission.evolution) {
    warnings.push('建议添加 evolution 字段定义 ACE 演化规则');
  }

  if (!mission.alignment) {
    warnings.push('建议添加 alignment 字段定义对齐评分模型');
  }

  if (!mission.covenant) {
    warnings.push('建议添加 covenant 字段定义人机契约');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 评估变更与 Mission 的对齐度
 * @param {import('./types').Mission} mission - Mission 对象
 * @param {Object} change - 变更描述
 * @param {string} change.description - 变更描述
 * @param {string} [change.type] - 变更类型 (refactor|optimize|document|test|fix)
 * @param {string[]} [change.affectedPrinciples] - 影响的原则ID列表
 * @returns {import('./types').AlignmentScore} 对齐分数
 */
function evaluateAlignment(mission, change) {
  const result = {
    total: 0,
    breakdown: {},
    meetsThreshold: false,
    violations: []
  };

  if (!mission || !change) {
    return result;
  }

  const scoring = mission.alignment?.scoring_model || {
    purpose_alignment: { weight: 0.3, question: '是否服务于使命？' },
    principle_compliance: { weight: 0.3, question: '是否遵守原则？' },
    anti_goal_avoidance: { weight: 0.25, question: '是否避开反目标？' },
    vision_contribution: { weight: 0.15, question: '是否推动愿景？' }
  };

  // 简化评估：基于关键词匹配和变更类型
  const desc = (change.description || '').toLowerCase();

  // 1. 目的对齐
  const purposeKeywords = ['规格', 'spec', '同步', 'sync', '人机', 'ai', '协作'];
  const purposeScore = purposeKeywords.some(k => desc.includes(k)) ? 0.8 : 0.5;
  result.breakdown.purpose_alignment = purposeScore;

  // 2. 原则合规
  let principleScore = 0.7; // 默认基准分
  if (mission.principles) {
    // 检查是否有明确违反
    const simpleViolations = ['复杂', '聪明', 'clever', 'magic'];
    if (simpleViolations.some(k => desc.includes(k))) {
      principleScore -= 0.2;
    }
    // 检查是否符合简单原则
    if (desc.includes('简单') || desc.includes('simple')) {
      principleScore += 0.1;
    }
  }
  result.breakdown.principle_compliance = Math.max(0, Math.min(1, principleScore));

  // 3. 反目标规避
  let antiGoalScore = 1.0;
  if (mission.anti_goals) {
    const antiGoalKeywords = {
      feature_creep: ['新增功能', '添加功能', 'add feature'],
      over_engineering: ['抽象', 'abstract', '复杂', 'complex'],
      sync_breaking: ['跳过同步', 'skip sync', '不更新规格']
    };

    for (const ag of mission.anti_goals) {
      const keywords = antiGoalKeywords[ag.id] || [];
      if (keywords.some(k => desc.includes(k.toLowerCase()))) {
        antiGoalScore -= 0.3;
        result.violations.push(ag.id);
      }
    }
  }
  result.breakdown.anti_goal_avoidance = Math.max(0, antiGoalScore);

  // 4. 愿景贡献
  let visionScore = 0.5; // 基准分
  if (mission.vision) {
    const visionKeywords = ['生态', 'ecosystem', '标准', 'standard', '自动化', 'automation'];
    if (visionKeywords.some(k => desc.includes(k))) {
      visionScore = 0.8;
    }
  }
  result.breakdown.vision_contribution = visionScore;

  // 计算加权总分
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, config] of Object.entries(scoring)) {
    const weight = config.weight || 0.25;
    const score = result.breakdown[key] || 0.5;
    weightedSum += weight * score;
    totalWeight += weight;
  }

  result.total = totalWeight > 0 ? weightedSum / totalWeight : 0;
  result.total = Math.round(result.total * 100) / 100; // 保留两位小数

  // 检查是否达到阈值
  const threshold = mission.evolution?.decision_criteria?.min_alignment_score || 0.7;
  result.meetsThreshold = result.total >= threshold;

  return result;
}

/**
 * 检查变更是否需要人工审核
 * @param {import('./types').Mission} mission - Mission 对象
 * @param {string} changeType - 变更类型
 * @returns {boolean} 是否需要人工审核
 */
function requiresHumanReview(mission, changeType) {
  if (!mission?.evolution?.decision_criteria?.human_review_required) {
    // 默认：refactor, optimize, fix 需要审核
    return ['refactor', 'optimize', 'fix'].includes(changeType);
  }

  return mission.evolution.decision_criteria.human_review_required.includes(changeType);
}

/**
 * 检查变更是否可以自动应用
 * @param {import('./types').Mission} mission - Mission 对象
 * @param {string} changeType - 变更类型
 * @param {import('./types').AlignmentScore} alignmentScore - 对齐分数
 * @returns {boolean} 是否可以自动应用
 */
function canAutoApply(mission, changeType, alignmentScore) {
  // 检查类型是否在允许范围内
  const allowedScopes = mission?.evolution?.allowed_scopes || [];
  const scope = allowedScopes.find(s => s.id === changeType);

  if (!scope || !scope.auto_apply) {
    return false;
  }

  // 检查是否满足自动应用条件
  const conditions = mission?.evolution?.decision_criteria?.auto_apply_conditions || [];

  for (const cond of conditions) {
    if (cond.alignment_score_above && alignmentScore.total < cond.alignment_score_above) {
      return false;
    }
    if (cond.no_anti_goal_violation && alignmentScore.violations.length > 0) {
      return false;
    }
  }

  return true;
}

/**
 * 获取本地化值
 * 支持 { en: "...", zh: "..." } 格式或直接字符串
 * @param {string|Object} field - 字段值
 * @param {string} [lang='en'] - 语言代码 ('en' | 'zh')
 * @returns {string} 本地化后的值
 */
function getLocalizedValue(field, lang = 'en') {
  if (!field) return '';

  // 直接字符串
  if (typeof field === 'string') {
    return field;
  }

  // 双语对象
  if (typeof field === 'object') {
    // 优先使用指定语言，回退到英文，再回退到中文
    return field[lang] || field.en || field.zh || '';
  }

  return String(field);
}

/**
 * 获取本地化数组
 * @param {string[]|Object} field - 字段值
 * @param {string} [lang='en'] - 语言代码
 * @returns {string[]} 本地化后的数组
 */
function getLocalizedArray(field, lang = 'en') {
  if (!field) return [];

  // 直接数组
  if (Array.isArray(field)) {
    return field;
  }

  // 双语对象
  if (typeof field === 'object') {
    const arr = field[lang] || field.en || field.zh;
    return Array.isArray(arr) ? arr : [];
  }

  return [];
}

/**
 * 获取 Mission 摘要（用于 AI 上下文）
 * @param {import('./types').Mission} mission - Mission 对象
 * @param {string} [lang='en'] - 语言代码 ('en' | 'zh')
 * @returns {string} 摘要文本
 */
function getMissionSummary(mission, lang = 'en') {
  if (!mission) {
    return lang === 'zh' ? '未找到 Mission Statement' : 'Mission Statement not found';
  }

  const lines = [];
  const isZh = lang === 'zh';

  // 使命
  lines.push(isZh ? '## 使命 (Mission)' : '## Mission');
  lines.push(getLocalizedValue(mission.purpose?.statement, lang) || (isZh ? '未定义' : 'Not defined'));
  lines.push('');

  // 核心原则
  lines.push(isZh ? '## 核心原则 (Principles)' : '## Core Principles');
  if (mission.principles) {
    mission.principles.forEach(p => {
      const name = getLocalizedValue(p.name, lang);
      const desc = getLocalizedValue(p.description, lang).split('\n')[0];
      lines.push(`- **${name}**: ${desc}`);
    });
  }
  lines.push('');

  // 反目标
  lines.push(isZh ? '## 反目标 (Anti-Goals)' : '## Anti-Goals');
  if (mission.anti_goals) {
    mission.anti_goals.forEach(ag => {
      const name = getLocalizedValue(ag.name, lang);
      const desc = getLocalizedValue(ag.description, lang).split('\n')[0];
      lines.push(`- **${name}**: ${desc}`);
    });
  }
  lines.push('');

  // 演化规则
  if (mission.evolution) {
    lines.push(isZh ? '## 演化规则 (ACE)' : '## Evolution Rules (ACE)');
    const minScore = mission.evolution.decision_criteria?.min_alignment_score || 0.7;
    lines.push(isZh
      ? `- 最低对齐分数: ${minScore}`
      : `- Minimum alignment score: ${minScore}`);

    if (mission.evolution.allowed_scopes) {
      const autoApply = mission.evolution.allowed_scopes
        .filter(s => s.auto_apply)
        .map(s => s.id);
      lines.push(isZh
        ? `- 自动应用范围: ${autoApply.join(', ') || '无'}`
        : `- Auto-apply scopes: ${autoApply.join(', ') || 'none'}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  findMissionPath,
  loadMission,
  validateMission,
  evaluateAlignment,
  requiresHumanReview,
  canAutoApply,
  getMissionSummary,
  // 双语支持
  getLocalizedValue,
  getLocalizedArray,
  // 内部函数导出供测试
  parseYaml,
  parseValue,
  extractFrontmatter
};
