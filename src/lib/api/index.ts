import { useEffect, useState } from 'react';
import { useMedplum } from '@medplum/react';
import { useDebouncedCallback } from '@mantine/hooks';

export function useFetchFromVitalBot<T>(endpoint: string, payload: any, initialData: T) {
  const medplum = useMedplum();
  const identifier = useGetVitalBotIdentifier();
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  const debounce = useDebouncedCallback(async () => {
    medplum
      .executeBot(identifier, { endpoint, payload })
      .then((result: T) => setData(result))
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, 200);

  useEffect(() => {
    setIsLoading(true);
    debounce();
  }, []);

  return { data, isLoading, error };
}

function useGetVitalBotIdentifier() {
  const medplum = useMedplum();

  const identifier = medplum
    .getProject()
    ?.secret?.find((secret) => secret.name === 'VITAL_BOT_IDENTIFIER')?.valueString;

  if (!identifier) {
    throw new Error('VITAL_BOT_IDENTIFIER not found');
  }

  return identifier;
}
