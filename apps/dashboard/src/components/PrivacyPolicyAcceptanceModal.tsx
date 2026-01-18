'use client';

import { useAcceptPrivacy } from '@/hooks/usePrivacyAcceptance';
import type { PrivacyPolicy } from '@/types/privacy';
import { AlertCircle, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

interface PrivacyPolicyAcceptanceModalProps {
  policy: PrivacyPolicy;
  onAccept: () => void;
  onCancel?: () => void;
}

export function PrivacyPolicyAcceptanceModal({
  policy,
  onAccept,
  onCancel,
}: PrivacyPolicyAcceptanceModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const acceptPrivacyMutation = useAcceptPrivacy();

  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleScroll = () => {
    if (!contentRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold

    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await acceptPrivacyMutation.mutateAsync(policy.id);
      toast.success('Privacy policy accepted successfully');
      onAccept();
    } catch (error) {
      console.error('Failed to accept privacy policy:', error);
      toast.error('Failed to accept privacy policy. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      // If no cancel handler, logout user
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={handleCancel} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-lg">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Privacy Policy</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-1">
                Version {policy.version} • Effective{' '}
                {new Date(policy.effectiveAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-8 prose prose-slate dark:prose-invert max-w-none"
          style={{ maxHeight: 'calc(90vh - 220px)' }}
        >
          <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed">
            {policy.content}
          </div>
        </div>

        {/* Scroll indicator */}
        {!hasScrolledToBottom && (
          <div className="absolute bottom-28 left-0 right-0 h-24 bg-gradient-to-t from-white dark:from-slate-900 to-transparent pointer-events-none flex items-end justify-center pb-4">
            <div className="px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center gap-2 animate-bounce">
              <AlertCircle size={16} />
              <span>Please scroll to read the full policy</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-4 p-8 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={handleCancel}
            className="px-6 py-3 rounded-xl font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5 transition-all"
            disabled={isAccepting}
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            disabled={!hasScrolledToBottom || isAccepting}
            className={`
              px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2
              ${
                hasScrolledToBottom && !isAccepting
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
              }
            `}
          >
            {isAccepting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <CheckCircle2 size={20} />I Accept
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
