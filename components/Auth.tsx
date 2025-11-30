import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { PiggyBank, ShieldCheck, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, HardDrive } from 'lucide-react';
import { useToast } from './ui/Toast';

interface AuthProps {
    onLogin: (user: any) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { addToast } = useToast();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                addToast('Conta criada! Verifique seu e-mail para confirmar.', 'success');
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (err: any) {
            setError(err.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : err.message);
            addToast(err.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-500">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute -top-20 -left-20 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8 animate-in slide-in-from-top-10 duration-500">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-3xl shadow-xl shadow-emerald-500/20 mb-4 transform rotate-3">
                        <PiggyBank className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Pé de Meia</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Gestão Financeira Inteligente</p>
                </div>

                <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="p-6">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 text-center">
                            {isSignUp ? 'Criar Nova Conta' : 'Acesse sua Conta'}
                        </h2>

                        {/* Security Disclaimer */}
                        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl flex items-start gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-full">
                                <HardDrive className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase mb-1">Armazenamento Local</p>
                                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                                    Seus dados financeiros são salvos <strong>apenas neste dispositivo</strong>.
                                    Não use computadores públicos, pois os dados não são criptografados no navegador.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleAuth} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">E-mail</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-slate-900 dark:text-white font-medium transition-all"
                                        placeholder="seu@email.com"
                                        autoComplete="username"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">Senha</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-slate-900 dark:text-white font-medium transition-all"
                                        placeholder="••••••••"
                                        autoComplete={isSignUp ? "new-password" : "current-password"}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            {!isSignUp && (
                                <div className="flex items-center justify-between pt-1">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${rememberMe ? 'bg-emerald-500 border-emerald-500' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'}`}>
                                            <input 
                                                type="checkbox" 
                                                className="hidden" 
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                            />
                                            {rememberMe && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        <span className="text-sm text-slate-600 dark:text-slate-300 font-medium group-hover:text-slate-800 dark:group-hover:text-white transition-colors">Lembrar de mim</span>
                                    </label>
                                    <button type="button" className="text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                                        Esqueceu a senha?
                                    </button>
                                </div>
                            )}

                            {error && (
                                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 flex items-start gap-2 text-red-600 dark:text-red-400 text-sm">
                                    <AlertCircle className="w-5 h-5 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <Button 
                                type="submit" 
                                className="w-full h-12 text-base shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        {isSignUp ? 'Criando...' : 'Entrando...'}
                                    </>
                                ) : (
                                    isSignUp ? 'Criar Conta' : 'Entrar'
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                {isSignUp ? 'Já tem uma conta?' : 'Não tem uma conta?'}
                                <button 
                                    onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                                    className="ml-1 font-bold text-emerald-600 dark:text-emerald-400 hover:underline outline-none"
                                >
                                    {isSignUp ? 'Fazer Login' : 'Cadastre-se'}
                                </button>
                            </p>
                        </div>
                    </div>
                </Card>

                <div className="flex items-center justify-center gap-2 mt-8 text-slate-400 dark:text-slate-500 text-xs">
                    <ShieldCheck className="w-4 h-4" />
                    <p>Ambiente Local Seguro</p>
                </div>
            </div>
        </div>
    );
};