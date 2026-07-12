# Interview Assistant - AI 面试助手

基于 LangChain + FastAPI + React 的智能面试助手，支持实时语音识别和自然语言回答生成。帮助面试者获得自然、专业且口语化的实时回答建议。

## 功能特性

- **实时语音识别**：基于 Web Speech API，边说边转写，无需额外服务
- **智能回答生成**：LangChain + DeepSeek V4 Flash，流式逐字输出
- **口语化自然**：回答带填充词、停顿、自我修正，模拟真人思考过程
- **问题分类**：自动识别 9 种面试问题类型，采用不同回答策略
- **多场景支持**：技术面试、行为面试、系统设计、产品经理等
- **双语支持**：中文 / 英文面试自由切换
- **上下文记忆**：多轮对话记忆，回答保持前后一致性

## 技术栈

| 层级 | 技术 |
|------|------|
| AI 引擎 | LangChain + DeepSeek V4 Flash |
| 后端 | FastAPI + WebSocket + Python |
| 前端 | React 18 + TypeScript + Tailwind CSS |
| 语音识别 | Web Speech API |
| 环境管理 | Conda |

## 快速开始

### 前置条件

- Python 3.13+
- Node.js 18+
- Conda（推荐）
- DeepSeek API Key

### 安装

```bash
# 1. 克隆仓库
git clone https://github.com/FreshFeel1ng/InterviewAssistant-python.git
cd InterviewAssistant-python

# 2. 创建 Conda 环境
conda create -n interview-assistant python=3.13 -y
conda activate interview-assistant

# 3. 安装 Python 依赖
pip install -r requirements.txt

# 4. 安装前端依赖
npm install

# 5. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY
```

### 启动

```bash
# 终端 1：后端（需要先 conda activate interview-assistant）
python -m uvicorn server.main:app --host 0.0.0.0 --port 3001 --reload

# 终端 2：前端
npx vite --port 5173
```

访问 http://localhost:5173

## 项目结构

```
InterviewAssistant-python/
├── server/                    # Python 后端
│   ├── main.py               # FastAPI + WebSocket 服务入口
│   ├── agent.py              # LangChain Agent 核心
│   ├── classifier.py         # 面试问题分类器（9 种类型）
│   ├── humanizer.py          # 回答人性化后处理
│   ├── speech.py             # 语音文本处理（4 层问题识别）
│   └── config.py             # 配置管理
├── client/                    # React 前端
│   ├── App.tsx               # 主应用组件
│   ├── main.tsx              # 入口文件
│   ├── index.css             # 全局样式（Tailwind）
│   ├── components/           # UI 组件
│   │   ├── StatusIndicator.tsx   # 连接/运行状态
│   │   ├── TranscriptPanel.tsx   # 实时转写面板
│   │   ├── AnswerPanel.tsx       # AI 回答面板
│   │   └── ConfigPanel.tsx       # 面试配置面板
│   └── hooks/                # 自定义 Hooks
│       ├── useWebSocket.ts       # WebSocket 连接管理
│       └── useSpeechRecognition.ts # 语音识别
├── requirements.txt           # Python 依赖
├── package.json               # 前端依赖
├── .env.example               # 环境变量模板
└── .vscode/                   # VS Code 配置
```

## 使用说明

1. 打开应用后，在左侧配置**面试类型**、**候选人背景**和**语言**
2. 点击麦克风按钮开始语音识别（需要使用 Chrome 浏览器）
3. 面试官提问时，AI 会自动在右侧面板生成口语化回答
4. 回答逐字流式输出，模拟真实思考节奏
5. 再次点击麦克风按钮可暂停识别

## 问题识别策略

系统使用 4 层兜底策略识别面试官问题，应对语音识别偏差：

| 层级 | 策略 | 示例 |
|------|------|------|
| 1 | 疑问语气词匹配 | "是什么？"、"怎么做呢" |
| 2 | 60+ 面试关键词 | "说说"、"怎么看"、"区别" |
| 3 | 技术主题词 + 长度 | "索引"、"微服务"（应对语音偏差） |
| 4 | 纯长度兜底 ≥20字 | 直接当作问题处理 |

## 回答风格

Agent 生成的回答具备以下特点：

- 第一人称"我"的口吻
- 自然的填充词：嗯、我觉得、其实、怎么说呢
- 思考过程展示：这个问题可以从几个角度来考虑...
- 适当展示真实工作中的权衡和取舍
- 控制长度 100-250 字，避免背书感

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key | - |
| `DEEPSEEK_BASE_URL` | API 地址 | `https://api.deepseek.com/v1` |
| `LLM_MODEL` | 模型名称 | `deepseek-v4-flash` |
| `SERVER_PORT` | 后端端口 | `3001` |

## 免责声明

本工具仅供学习和研究使用。请在合法合规的场景下使用，不得用于任何作弊或违反考试/面试规则的行为。

## License

MIT
