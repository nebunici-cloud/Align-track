import React, { useState } from 'react';
import { User, Plus, Check, Trash2, Edit3, Layers, Sparkles, UserCheck, ChevronRight, X } from 'lucide-react';
import { UserProfile, AlignerSettings } from '../types';

interface AccountSwitcherModalProps {
  isOpen: boolean;
  accounts: UserProfile[];
  currentAccountId: string;
  onClose: () => void;
  onSelectAccount: (id: string) => void;
  onCreateNewPlan: () => void;
  onDeleteAccount: (id: string) => void;
  onUpdateAccountProfile: (updatedProfile: UserProfile) => void;
}

export const AccountSwitcherModal: React.FC<AccountSwitcherModalProps> = ({
  isOpen,
  accounts,
  currentAccountId,
  onClose,
  onSelectAccount,
  onCreateNewPlan,
  onDeleteAccount,
  onUpdateAccountProfile,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editPlanType, setEditPlanType] = useState<string>('');

  if (!isOpen) return null;

  const startEdit = (acc: UserProfile) => {
    setEditingId(acc.id);
    setEditName(acc.name);
    setEditPlanType(acc.planType);
  };

  const saveEdit = (acc: UserProfile) => {
    onUpdateAccountProfile({
      ...acc,
      name: editName.trim() || acc.name,
      planType: editPlanType.trim() || acc.planType,
    });
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Patient Accounts & Plans</h3>
              <p className="text-xs text-slate-400">Switch or manage active treatment profiles</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Accounts List */}
        <div className="space-y-2.5">
          {accounts.map((acc) => {
            const isActive = acc.id === currentAccountId;
            const isEditing = editingId === acc.id;

            return (
              <div
                key={acc.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isActive
                    ? 'bg-slate-800/90 border-teal-500/50 shadow-md shadow-teal-500/5 ring-1 ring-teal-500/20'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">Profile Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg p-2 text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">Plan Brand</label>
                      <input
                        type="text"
                        value={editPlanType}
                        onChange={(e) => setEditPlanType(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg p-2 text-xs outline-none"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 bg-slate-800 text-slate-400 hover:text-slate-200 rounded-md text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(acc)}
                        className="px-3 py-1 bg-teal-500 text-slate-950 hover:bg-teal-400 rounded-md text-xs font-bold"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                      onClick={() => {
                        onSelectAccount(acc.id);
                        onClose();
                      }}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${acc.avatarColor || 'from-teal-500 to-cyan-400'} flex items-center justify-center text-slate-950 font-bold shrink-0 shadow-md ring-1 ring-white/20`}
                      >
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100 text-xs truncate">{acc.name}</span>
                          {isActive && (
                            <span className="px-1.5 py-0.5 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded text-[10px] font-bold">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block truncate">{acc.planType}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(acc)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 rounded-lg transition-colors"
                        title="Edit profile"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {accounts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete profile "${acc.name}"?`)) {
                              onDeleteAccount(acc.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded-lg transition-colors"
                          title="Delete account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onCreateNewPlan();
            }}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-500 to-cyan-400 hover:from-teal-400 hover:to-cyan-300 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-teal-500/10"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Set Up New Individual Plan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
