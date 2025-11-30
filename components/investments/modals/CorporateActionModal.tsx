import React, { useState } from 'react';
import { Asset, AssetType } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Percent, Divide, Plus } from 'lucide-react';

interface CorporateActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (type: 'SPLIT' | 'INPLIT' | 'BONUS', factor: number, cost?: number) => void;
    asset: Asset | null;
}

export const CorporateActionModal: React.FC<CorporateActionModalProps> = ({ isOpen, onClose, onSave, asset }) => {
    const [type, setType] = useState<'SPLIT' | 'INPLIT' | 'BONUS'>('SPLIT');
    const [factor, setFactor] = useState('1');
    const [cost, setCost] = useState('0'); // For Bonus shares cost basis

    if (!asset) return null;

    const handleSave = () => {
        const f = parseFloat(factor);
        const c = parseFloat(cost);
        if (isNaN(f) || f <= 0) return;
        onSave(type, f, c);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Evento Corporativo: ${asset.ticker}`}>
            <div className="space-y-6">
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        onClick={() => setType('SPLIT')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex flex-col items-center gap-1 transition-all ${type === 'SPLIT' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        <Divide className="w-4 h-4" /> Desdobramento (Split)
                    </button>
                    <button
                        onClick={() => setType('INPLIT')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex flex-col items-center gap-1 transition-all ${type === 'INPLIT' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        <Percent className="w-4 h-4" /> Grupamento (Inplit)
                    </button>
                    <button
                        onClick={() => setType('BONUS')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex flex-col items-center gap-1 transition-all ${type === 'BONUS' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        <Plus className="w-4 h-4" /> Bonificação
                    </button>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl text-sm text-slate-600 dark:text-slate-400">
                    {type === 'SPLIT' && (
                        <p>Aumenta a quantidade de ações e reduz o preço médio proporcionalmente. Ex: Split 1:2 (Fator 2) dobra a quantidade e divide o preço por 2.</p>
                    )}
                    {type === 'INPLIT' && (
                        <p>Reduz a quantidade de ações e aumenta o preço médio proporcionalmente. Ex: Inplit 2:1 (Fator 2) divide a quantidade por 2 e dobra o preço.</p>
                    )}
                    {type === 'BONUS' && (
                        <p>Recebimento de novas ações gratuitamente (ou com custo atribuído). Aumenta a quantidade e ajusta o preço médio.</p>
                    )}
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {type === 'BONUS' ? 'Quantidade Recebida (Proporção %)' : 'Fator de Ajuste'}
                        </label>
                        <Input
                            type="number"
                            value={factor}
                            onChange={e => setFactor(e.target.value)}
                            placeholder={type === 'BONUS' ? "Ex: 10 (para 10%)" : "Ex: 2 (para 1:2)"}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            {type === 'SPLIT' && `Quantidade atual (${asset.quantity}) será multiplicada por ${factor}.`}
                            {type === 'INPLIT' && `Quantidade atual (${asset.quantity}) será dividida por ${factor}.`}
                            {type === 'BONUS' && `Receberá ${((parseFloat(factor) / 100) * asset.quantity).toFixed(2)} novas ações (se for %).`}
                        </p>
                    </div>

                    {type === 'BONUS' && (
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Custo de Aquisição Total (Opcional)
                            </label>
                            <Input
                                type="number"
                                value={cost}
                                onChange={e => setCost(e.target.value)}
                                placeholder="R$ 0,00"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Se houver custo atribuído para fins fiscais, informe aqui.
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave}>Aplicar Ajuste</Button>
                </div>
            </div>
        </Modal>
    );
};
