import { Lock, Shield, Zap } from 'lucide-react';

/**
 * Handles GitHub OAuth login flow
 * @param githubClientId - GitHub OAuth client ID
 */
export const handleGitHubLogin = (githubClientId: string | undefined) => {
  if (!githubClientId) {
    console.error('NEXT_PUBLIC_GITHUB_CLIENT_ID is not defined');
    return;
  }

  const redirectUri = `${window.location.origin}/auth/callback`;
  const githubUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${redirectUri}&scope=user,repo,read:org,read:packages`;

  window.location.href = githubUrl;
};

/**
 * Platform benefits displayed on login and signup pages
 */
export const getPlatformBenefits = (t: {
  login: {
    benefit1: string;
    benefit2: string;
    benefit3: string;
  };
}) => [
  {
    id: 'deploy-git',
    icon: <Zap size={18} className="text-indigo-400" />,
    text: t.login.benefit1,
  },
  {
    id: 'hosted-switzerland',
    icon: <Shield size={18} className="text-emerald-400" />,
    text: t.login.benefit2,
  },
  {
    id: 'enterprise-security',
    icon: <Lock size={18} className="text-blue-400" />,
    text: t.login.benefit3,
  },
];
