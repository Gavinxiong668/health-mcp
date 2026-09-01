#!/usr/bin/env node
/**
 * 钉钉推送测试脚本
 * 用法: HEALTH_MCP_TOKEN=xxx DINGTALK_WEBHOOK_URL=xxx node test-dingtalk.js
 *
 * 测试 health-mcp → Ollama → 钉钉 完整链路
 */

const HEALTH_MCP_URL = process.env.HEALTH_MCP_URL || 'http://localhost:7777';
const HEALTH_MCP_TOKEN = process.env.HEALTH_MCP_TOKEN || '';
const DINGTALK_WEBHOOK_URL = process.env.DINGTALK_WEBHOOK_URL || '';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

async function fetchReport() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);

  const url = `${HEALTH_MCP_URL}/api/report?start=${start.toISOString().slice(0, 10)}&end=${end.toISOString().slice(0, 10)}`;
  console.log(`[1/4] 拉取健康报告: ${url}`);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${HEALTH_MCP_TOKEN}` },
  });
  if (!res.ok) throw new Error(`health-mcp API error: ${res.status}`);
  return res.json();
}

async function generateSummary(report) {
  const nutrition = report.nutrition?.avg || {};
  const bp = report.blood_pressure?.stats || {};
  const pain = report.pain?.stats || {};

  const prompt = `你是一位肾内科健康顾问。根据以下数据生成简短的每日健康摘要（中文，200字以内）：
- 日均营养：热量${nutrition.kcal || '?'}kcal，蛋白质${nutrition.protein_g || '?'}g，钾${nutrition.potassium_mg || '?'}mg，钠${nutrition.sodium_mg || '?'}mg
- 血压：平均${bp.avg_systolic || '?'}/${bp.avg_diastolic || '?'}mmHg，${bp.count || 0}次记录
- 疼痛：平均${pain.avg_score || '?'}分，${pain.count || 0}次记录
请评估血压控制、饮食合理性，给出1-2条建议。`;

  console.log(`[2/4] 调用 Ollama (${OLLAMA_MODEL})...`);

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.response;
}

async function sendToDingTalk(summary) {
  const today = new Date().toISOString().slice(0, 10);
  const body = {
    msgtype: 'markdown',
    markdown: {
      title: `每日健康摘要 (${today})`,
      text: `## 每日健康摘要\n**${today}**\n\n${summary}\n\n---\n*health-mcp + Ollama 自动生成*`,
    },
  };

  console.log(`[3/4] 推送至钉钉...`);

  const res = await fetch(DINGTALK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DingTalk error: ${res.status}`);
  const data = await res.json();
  return data;
}

async function main() {
  console.log('=== health-mcp → Ollama → 钉钉 测试 ===\n');

  if (!HEALTH_MCP_TOKEN) {
    console.error('错误: 请设置 HEALTH_MCP_TOKEN 环境变量');
    process.exit(1);
  }
  if (!DINGTALK_WEBHOOK_URL) {
    console.error('错误: 请设置 DINGTALK_WEBHOOK_URL 环境变量');
    process.exit(1);
  }

  try {
    const report = await fetchReport();
    console.log(`  ✓ 报告数据获取成功\n`);

    const summary = await generateSummary(report);
    console.log(`  ✓ AI 摘要生成完成\n`);
    console.log('--- 摘要预览 ---');
    console.log(summary);
    console.log('---\n');

    const result = await sendToDingTalk(summary);
    console.log(`  ✓ 钉钉推送结果:`, result);

    console.log('\n[4/4] 完成! ✓');
  } catch (err) {
    console.error('\n错误:', err.message);
    process.exit(1);
  }
}

main();
