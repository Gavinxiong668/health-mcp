# Health-MCP 项目结构分析

> 自动生成于 2026-08-23，基于代码库静态分析。

## 项目概述

**health-mcp** 是一个自托管的个人健康数据管理平台，采用 MCP (Model Context Protocol) 架构，让 AI 智能体能够直接读写用户的营养、化验、可穿戴设备和临床健康数据。

- **代码量**：~23,500 行 TypeScript
- **版本**：0.1.3
- **许可证**：MIT
- **Node.js**：>= 20
- **包管理**：pnpm 10.x monorepo

## 架构总览

```
┌─────────────────────────────────────────────────────┐
│                   单进程三表面                        │
│                                                     │
│  ┌───────────┐  ┌───────────┐  ┌────────────────┐  │
│  │ Dashboard │  │ REST API  │  │  MCP (stdio/   │  │
│  │ (React)   │  │  (Hono)   │  │  Streamable    │  │
│  │           │  │           │  │  HTTP)         │  │
│  └─────┬─────┘  └─────┬─────┘  └───────┬────────┘  │
│        │              │                │            │
│        └──────────────┼────────────────┘            │
│                       │                             │
│              ┌────────▼────────┐                    │
│              │   Service Layer  │                    │
│              │  (业务逻辑层)     │                    │
│              └────────┬────────┘                    │
│                       │                             │
│              ┌────────▼────────┐                    │
│              │  SQLite (WAL)   │                    │
│              │  data.db        │                    │
│              └─────────────────┘                    │
└─────────────────────────────────────────────────────┘
```

**三个表面 (Surfaces)**：
1. **Dashboard** — 静态 SPA，由 Vite 构建后由服务器直接服务
2. **REST API** — Hono 框架，供 Dashboard 和外部系统集成
3. **MCP Server** — 支持 stdio 和 Streamable HTTP 传输，供 AI 智能体调用

## 工作区结构

```
health-mcp/
├── apps/
│   ├── server/          # 后端 (Node.js, Hono + MCP SDK)
│   │   ├── src/
│   │   │   ├── index.ts           # 入口：CLI 解析 → 启动服务器
│   │   │   ├── config.ts          # 环境变量 + CLI 参数解析
│   │   │   ├── http.ts            # Hono 应用工厂
│   │   │   ├── rest/index.ts      # REST API 路由 (~60 个端点)
│   │   │   ├── mcp/               # MCP 协议层
│   │   │   │   ├── server.ts      # MCP 服务器核心
│   │   │   │   ├── tool-registry.ts # 工具注册工厂
│   │   │   │   ├── transport.ts   # Streamable HTTP 传输
│   │   │   │   ├── stdio.ts       # stdio 传输
│   │   │   │   └── tools/         # MCP 工具实现 (15 个模块)
│   │   │   ├── services/          # 业务逻辑层 (16 个模块)
│   │   │   ├── db/                # 数据库层
│   │   │   │   ├── client.ts      # better-sqlite3 连接管理
│   │   │   │   ├── migrations.ts  # 迁移注册
│   │   │   │   └── sql/           # 迁移文件 (0001-0020)
│   │   │   ├── wearables/         # 可穿戴设备集成
│   │   │   │   ├── providers/     # Whoop + Oura 适配器
│   │   │   │   ├── auth-store.ts  # OAuth token 存储
│   │   │   │   └── registry.ts    # Provider 注册表
│   │   │   ├── biomarkers/        # 生物标志物种子里
│   │   │   └── util/              # 工具函数 (id, tz)
│   │   └── scripts/               # 种子数据脚本
│   │
│   └── dashboard/       # 前端 (React 18 + TanStack + Tailwind)
│       ├── src/
│       │   ├── routes/            # TanStack Router 文件约定路由 (17 页面)
│       │   ├── components/        # UI 组件 (含 Kumo Design 系统)
│       │   ├── lib/               # API 客户端、工具函数
│       │   └── styles.css         # Tailwind v4 + 自定义主题
│       └── vite.config.ts
│
└── packages/
    └── shared/          # 共享类型 + Zod schemas
        └── src/
            ├── types.ts           # 领域类型定义
            ├── dto.ts             # DTO 类型
            ├── schemas.ts         # Zod 验证 schemas
            └── index.ts           # 统一导出
```

