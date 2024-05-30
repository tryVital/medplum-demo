import { useQuery } from '@tanstack/react-query';
import { http } from '.';
import { useMemo } from 'react';

export function useFetchLabTests({ labID }: { labID?: number }) {
  const { data, ...query } = useQuery({
    queryKey: ['labTests'],
    queryFn: fetchLabTests,
  });

  const labTests = useMemo(
    // Filter lab tests by labID
    () => (!Boolean(labID) ? data : data?.filter((test) => test.lab.id === labID)),
    [data, labID]
  );

  return {
    labTests,
    ...query,
  };
}

async function fetchLabTests(): Promise<LabTest[]> {
  const resp = await http.get<LabTest[]>('v3/lab_tests');

  return resp.data;
}

export type LabTest = {
  id: string;
  slug: string;
  name: string;
  sample_type: string;
  method: string;
  price: number;
  is_active: boolean;
  status: string;
  fasting: boolean;
  lab: {
    id: number;
    slug: string;
    name: string;
    first_line_address: string;
    city: string;
    zipcode: string;
    collection_methods: Array<string>;
    sample_types: Array<string>;
  };
  markers?: Array<{
    id: number;
    name: string;
    slug: string;
    description: string;
    lab_id: number;
    provider_id: string;
    type?: string;
    unit: any;
    price: string;
    aoe: {
      questions: Array<{
        id: number;
        required: boolean;
        code: string;
        value: string;
        type: string;
        sequence: number;
        answers: Array<any>;
      }>;
    };
  }>;
  is_delegated: boolean;
};
