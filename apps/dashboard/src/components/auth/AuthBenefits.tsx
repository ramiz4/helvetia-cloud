import React from 'react';

export interface Benefit {
  id: string;
  icon: React.ReactNode;
  text: string;
}

interface AuthBenefitsProps {
  benefits: Benefit[];
}

export function AuthBenefits({ benefits }: AuthBenefitsProps) {
  return (
    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/10" role="list">
      {benefits.map((benefit) => {
        const [rawTitle, ...rest] = benefit.text.split(':');
        const title = rawTitle.trim() || 'Feature';
        const description = rest.length > 0 ? rest.join(':').trim() : benefit.text;

        return (
          <div
            key={benefit.id}
            className="flex items-start gap-4 p-4 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-100 dark:border-white/5 backdrop-blur-sm"
            role="listitem"
          >
            <div className="mt-1 shrink-0 p-2 bg-indigo-50 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
              {benefit.icon}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                {title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
