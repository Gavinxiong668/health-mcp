# Health-MCP 完整部署手册

> 基于实际部署过程整理，包含所有踩坑记录。适用于 WSL2 (Ubuntu) + Windows 环境。

## 环境概览

```
┌─────────────────────────────────────────────────────────────┐
│  Windows 11 (25H2)                                          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  WSL2 (Ubuntu-New)                                    │  │
│  │                                                       │  │
│  │  ┌──────────────┐  ┌──────────┐  ┌───────────────┐  │  │
│  │  │ health-mcp   │  │ Ollama   │  │ n8n (Docker)  │  │  │
│  │  │ :7777        │  │ :18080   │  │ :5678         │  │  │
│  │  │              │  │          │  │               │  │  │
│  │  │ Node v24.18  │  │ qwen3    │  │               │  │  │
│  │  │ pnpm 10.33   │  │ -coder   │  │               │  │  │
│  │  └──────────────┘  └──────────┘  └───────────────┘  │  │
│  │                                                       │  │
│  │  SQLite data.db @ ~/.health-mcp/data.db              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────┐                                               │
│  │ 浏览器    │ ← http://localhost:7777                       │
│  └──────────┘                                               │
│                                                             │
│  ┌──────────┐                                               │
│  │ 钉钉     │ ← Webhook 推送                                │
│  └──────────┘                                               │
└─────────────────────────────────────────────────────────────┘
```

## 一、环境准备

### 1.1 WSL2 基础环境

```bash
# 安装 nvm（Node Version Manager）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# 安装 Node.js >= 20（本项目使用 v24.18.0）
nvm install 24
nvm use default

# 安装 pnpm
corepack enable
corepack prepare pnpm@10.33.4 --activate

# 验证
node -v   # v24.18.0
pnpm -v   # 10.33.4
```

### 1.2 克隆项目

```bash
cd ~
git clone https://github.com/lukaisailovic/health-mcp.git
cd health-mcp
pnpm install
```

---

## 二、health-mcp 部署

### 2.1 构建生产版本

```bash
# 完整构建（shared → dashboard → server）
pnpm build
```

构建产物：
- `apps/server/dist/` — 服务端编译产物
- `apps/server/public/` — Dashboard 静态文件（Vite 构建输出）
- `packages/shared/dist/` — 共享类型库

### 2.2 启动服务

#### 方式 A：本地开发模式（绑定 127.0.0.1）

```bash
source ~/.nvm/nvm.sh && nvm use default
cd ~/health-mcp/health-mcp

# 绑定 loopback 无需 token
HEALTH_MCP_HOST=127.0.0.1 pnpm start
```

#### 方式 B：对外服务模式（绑定 0.0.0.0，需要 Token）

```bash
source ~/.nvm/nvm.sh && nvm use default
cd ~/health-mcp/health-mcp

HEALTH_MCP_HOST=0.0.0.0 \
HEALTH_MCP_TOKEN=5f2ce1a7603644eece05a2a4fe2c2ac3 \
pnpm start
```

#### 方式 C：Docker 部署

```bash
# 配置 .env
cp .env.example .env
# 编辑 .env，设置 HEALTH_MCP_TOKEN

# 启动
docker compose up -d
```

### 2.3 后台持久化运行

> **踩坑 #1：nohup 在 WSL2 中不可靠**
>
> 使用 `nohup ... &` 启动的服务会随终端关闭而终止。即使 nohup 将进程标记为"不挂断"，WSL2 的终端会话管理机制仍会在 shell 退出时清理子进程。

**正确方式：使用后台终端**

在 IDE 的终端中以后台模式（`is_background: true`）启动命令，进程会持续运行直到显式终止。

**或者使用 systemd / tmux / screen：**

