# n8n 自动化工作流部署指南

本文档说明如何部署 health-mcp 的自动化工作流，实现每日健康摘要推送和异常告警。

## 架构概览

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ health-  │    │  Ollama  │    │   n8n    │    │  钉钉    │
│   mcp    │◄───│ (AI 模型)│◄───│ (工作流) │───►│ 机器人   │
│ :7777    │    │ :11434   │    │ :5678    │    │ Webhook  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     ▲                                │
     │          拉取数据              │ 推送消息
     │                                ▼
  SQLite                        Markdown 格式
  data.db                       每日摘要 / 告警
```

## 前置条件

| 组件 | 版本要求 | 说明 |
|------|---------|------|
| health-mcp | >= 0.1.3 | 需启用 REST API + 认证 Token |
| Docker | >= 20.10 | 运行 n8n 容器 |
| Ollama | >= 0.3 | 本地 AI 推理 |
| 钉钉 | - | 已创建自定义机器人 |

## 1. 安装 Ollama

```bash
# 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 拉取推荐模型（中文友好，7B 参数适合消费级 GPU）
ollama pull qwen2.5:7b

# 验证（确保 Ollama 监听所有接口，供 Docker 容器访问）
export OLLAMA_HOST=0.0.0.0:11434
ollama serve
```

**模型选择建议**：
- `qwen2.5:7b` — 推荐，中文能力强，7B 参数在 8GB+ 显存上流畅运行
- `qwen2.5:3b` — 轻量版，适合无 GPU 环境（CPU 推理较慢）
- `llama3.1:8b` — 英文更好，中文稍弱

## 2. 部署 n8n (Docker)

```bash
# 创建数据目录
mkdir -p ~/.n8n

# 启动 n8n 容器
docker run -d \
  --name n8n \
  --restart unless-stopped \
  -p 5678:5678 \
  -e GENERIC_TIMEZONE="Asia/Shanghai" \
  -e TZ="Asia/Shanghai" \
  -e N8N_HOST=0.0.0.0 \
  -e N8N_PORT=5678 \
  -e WEBHOOK_URL=http://localhost:5678/ \
  -e HEALTH_MCP_TOKEN="你的health-mcp-token" \
  -e DINGTALK_WEBHOOK_URL="https://oapi.dingtalk.com/robot/send?access_token=你的token" \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n:latest
```

**关键配置**：
- `HEALTH_MCP_TOKEN` — health-mcp 的认证 Token，需与服务器启动时一致
- `DINGTALK_WEBHOOK_URL` — 钉钉机器人的 Webhook 地址

**容器网络**：
- n8n 容器内通过 `host.docker.internal` 访问宿主机上的 health-mcp 和 Ollama
- Linux 上可能需要添加 `--add-host=host.docker.internal:host-gateway`

```bash
# Linux 完整启动命令
docker run -d \
  --name n8n \
  --restart unless-stopped \
  --add-host=host.docker.internal:host-gateway \
  -p 5678:5678 \
  -e GENERIC_TIMEZONE="Asia/Shanghai" \
  -e TZ="Asia/Shanghai" \
  -e HEALTH_MCP_TOKEN="你的token" \
  -e DINGTALK_WEBHOOK_URL="https://oapi.dingtalk.com/robot/send?access_token=你的token" \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n:latest
```

## 3. 配置钉钉机器人

1. 打开钉钉群 → **设置** → **智能群助手** → **添加机器人**
2. 选择 **自定义（通过 Webhook 接入）**
3. 安全设置建议选择 **加签**（记录 Secret 备用）
4. 复制 **Webhook 地址**，格式：
   ```
   https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxxxxxx
   ```
5. 将此地址填入 n8n 环境变量 `DINGTALK_WEBHOOK_URL`

## 4. 导入工作流

### 4.1 每日健康摘要

1. 打开 n8n 界面：`http://localhost:5678`
2. 点击 **Workflows** → **Import from File**
3. 选择 `integrations/n8n/daily-health-summary.json`
4. 检查节点配置：
   - "拉取健康报告数据" 节点的 URL 和 Token
   - "调用 Ollama 生成摘要" 节点的模型名称
   - "推送至钉钉" 节点的 Webhook URL
