/**
 * ACE 观察自动收集器
 * @module ace/observation-collector
 * @see openspec/changes/v3.0-ace-integration/specs/ace/observation-collector.fspec.md
 *
 * 从 Execute 和 Defend 阶段自动收集观察，避免重复。
 */

const {
  OBSERVATION_TYPES,
  OBSERVATION_SOURCES,
  createObservation,
  saveObservation,
  loadObservation,
  listObservations,
  updateIndex
} = require('./observation');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 测试失败信息
 * @typedef {Object} TestFailure
 * @property {string} file - 测试文件
 * @property {string} name - 测试名称
 * @property {string} message - 失败消息
 * @property {string} [error] - 错误堆栈
 */

/**
 * 覆盖率缺口信息
 * @typedef {Object} CoverageGap
 * @property {string} specFile - 规格文件
 * @property {string} acId - AC 标识
 * @property {string} [description] - 描述
 */

/**
 * Execute 测试结果
 * @typedef {Object} TestResult
 * @property {string} runId - 执行批次 ID
 * @property {TestFailure[]} failures - 失败列表
 * @property {CoverageGap[]} [coverageGaps] - 覆盖率缺口
 * @property {number} [passed] - 通过数
 * @property {number} [failed] - 失败数
 */

/**
 * 规格偏离信息
 * @typedef {Object} SpecDrift
 * @property {string} specFile - 规格文件
 * @property {string} [codeFile] - 代码文件
 * @property {'missing_code' | 'extra_code' | 'signature_mismatch' | 'ac_not_implemented'} type - 偏离类型
 * @property {string} message - 偏离消息
 * @property {Object} [details] - 详细信息
 */

/**
 * Defend 检查结果
 * @typedef {Object} DefendResult
 * @property {string} [runId] - 执行批次 ID
 * @property {SpecDrift[]} drifts - 偏离列表
 * @property {boolean} synced - 是否同步
 */

/**
 * 收集结果
 * @typedef {Object} CollectResult
 * @property {number} added - 新增数
 * @property {number} updated - 更新数
 * @property {number} skipped - 跳过数
 * @property {Object<string, number>} byType - 按类型统计
 * @property {string[]} ids - 新增的观察 ID 列表
 */

// ============================================================================
// REQ-001: Execute 阶段观察收集 (AC-001 ~ AC-004)
// ============================================================================

/**
 * 从测试结果收集观察 (AC-001)
 * @param {TestResult} result - 测试执行结果
 * @param {string} [projectRoot] - 项目根目录
 * @returns {Array<{type: string, source: string, description: string, context: Object, spec?: string}>} 收集到的观察参数列表
 */
function collectFromExecute(result) {
  const observations = [];

  // 收集测试失败 (AC-002)
  if (result.failures && result.failures.length > 0) {
    for (const failure of result.failures) {
      observations.push({
        type: OBSERVATION_TYPES.TEST_FAILURE,
        source: OBSERVATION_SOURCES.AUTO_EXECUTE,
        description: failure.message || `测试 ${failure.name} 失败`,
        context: {
          testFile: failure.file,
          testName: failure.name,
          error: failure.error,
          runId: result.runId  // AC-004
        }
      });
    }
  }

  // 收集覆盖率缺口 (AC-003)
  if (result.coverageGaps && result.coverageGaps.length > 0) {
    for (const gap of result.coverageGaps) {
      observations.push({
        type: OBSERVATION_TYPES.COVERAGE_GAP,
        source: OBSERVATION_SOURCES.AUTO_EXECUTE,
        description: gap.description || `AC ${gap.acId} 未被测试覆盖`,
        spec: gap.specFile,
        context: {
          specFile: gap.specFile,
          acId: gap.acId,
          runId: result.runId  // AC-004
        }
      });
    }
  }

  return observations;
}

// ============================================================================
// REQ-002: Defend 阶段观察收集 (AC-005 ~ AC-007)
// ============================================================================

/**
 * 从同步检查结果收集观察 (AC-005)
 * @param {DefendResult} result - Defend 检查结果
 * @returns {Array<{type: string, source: string, description: string, context: Object, spec?: string}>} 收集到的观察参数列表
 */
function collectFromDefend(result) {
  const observations = [];

  // 收集规格偏离 (AC-006)
  if (result.drifts && result.drifts.length > 0) {
    for (const drift of result.drifts) {
      observations.push({
        type: OBSERVATION_TYPES.SPEC_DRIFT,
        source: OBSERVATION_SOURCES.AUTO_DEFEND,
        spec: drift.specFile,
        description: drift.message,
        context: {
          specFile: drift.specFile,
          codeFile: drift.codeFile,
          driftType: drift.type,  // AC-007
          details: drift.details,  // AC-007
          runId: result.runId
        }
      });
    }
  }

  return observations;
}

// ============================================================================
// REQ-003: 观察去重机制 (AC-008 ~ AC-010)
// ============================================================================

/**
 * 生成观察的唯一键（用于去重）
 * @param {Object} obsParams - 观察参数
 * @returns {string} 唯一键
 */