```bash
# 方式 1：tmux（推荐）
tmux new -s health-mcp
source ~/.nvm/nvm.sh && nvm use default
cd ~/health-mcp/health-mcp
HEALTH_MCP_HOST=0.0.0.0 HEALTH_MCP_TOKEN=5f2ce1a7603644eece05a2a4fe2c2ac3 pnpm start
# Ctrl+B, D 分离会话

# 方式 2：systemd 用户服务
mkdir -p ~/.config/systemd/user/
cat > ~/.config/systemd/user/health-mcp.service << 'EOF'
[Unit]
Description=Health MCP Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/gavin/health-mcp/health-mcp
Environment=PATH=/home/gavin/.nvm/versions/node/v24.18.0/bin:/usr/bin
Environment=HEALTH_MCP_HOST=0.0.0.0
Environment=HEALTH_MCP_TOKEN=5f2ce1a7603644eece05a2a4fe2c2ac3
ExecStart=/home/gavin/.nvm/versions/node/v24.18.0/bin/node apps/server/dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now health-mcp
```

---

## 三、踩坑记录

### 坑 #1：WSL2 中 nohup 进程随终端退出

**现象**：`nohup node ... &` 启动后关闭终端，服务停止。

**原因**：WSL2 的终端会话管理会在 shell 退出时发送 SIGHUP 清理子进程。

**解决**：使用 tmux、systemd 或 IDE 后台终端。

---

### 坑 #2：HEALTH_MCP_TOKEN 长度不足

**现象**：
```
config error: HEALTH_MCP_TOKEN must be at least 32 chars with sufficient entropy (≥8 distinct characters)
```

**原因**：绑定 `0.0.0.0` 时强制要求强 Token（≥32 字符，≥8 个不同字符）。

**解决**：
```bash
# 生成合规 Token
openssl rand -hex 16
# 输出示例：5f2ce1a7603644eece05a2a4fe2c2ac3
```

**注意**：绑定 `127.0.0.1` 时不需要 Token，可以留空。

---

### 坑 #3：端口 7777 被占用

**现象**：
```
Error: listen EADDRINUSE: address already in use 127.0.0.1:7777
```

**原因**：之前的进程未正常退出，端口仍被占用。

**解决**：
```bash
# 查找并杀死占用端口的进程
fuser -k 7777/tcp

# 或更暴力
lsof -ti:7777 | xargs kill -9

# 等待几秒后重试
sleep 2
HEALTH_MCP_HOST=127.0.0.1 pnpm start
```

---

### 坑 #4：WSL 中 Node/pnpm 命令找不到

**现象**：
```
bash: node: command not found
bash: pnpm: command not found
```

**原因**：nvm 管理的 Node.js 不在默认 PATH 中，需要先加载 nvm。

**解决**：所有 WSL 命令前必须加 nvm 加载：
```bash
source ~/.nvm/nvm.sh && nvm use default && [your_command]
```

从 Windows 调用时：
```powershell
wsl -d Ubuntu-New bash -lc "source ~/.nvm/nvm.sh && nvm use default && cd ~/health-mcp/health-mcp && pnpm start"
```

---

### 坑 #5：预览/浏览器无法访问 WSL 内的服务

**现象**：服务在 WSL 内正常运行（curl 返回 200），但 Windows 浏览器打不开。

**原因**：服务绑定在 WSL 内部的 `127.0.0.1`，Windows 侧无法直接访问。

**解决**：绑定到 `0.0.0.0`（需要 Token）：
```bash
HEALTH_MCP_HOST=0.0.0.0 HEALTH_MCP_TOKEN=5f2ce1a7603644eece05a2a4fe2c2ac3 pnpm start
```

然后在 Windows 浏览器访问 `http://localhost:7777`。

> WSL2 会自动将容器内的端口映射到 Windows 的 localhost，但前提是服务绑定到 `0.0.0.0` 而不是 `127.0.0.1`。

---

### 坑 #6：Dashboard 修改后看不到效果

**现象**：修改了 Dashboard 源码，重启服务后页面没变化。

