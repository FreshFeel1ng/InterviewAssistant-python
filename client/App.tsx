import { useState, useRef, useEffect, useCallback } from 'react';
import { StatusIndicator } from './components/StatusIndicator.js';
import { TranscriptPanel } from './components/TranscriptPanel.js';
import { AnswerPanel } from './components/AnswerPanel.js';
import { ConfigPanel } from './components/ConfigPanel.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useSpeechRecognition } from './hooks/useSpeechRecognition.js';

interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  language: 'zh' | 'en';
  interviewType: string;
  candidateBackground: string;
}

const defaultConfig: AgentConfig = {
  model: 'deepseek-v4-flash',
  temperature: 0.7,
  maxTokens: 500,
  language: 'zh',
  interviewType: '技术面试',
  candidateBackground: '全栈开发工程师',
};

export default function App() {
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);
  const [transcript, setTranscript] = useState('');
  const [answers, setAnswers] = useState<Array<{ id: string; content: string }>>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [isListening, setIsListening] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);

  // WebSocket 连接
  const { sendMessage, isConnected } = useWebSocket('ws://localhost:3001/ws', {
    onMessage: (msg) => {
      switch (msg.type) {
        case 'answer_chunk': {
          const payload = msg.payload as { chunk: string; isComplete: boolean; id: string };
          if (payload.isComplete) {
            setAnswers((prev) => [...prev, { id: payload.id, content: currentAnswer }]);
            setCurrentAnswer('');
            setStatus('listening');
          } else {
            setCurrentAnswer((prev) => prev + payload.chunk);
            setStatus('speaking');
          }
          break;
        }
        case 'status': {
          const payload = msg.payload as { status: string };
          setStatus(payload.status as typeof status);
          break;
        }
        case 'config': {
          const payload = msg.payload as { config: AgentConfig };
          if (payload.config) {
            setConfig(payload.config);
          }
          break;
        }
      }
    },
    onError: () => setStatus('idle'),
  });

  // 语音识别
  const { startListening, stopListening, isSupported } = useSpeechRecognition({
    language: config.language === 'zh' ? 'zh-CN' : 'en-US',
    onResult: (text, isFinal) => {
      setTranscript(text);
      if (text.trim()) {
        sendMessage({
          type: 'transcript',
          payload: { text, isFinal, confidence: 0.9 },
        });
      }
    },
    onError: (err) => {
      console.error('语音识别错误:', err);
      setStatus('idle');
    },
  });

  // 滚动到最新回答
  useEffect(() => {
    if (answerRef.current) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight;
    }
  }, [currentAnswer, answers]);

  // 更新配置
  const handleConfigChange = useCallback(
    (newConfig: Partial<AgentConfig>) => {
      const updated = { ...config, ...newConfig };
      setConfig(updated);
      sendMessage({ type: 'config', payload: updated });
    },
    [config, sendMessage]
  );

  // 切换麦克风
  const toggleMic = useCallback(() => {
    if (isListening) {
      stopListening();
      setIsListening(false);
      setStatus('idle');
    } else {
      startListening();
      setIsListening(true);
      setStatus('listening');
    }
  }, [isListening, startListening, stopListening]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e4e4ef]">
      {/* Header */}
      <header className="border-b border-[#1e1e2e] bg-[#111118]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold">
              AI
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Interview Assistant</h1>
              <p className="text-xs text-[#9090a8]">AI 面试助手</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <StatusIndicator status={status} isConnected={isConnected} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：配置 + 语音识别 */}
          <div className="lg:col-span-1 space-y-6">
            <ConfigPanel
              config={config}
              onChange={handleConfigChange}
            />

            {/* 麦克风控制 */}
            <div className="bg-[#16161f] rounded-2xl border border-[#1e1e2e] p-6">
              <h3 className="text-sm font-medium text-[#9090a8] mb-4 uppercase tracking-wider">
                语音识别
              </h3>

              {!isSupported ? (
                <div className="text-center py-4">
                  <p className="text-red-400 text-sm">
                    您的浏览器不支持语音识别，请使用 Chrome 浏览器
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <button
                    onClick={toggleMic}
                    className={`
                      relative w-20 h-20 rounded-full flex items-center justify-center
                      transition-all duration-300 cursor-pointer border-2
                      ${
                        isListening
                          ? 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.3)]'
                          : 'bg-[#1e1e2e] border-[#2a2a3e] text-[#9090a8] hover:border-blue-500/50 hover:text-blue-400'
                      }
                    `}
                  >
                    {isListening && (
                      <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />
                    )}
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                      />
                    </svg>
                  </button>
                  <p className="text-sm text-[#9090a8]">
                    {isListening ? '正在聆听... 点击停止' : '点击开始语音识别'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 右侧：对话面板 */}
          <div className="lg:col-span-2 space-y-6">
            <TranscriptPanel text={transcript} isListening={isListening} />
            <AnswerPanel
              answers={answers}
              currentAnswer={currentAnswer}
              status={status}
              ref={answerRef}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e1e2e] mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4 text-center text-xs text-[#9090a8]">
          Powered by LangChain + OpenAI &middot; 仅供学习参考，请在合法场景使用
        </div>
      </footer>
    </div>
  );
}
