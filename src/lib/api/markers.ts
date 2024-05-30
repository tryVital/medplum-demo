import { useQuery } from '@tanstack/react-query';
import { PaginatedResponse, http } from '.';
import { QuestionnaireItem, QuestionnaireItemAnswerOption } from '@medplum/fhirtypes';
import { QuestionnaireItemType } from '@medplum/react';
import { useMemo } from 'react';

export function useFetchQuestionnaireItems({ labID }: { labID: string }) {
  const { data, ...query } = useQuery({
    queryKey: ['compendium', labID],
    queryFn: async () => fetchMarkers(labID),
  });

  const markers = useMemo(() => {
    if (!data?.markers) {
      return [];
    }

    return data.markers.flatMap<QuestionnaireItem>((marker) =>
      (marker?.aoe?.questions || []).map((question) => ({
        extension: [
          {
            url: 'marker_id',
            valueInteger: marker.id,
          },
        ],
        identifier: question.code,
        // TODO: Find a workaround to have marker_id in linkId separated
        linkId: `${question.id.toString()}-${marker.id.toString()}`,
        text: question.value,
        type: question.type === 'numeric' ? 'decimal' : (question.type as QuestionnaireItemType),
        required: question.required,
        answerOption: question.answers?.map<QuestionnaireItemAnswerOption>((answer) => ({
          valueString: question.type !== 'numeric' ? answer.value : undefined,
          valueInteger: question.type === 'numeric' ? parseFloat(answer.value) : undefined,
        })),
      }))
    );
  }, [data?.markers]);

  return {
    markers,
    ...query,
  };
}

export function useFetchMarkers({ labTestID }: { labTestID: string }) {
  const { data, ...query } = useQuery({
    queryKey: ['markers', labTestID],
    queryFn: async () => fetchMarkers(labTestID),
  });

  return {
    markers: data?.markers,
    ...query,
  };
}

async function fetchMarkers(labID: string): Promise<MarkersResponse> {
  const resp = await http.get<MarkersResponse>(`/v3/lab_tests/${labID}/markers`);

  return resp.data;
}

type MarkersResponse = PaginatedResponse & {
  markers: Array<{
    id: number;
    name: string;
    slug: string;
    description: string;
    lab_id: number;
    provider_id: string;
    type: string | null;
    unit: string | null;
    price: string;
    aoe: {
      questions: Array<{
        id: number;
        required: boolean;
        code: string;
        value: string;
        type: 'numeric' | 'text' | 'choice' | 'multiple_choice';
        sequence: number;
        answers?: Array<{
          id: number;
          code: string;
          value: string;
        }>;
      }>;
    };
    expected_results: Array<{
      id: number;
      name: string;
      slug: string;
      lab_id: number;
      required: boolean;
      provider_id: string;
      loinc: {
        id: number;
        name: string;
        slug: string;
        code: string;
        unit?: string;
      };
    }>;
  }>;
};
