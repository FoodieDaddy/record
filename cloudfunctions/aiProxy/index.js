/**
 * aiProxy — CloudBase AI 统一代理云函数
 *
 * 使用 @cloudbase/node-sdk（≥3.16.0）调用 CloudBase AI
 * 入口：action='fortune' → 调用 CloudBase AI streamText 生成每日策略
 * 超时/异常时返回 { code: 500, fallback: true }，由前端降级后端
 */
const tcb = require('@cloudbase/node-sdk');
const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
const ai = app.ai();

exports.main = async (event) => {
  const { action, payload } = event;
  if (action === 'fortune') {
    return await handleFortune(payload);
  }
  return { code: 400, message: 'unknown action' };
};

// ==================== Fortune 指令生成 ====================

const SYSTEM_PROMPT = `你是「脉冲终端」中的策略解释引擎，代号 ORACLE CORE。

你是状态复盘与节奏校准系统，不判断结果，不承诺任何反馈。

规则：
- 用赛博科幻词汇和时间窗口/节奏窗口/环境变量等意象，映射到任务痛点（情绪波动、节奏管理、风险控制）
- 避免非策略化词汇、结果断言和利益承诺
- 输出复盘建议和状态管理，语气冷静克制、赛博飞船终端感
- 不使用emoji，不使用空泛套话，不制造焦虑
- 使用时间窗口、节奏窗口、环境变量等表达方式

字段：tag(4字)、verdict(10-18字冷酷忠告，融合节奏/环境意象)、buffs(3个5-7字策略优势)、debuffs(2个5-7字隐患)

只输出JSON，不要其他文字：
{"themeColor":"#HEX","tag":"4字","verdict":"10-18字","buffs":["优势1","优势2","优势3"],"debuffs":["预警1","预警2"]}
颜色：稳健=#0A84FF 顺行=#32D74B 回稳=#FF9F0A 高波动=#FF453A`;

async function handleFortune(payload) {
  const { userTag = 'STABLE', netScore = 0, recentScores = [], sampleCount = 0 } = payload || {};

  const userPrompt = buildUserPrompt(userTag, netScore, recentScores, sampleCount);

  try {
    const model = ai.createModel('cloudbase');
    const res = await model.streamText({
      model: 'hy3-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.6,
    });

    let fullText = '';
    for await (const chunk of res.textStream) {
      fullText += chunk;
    }

    const parsed = extractJson(fullText);
    if (!parsed || !parsed.tag || !parsed.verdict) {
      return { code: 500, message: 'AI 输出解析失败', fallback: true };
    }

    return {
      code: 200,
      data: {
        tag: parsed.tag,
        verdict: parsed.verdict,
        buffs: parsed.buffs || [],
        debuffs: parsed.debuffs || [],
        themeColor: parsed.themeColor || '#0A84FF',
        glowColor: parsed.themeColor || '#0A84FF',
        userTag: userTag,
        source: 'cloudbase-ai',
      }
    };
  } catch (err) {
    return { code: 500, message: err.message || 'CloudBase AI 调用异常', fallback: true };
  }
}

// ==================== Prompt 构建 ====================

function buildUserPrompt(userTag, netScore, recentScores, sampleCount) {
  const tagDesc = {
    WINNING_STREAK: '当前处于连胜态，近期节奏较顺',
    LOSING_STREAK: '当前处于连败态，近期节奏偏低',
    HIGH_RISK: '当前处于高波动态，节奏起伏大',
    STABLE: '当前处于稳态，节奏平缓',
  };

  const desc = tagDesc[userTag] || tagDesc.STABLE;
  const scoreStr = recentScores.length > 0
    ? `近期积分走势：[${recentScores.join(', ')}]，净积分：${netScore}，样本数：${sampleCount}`
    : `净积分：${netScore}`;

  return `用户画像：${desc}。${scoreStr}。请生成今日策略。`;
}

// ==================== JSON 提取 ====================

function extractJson(text) {
  if (!text) return null;

  // 尝试直接解析
  try {
    return JSON.parse(text);
  } catch (_) {}

  // 尝试提取 markdown code block 中的 JSON
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch (_) {}
  }

  // 尝试提取第一个 { ... } 块
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch (_) {}
  }

  return null;
}
