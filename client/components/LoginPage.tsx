import { useState } from 'react';

interface LoginPageProps {
    onLogin: (token: string, username: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!username || !password) {
            setError('请填写用户名和密码');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.detail || '操作失败');
                return;
            }

            if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', data.user.username);
                onLogin(data.token, data.user.username);
            }
        } catch (err: any) {
            setError('网络错误: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSubmit();
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
                        AI
                    </div>
                    <h1 className="text-xl font-semibold text-[#e4e4ef]">Interview Assistant</h1>
                    <p className="text-sm text-[#9090a8] mt-1">AI 面试助手</p>
                </div>

                {/* Form */}
                <div className="bg-[#16161f] rounded-2xl border border-[#1e1e2e] p-6">
                    {/* 切换 */}
                    <div className="flex gap-2 bg-[#0a0a0f] rounded-lg p-1 mb-5">
                        <button
                            onClick={() => { setMode('login'); setError(''); }}
                            className={`flex-1 py-2 rounded-md text-sm transition-all ${
                                mode === 'login'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'text-[#9090a8] hover:text-white'
                            }`}
                        >
                            登录
                        </button>
                        <button
                            onClick={() => { setMode('register'); setError(''); }}
                            className={`flex-1 py-2 rounded-md text-sm transition-all ${
                                mode === 'register'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'text-[#9090a8] hover:text-white'
                            }`}
                        >
                            注册
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-[#9090a8] mb-1.5">用户名</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="请输入用户名"
                                className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-[#e4e4ef] placeholder-[#9090a8]/50 focus:outline-none focus:border-blue-500/50 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-[#9090a8] mb-1.5">密码</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={mode === 'register' ? '不少于6位' : '请输入密码'}
                                className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-[#e4e4ef] placeholder-[#9090a8]/50 focus:outline-none focus:border-blue-500/50 transition-colors"
                            />
                        </div>

                        {error && (
                            <div className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? '请稍候...' : mode === 'login' ? '登录' : '注册'}
                        </button>
                    </div>
                </div>

                <p className="text-center text-xs text-[#9090a8]/50 mt-6">
                    Powered by LangChain + DeepSeek
                </p>
            </div>
        </div>
    );
}