5. 点击 **Activate** 启用工作流

**工作流逻辑**：
```
每日 8:00 触发
  → 计算昨日/7天前日期
  → GET /api/report 拉取 7 天健康数据
  → 格式化为中文提示词（含营养/血压/透析/疼痛/用药等）
  → POST Ollama /api/generate 生成摘要
  → 格式化为钉钉 Markdown 消息
  → POST 钉钉 Webhook 推送
```

### 4.2 健康告警

1. 同样导入 `integrations/n8n/health-alert.json`
2. 检查节点配置
3. 点击 **Activate** 启用

**告警规则**：

| 指标 | 阈值 | 告警级别 | 说明 |
|------|------|---------|------|
| 收缩压 | > 160 mmHg | WARNING | 高血压警告 |
| 收缩压 | > 180 mmHg | CRITICAL | 高血压危象 |
| 舒张压 | > 100 mmHg | WARNING | 高血压警告 |
| 舒张压 | > 110 mmHg | CRITICAL | 高血压危象 |
| 血钾 | > 5.0 mmol/L | WARNING | 高钾血症 |
| 血钾 | > 6.0 mmol/L | CRITICAL | 危险！需立即就医 |

**工作流逻辑**：
```
每 5 分钟触发
  → GET /api/blood-pressure?limit=1 查询最新血压
  → 检查收缩压 > 160 / 舒张压 > 100
  → GET /api/lab-results?limit=20 查询化验结果
  → 筛选血钾指标，检查 > 5.0
  → 如有告警 → 格式化消息 → POST 钉钉 Webhook
  → 如无告警 → 静默（不推送）
```

## 5. 验证

### 5.1 手动测试每日摘要

```bash
# 测试 health-mcp API 连通性
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:7777/api/report?start=2026-08-16\&end=2026-08-23

# 测试 Ollama 连通性
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5:7b",
  "prompt": "你好",
  "stream": false
}'

# 测试钉钉 Webhook
curl -X POST "YOUR_DINGTALK_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"msgtype":"text","text":{"content":"n8n 工作流测试消息"}}'
```

### 5.2 在 n8n 中手动执行

1. 打开工作流
2. 点击 **Execute Workflow** 按钮
3. 检查每个节点的输出是否正确
4. 确认钉钉收到消息

## 6. 自定义

### 修改告警阈值

在 `health-alert.json` 的 "检查血压阈值" 和 "检查血钾阈值" Code 节点中修改阈值：

```javascript
// 血压阈值
if (systolic > 160) {  // 修改此处
// 血钾阈值
if (value > 5.0) {  // 修改此处
```

### 修改推送频率

- 每日摘要：修改 Schedule Trigger 的 cron 表达式（默认 `0 8 * * *` = 每天 8:00）
- 告警检查：修改间隔（默认 5 分钟）

### 更换 AI 模型

在 "调用 Ollama 生成摘要" 节点中修改 `model` 字段：
```json
{
  "model": "qwen2.5:7b"  // 改为你需要的模型
}
```

## 文件清单

```
integrations/n8n/
├── daily-health-summary.json   # 每日健康摘要工作流
├── health-alert.json           # 健康告警工作流
├── .env.example                # 环境变量模板
└── README.md                   # 本文档
```

## 故障排查

| 问题 | 原因 | 解决 |
|------|------|------|
| n8n 无法访问 health-mcp | Docker 网络隔离 | 添加 `--add-host=host.docker.internal:host-gateway` |
| Ollama 连接超时 | 模型未加载或内存不足 | `ollama list` 检查模型，确保 GPU 内存充足 |
| 钉钉推送失败 | Webhook URL 错误或签名不匹配 | 检查 URL 和 Secret 配置 |
| 血压数据为空 | 没有血压记录 | 先在 Dashboard 中记录血压数据 |
| 血钾告警未触发 | 化验结果中无钾指标 | 确认 biomarker 名称包含 "potassium" 或 "钾" |
