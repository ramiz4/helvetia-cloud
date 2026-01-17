import { useLanguage } from 'shared-ui';

interface StepIndicatorProps {
  step: number;
  onStepClick: (step: number) => void;
}

export default function StepIndicator({ step, onStepClick }: StepIndicatorProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4 relative">
      {/* Connector Line */}
      <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-200 dark:bg-white/5" />

      {/* Step 1 */}
      <button
        type="button"
        onClick={() => step >= 1 && onStepClick(1)}
        disabled={step < 1}
        className={`w-full flex items-center gap-4 relative z-10 p-2 rounded-2xl transition-all group text-left ${step === 1
            ? 'bg-indigo-50 dark:bg-indigo-500/10'
            : step > 1
              ? 'hover:bg-slate-100 dark:hover:bg-white/5'
              : 'opacity-40 cursor-not-allowed'
          }`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-all ${step >= 1
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-slate-100 dark:bg-white/5 text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-white/10 group-hover:text-slate-700 dark:group-hover:text-slate-300'
            }`}
        >
          1
        </div>
        <div
          className={`font-medium transition-all ${step === 1
              ? 'text-slate-900 dark:text-white'
              : 'text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
            }`}
        >
          {t.dashboard.newService.step1}
        </div>
      </button>

      {/* Step 2 */}
      <button
        type="button"
        onClick={() => step >= 2 && onStepClick(2)}
        disabled={step < 2}
        className={`w-full flex items-center gap-4 relative z-10 p-2 rounded-2xl transition-all group text-left ${step === 2
            ? 'bg-indigo-50 dark:bg-indigo-500/10'
            : step > 2
              ? 'hover:bg-slate-100 dark:hover:bg-white/5'
              : 'opacity-40 cursor-not-allowed'
          }`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-all ${step >= 2
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-slate-100 dark:bg-white/5 text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-white/10 group-hover:text-slate-700 dark:group-hover:text-slate-300'
            }`}
        >
          2
        </div>
        <div
          className={`font-medium transition-all ${step === 2
              ? 'text-slate-900 dark:text-white'
              : 'text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
            }`}
        >
          {t.dashboard.newService.step2}
        </div>
      </button>

      {/* Step 3 */}
      <button
        type="button"
        onClick={() => step >= 3 && onStepClick(3)}
        disabled={step < 3}
        className={`w-full flex items-center gap-4 relative z-10 p-2 rounded-2xl transition-all group text-left ${step === 3
            ? 'bg-indigo-50 dark:bg-indigo-500/10'
            : 'hover:bg-slate-100 dark:hover:bg-white/5 opacity-40 cursor-not-allowed'
          }`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-all ${step >= 3
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-slate-100 dark:bg-white/5 text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-white/10 group-hover:text-slate-700 dark:group-hover:text-slate-300'
            }`}
        >
          3
        </div>
        <div
          className={`font-medium transition-all ${step === 3
              ? 'text-slate-900 dark:text-white'
              : 'text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
            }`}
        >
          {t.dashboard.newService.step3}
        </div>
      </button>
    </div>
  );
}
