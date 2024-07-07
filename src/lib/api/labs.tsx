import { useFetchFromVitalBot } from '.';
import { Lab } from './types';

export function useFetchLabs() {
  const { data: labs, ...rest } = useFetchFromVitalBot<Lab[]>('get_labs', {}, []);
  return { labs, ...rest };
}
