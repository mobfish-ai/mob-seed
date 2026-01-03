/**
 * LLM 限流控制器
 * @module ace/llm-rate-limiter
 * @see openspec/changes/v3.0-ace-integration/specs/ace/llm-reflect.fspec.md
 *
 * 实现 REQ-007: 成本和限流控制 (AC-027 ~ AC-030)
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 限流配置
 * @typedef {Object} RateLimitConfig
 * @property {number} max_observations_per_call - 每次调用最大观察数
 * @property {number} max_calls_per_day - 每日最大调用次数
 * @property {number} min_interval_seconds - 最小调用间隔（秒）
 */

/**
 * 使用统计
 * @typedef {Object} UsageStats
 * @property {string} date - 日期 (YYYY-MM-DD)
 * @property {number} calls - 调用次数
 * @property {number} lastCallTime - 最后调用时间戳
 */

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_LIMITS = {
  max_observations_per_call: 10,
  max_calls_per_day: 50,
  min_interval_seconds: 60
};

// ============================================================================
// 限流器类
// ============================================================================

/**
 * LLM 限流控制器
 */
class LLMRateLimiter {
  /**
   * @param {string} projectRoot - 项目根目录
   * @param {RateLimitConfig} [limits] - 限流配置
   */
  constructor(projectRoot, limits = {}) {
    this.projectRoot = projectRoot;
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.usagePath = path.join(projectRoot, '.seed', 'llm-usage.json');
  }

  /**
   * 获取今日日期字符串
   * @returns {string}
   */
  getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * 加载使用统计
   * @returns {UsageStats}
   */
  loadUsage() {
    try {
      if (fs.existsSync(this.usagePath)) {
        const data = JSON.parse(fs.readFileSync(this.usagePath, 'utf-8'));
        // 检查是否是今天的数据
        if (data.date === this.getToday()) {
          return data;
        }
      }
    } catch {
      // 忽略错误，返回空统计
    }

    return {
      date: this.getToday(),
      calls: 0,
      lastCallTime: 0
    };
  }

  /**
   * 保存使用统计
   * @param {UsageStats} usage - 使用统计
   */
  saveUsage(usage) {
    const dir = path.dirname(this.usagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.usagePath, JSON.stringify(usage, null, 2), 'utf-8');
  }

  /**
   * 检查是否可以调用
   * @returns {{allowed: boolean, reason?: string, waitSeconds?: number}}
   */
  checkLimit() {
    const usage = this.loadUsage();

    // 检查每日调用限制 (AC-028)
    if (usage.calls >= this.limits.max_calls_per_day) {
      return {
        allowed: false,
        reason: `已达到每日调用限制 (${this.limits.max_calls_per_day} 次)`,
        waitSeconds: this.getSecondsUntilMidnight()
      };
    }

    // 检查调用间隔 (AC-029)
    if (usage.lastCallTime > 0) {
      const elapsed = (Date.now() - usage.lastCallTime) / 1000;
      if (elapsed < this.limits.min_interval_seconds) {
        const waitSeconds = Math.ceil(this.limits.min_interval_seconds - elapsed);
        return {
          allowed: false,
          reason: `请等待 ${waitSeconds} 秒后重试`,
          waitSeconds
        };
      }
    }

    return { allowed: true };
  }

  /**
   * 检查观察数量限制 (AC-027)
   * @param {number} count - 观察数量
   * @returns {{allowed: boolean, reason?: string, maxAllowed?: number}}
   */
  checkObservationLimit(count) {
    if (count > this.limits.max_observations_per_call) {
      return {
        allowed: false,
        reason: `观察数量超过限制 (${count} > ${this.limits.max_observations_per_call})`,
        maxAllowed: this.limits.max_observations_per_call
      };
    }
    return { allowed: true };
  }

  /**
   * 记录一次调用
   */
  recordCall() {
    const usage = this.loadUsage();
    usage.calls += 1;
    usage.lastCallTime = Date.now();
    this.saveUsage(usage);
  }

  /**
   * 获取剩余调用次数
   * @returns {number}
   */
  getRemainingCalls() {
    const usage = this.loadUsage();
    return Math.max(0, this.limits.max_calls_per_day - usage.calls);
  }

  /**
   * 获取距离午夜的秒数
   * @returns {number}
   */
  getSecondsUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
  }

  /**
   * 获取使用统计摘要
   * @returns {Object}
   */
  getUsageSummary() {
    const usage = this.loadUsage();
    return {
      date: usage.date,
      callsToday: usage.calls,
      callsRemaining: this.getRemainingCalls(),
      maxCallsPerDay: this.limits.max_calls_per_day,
      maxObservationsPerCall: this.limits.max_observations_per_call,
      minIntervalSeconds: this.limits.min_interval_seconds
    };
  }

  /**
   * 重置使用统计（测试用）
   */
  reset() {
    if (fs.existsSync(this.usagePath)) {
      fs.unlinkSync(this.usagePath);
    }
  }
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  LLMRateLimiter,
  DEFAULT_LIMITS
};
