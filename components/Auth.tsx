import React, { useState, useEffect } from 'react';
import { UserProfile, SyncStatus } from '../types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Lock, Mail, User, ArrowRight, PiggyBank, AlertCircle, ShieldAlert } from 'lucide-react';

interface AuthProps {
    onLogin: (user: UserProfile) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: ''
    });

    // Check if a user is already registered locally
    useEffect(() => {
        const storedHash = localStorage.getItem('pdm_auth_hash');
        if (storedHash) {
            setIsLogin(true);
        } else {
            setIsLogin(false); // Force signup if no hash exists
        }
    }, []);

    // Simple SHA-256 hash function
    const hashPassword = async (password: string) => {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const hash = await hashPassword(formData.password);
            const storedHash = localStorage.getItem('pdm_auth_hash');

            if (isLogin) {
                if (!storedHash) {
                    setError('Nenhum usuário registrado neste dispositivo.');
                    setIsLoading(false);
                    return;
                }

                if (hash !== storedHash) {
                    setError('Senha incorreta.');
                    setIsLoading(false);
                    return;
                }

                // Login successful
                const storedName = localStorage.getItem('pdm_user_name') || 'Usuário Local';
                const storedEmail = localStorage.getItem('pdm_user_email') || formData.email;
                
                const user: UserProfile = {
                    id: 'local-user',
                    name: storedName,
                    email: storedEmail,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    syncStatus: SyncStatus.PENDING
                };
                onLogin(user);

            } else {
                // Registration (Signup)
                if (storedHash) {
                    if (!confirm('Já existe uma conta neste dispositivo. Criar uma nova substituirá a senha de acesso (mas manterá os dados). Deseja continuar?')) {
                        setIsLoading(false);
                        return;
                    }
                }

                if (formData.password.length < 4) {
                    setError('A senha deve ter pelo menos 4 caracteres.');
                    setIsLoading(false);
                    return;
                }

                // Save credentials locally
                localStorage.setItem('pdm_auth_hash', hash);
                localStorage.setItem('pdm_user_name', formData.name);
                localStorage.setItem('pdm_user_email', formData.email);

                const newUser: UserProfile = {
                    id: 'local-user',
                    name: formData.name,
                    email: formData.email,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    syncStatus: SyncStatus.PENDING
                };
                onLogin(newUser);
            }
        } catch (err) {
            setError('Erro ao processar autenticação.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute -top-20 -left-20 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-3xl shadow-2xl mb-4 transform rotate-3">
                        <PiggyBank className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Pé de Meia</h1>
                    <p className="text-slate-400 text-lg">Seu futuro financeiro começa aqui.</p>
                </div>

                {/* Security Disclaimer */}
                <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 backdrop-blur-sm">
                    <div className="flex gap-3">
                        <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-200">
                            <p className="font-bold mb-1 text-amber-100">Armazenamento Local (Offline)</p>
                            <p className="leading-relaxed opacity-90">
                                Seus dados são salvos apenas neste dispositivo e <strong>não são criptografados</strong>.
                                A senha abaixo serve apenas para restringir o acesso à interface.
                                <strong> Não utilize em computadores públicos.</strong>
                            </p>
                        </div>
                    </div>
                </div>

                <Card className="bg-white/95 backdrop-blur-xl border-none shadow-2xl">
                    <div className="mb-6 flex gap-4 border-b border-slate-200 pb-2">
                        <button
                            className={`flex-1 pb-2 text-sm font-bold transition-colors ${isLogin ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-800'}`}
                            onClick={() => { setIsLogin(true); setError(''); }}
                        >
                            Entrar
                        </button>
                        <button
                            className={`flex-1 pb-2 text-sm font-bold transition-colors ${!isLogin ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-800'}`}
                            onClick={() => { setIsLogin(false); setError(''); }}
                        >
                            Configurar Acesso
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isLogin && (
                            <div className="space-y-1 animate-in slide-in-from-top-2">
                                <label className="text-xs font-bold text-slate-700 uppercase">Nome</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                    <input
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-900 placeholder:text-slate-500"
                                        placeholder="Seu nome completo"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required={!isLogin}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 uppercase">E-mail (Identificação)</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                <input
                                    type="email"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-900 placeholder:text-slate-500"
                                    placeholder="seu@email.com"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    required={!isLogin} // Optional on login if we rely on stored hash only, but keeping it for consistency/identification
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-slate-700 uppercase">
                                    {isLogin ? 'Senha de Acesso' : 'Criar Senha de Acesso'}
                                </label>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                <input
                                    type="password"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-900 placeholder:text-slate-500"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-start gap-2 animate-in slide-in-from-top-2 whitespace-pre-wrap">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-14 text-base font-bold shadow-lg shadow-emerald-500/30 bg-emerald-600 hover:bg-emerald-700 mt-4 rounded-xl"
                            isLoading={isLoading}
                        >
                            {isLogin ? 'Desbloquear Acesso' : 'Criar Perfil Local'} <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                    </form>
                </Card>

                <p className="text-center text-slate-500 text-xs mt-8">
                    © 2024 Pé de Meia. Seus dados são armazenados localmente.
                </p>
            </div>
        </div>
    );
};