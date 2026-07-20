import { useState } from 'react';

export function SystemAudioGuide() {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
            </div>
            <p className="text-sm font-medium">捕获系统音频</p>
            <p className="text-xs text-[#9090a8]">
                用于识别腾讯会议等视频面试的声音
            </p>

            <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 mx-auto"
            >
                {expanded ? '收起教程 ▲' : '展开教程 ▼'}
            </button>

            {expanded && (
                <div className="text-left space-y-4 pt-2 border-t border-[#1e1e2e]">

                    {/* 准备工作 */}
                    <div>
                        <h4 className="text-xs font-medium text-[#e4e4ef] mb-2 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 text-[10px] flex items-center justify-center font-bold">1</span>
                            安装 VB-Cable
                        </h4>
                        <p className="text-[11px] text-[#9090a8] leading-relaxed ml-5.5">
                            下载 <a href="https://vb-audio.com/Cable/" target="_blank" className="text-purple-400 hover:underline">VB-Cable</a>，解压后右键
                            <code className="px-1 py-0.5 bg-[#0a0a0f] rounded text-[10px]">VBCABLE_Setup_x64.exe</code>
                            以管理员身份运行 → Install Driver → 重启电脑
                        </p>
                    </div>

                    {/* 腾讯会议设置 */}
                    <div>
                        <h4 className="text-xs font-medium text-[#e4e4ef] mb-2 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 text-[10px] flex items-center justify-center font-bold">2</span>
                            腾讯会议设置
                        </h4>
                        <p className="text-[11px] text-[#9090a8] leading-relaxed ml-5.5">
                            进入会议后点击左下角设置 → 音频 → 扬声器选<br/>
                            <code className="px-1.5 py-0.5 bg-[#0a0a0f] rounded text-[10px] text-[#e4e4ef]">CABLE Input (VB-Audio Virtual Cable)</code>
                        </p>
                    </div>

                    {/* 系统声音设置 */}
                    <div>
                        <h4 className="text-xs font-medium text-[#e4e4ef] mb-2 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 text-[10px] flex items-center justify-center font-bold">3</span>
                            系统声音设置（听得到声音）
                        </h4>
                        <div className="text-[11px] text-[#9090a8] leading-relaxed ml-5.5 space-y-1">
                            <p>Win+R → 输入 <code className="px-1 py-0.5 bg-[#0a0a0f] rounded text-[10px]">mmsys.cpl</code> → 录制标签页</p>
                            <p>找到 <code className="px-1 py-0.5 bg-[#0a0a0f] rounded text-[10px] text-[#e4e4ef]">CABLE Output</code> → 右键 → 属性</p>
                            <p>切换到<strong className="text-[#e4e4ef]">侦听</strong>标签页</p>
                            <p>勾选 ☑ <strong className="text-[#e4e4ef]">侦听此设备</strong></p>
                            <p>下拉框选你的真实耳机/扬声器</p>
                            <p>点击确定</p>
                            <p className="text-[#9090a8]/60 mt-1">💡 这步让你既能听到声音，程序也能捕获</p>
                        </div>
                    </div>

                    {/* 浏览器设置 */}
                    <div>
                        <h4 className="text-xs font-medium text-[#e4e4ef] mb-2 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 text-[10px] flex items-center justify-center font-bold">4</span>
                            浏览器麦克风设置
                        </h4>
                        <div className="text-[11px] text-[#9090a8] leading-relaxed ml-5.5 space-y-1">
                            <p>切回上方<strong className="text-[#e4e4ef]">麦克风</strong>标签</p>
                            <p>点击麦克风按钮 → 浏览器弹窗时</p>
                            <p>将麦克风选为 <strong className="text-[#e4e4ef]">CABLE Output</strong></p>
                            <p className="text-[#9090a8]/60 mt-1">💡 也可在系统声音设置的录制标签页，将 CABLE Output 设为默认设备</p>
                        </div>
                    </div>

                    {/* 原理说明 */}
                    <div className="text-[10px] text-[#9090a8]/50 leading-relaxed pt-2 border-t border-[#1e1e2e]">
                        <p className="mb-1"><strong>原理：</strong>VB-Cable 是一根虚拟音频线。</p>
                        <p>腾讯会议 → CABLE Input（线这头）</p>
                        <p>浏览器 ← CABLE Output（线那头）</p>
                        <p>侦听 = 线里的声音复制一份给你听</p>
                    </div>
                </div>
            )}
        </div>
    );
}
