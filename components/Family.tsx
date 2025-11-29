import React, { useState } from 'react';
import { FamilyMember } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Plus, Users, User, Trash2 } from 'lucide-react';

interface FamilyProps {
    members: FamilyMember[];
    onAddMember: (member: Omit<FamilyMember, 'id'>) => void;
    onDeleteMember: (id: string) => void;
}

export const Family: React.FC<FamilyProps> = ({ members, onAddMember, onDeleteMember }) => {
    const [name, setName] = useState('');
    const [role, setRole] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onAddMember({ name: name.trim(), role: role.trim() });
            setName('');
            setRole('');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Minha Família</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">Gerencie os membros para dividir despesas.</p>
            </div>

            <Card title="Adicionar Membro">
                <form onSubmit={handleSubmit} className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                        <input
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ex: João"
                            required
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Parentesco (Opcional)</label>
                        <input
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400"
                            value={role}
                            onChange={e => setRole(e.target.value)}
                            placeholder="Ex: Cônjuge, Filho"
                        />
                    </div>
                    <Button type="submit" disabled={!name.trim()}><Plus className="w-4 h-4" /></Button>
                </form>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {members.length === 0 && (
                    <div className="col-span-2 text-center py-8 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-dashed rounded-xl border-slate-300 dark:border-slate-700">
                        Nenhum membro cadastrado. Adicione alguém para começar a compartilhar gastos.
                    </div>
                )}
                {members.map(member => (
                    <div key={member.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">{member.name}</h3>
                                {member.role && <p className="text-xs text-slate-600 dark:text-slate-400">{member.role}</p>}
                            </div>
                        </div>
                        <button onClick={() => onDeleteMember(member.id)} className="text-slate-400 hover:text-red-600 transition-colors p-2">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};