## 数据模型

SQLite 单文件数据库 (`~/.health-mcp/data.db`)，WAL 模式，20 个迁移文件。

### 核心数据域 (13 个)

| 数据域 | 表名 | 用途 |
|--------|------|------|
| 食物 | `foods` (+ FTS5) | USDA/OFF/自定义食物，全文搜索 |
| 餐食 | `meals` + `meal_components` | 饮食记录，多组件模型 |
| 视图 | `intake_v` | 营养摄入扁平视图 |
| 水分 | `hydration_entries` | 饮水记录 |
| 体重 | `weight_entries` | 体重/体脂 |
| 测量 | `measurements` | 身体尺寸 |
| 目标 | `goals` | 营养目标 (单例) |
| 食谱 | `recipes` + `recipe_ingredients` | 食谱管理 |
| 批次 | `batches` | 烹饪批次（递减模型） |
| 记忆餐 | `remembered_meals` | 快速复用 |
| 生物标志物 | `biomarkers` + `lab_results` + `lab_panels` | 化验数据 |
| 可穿戴 | `wearable_*` (10+ 表) | Whoop/Oura 同步 |
| 临床扩展 | 7 个新表 | 血压/透析/疼痛/用药/日记/液体排出 |

### 临床扩展表 (migration 0020)

| 表名 | 字段亮点 |
|------|---------|
| `blood_pressure_entries` | 收缩压/舒张压/脉搏/体位/手臂 |
| `dialysis_sessions` | 方式/时长/血管通路/体重/超滤/并发症 |
| `pain_entries` | NRS 0-10/部位/类型/触发因素 |
| `medications` | 药物管理 (名称/类别/剂量/频次) |
| `medication_log` | 服药记录 (FK CASCADE) |
| `diary_entries` | 心情/精力/睡眠/食欲 (1-5 评分) |
| `fluid_output_entries` | 排出记录 (尿液/汗液/引流等) |

## MCP 工具清单

共 **60+ 个 MCP 工具**，按功能分组：

| 组 | 工具数 | 代表工具 |
|----|--------|---------|
| food | 6 | `search_food`, `lookup_barcode`, `create_custom_food` |
| meals | 8 | `log_meal`, `add_meal_component`, `undo_last_meal` |
| hydration/weight | 6 | `log_hydration`, `log_weight`, `log_measurement` |
| goals | 2 | `get_goals`, `set_goals` |
| summaries | 3 | `daily_summary`, `weekly_summary`, `range_summary` |
| biomarkers | 12 | `search_biomarker`, `log_lab_result`, `biomarker_trend` |
| recipes/batches | 9 | `create_recipe`, `create_batch`, `archive_batch` |
| wearables | 6 | `wearable_connect_url`, `discover_capabilities` |
| clinical | 20+ | `log_blood_pressure`, `log_dialysis`, `log_pain`, `create_medication`, `log_diary` |
| correlate | 2 | `correlate`, `list_metrics` |

## REST API 端点

约 **60 个 REST 端点**，覆盖所有数据域：

