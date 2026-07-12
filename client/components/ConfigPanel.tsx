interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  language: 'zh' | 'en';
  interviewType: string;
  candidateBackground: string;
}

interface ConfigPanelProps {
  config: AgentConfig;
  onChange: (config: Partial<AgentConfig>) => void;
}

const INTERVIEW_TYPES = [
  '技术面试',
  '行为面试',
  '系统设计面试',
  '产品经理面试',
  '数据分析面试',
  '管理岗位面试',
  '综合面试',
];

const BACKGROUNDS = [
  '全栈开发工程师',
  '前端开发工程师',
  '后端开发工程师',
  'DevOps 工程师',
  '数据科学家',
  '产品经理',
  'UI/UX 设计师',
  '应届毕业生',
  '技术管理者',
];

export function ConfigPanel({ config, onChange }: ConfigPanelProps) {
  return (
    <div className="bg-[#16161f] rounded-2xl border border-[#1e1e2e] p-6">
      <h3 className="text-sm font-medium text-[#9090a8] mb-4 uppercase tracking-wider">
        面试配置
      </h3>

      <div className="space-y-4">
        {/* 面试类型 */}
        <div>
          <label className="block text-xs text-[#9090a8] mb-2">面试类型</label>
          <select
            value={config.interviewType}
            onChange={(e) => onChange({ interviewType: e.target.value })}
            className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-[#e4e4ef] focus:outline-none focus:border-blue-500/50 transition-colors"
          >
            {INTERVIEW_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* 候选人背景 */}
        <div>
          <label className="block text-xs text-[#9090a8] mb-2">候选人背景</label>
          <select
            value={config.candidateBackground}
            onChange={(e) => onChange({ candidateBackground: e.target.value })}
            className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-[#e4e4ef] focus:outline-none focus:border-blue-500/50 transition-colors"
          >
            {BACKGROUNDS.map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>
        </div>

        {/* 语言 */}
        <div>
          <label className="block text-xs text-[#9090a8] mb-2">语言</label>
          <div className="flex gap-2">
            <button
              onClick={() => onChange({ language: 'zh' })}
              className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
                config.language === 'zh'
                  ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
                  : 'bg-[#0a0a0f] border border-[#1e1e2e] text-[#9090a8] hover:border-[#2a2a3e]'
              }`}
            >
              中文
            </button>
            <button
              onClick={() => onChange({ language: 'en' })}
              className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
                config.language === 'en'
                  ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
                  : 'bg-[#0a0a0f] border border-[#1e1e2e] text-[#9090a8] hover:border-[#2a2a3e]'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* 创意度 */}
        <div>
          <label className="block text-xs text-[#9090a8] mb-2">
            创意度: {config.temperature.toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.1"
            value={config.temperature}
            onChange={(e) => onChange({ temperature: parseFloat(e.target.value) })}
            className="w-full h-2 bg-[#0a0a0f] rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-[#9090a8]/50 mt-1">
            <span>严谨</span>
            <span>创意</span>
          </div>
        </div>
      </div>
    </div>
  );
}