**原因**：生产模式下服务的是 `apps/server/public/` 中的预构建文件，不是源码。

**解决**：每次修改源码后必须重新构建 Dashboard：
```bash
cd apps/dashboard
pnpm build
# 输出会覆盖 apps/server/public/
```

---

### 坑 #7：TypeScript 编译错误 — 属性重复指定

**现象**：
```
TS2783: 'medication_id' is specified more than once.
```

**原因**：在 REST 路由中，URL 参数和 body 展开到同一对象时产生冲突。

**解决**：调整展开顺序，让 URL 参数覆盖 body 中的值：
```typescript
// 错误：body 展开后 medication_id 与 URL 参数冲突
{ medication_id: c.req.param('id'), ...(await parseBody(c)) }

// 正确：URL 参数放后面，覆盖 body 中的值
{ ...(await parseBody(c)), medication_id: c.req.param('id') }
```

---

### 坑 #8：TanStack Router 自动生成重复路由

**现象**：
```
Duplicate identifier 'createFileRoute'
```

**原因**：创建新路由文件（如 `report.tsx`）后，TanStack Router 的文件扫描器自动在文件末尾追加了重复的 Route 定义。

**解决**：手动删除文件末尾自动生成的 `import { createFileRoute }...` 和 `RouteComponent` 代码块。

---

## 四、n8n + Ollama + 钉钉 集成部署

### 4.1 安装 Ollama

```bash
# 安装
curl -fsSL https://ollama.com/install.sh | sh

# 拉取模型
ollama pull qwen2.5:7b

# 确保监听所有接口（供 Docker 容器访问）
export OLLAMA_HOST=0.0.0.0:18080
ollama serve
```

验证：
```bash
curl http://localhost:18080/api/generate -d '{
  "model": "qwen2.5:7b",
  "prompt": "你好",
  "stream": false
}'
```

### 4.2 部署 n8n

```bash
cd ~/health-mcp/health-mcp/integrations/n8n

# 编辑环境变量
cp .env.example .env
# 编辑 .env 填入实际值：
#   HEALTH_MCP_TOKEN=5f2ce1a7603644eece05a2a4fe2c2ac3
#   DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx

# 启动
docker compose -f docker-compose.n8n.yml up -d
```

### 4.3 导入工作流

1. 打开 `http://localhost:5678`
2. 导入 `daily-health-summary.json`（每日摘要）
3. 导入 `health-alert.json`（告警）
4. 检查各节点的 URL 和 Token 配置
5. 点击 Activate 启用

### 4.4 配置钉钉机器人

1. 钉钉群 → 设置 → 智能群助手 → 添加机器人
2. 选择"自定义"
3. 安全设置建议选"加签"
4. 复制 Webhook URL 填入 `.env`

### 4.5 端到端测试

```bash
# 使用测试脚本验证完整链路
HEALTH_MCP_TOKEN=5f2ce1a7603644eece05a2a4fe2c2ac3 \
DINGTALK_WEBHOOK_URL="https://oapi.dingtalk.com/robot/send?access_token=xxx" \
node integrations/n8n/test-dingtalk.js
```

---

## 五、完整启动清单

按以下顺序启动所有服务：

```bash
# 1. 加载 nvm
source ~/.nvm/nvm.sh && nvm use default

# 2. 启动 health-mcp
cd ~/health-mcp/health-mcp
HEALTH_MCP_HOST=0.0.0.0 \
HEALTH_MCP_TOKEN=5f2ce1a7603644eece05a2a4fe2c2ac3 \
pnpm start
# 确认日志出现 "listening on 0.0.0.0:7777"

# 3. 启动 Ollama（新终端）
export OLLAMA_HOST=0.0.0.0:18080
ollama serve
# 确认模型已拉取：ollama list

# 4. 启动 n8n（新终端）
cd ~/health-mcp/health-mcp/integrations/n8n
docker compose -f docker-compose.n8n.yml up -d
# 访问 http://localhost:5678 确认 n8n 运行

# 5. 验证
curl -s http://localhost:7777/health | head   # health-mcp
curl -s http://localhost:18080/api/tags | head  # Ollama
curl -s http://localhost:5678/healthz | head    # n8n
```

