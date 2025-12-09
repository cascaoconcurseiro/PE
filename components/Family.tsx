import React, { useState } from 'react';
import { FamilyMember } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Plus, Users, User, Trash2, Mail, Pencil, X, Check, Loader2, UserCheck, UserX } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

interface FamilyProps {
    members: FamilyMember[];
    onAddMember: (member: Partial<FamilyMember>) => void;
    onUpdateMember: (member: FamilyMember) => void;
    onDeleteMember: (id: string) => void;
    onInviteMember?: (memberId: string, email: string) => Promise<void>;
}

export const Family: React.FC<FamilyProps> = ({ members, onAddMember, onUpdateMember, onDeleteMember, onInviteMember }) => {
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [email, setEmail] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    // Email Check State
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);
    const [emailCheckStatus, setEmailCheckStatus] = useState<'IDLE' | 'FOUND' | 'NOT_FOUND'>('IDLE');
    const [lastCheckedEmail, setLastCheckedEmail] = useState('');
    const [foundUserId, setFoundUserId] = useState<string | null>(null);

    const checkEmail = async (emailToCheck: string) => {
        const cleanEmail = emailToCheck.trim();
        if (!cleanEmail || cleanEmail === lastCheckedEmail) return;

        setIsCheckingEmail(true);
        setLastCheckedEmail(cleanEmail);
        try {
            const { data: inviteeId } = await supabase.rpc('check_user_by_email', { email_to_check: cleanEmail });
            if (inviteeId) {
                setEmailCheckStatus('FOUND');
                setFoundUserId(inviteeId);
            } else {
                setEmailCheckStatus('NOT_FOUND');
                setFoundUserId(null);
            }
        } catch (error) {
            console.error("Error checking email:", error);
            setEmailCheckStatus('NOT_FOUND');
        } finally {
            setIsCheckingEmail(false);
        }
    };

    const handleEmailBlur = () => {
        if (email && email.includes('@')) {
            checkEmail(email);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        const currentEmail = email.trim() || undefined;
        let finalMemberId = editingId;
        let shouldInvite = false;

        // Check for invite if email is present and changed (or new)
        if (currentEmail && onInviteMember) {
            let inviteeId = foundUserId;

            // If not checked yet or changed since last check (rare edge case if typing fast then enter)
            if (currentEmail !== lastCheckedEmail) {
                const { data } = await supabase.rpc('check_user_by_email', { email_to_check: currentEmail });
                inviteeId = data;
            }

            if (inviteeId) {
                const confirmInvite = window.confirm(`O usuário com e-mail ${currentEmail} foi encontrado no sistema.\n\nDeseja enviar uma solicitação para compartilhar todas as despesas vinculadas a este membro?`);
                if (confirmInvite) {
                    shouldInvite = true;
                }
            }
        }

        if (editingId) {
            // Update existing
            onUpdateMember({
                id: editingId,
                name: name.trim(),
                role: role.trim(),
                email: currentEmail
            });
        } else {
            // Add new - generate ID here if inviting, so we can link it
            finalMemberId = crypto.randomUUID();
            onAddMember({
                id: finalMemberId,
                name: name.trim(),
                role: role.trim(),
                email: currentEmail
            });
        }

        if (shouldInvite && finalMemberId && currentEmail && onInviteMember) {
            await onInviteMember(finalMemberId, currentEmail);
        }

        // Reset form
        setName('');
        setRole('');
        setEmail('');
        setEditingId(null);
        setEmailCheckStatus('IDLE');
        setLastCheckedEmail('');
        setFoundUserId(null);
    };

    const handleEdit = (member: FamilyMember) => {
        setName(member.name);
        setRole(member.role || '');
        setEmail(member.email || '');
        setEditingId(member.id);
        // Reset check state on edit start to force re-check if they touch it
        setEmailCheckStatus('IDLE');
        setLastCheckedEmail('');
        setFoundUserId(null);
    };

    const handleCancelEdit = () => {
        setName('');
        setRole('');
        setEmail('');
        setEditingId(null);
        setEmailCheckStatus('IDLE');
        setLastCheckedEmail('');
        setFoundUserId(null);
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
                                className={`w-full pl-9 pr-9 px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg focus:ring-2 outline-none text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 transition-colors ${emailCheckStatus === 'FOUND' ? 'border-emerald-500 ring-1 ring-emerald-500' : emailCheckStatus === 'NOT_FOUND' ? 'border-amber-300' : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500'}`}
                                value={email}
                                onChange={e => {
                                    setEmail(e.target.value);
                                    if (e.target.value !== lastCheckedEmail) setEmailCheckStatus('IDLE');
                                }}
                                onBlur={handleEmailBlur}
                                placeholder="email@exemplo.com"
                            />
                            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

                            {/* Status Indicator */}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {isCheckingEmail && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />}
                                {!isCheckingEmail && emailCheckStatus === 'FOUND' && <UserCheck className="w-4 h-4 text-emerald-600" aria-label="Usuário encontrado" />}
                                {!isCheckingEmail && emailCheckStatus === 'NOT_FOUND' && email && <UserX className="w-4 h-4 text-amber-500" aria-label="Usuário não encontrado" />}
                            </div>
                        </div>
                        {/* Feedback Text */}
                        {emailCheckStatus === 'FOUND' && !isCheckingEmail && (
                            <p className="text-[10px] text-emerald-600 font-bold mt-1 px-1">✓ Usuário do App encontrado!</p>
                        )}
                        {emailCheckStatus === 'NOT_FOUND' && !isCheckingEmail && email && (
                            <p className="text-[10px] text-amber-600 mt-1 px-1">⚠️ Usuário não possui conta no App ainda</p>
                        )}
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
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