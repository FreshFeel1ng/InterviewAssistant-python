import { forwardRef } from 'react';

interface AnswerPanelProps {
  answers: Array<{ id: string; content: string }>;
  currentAnswer: string;
  status: string;
}

export const AnswerPanel = forwardRef<HTMLDivElement, AnswerPanelProps>(
  ({ answers, currentAnswer, status }, ref) => {
    return (
      <div className="bg-[#16161f] rounded-2xl border border-[#1e1e2e] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[#9090a8] uppercase tracking-wider">
            AI 回答建议
          </h3>
          {answers.length > 0 && (
            <span className="text-xs text-[#9090a8]">{answers.length} 条回答</span>
          )}
        </div>

        <div
          ref={ref}
          className="space-y-4 max-h-[500px] overflow-y-auto pr-2"
        >
          {/* 历史回答 */}
          {answers.map((answer, idx) => (
            <div
              key={answer.id}
              className="animate-fade-in bg-[#0a0a0f] rounded-xl border border-[#1e1e2e] p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-[#9090a8] font-mono">Q{idx + 1}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              </div>
              <p className="text-[#e4e4ef] leading-relaxed text-sm">{answer.content}</p>
            </div>
          ))}

          {/* 当前流式回答 */}
          {currentAnswer && status === 'speaking' && (
            <div className="animate-fade-in bg-gradient-to-r from-blue-500/5 to-transparent rounded-xl border border-blue-500/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-blue-400 font-mono">生成中...</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              </div>
              <p className="text-[#e4e4ef] leading-relaxed text-sm">
                {currentAnswer}
                <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-pulse align-middle" />
              </p>
            </div>
          )}

          {/* 空状态 */}
          {answers.length === 0 && !currentAnswer && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#1e1e2e] flex items-center justify-center">
                <svg className="w-8 h-8 text-[#9090a8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <p className="text-[#9090a8] text-sm">等待面试官提问，AI 将实时生成回答建议</p>
            </div>
          )}
        </div>
      </div>
    );
  }
);
