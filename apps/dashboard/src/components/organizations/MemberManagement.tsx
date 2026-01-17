'use client';

import { useAddMember, useRemoveMember, useUpdateMember } from '@/hooks/useOrganizations';
import { Trash2, User as UserIcon, UserPlus } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmationModal, Organization, Role } from 'shared-ui';

interface MemberManagementProps {
  organization: Organization;
}

export default function MemberManagement({ organization }: MemberManagementProps) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>(Role.MEMBER);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);

  const addMemberMutation = useAddMember();
  const updateMemberMutation = useUpdateMember();
  const removeMemberMutation = useRemoveMember();

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addMemberMutation.mutateAsync({
        orgId: organization.id,
        userId: inviteUserId,
        role: inviteRole,
      });
      toast.success('Member added successfully');
      setInviteUserId('');
      setIsInviteOpen(false);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to add member');
    }
  };

  const handleUpdateRole = async (userId: string, role: Role) => {
    try {
      await updateMemberMutation.mutateAsync({
        orgId: organization.id,
        userId,
        role,
      });
      toast.success('Role updated');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update role');
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      await removeMemberMutation.mutateAsync({
        orgId: organization.id,
        userId: memberToRemove,
      });
      toast.success('Member removed');
      setMemberToRemove(null);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to remove member');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Members</h2>
        <button
          onClick={() => setIsInviteOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-medium transition-all shadow-lg hover:-translate-y-0.5"
        >
          <UserPlus size={18} />
          <span>Add Member</span>
        </button>
      </div>

      {isInviteOpen && (
        <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 animate-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-4">
            <div className="grow">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                User ID
              </label>
              <input
                type="text"
                value={inviteUserId}
                onChange={(e) => setInviteUserId(e.target.value)}
                placeholder="Enter user unique ID"
                className="w-full bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                required
              />
            </div>
            <div className="w-full md:w-32">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-2">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="w-full bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
              >
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
                <option value="DEVELOPER">Developer</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={addMemberMutation.isPending}
                className="px-6 py-2 bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {addMemberMutation.isPending ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-xl dark:shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/5">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {organization.members?.map((member) => (
                <tr key={member.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30">
                        {member.user.avatarUrl ? (
                          <Image
                            src={member.user.avatarUrl}
                            alt={member.user.username}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                            <UserIcon size={20} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-slate-900 dark:text-white font-semibold">{member.user.username}</div>
                        <div className="text-xs text-slate-500 font-mono">{member.userId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.userId, e.target.value as Role)}
                      className="bg-transparent text-slate-700 dark:text-slate-300 text-sm focus:outline-none cursor-pointer border-b border-slate-200 dark:border-white/10 hover:border-indigo-400 pb-0.5 transition-all"
                    >
                      <option value="OWNER">Owner</option>
                      <option value="ADMIN">Admin</option>
                      <option value="DEVELOPER">Developer</option>
                      <option value="MEMBER">Member</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setMemberToRemove(member.userId)}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Remove Member"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {memberToRemove && (
        <ConfirmationModal
          title="Remove Member"
          message="Are you sure you want to remove this member from the organization? This action cannot be undone."
          confirmLabel="Remove"
          onConfirm={handleRemoveMember}
          onCancel={() => setMemberToRemove(null)}
          isDanger
          isLoading={removeMemberMutation.isPending}
        />
      )}
    </div>
  );
}
