import { useQuery } from '@tanstack/react-query';
import { http } from '.';

export function useFetchLabs() {
  const { data: labs, ...query } = useQuery({
    queryKey: ['labs'],
    queryFn: fetchLabs,
  });

  return {
    labs,
    ...query,
  };
}

async function fetchLabs(): Promise<Lab[]> {
  const resp = await http.get<Lab[]>('/v3/lab_tests/labs');

  return resp.data;
}

export type Lab = {
  id: number;
  slug: string;
  name: string;
  first_line_address: string;
  city: string;
  zipcode: string;
  collection_methods: Array<string>;
  sample_types: Array<string>;
};
