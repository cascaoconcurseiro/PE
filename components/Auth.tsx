import React, { useState } from 'react';
import { UserProfile, SyncStatus } from '../types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Lock, Mail, User, ArrowRight, PiggyBank, AlertCircle } from 'lucide-react';

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Simulate login/signup delay
        setTimeout(() => {
            setIsLoading(false);
            // Mock user for local-first app
            const mockUser: UserProfile = {
                id: 'local-user',
                name: formData.name || 'Usuário Local',
                email: formData.email,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                syncStatus: SyncStatus.PENDING
            };
            onLogin(mockUser);
        }, 1000);
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
                            Criar Conta
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
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 uppercase">E-mail</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                <input
                                    type="email"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-900 placeholder:text-slate-500"
                                    placeholder="seu@email.com"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-slate-700 uppercase">Senha</label>
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
                            {isLogin ? 'Acessar Meu Pé de Meia' : 'Criar Meu Pé de Meia'} <ArrowRight className="w-5 h-5 ml-2" />
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
