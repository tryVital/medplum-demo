import { UUID } from 'uuidjs';
import { Questionnaire } from '@medplum/fhirtypes';
import { useFetchFromVitalBot } from '.';
import { Marker } from './types';

export function useFetchAoEQuestionnaire({ labTestID }: { labTestID: string }) {
  const { data: questionnaire, ...rest } = useFetchFromVitalBot<Questionnaire>(
    'get_aoe_questionnaire',
    { labTestID },
    {
      id: UUID.genV4().toString(),
      resourceType: 'Questionnaire',
      title: 'Ask on Order Entry (AOE)',
      status: 'active',
    }
  );

  return {
    questionnaire: {
      ...questionnaire,
      id: UUID.genV4().toString(),
    },
    ...rest,
  };
}

export function useFetchMarkers({ labTestID }: { labTestID: string }) {
  const { data: markers, ...rest } = useFetchFromVitalBot<Marker[]>('get_markers', { labTestID }, []);
  return { markers, ...rest };
}
