import { useFetchFromVitalBot } from '.';
import { LabTest } from './types';

export function useFetchLabTests({ labID }: { labID?: number }) {
  const { data: labTests, ...rest } = useFetchFromVitalBot<LabTest[]>('get_lab_tests', { labID }, []);
  return { labTests, ...rest };
}