function getObservationKey(obsParams) {
  const { type, context } = obsParams;

  switch (type) {
    case OBSERVATION_TYPES.TEST_FAILURE:
      return `test_failure:${context.testFile}:${context.testName}`;

    case OBSERVATION_TYPES.COVERAGE_GAP:
      return `coverage_gap:${context.specFile}:${context.acId}`;

    case OBSERVATION_TYPES.SPEC_DRIFT:
      return `spec_drift:${context.specFile}:${context.codeFile || ''}:${context.driftType}`;

    default:
      // 用户反馈等没有去重逻辑
      return null;
  }
}

/**
 * 检查是否已存在相同观察 (AC-008)
 * @param {Object} obsParams - 待检查的观察参数
 * @param {import('./observation').Observation[]} existing - 已存在的观察列表
 * @returns {import('./observation').Observation|null} 已存在的观察，或 null
 */
function findDuplicate(obsParams, existing) {
  const key = getObservationKey(obsParams);

  if (!key) {
    return null;
  }

  for (const obs of existing) {
    const existingKey = getObservationKey({
      type: obs.type,
      context: obs.context
    });

    if (key === existingKey) {
      return obs;
    }
  }

  return null;
}

// ============================================================================
// REQ-004: 收集器集成接口 (AC-011 ~ AC-014)
// ============================================================================

/**
 * 观察收集器 (AC-011)
 * @class ObservationCollector
 */
class ObservationCollector {
  /**
   * @param {Object} config - 配置
   * @param {string} config.projectRoot - 项目根目录
   */
  constructor(config) {
    this.projectRoot = config.projectRoot;
  }

  /**
   * 处理 Execute 结果 (AC-012)
   * @param {TestResult} result - 测试结果
   * @returns {Promise<CollectResult>} 收集结果
   */
  async processExecuteResult(result) {
    const obsParams = collectFromExecute(result);
    return this._processObservations(obsParams);
  }

  /**
   * 处理 Defend 结果 (AC-013)
   * @param {DefendResult} result - Defend 结果
   * @returns {Promise<CollectResult>} 收集结果
   */
  async processDefendResult(result) {
    const obsParams = collectFromDefend(result);
    return this._processObservations(obsParams);
  }

  /**
   * 处理观察列表（去重、保存）
   * @param {Array<{type: string, source: string, description: string, context: Object, spec?: string}>} obsParams - 观察参数列表
   * @returns {Promise<CollectResult>} 收集结果 (AC-014)
   * @private
   */
  async _processObservations(obsParams) {
    const result = {
      added: 0,
      updated: 0,
      skipped: 0,
      byType: {},
      ids: []
    };

    if (obsParams.length === 0) {
      return result;
    }

    // 加载已有的非终态观察
    const existing = listObservations(this.projectRoot, {})
      .filter(o => o.status === 'raw' || o.status === 'triaged')
      .map(o => loadObservation(this.projectRoot, o.id))
      .filter(o => o !== null);

    for (const params of obsParams) {
      // 去重检查 (AC-009)
      const duplicate = findDuplicate(params, existing);

      if (duplicate) {
        // 更新已有观察的时间戳 (AC-010)
        duplicate.updated = new Date().toISOString();
        duplicate.context.lastRunId = params.context.runId;
        saveObservation(this.projectRoot, duplicate);
        result.updated++;
      } else {
        // 创建新观察
        const obs = createObservation(params, this.projectRoot);
        saveObservation(this.projectRoot, obs);
        result.added++;
        result.ids.push(obs.id);

        // 统计类型
        result.byType[params.type] = (result.byType[params.type] || 0) + 1;

        // 添加到已存在列表（避免本批次重复）
        existing.push(obs);
      }
    }

    // 更新索引
    updateIndex(this.projectRoot);

    return result;
  }
}

// ============================================================================
// REQ-005: 收集结果报告 (AC-015 ~ AC-017)
// ============================================================================

/**
 * 格式化收集结果 (AC-015)
 * @param {CollectResult} result - 收集结果
 * @returns {string} 格式化的输出
 */
function formatCollectResult(result) {
  const lines = ['📊 观察收集完成'];

  // 新增统计 (AC-016)
  if (result.added > 0) {
    const typeBreakdown = Object.entries(result.byType)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');
    lines.push(`  新增: ${result.added} 条 (${typeBreakdown})`);
  } else {
    lines.push('  新增: 0 条');
  }

  // 更新统计
  lines.push(`  更新: ${result.updated} 条`);

  // 跳过统计
  if (result.skipped > 0) {
    lines.push(`  跳过: ${result.skipped} 条`);
  }

  // 空行
  lines.push('');

  // 提示命令 (AC-017)
  if (result.added > 0 || result.updated > 0) {
    lines.push('💡 运行 `/mob-seed:spec observe --list` 查看详情');
  }

  return lines.join('\n');
}

/**
 * 生成简洁的收集摘要
 * @param {CollectResult} result - 收集结果
 * @returns {string} 单行摘要
 */
function formatCollectSummary(result) {
  const total = result.added + result.updated;
  if (total === 0) {
    return '无新观察';
  }
  return `收集 ${result.added} 条新观察${result.updated > 0 ? `，更新 ${result.updated} 条` : ''}`;
}

module.exports = {
  // 收集函数
  collectFromExecute,
  collectFromDefend,

  // 去重
  findDuplicate,
  getObservationKey,

  // 收集器类
  ObservationCollector,

  // 结果格式化
  formatCollectResult,
  formatCollectSummary
};
