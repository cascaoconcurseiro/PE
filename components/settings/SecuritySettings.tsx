import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Shield, Lock, History, Smartphone, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { useToast } from '../ui/Toast';
import { supabase } from '../../integrations/supabase/client';

export const SecuritySettings: React.FC = () => {
    const { settings, updateSecurity } = useSettings();
    const { addToast } = useToast();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            addToast('As senhas não coincidem!', 'error');
            return;
        }

        if (newPassword.length < 8) {
            addToast('A senha deve ter pelo menos 8 caracteres!', 'error');
            return;
        }

        setIsChangingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            addToast('Senha alterada com sucesso!', 'success');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            addToast(error.message || 'Erro ao alterar senha', 'error');
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleToggle2FA = async () => {
        const newValue = !settings.security.twoFactorEnabled;
        await updateSecurity({ twoFactorEnabled: newValue });
        addToast(
            newValue ? 'Autenticação de dois fatores ativada!' : 'Autenticação de dois fatores desativada!',
            'success'
        );
    };

    // Mock data for sessions and login history (in production, this would come from Supabase)
    const mockSessions = [
        {
            id: '1',
            device: 'Windows PC',
            browser: 'Chrome 120',
            location: 'São Paulo, BR',
            lastActive: new Date().toISOString(),
            isCurrent: true
        }
    ];

    const mockLoginHistory = [
        {
            id: '1',
            timestamp: new Date().toISOString(),
            device: 'Windows PC',
            location: 'São Paulo, BR',
            success: true
        },
        {
            id: '2',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            device: 'Android Phone',
            location: 'Rio de Janeiro, BR',
            success: true
        }
    ];

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* Password Change */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
                        <Lock className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Alterar Senha</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Mantenha sua conta segura.</p>
                    </div>
                </div>

                <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Senha Atual
                        </label>
                        <input
                            type="password"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white font-medium"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Nova Senha
                        </label>
                        <input
                            type="password"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white font-medium"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={8}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Confirmar Nova Senha
                        </label>
                        <input
                            type="password"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white font-medium"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={8}
                        />
                    </div>

                    <Button type="submit" disabled={isChangingPassword} className="w-full">
                        {isChangingPassword ? 'Alterando...' : 'Alterar Senha'}
                    </Button>
                </form>
            </Card>

            {/* Two-Factor Authentication */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <Shield className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Autenticação de Dois Fatores</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Camada extra de segurança.</p>
                    </div>
                </div>

                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 block">2FA</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            {settings.security.twoFactorEnabled ? 'Ativado' : 'Desativado'}
                        </span>
                    </div>
                    <button
                        onClick={handleToggle2FA}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${settings.security.twoFactorEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.security.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </Card>

            {/* Active Sessions */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl">
                        <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Sessões Ativas</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Dispositivos conectados à sua conta.</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {mockSessions.map((session) => (
                        <div
                            key={session.id}
                            className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700"
                        >
                            <div className="flex items-center gap-3">
                                <Smartphone className="w-5 h-5 text-slate-400" />
                                <div>
                                    <p className="font-bold text-slate-700 dark:text-slate-300">
                                        {session.device} - {session.browser}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {session.location}
                                        {session.isCurrent && <span className="ml-2 text-green-600 dark:text-green-400">(Atual)</span>}
                                    </p>
                                </div>
                            </div>
                            {!session.isCurrent && (
                                <Button variant="secondary" size="sm">
                                    Revogar
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </Card>

            {/* Login History */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                        <History className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Histórico de Login</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Últimas atividades de acesso.</p>
                    </div>
                </div>

                <div className="space-y-2">
                    {mockLoginHistory.map((login) => (
                        <div
                            key={login.id}
                            className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700"
                        >
                            <div className="flex items-center gap-3">
                                {login.success ? (
                                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                )}
                                <div>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {login.device}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {new Date(login.timestamp).toLocaleString('pt-BR')} • {login.location}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};