```
GET/POST/PATCH/DELETE /api/foods/*
GET/POST/PATCH/DELETE /api/meals/*
GET/POST/DELETE       /api/hydration/*
GET/POST/DELETE       /api/weight/*
GET/POST/DELETE       /api/measurements/*
GET/PUT               /api/goals
GET                   /api/summary/daily|weekly|range
POST                  /api/correlate
GET/POST/PATCH/DELETE /api/recipes/*
GET/POST/DELETE       /api/batches/*
GET/POST/DELETE       /api/biomarkers/*
GET/POST/DELETE       /api/lab-panels/*
GET/POST/DELETE       /api/lab-results/*
GET                   /api/wearables/*
POST                  /api/wearables/sync
GET/POST/DELETE       /api/blood-pressure/*
GET/POST/PATCH/DELETE /api/dialysis/*
GET/POST/DELETE       /api/pain/*
GET/POST/PATCH/DELETE /api/medications/*
GET/POST              /api/medication-log/*
GET/POST/DELETE       /api/diary/*
GET/POST/DELETE       /api/fluid-output/*
GET                   /api/report
```

## Dashboard 页面

17 个路由页面，使用 TanStack Router 文件约定路由：

| 路由 | 功能 | 图表 |
|------|------|------|
| `/today` | 今日概览：宏量营养素环、睡眠/恢复/体重卡片、水分、餐食 | MacroRings |
| `/log` | 历史记录列表 | — |
| `/trends` | 营养/体重/恢复趋势 | MetricChart (Recharts) |
| `/report` | 健康报告 (PDF 导出) | 多图表 + 表格 |
| `/insights` | 相关性分析 | — |
| `/foods` | 食物搜索/管理 | — |
| `/recipes` | 食谱管理 | — |
| `/batches` | 批次管理 | — |
| `/labs` | 化验结果 + 生物标志物趋势 | AreaChart |
| `/wearables` | 可穿戴设备管理 | — |
| `/goals` | 目标设置 | — |
| `/blood-pressure` | 血压追踪 | LineChart + ReferenceLine |
| `/dialysis` | 透析记录 | ComposedChart (双 Y 轴) |
| `/pain` | 疼痛评分 | ComposedChart (Bar + Line) |
| `/medications` | 用药管理 | — |
| `/diary` | 情绪日记 | LineChart |
| `/settings` | 设置 | — |

## 技术栈

### 后端
- **运行时**：Node.js >= 20
- **HTTP 框架**：Hono (轻量、类型安全)
- **数据库**：SQLite via better-sqlite3 (WAL, 同步 API)
- **MCP SDK**：@modelcontextprotocol/sdk
- **验证**：Zod
- **构建**：tsup (ESBuild)
- **测试**：Vitest

### 前端
- **框架**：React 18
- **路由**：TanStack Router (文件约定)
- **数据获取**：TanStack React Query
- **样式**：Tailwind CSS v4 + Kumo Design System (@cloudflare/kumo)
- **图表**：Recharts
- **构建**：Vite 6
- **图标**：Lucide React

### 共享
- **类型**：TypeScript 接口 + Zod schemas
- **包管理**：pnpm workspaces

## 外部集成

### 可穿戴设备
- **Whoop**：OAuth 2.0，同步睡眠/活动/恢复/身体测量
- **Oura**：OAuth 2.0，同步睡眠/活动/准备度/锻炼
- 可扩展架构：添加新 provider 只需新目录 + 注册

### 食物数据源
- **USDA FoodData Central**：官方营养数据库
- **Open Food Facts**：全球食品数据库
- FTS5 全文搜索 + 别名匹配

## 部署模型

单二进制部署：
```bash
# 开发
pnpm dev

# 生产构建
pnpm build

# 启动 (服务 Dashboard + REST + MCP)
HEALTH_MCP_HOST=127.0.0.1 node dist/index.js

# 或通过 npm
npx health-mcp
```

数据存储在 `~/.health-mcp/data.db`，认证 token 在 `~/.health-mcp/auth.json`。

## 安全模型

- **本地优先**：默认绑定 127.0.0.1
- **Token 认证**：绑定 0.0.0.0 时强制要求 HEALTH_MCP_TOKEN (>= 32 字符)
- **OAuth 隔离**：可穿戴设备 token 存储在独立文件，不随数据库导出泄露
- **CORS**：同源策略，Dashboard 与 API 同域
