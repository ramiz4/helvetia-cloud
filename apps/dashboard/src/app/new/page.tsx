'use client';

import ConfigurationStep from '@/components/new-service/ConfigurationStep';
import ImportSourceStep from '@/components/new-service/ImportSourceStep';
import ProjectNameStep from '@/components/new-service/ProjectNameStep';
import StepIndicator from '@/components/new-service/StepIndicator';
import { ServiceFormData } from '@/components/new-service/types';
import { serviceKeys } from '@/hooks/useServices';
import { useLanguage } from 'shared';
import { API_BASE_URL } from 'shared';
import { fetchWithAuth } from 'shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function NewServicePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ServiceFormData>({
    projectId: searchParams.get('project') || '',
    environmentId: searchParams.get('env') || '',
    projectName: '',
    importType: 'github',
    repoUrl: '',
    branch: 'main',
    serviceType: 'docker',
    dbEngine: 'postgres',
    buildCommand: '',
    startCommand: '',
    staticOutputDir: 'dist',
    port: undefined,
    composeFile: 'docker-compose.yml',
    mainService: 'app',
    envVars: [],
    volumes: [],
  });

  // Handle pre-selection when search params change
  useEffect(() => {
    const project = searchParams.get('project');
    const env = searchParams.get('env');
    if (project || env) {
      setFormData((prev) => ({
        ...prev,
        projectId: project || prev.projectId,
        environmentId: env || prev.environmentId,
      }));
    }
  }, [searchParams]);

  const updateFormData = (data: Partial<ServiceFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const {
      projectName,
      environmentId,
      repoUrl,
      branch,
      serviceType,
      importType,
      dbEngine,
      buildCommand,
      startCommand,
      staticOutputDir,
      port,
      composeFile,
      mainService,
      envVars,
      volumes,
    } = formData;

    let finalType = serviceType === 'compose' ? 'COMPOSE' : serviceType.toUpperCase();
    if (importType === 'database') {
      finalType = dbEngine.toUpperCase();
    }

    const payload = {
      name: projectName,
      environmentId,
      repoUrl,
      branch,
      type: finalType,
      // Only include fields relevant to the selected types
      buildCommand:
        serviceType === 'compose' || importType === 'github-image' ? undefined : buildCommand,
      startCommand:
        serviceType === 'docker' || importType === 'github-image' ? startCommand : undefined,
      staticOutputDir: serviceType === 'static' ? staticOutputDir : undefined,
      port:
        serviceType === 'docker' || serviceType === 'compose' || importType === 'github-image'
          ? port
          : undefined,
      composeFile: serviceType === 'compose' ? composeFile : undefined,
      mainService: serviceType === 'compose' ? mainService : undefined,
      envVars: Object.fromEntries(envVars.map((ev) => [ev.key, ev.value])),
      volumes: volumes.filter((v) => v.trim() !== ''),
    };

    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const { getErrorMessage } = await import('@/lib/errorUtils');
        const message = await getErrorMessage(res, t.dashboard.newService.errorGeneric);
        throw new Error(message);
      }

      const createdService = await res.json();

      // Invalidate service list cache to ensure it appears in the project view
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });

      // Automatically Start Deployment
      const deployRes = await fetchWithAuth(
        `${API_BASE_URL}/services/${createdService.id}/deploy`,
        { method: 'POST' },
      );

      if (deployRes.ok) {
        toast.success(t.dashboard.newService.deploySuccess);
      } else {
        toast.success(t.common.success);
        toast.error(t.dashboard.actions.deployTriggerFailed);
      }

      router.push(`/projects/${formData.projectId}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t.dashboard.newService.errorGeneric);
      // Ensure we stay on the configuration step if there is an error
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <div className="mb-12">
        <Link
          href="/"
          className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors group text-sm font-medium"
        >
          <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
          {t.common.back}
        </Link>
        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
          {t.dashboard.newService.title}
        </h1>
        <p className="text-slate-400 text-lg">{t.dashboard.newService.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Step Indicator */}
        <div className="lg:col-span-3">
          <StepIndicator step={step} onStepClick={setStep} />
        </div>

        {/* Form Area */}
        <div className="lg:col-span-9">
          {step === 1 && (
            <ProjectNameStep
              data={formData}
              updateData={updateFormData}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <ImportSourceStep
              data={formData}
              updateData={updateFormData}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <ConfigurationStep
              data={formData}
              updateData={updateFormData}
              onSubmit={handleCreateService}
              onBack={() => setStep(2)}
              loading={loading}
              error={error}
              setError={setError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
