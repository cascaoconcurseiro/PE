import React, { useState } from 'react';
import { FamilyMember } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Plus, Users, User, Trash2, Mail, Pencil, X, Check } from 'lucide-react';

interface FamilyProps {
    members: FamilyMember[];
    onAddMember: (member: Omit<FamilyMember, 'id'>) => void;
    onUpdateMember: (member: FamilyMember) => void;
    onDeleteMember: (id: string) => void;
}

export const Family: React.FC<FamilyProps> = ({ members, onAddMember, onUpdateMember, onDeleteMember }) => {
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [email, setEmail] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        if (editingId) {
            // Update existing
            onUpdateMember({
                id: editingId,
                name: name.trim(),
                role: role.trim(),
                email: email.trim() || undefined
            });
            setEditingId(null);
        } else {
            // Add new
            onAddMember({
                name: name.trim(),
                role: role.trim(),
                email: email.trim() || undefined
            });
        }

        // Reset form
        setName('');
        setRole('');
        setEmail('');
    };

    const handleEdit = (member: FamilyMember) => {
        setName(member.name);
        setRole(member.role || '');
        setEmail(member.email || '');
        setEditingId(member.id);
    };

    const handleCancelEdit = () => {
        setName('');
        setRole('');
        setEmail('');
        setEditingId(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Minha Família</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">Gerencie os membros para dividir despesas.</p>
            </div>

            <Card title={editingId ? "Editar Membro" : "Adicionar Membro"}>
                <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                        <input
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ex: João"
                            required
                        />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Parentesco (Opcional)</label>
                        <input
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400"
                            value={role}
                            onChange={e => setRole(e.target.value)}
                            placeholder="Ex: Cônjuge"
                        />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Email (Para convites)</label>
                        <div className="relative">
                            <input
                                type="email"
                                className="w-full pl-9 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="email@exemplo.com"
                            />
                            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {editingId && (
                            <Button type="button" variant="secondary" onClick={handleCancelEdit} title="Cancelar Edição">
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                        <Button type="submit" disabled={!name.trim()}>
                            {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </Button>
                    </div>
                </form>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {members.length === 0 && (
                    <div className="col-span-2 text-center py-8 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-dashed rounded-xl border-slate-300 dark:border-slate-700">
                        Nenhum membro cadastrado. Adicione alguém para começar a compartilhar gastos.
                    </div>
                )}
                {members.map(member => (
                    <div key={member.id} className={`bg-white dark:bg-slate-800 p-4 rounded-xl border shadow-sm flex justify-between items-center hover:shadow-md transition-all ${editingId === member.id ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200 dark:border-slate-700'}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">{member.name}</h3>
                                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                    {member.role && <span>{member.role}</span>}
                                    {member.role && member.email && <span>•</span>}
                                    {member.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {member.email}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => handleEdit(member)} className="text-slate-400 hover:text-indigo-600 transition-colors p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900" title="Editar">
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => onDeleteMember(member.id)} className="text-slate-400 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900" title="Excluir">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};