interface TranscriptPanelProps {
  text: string;
  isListening: boolean;
}

export function TranscriptPanel({ text, isListening }: TranscriptPanelProps) {
  return (
    <div className="bg-[#16161f] rounded-2xl border border-[#1e1e2e] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[#9090a8] uppercase tracking-wider">
          实时转写
        </h3>
        {isListening && (
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      <div className="min-h-[80px] bg-[#0a0a0f] rounded-xl border border-[#1e1e2e] p-4">
        {text ? (
          <p className="text-[#e4e4ef] leading-relaxed animate-fade-in whitespace-pre-wrap">
            {text}
            {isListening && (
              <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-pulse align-middle" />
            )}
          </p>
        ) : (
          <p className="text-[#9090a8]/50 italic text-sm">
            {isListening ? '正在聆听面试官的问题...' : '等待语音输入...'}
          </p>
        )}
      </div>
    </div>
  );
}
