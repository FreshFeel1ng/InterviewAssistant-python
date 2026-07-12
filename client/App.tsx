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
  const [audioSource, setAudioSource] = useState<'mic' | 'system'>('mic');
  const [isCapturingSystem, setIsCapturingSystem] = useState(false);
  const [resumeLoaded, setResumeLoaded] = useState(false);
  const [resumeInfo, setResumeInfo] = useState<{ name?: string; projectCount?: number; skills?: string[] }>({});
  const [uploading, setUploading] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        case 'transcript_update': {
          const payload = msg.payload as { text: string; source: string };
          setTranscript(payload.text);
          break;
        }
        case 'config': {
          const payload = msg.payload as { config: AgentConfig; resume?: { resumeLoaded: boolean; name: string; projectCount: number } };
          if (payload.config) {
            setConfig(payload.config);
          }
          if (payload.resume?.resumeLoaded) {
            setResumeLoaded(true);
            setResumeInfo(payload.resume);
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

  // 上传简历
  const handleResumeUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/resume/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setResumeLoaded(true);
        setResumeInfo({
          name: data.data.name,
          projectCount: data.data.project_count,
          skills: data.data.skills,
        });
        // 通知服务端重新加载简历
        sendMessage({ type: 'config', payload: {} });
      } else {
        alert('上传失败: ' + data.message);
      }
    } catch (err: any) {
      alert('上传失败: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [sendMessage]);

  const triggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 切换麦克风
  const toggleMic = useCallback(() => {
    if (audioSource !== 'mic') {
      setAudioSource('mic');
    }
    if (isListening) {
      stopListening();
      setIsListening(false);
      setStatus('idle');
    } else {
      // 如果正在系统捕获，先停止
      if (isCapturingSystem) {
        sendMessage({ type: 'stop_audio_capture', payload: {} });
        setIsCapturingSystem(false);
      }
      startListening();
      setIsListening(true);
      setStatus('listening');
    }
  }, [isListening, startListening, stopListening, audioSource, isCapturingSystem, sendMessage]);

  // 切换系统音频捕获
  const toggleSystemAudio = useCallback(() => {
    if (audioSource !== 'system') {
      setAudioSource('system');
    }
    if (isCapturingSystem) {
      sendMessage({ type: 'stop_audio_capture', payload: {} });
      setIsCapturingSystem(false);
      setStatus('idle');
    } else {
      // 如果正在麦克风，先停止
      if (isListening) {
        stopListening();
        setIsListening(false);
      }
      sendMessage({ type: 'start_audio_capture', payload: {} });
      setIsCapturingSystem(true);
      setStatus('listening');
    }
  }, [isCapturingSystem, isListening, stopListening, sendMessage, audioSource]);

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
            {/* 简历上传 */}
            <div className="bg-[#16161f] rounded-2xl border border-[#1e1e2e] p-6">
              <h3 className="text-sm font-medium text-[#9090a8] mb-4 uppercase tracking-wider">
                简历知识库
              </h3>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                onChange={handleResumeUpload}
                className="hidden"
              />

              {resumeLoaded ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium">简历已加载</span>
                  </div>
                  {resumeInfo.name && (
                    <p className="text-sm text-[#e4e4ef]">姓名: {resumeInfo.name}</p>
                  )}
                  {resumeInfo.projectCount !== undefined && (
                    <p className="text-xs text-[#9090a8]">提取到 {resumeInfo.projectCount} 个项目经历</p>
                  )}
                  {resumeInfo.skills && resumeInfo.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {resumeInfo.skills.slice(0, 8).map((s) => (
                        <span key={s} className="px-2 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
                          {s}
                        </span>
                      ))}
                      {resumeInfo.skills.length > 8 && (
                        <span className="px-2 py-0.5 text-[10px] text-[#9090a8]">+{resumeInfo.skills.length - 8}</span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={triggerUpload}
                    className="w-full py-2 px-3 rounded-lg text-xs border border-[#2a2a3e] text-[#9090a8] hover:text-white hover:border-[#3a3a4e] transition-all"
                  >
                    重新上传
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <button
                    onClick={triggerUpload}
                    disabled={uploading}
                    className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-[#2a2a3e] text-[#9090a8] hover:border-blue-500/50 hover:text-blue-400 transition-all disabled:opacity-50"
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        解析中...
                      </span>
                    ) : (
                      <span className="flex flex-col items-center gap-1">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        <span className="text-sm">上传简历</span>
                        <span className="text-[10px] text-[#9090a8]/50">PDF / DOCX / TXT</span>
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>

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
                  {/* 音频源切换 */}
                  <div className="flex gap-2 bg-[#0a0a0f] rounded-lg p-1 w-full">
                    <button
                      onClick={() => { setAudioSource('mic'); if (isCapturingSystem) toggleSystemAudio(); }}
                      className={`flex-1 py-1.5 px-2 rounded-md text-xs transition-all ${
                        audioSource === 'mic'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'text-[#9090a8] hover:text-white'
                      }`}
                    >
                      麦克风
                    </button>
                    <button
                      onClick={() => { setAudioSource('system'); if (isListening) toggleMic(); }}
                      className={`flex-1 py-1.5 px-2 rounded-md text-xs transition-all ${
                        audioSource === 'system'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'text-[#9090a8] hover:text-white'
                      }`}
                    >
                      系统音频
                    </button>
                  </div>

                  {/* 麦克风模式 */}
                  {audioSource === 'mic' && (
                    <>
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
                    </>
                  )}

                  {/* 系统音频模式 */}
                  {audioSource === 'system' && (
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                        <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                        </svg>
                      </div>
                      <div className="text-sm text-[#9090a8] leading-relaxed space-y-2">
                        <p className="font-medium text-purple-400">使用 VB-Cable 捕获系统音频</p>
                        <ol className="text-xs text-left space-y-1 list-decimal list-inside">
                          <li>点击上方切换到<strong>麦克风</strong>模式</li>
                          <li>在浏览器弹窗中将麦克风选为 <strong>CABLE Output</strong></li>
                          <li>或将系统默认录音设备设为 CABLE Output</li>
                          <li>点击麦克风按钮即可识别腾讯会议声音</li>
                        </ol>
                      </div>
                      <p className="text-xs text-[#9090a8]/50">
                        VB-Cable 已安装？切换回麦克风模式即可使用
                      </p>
                    </div>
                  )}
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
