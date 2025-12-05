import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Type, Layout, Palette } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { useToast } from '../ui/Toast';

export const AppearanceSettings: React.FC = () => {
    const { settings, updateAppearance } = useSettings();
    const { addToast } = useToast();
    const [selectedCategory, setSelectedCategory] = useState<string>('');

    const handleFontSizeChange = async (fontSize: 'small' | 'medium' | 'large') => {
        await updateAppearance({ fontSize });
        addToast('Tamanho de fonte atualizado!', 'success');

        // Apply font size to root element
        const root = document.documentElement;
        root.style.fontSize = fontSize === 'small' ? '14px' : fontSize === 'large' ? '18px' : '16px';
    };

    const handleDensityChange = async (density: 'compact' | 'comfortable' | 'spacious') => {
        await updateAppearance({ density });
        addToast('Densidade atualizada!', 'success');

        // Apply density class to root element
        const root = document.documentElement;
        root.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
        root.classList.add(`density-${density}`);
    };

    const handleColorChange = async (category: string, color: string) => {
        const newColors = { ...settings.appearance.customCategoryColors, [category]: color };
        await updateAppearance({ customCategoryColors: newColors });
        addToast(`Cor da categoria "${category}" atualizada!`, 'success');
    };

    const categories = [
        'Moradia', 'Alimentação', 'Transporte', 'Contas e Utilidades',
        'Viagem', 'Compras', 'Lazer', 'Saúde', 'Educação'
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-300">
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                        <Type className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Tamanho de Fonte</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Ajuste a legibilidade.</p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <button
                        onClick={() => handleFontSizeChange('small')}
                        className={`px-4 py-3 rounded-xl font-bold transition-all ${settings.appearance.fontSize === 'small'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                    >
                        <span className="text-xs">Pequeno</span>
                    </button>
                    <button
                        onClick={() => handleFontSizeChange('medium')}
                        className={`px-4 py-3 rounded-xl font-bold transition-all ${settings.appearance.fontSize === 'medium'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                    >
                        <span className="text-sm">Médio</span>
                    </button>
                    <button
                        onClick={() => handleFontSizeChange('large')}
                        className={`px-4 py-3 rounded-xl font-bold transition-all ${settings.appearance.fontSize === 'large'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                    >
                        <span className="text-base">Grande</span>
                    </button>
                </div>

                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Preview: Este é um exemplo de texto com o tamanho selecionado.
                    </p>
                </div>
            </Card>

            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                        <Layout className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Densidade</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Espaçamento entre elementos.</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => handleDensityChange('compact')}
                        className={`w-full px-4 py-2 rounded-xl font-bold transition-all text-left ${settings.appearance.density === 'compact'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                    >
                        Compacto
                        <span className="block text-xs opacity-75">Mais informação em menos espaço</span>
                    </button>
                    <button
                        onClick={() => handleDensityChange('comfortable')}
                        className={`w-full px-4 py-3 rounded-xl font-bold transition-all text-left ${settings.appearance.density === 'comfortable'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                    >
                        Confortável
                        <span className="block text-xs opacity-75">Equilíbrio entre espaço e informação</span>
                    </button>
                    <button
                        onClick={() => handleDensityChange('spacious')}
                        className={`w-full px-4 py-4 rounded-xl font-bold transition-all text-left ${settings.appearance.density === 'spacious'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                    >
                        Espaçoso
                        <span className="block text-xs opacity-75">Mais espaço, mais respiração</span>
                    </button>
                </div>
            </Card>

            <Card className="p-6 md:col-span-2">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-xl">
                        <Palette className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Cores de Categorias</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Personalize as cores das suas categorias.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map((category) => (
                        <div
                            key={category}
                            className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700"
                        >
                            <input
                                type="color"
                                className="w-10 h-10 rounded-lg cursor-pointer border-2 border-slate-300 dark:border-slate-600"
                                value={settings.appearance.customCategoryColors[category] || '#6366f1'}
                                onChange={(e) => handleColorChange(category, e.target.value)}
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {category}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        💡 <strong>Dica:</strong> As cores personalizadas serão aplicadas em gráficos, relatórios e
                        visualizações de transações.
                    </p>
                </div>
            </Card>
        </div>
    );
};
