'use client';

import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileText,
  Globe,
  LogOut,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  API_BASE_URL,
  ConfirmationModal,
  fetchWithAuth,
  GITHUB_CLIENT_ID,
  useLanguage,
} from 'shared-ui';
import { GithubIcon } from '../../components/icons/GithubIcon';

interface UserInfo {
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string;
  githubId?: string | null;
  hasGitHubConnected: boolean;
  hasPasswordAuth: boolean;
}

export default function SettingsPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState('');

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/auth/me`);
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        // Update local storage user if needed
        localStorage.setItem('user', JSON.stringify(data));
      } else if (res.status === 401) {
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Failed to fetch user info', err);
      toast.error(t.settings.toast.loadSettingsFailed);
    } finally {
      setLoading(false);
    }
  }, [t.settings.toast.loadSettingsFailed]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const disconnectGithub = async () => {
    setIsDisconnecting(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/auth/github/disconnect`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(t.settings.toast.githubDisconnected);
        setShowDisconnectModal(false);
        fetchUser();
      } else {
        toast.error(t.settings.toast.githubDisconnectFailed);
      }
    } catch (err) {
      console.error(err);
      toast.error(t.common.apiError);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const connectGithub = () => {
    if (!GITHUB_CLIENT_ID) {
      toast.error('GitHub Client ID not configured');
      return;
    }

    // Store current path to return after GitHub auth
    sessionStorage.setItem('github_link_redirect', '/settings');

    const redirectUri = `${window.location.origin}/auth/github-link-callback`;
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user,repo,read:org,read:packages`;

    window.location.href = githubUrl;
  };

  const reconnectGithub = () => {
    connectGithub();
  };

  const exportUserData = async () => {
    setIsExporting(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/gdpr/export`);
      if (res.ok) {
        const data = await res.json();
        // Create a downloadable JSON file
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `helvetia-cloud-data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Data exported successfully');
      } else {
        toast.error('Failed to export data');
      }
    } catch (err) {
      console.error(err);
      toast.error(t.common.apiError);
    } finally {
      setIsExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (!user || confirmUsername !== user.username) {
      toast.error('Username confirmation does not match');
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/gdpr/delete-account`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmUsername }),
      });
      if (res.ok) {
        toast.success('Account deleted successfully');
        // Clear local storage and redirect to home
        localStorage.clear();
        window.location.href = '/';
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to delete account');
      }
    } catch (err) {
      console.error(err);
      toast.error(t.common.apiError);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin-fast" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-fade-in">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
            {t.settings.title}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">{t.settings.subtitle}</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Profile Section */}
        <section className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-8 rounded-[32px] shadow-xl dark:shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-8 relative z-10">
            <div className="relative">
              {user?.avatarUrl ? (
                <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-indigo-500/30">
                  <Image
                    src={user.avatarUrl}
                    alt={user.username}
                    width={96}
                    height={96}
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-slate-800/50 flex items-center justify-center border-2 border-white/10 text-slate-500">
                  <Globe size={40} />
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 w-6 h-6 rounded-full border-4 border-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                {user?.username}
              </h2>
              {user?.email && (
                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">{user.email}</p>
              )}
              <p className="text-slate-500 font-mono text-sm mt-1">ID: {user?.id}</p>
              <div className="flex gap-2 mt-4">
                <span className="px-3 py-1 bg-indigo-500/15 text-indigo-400 text-[11px] font-bold uppercase tracking-wider rounded-full border border-indigo-500/20 shadow-sm">
                  {t.common.freePlan} <span className="text-[10px]">🇨🇭</span>
                </span>
                <span className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider rounded-full border border-slate-200 dark:border-white/10 shadow-sm">
                  {t.common.earlyAccess}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* GitHub Integration */}
        <section className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[32px] shadow-xl dark:shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white text-black rounded-2xl shadow-lg">
                <GithubIcon size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {t.settings.githubIntegration}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 leading-relaxed">
                  {t.settings.githubDesc}
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 transition-colors hover:border-indigo-500/30 group/item">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white dark:bg-black/40 rounded-2xl border border-slate-200 dark:border-white/5 group-hover/item:border-indigo-500/20 transition-all shadow-inner">
                  <GithubIcon size={28} />
                </div>
                <div>
                  <div className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-3">
                    {user?.username}
                    {user?.hasGitHubConnected ? (
                      <span className="text-[10px] uppercase tracking-widest bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5 font-bold shadow-sm">
                        <CheckCircle2 size={12} /> {t.settings.connected}
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-widest bg-rose-500/15 text-rose-400 px-2.5 py-1 rounded-full border border-rose-500/20 flex items-center gap-1.5 font-bold shadow-sm">
                        <AlertCircle size={12} /> {t.settings.disconnected}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 mt-1 font-medium">
                    {t.settings.accountLinked}
                  </div>
                </div>
              </div>

              {user?.hasGitHubConnected ? (
                <button
                  onClick={() => setShowDisconnectModal(true)}
                  disabled={!user.hasPasswordAuth}
                  className="w-full sm:w-auto text-sm text-rose-400 hover:text-white font-bold transition-all flex items-center justify-center gap-2 px-6 py-3 bg-rose-500/10 hover:bg-rose-500 disabled:bg-rose-500/5 disabled:text-rose-400/50 disabled:cursor-not-allowed rounded-xl border border-rose-500/20 shadow-md active:scale-95 disabled:active:scale-100"
                  title={
                    !user.hasPasswordAuth
                      ? 'Cannot disconnect GitHub without email/password authentication'
                      : ''
                  }
                >
                  <LogOut size={16} /> {t.settings.disconnect}
                </button>
              ) : (
                <button
                  onClick={connectGithub}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <GithubIcon size={16} /> Connect GitHub
                </button>
              )}
            </div>

            {!user?.hasPasswordAuth && user?.hasGitHubConnected && (
              <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 rounded-2xl p-6 flex items-start gap-5">
                <div className="p-3 bg-amber-100 dark:bg-amber-500/10 rounded-xl text-amber-500 dark:text-amber-400 mt-0.5 shadow-sm">
                  <AlertCircle size={22} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">
                    Set up Email/Password Authentication
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed font-medium">
                    You're currently using GitHub authentication only. To disconnect GitHub, you
                    need to set up email/password authentication first. This ensures you can always
                    access your account.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-6 flex items-start gap-5">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-500/10 rounded-xl text-indigo-500 dark:text-indigo-400 mt-0.5 shadow-sm">
                <Shield size={22} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">
                  {t.settings.orgAccessTitle}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed font-medium">
                  {t.settings.orgAccessDesc}
                </p>
                <a
                  href={`https://github.com/settings/connections/applications/${GITHUB_CLIENT_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-all mt-5 bg-indigo-100 dark:bg-indigo-500/10 px-4 py-2 rounded-lg border border-indigo-200 dark:border-indigo-500/20"
                >
                  {t.settings.manageOnGithub}
                  <ArrowUpRight
                    size={16}
                    className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy & Data Section */}
        <section className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-[32px] overflow-hidden shadow-xl dark:shadow-2xl">
          <div className="p-8 border-b border-slate-200 dark:border-white/5">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Privacy & Data
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 font-medium">
              Manage your personal data and privacy settings
            </p>
          </div>
          <div className="p-8 space-y-6">
            {/* Data Export */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-white/5">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-500/10 rounded-lg">
                    <Download size={20} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="font-bold text-lg text-slate-900 dark:text-white">
                    Export Your Data
                  </div>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 font-medium max-w-md">
                  Download a copy of all your personal data in JSON format. This includes your
                  account information, projects, and deployments.
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                  <Shield size={14} />
                  <span>GDPR Article 20 - Right to data portability</span>
                </div>
              </div>
              <button
                onClick={exportUserData}
                disabled={isExporting}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 disabled:bg-indigo-300 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Export Data
                  </>
                )}
              </button>
            </div>

            {/* Privacy Policy Link */}
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <FileText size={20} className="text-slate-600 dark:text-slate-400" />
                  </div>
                  <div className="font-bold text-lg text-slate-900 dark:text-white">
                    Privacy Policy
                  </div>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 font-medium max-w-md">
                  Review our comprehensive privacy policy to understand how we collect, use, and
                  protect your data.
                </div>
              </div>
              <a
                href="/privacy"
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                View Policy
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-rose-50 dark:bg-rose-500/5 border border-rose-200 dark:border-rose-500/20 rounded-[32px] overflow-hidden shadow-xl dark:shadow-2xl">
          <div className="p-8 border-b border-rose-200 dark:border-rose-500/10 bg-rose-100/50 dark:bg-rose-500/5">
            <h2 className="text-2xl font-bold text-rose-400 tracking-tight">
              {t.settings.dangerZone}
            </h2>
            <p className="text-rose-400/60 text-sm mt-1 font-medium">{t.settings.irreversible}</p>
          </div>
          <div className="p-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <div className="font-bold text-lg text-slate-900 dark:text-white">
                  {t.settings.deleteAccount}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-500 mt-1 font-medium max-w-md">
                  {t.settings.deleteAccountDesc}
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full sm:w-auto p-4 rounded-xl bg-rose-200/50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-md active:scale-95 border border-rose-200 dark:border-rose-500/20"
                title={t.settings.deleteAccount}
              >
                <Trash2 size={24} />
              </button>
            </div>
          </div>
        </section>
      </div>

      {showDisconnectModal && (
        <ConfirmationModal
          title="Disconnect GitHub"
          message={t.settings.disconnectConfirm}
          confirmLabel={t.settings.disconnect}
          onConfirm={disconnectGithub}
          onCancel={() => setShowDisconnectModal(false)}
          isDanger
          isLoading={isDisconnecting}
        />
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Delete Account</h3>
            </div>
            <div className="mb-6">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                This action is permanent and cannot be undone. All your projects, deployments, and
                data will be permanently deleted.
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Please type your username to confirm:
              </p>
              <input
                type="text"
                value={confirmUsername}
                onChange={(e) => setConfirmUsername(e.target.value)}
                placeholder={user?.username || 'your-username'}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmUsername('');
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 rounded-xl font-semibold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={isDeleting || confirmUsername !== user?.username}
                className="flex-1 px-4 py-3 rounded-xl font-semibold bg-rose-600 text-white hover:bg-rose-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
