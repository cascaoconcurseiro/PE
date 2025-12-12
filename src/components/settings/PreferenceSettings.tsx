import React from 'react';
import { Card } from '../ui/Card';
import { Globe, Calendar, Clock, DollarSign } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { useToast } from '../ui/Toast';

export const PreferenceSettings: React.FC = () => {
    const { settings, updatePreferences } = useSettings();
    const { addToast } = useToast();

    const handleLanguageChange = async (language: 'pt-BR' | 'en-US' | 'es-ES') => {
        await updatePreferences({ language });
        addToast('Idioma atualizado!', 'success');
    };

    const handleDateFormatChange = async (dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD') => {
        await updatePreferences({ dateFormat });
        addToast('Formato de data atualizado!', 'success');
    };

    const handleTimeFormatChange = async (timeFormat: '12h' | '24h') => {
        await updatePreferences({ timeFormat });
        addToast('Formato de hora atualizado!', 'success');
    };

    const handleWeekStartChange = async (weekStartsOn: 'sunday' | 'monday') => {
        await updatePreferences({ weekStartsOn });
        addToast('Primeiro dia da semana atualizado!', 'success');
    };

    const handleCurrencyChange = async (currency: string) => {
        await updatePreferences({ defaultCurrency: currency });
        addToast('Moeda padrão atualizada!', 'success');
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-300">
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                        <Globe className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Idioma</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Escolha o idioma do sistema.</p>
                    </div>
                </div>

                <select
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium transition-all"
                    value={settings.preferences.language}
                    onChange={(e) => handleLanguageChange(e.target.value as any)}
                >
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es-ES">Español (España)</option>
                </select>
            </Card>

            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Formato de Data</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Como exibir datas.</p>
                    </div>
                </div>

                <select
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-slate-900 dark:text-white font-medium transition-all"
                    value={settings.preferences.dateFormat}
                    onChange={(e) => handleDateFormatChange(e.target.value as any)}
                >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
                </select>
            </Card>

            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Formato de Hora</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">12h ou 24h.</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => handleTimeFormatChange('24h')}
                        className={`px-4 py-3 rounded-xl font-bold transition-all ${settings.preferences.timeFormat === '24h'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                    >
                        24 horas
                    </button>
                    <button
                        onClick={() => handleTimeFormatChange('12h')}
                        className={`px-4 py-3 rounded-xl font-bold transition-all ${settings.preferences.timeFormat === '12h'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                    >
                        12 horas (AM/PM)
                    </button>
                </div>
            </Card>

            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Início da Semana</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Primeiro dia da semana.</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => handleWeekStartChange('monday')}
                        className={`px-4 py-3 rounded-xl font-bold transition-all ${settings.preferences.weekStartsOn === 'monday'
                            ? 'bg-orange-600 text-white shadow-lg'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                    >
                        Segunda-feira
                    </button>
                    <button
                        onClick={() => handleWeekStartChange('sunday')}
                        className={`px-4 py-3 rounded-xl font-bold transition-all ${settings.preferences.weekStartsOn === 'sunday'
                            ? 'bg-orange-600 text-white shadow-lg'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                    >
                        Domingo
                    </button>
                </div>
            </Card>

            <Card className="p-6 md:col-span-2">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Moeda Padrão</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Moeda usada ao criar novas contas.</p>
                    </div>
                </div>

                <select
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white font-medium transition-all"
                    value={settings.preferences.defaultCurrency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                >
                    <option value="BRL">Real Brasileiro (BRL - R$)</option>
                    <option value="USD">Dólar Americano (USD - $)</option>
                    <option value="EUR">Euro (EUR - €)</option>
                    <option value="GBP">Libra Esterlina (GBP - £)</option>
                    <option value="JPY">Iene Japonês (JPY - ¥)</option>
                    <option value="CAD">Dólar Canadense (CAD - C$)</option>
                    <option value="AUD">Dólar Australiano (AUD - A$)</option>
                    <option value="CHF">Franco Suíço (CHF - Fr)</option>
                    <option value="CNY">Yuan Chinês (CNY - ¥)</option>
                    <option value="ARS">Peso Argentino (ARS - $)</option>
                </select>
            </Card>

            {/* TROUBLESHOOTING / CACHE */}
            <Card className="p-6 md:col-span-2 border-red-200 dark:border-red-900 bg-red-50/10 dark:bg-red-900/5">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2">Solução de Problemas</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Versão Atual: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{new Date().toLocaleDateString()} (Build {Math.floor(Date.now() / 1000)})</span>
                </p>
                <button
                    onClick={async () => {
                        if (confirm('Isso irá recarregar a aplicação e limpar o cache do navegador. Deseja continuar?')) {
                            // Unregister Service Workers
                            if ('serviceWorker' in navigator) {
                                const registrations = await navigator.serviceWorker.getRegistrations();
                                for (const registration of registrations) {
                                    await registration.unregister();
                                }
                            }
                            // Clear Local/Session Storage (Optional, strictly we only need to clear SW and HTTP cache)
                            // localStorage.clear(); // CAREFUL: might wipe settings not synced.
                            // sessionStorage.clear();

                            // Force Reload ignoring cache
                            window.location.reload();
                        }
                    }}
                    className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all"
                >
                    Forçar Atualização (Limpar Cache)
                </button>
            </Card>
        </div>
    );
};
