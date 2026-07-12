interface StatusIndicatorProps {
  status: 'idle' | 'listening' | 'thinking' | 'speaking';
  isConnected: boolean;
}

const statusConfig = {
  idle: { label: '待命中', color: 'bg-gray-500', dot: 'bg-gray-400' },
  listening: { label: '聆听中', color: 'bg-green-500/10 text-green-400', dot: 'bg-green-400 animate-pulse' },
  thinking: { label: '思考中', color: 'bg-yellow-500/10 text-yellow-400', dot: 'bg-yellow-400 animate-pulse' },
  speaking: { label: '生成中', color: 'bg-blue-500/10 text-blue-400', dot: 'bg-blue-400 animate-pulse' },
};

export function StatusIndicator({ status, isConnected }: StatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${config.color}`}>
        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
        {config.label}
      </div>
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} title={isConnected ? '已连接' : '未连接'} />
    </div>
  );
}
