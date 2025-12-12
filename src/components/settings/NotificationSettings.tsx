import React from 'react';
import { Card } from '../ui/Card';
import { Bell, Clock } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { useToast } from '../ui/Toast';

export const NotificationSettings: React.FC = () => {
    const { settings, updateNotifications } = useSettings();
    const { addToast } = useToast();

    const handleToggle = async (key: keyof typeof settings.notifications, value: boolean) => {
        await updateNotifications({ [key]: value });
        addToast('Configuração de notificação atualizada!', 'success');
    };

    const handleReminderDaysChange = async (days: number) => {
        await updateNotifications({ reminderDaysBefore: days });
        addToast('Antecedência de alertas atualizada!', 'success');
    };

    const handleTimeChange = async (time: string) => {
        await updateNotifications({ preferredNotificationTime: time });
        addToast('Horário preferido atualizado!', 'success');
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-300">
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
                        <Bell className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Tipos de Notificação</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Escolha quais alertas receber.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div>
                            <span className="font-bold text-slate-700 dark:text-slate-300 block">Lembretes de Vencimento</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Alertas de contas a vencer</span>
                        </div>
                        <button
                            onClick={() => handleToggle('enableBillReminders', !settings.notifications.enableBillReminders)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${settings.notifications.enableBillReminders ? 'bg-amber-600' : 'bg-slate-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.notifications.enableBillReminders ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div>
                            <span className="font-bold text-slate-700 dark:text-slate-300 block">Alertas de Orçamento</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Notificar quando exceder orçamento</span>
                        </div>
                        <button
                            onClick={() => handleToggle('enableBudgetAlerts', !settings.notifications.enableBudgetAlerts)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${settings.notifications.enableBudgetAlerts ? 'bg-amber-600' : 'bg-slate-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.notifications.enableBudgetAlerts ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div>
                            <span className="font-bold text-slate-700 dark:text-slate-300 block">Lembretes de Metas</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Alertas sobre progresso de metas</span>
                        </div>
                        <button
                            onClick={() => handleToggle('enableGoalReminders', !settings.notifications.enableGoalReminders)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${settings.notifications.enableGoalReminders ? 'bg-amber-600' : 'bg-slate-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.notifications.enableGoalReminders ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
            </Card>

            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Configurações de Tempo</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Quando e como receber alertas.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Antecedência de Alertas
                        </label>
                        <select
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium transition-all"
                            value={settings.notifications.reminderDaysBefore}
                            onChange={(e) => handleReminderDaysChange(Number(e.target.value))}
                        >
                            <option value={1}>1 dia antes</option>
                            <option value={3}>3 dias antes</option>
                            <option value={7}>7 dias antes</option>
                            <option value={15}>15 dias antes</option>
                        </select>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            Você será notificado com essa antecedência sobre vencimentos
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Horário Preferido
                        </label>
                        <input
                            type="time"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium transition-all"
                            value={settings.notifications.preferredNotificationTime}
                            onChange={(e) => handleTimeChange(e.target.value)}
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            Horário preferido para receber notificações diárias
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
};
