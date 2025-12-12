import React from 'react';
import { Card } from '../ui/Card';
import { Eye, EyeOff, Users, BarChart, Download } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { useToast } from '../ui/Toast';

export const PrivacySettings: React.FC = () => {
    const { settings, updatePrivacy } = useSettings();
    const { addToast } = useToast();

    const handleToggle = async (key: keyof typeof settings.privacy, value: boolean) => {
        await updatePrivacy({ [key]: value });
        addToast('Configuração de privacidade atualizada!', 'success');
    };

    const handleExportPersonalData = () => {
        // This would export all user data for LGPD compliance
        addToast('Exportação de dados iniciada! Você receberá um email em breve.', 'info');
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-300">
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <Eye className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Visibilidade</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Controle o que é exibido.</p>
                    </div>
                </div>

                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 block">Ocultar Saldos</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            Esconder valores em telas compartilhadas
                        </span>
                    </div>
                    <button
                        onClick={() => handleToggle('hideBalanceInSharedScreens', !settings.privacy.hideBalanceInSharedScreens)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${settings.privacy.hideBalanceInSharedScreens ? 'bg-indigo-600' : 'bg-slate-200'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.privacy.hideBalanceInSharedScreens ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </Card>

            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                        <BarChart className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Dados Analíticos</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Ajude a melhorar o app.</p>
                    </div>
                </div>

                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 block">Compartilhar Analytics</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            Dados anônimos de uso
                        </span>
                    </div>
                    <button
                        onClick={() => handleToggle('shareAnalytics', !settings.privacy.shareAnalytics)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${settings.privacy.shareAnalytics ? 'bg-purple-600' : 'bg-slate-200'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.privacy.shareAnalytics ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </Card>

            <Card className="p-6 md:col-span-2">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Permissões Familiares</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Controle o que membros da família podem ver e editar.
                        </p>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Configure permissões individuais para cada membro da família. Por padrão, todos podem visualizar
                        transações compartilhadas, mas não podem editar configurações.
                    </p>
                    <div className="text-center py-4">
                        <p className="text-sm text-slate-400 italic">
                            Nenhum membro familiar configurado ainda.
                        </p>
                    </div>
                </div>
            </Card>

            <Card className="p-6 md:col-span-2">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                        <Download className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Seus Dados (LGPD)</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Exporte todos os seus dados pessoais.
                        </p>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        De acordo com a LGPD (Lei Geral de Proteção de Dados), você tem direito de solicitar uma cópia
                        completa de todos os seus dados armazenados. Clique no botão abaixo para iniciar a exportação.
                    </p>
                    <button
                        onClick={handleExportPersonalData}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Exportar Meus Dados
                    </button>
                </div>
            </Card>
        </div>
    );
};