---

## 六、日常维护

### 重新构建并部署

```bash
source ~/.nvm/nvm.sh && nvm use default
cd ~/health-mcp/health-mcp

# 拉取最新代码
git pull

# 安装依赖（如有变化）
pnpm install

# 构建
pnpm build

# 重启服务（先 fuser -k 7777/tcp 释放端口）
fuser -k 7777/tcp
sleep 2
HEALTH_MCP_HOST=0.0.0.0 HEALTH_MCP_TOKEN=5f2ce1a7603644eece05a2a4fe2c2ac3 pnpm start
```

### 数据备份

```bash
# 备份 SQLite 数据库
cp ~/.health-mcp/data.db ~/.health-mcp/data.db.backup.$(date +%Y%m%d)

# 备份 OAuth token
cp ~/.health-mcp/auth.json ~/.health-mcp/auth.json.backup
```

### 日志查看

```bash
# health-mcp 日志（前台运行时直接看终端）
# 如使用 systemd：
journalctl --user -u health-mcp -f

# n8n 日志
docker logs -f n8n
```

---

## 七、故障排查速查表

| 症状 | 原因 | 解决 |
|------|------|------|
| `command not found: node/pnpm` | nvm 未加载 | `source ~/.nvm/nvm.sh && nvm use default` |
| `EADDRINUSE :7777` | 端口占用 | `fuser -k 7777/tcp` |
| `config error: TOKEN` | Token 不合规 | 生成 ≥32 字符、≥8 不同字符的 Token |
| 浏览器打不开页面 | 绑定 127.0.0.1 | 改用 `HEALTH_MCP_HOST=0.0.0.0` |
| 页面修改没效果 | 未重新构建 | `cd apps/dashboard && pnpm build` |
| 服务突然停了 | nohup 不可靠 | 改用 tmux 或 systemd |
| n8n 连不上 health-mcp | Docker 网络隔离 | 添加 `--add-host=host.docker.internal:host-gateway` |
| Ollama 超时 | 模型未加载/内存不足 | `ollama list` 检查，确认 GPU 内存 |
| 钉钉推送失败 | Webhook URL 错误 | 检查 URL 格式和签名配置 |
| `Duplicate identifier` | TanStack Router 自动生成 | 删除文件末尾的重复路由存根 |

---

## 八、文件结构总览

```
health-mcp/
├── apps/
│   ├── server/              # 后端服务
│   │   ├── dist/            # 编译产物
│   │   ├── public/          # Dashboard 构建产物（生产模式服务的）
│   │   └── src/             # 源码
│   └── dashboard/           # 前端 Dashboard
│       └── src/
│           ├── routes/      # 17 个页面路由
│           └── components/  # UI 组件
├── integrations/
│   └── n8n/                 # n8n 自动化工作流
│       ├── daily-health-summary.json  # 每日摘要工作流
│       ├── health-alert.json          # 告警工作流
│       ├── docker-compose.n8n.yml     # n8n Docker 配置
│       ├── test-dingtalk.js           # 端到端测试
│       ├── .env.example               # 环境变量模板
│       └── README.md                  # n8n 部署指南
├── packages/shared/         # 共享类型
├── docs/
│   ├── DEPLOYMENT.md        # 本文档
│   ├── PROJECT_ANALYSIS.md  # 项目结构分析
│   └── DATA_MODEL.md        # 数据模型文档
├── .env                     # 环境变量（不入库）
├── docker-compose.yml       # Docker 部署
└── pnpm-workspace.yaml      # Monorepo 配置
```
