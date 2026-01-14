import { Translations } from 'shared';

export type ServiceType = 'DOCKER' | 'STATIC' | 'COMPOSE' | 'DATABASE';

export interface BaseConfigFieldsProps {
  data: {
    buildCommand?: string | null;
    startCommand?: string | null;
    staticOutputDir?: string | null;
    port?: number;
    branch?: string;
  };
  onChange: (updates: Record<string, unknown>) => void;
  translations: Translations['dashboard'];
  disabled?: boolean;
}
