import { useQuery } from '@tanstack/react-query';
import { http } from '.';

export function useICD10CM({ search }: { search: string }) {
  const { data, ...query } = useQuery({
    queryKey: ['icd10mc', search],
    queryFn: () => fetchICD10CM(search),
  });

  const options = (data?.length || 0) >= 3 ? data?.[3] : undefined;

  return {
    options: options?.map(([code, name]) => ({ value: code, label: name })),
    ...query,
  };
}

async function fetchICD10CM(search: string): Promise<ICDResponse> {
  const resp = await http.get<ICDResponse>(`/api/icd10cm/v3/search?sf=code,name&terms=${search}`, {
    baseURL: 'https://clinicaltables.nlm.nih.gov',
  });

  return resp.data;
}

export type ICDResponse = [number, any[], null, [string, string][]];
