import { useQuery } from '@tanstack/react-query';

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
  const url = `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${search}`;

  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return resp.json() as Promise<ICDResponse>;
}

export type ICDResponse = [number, any[], null, [string, string][]];
