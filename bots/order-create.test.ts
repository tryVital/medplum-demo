import {
  MedplumClient,
  createReference,
  indexSearchParameterBundle,
  indexStructureDefinitionBundle,
} from '@medplum/core';
import { readJson, SEARCH_PARAMETER_BUNDLE_FILES } from '@medplum/definitions';
import {
  Bundle,
  BundleEntry,
  Coverage,
  Organization,
  Patient,
  Practitioner,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponse,
  SearchParameter,
  ServiceRequest,
} from '@medplum/fhirtypes';
import { MockClient } from '@medplum/mock';
import { QuestionnaireItemType } from '@medplum/react';
import { MockedFunction, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { buildVitalOrder, handler } from './order-create';

global.fetch = vi.fn();

describe('Get ServiceRequest from subscription', () => {
  beforeAll(() => {
    indexStructureDefinitionBundle(readJson('fhir/r4/profiles-types.json') as Bundle);
    indexStructureDefinitionBundle(readJson('fhir/r4/profiles-resources.json') as Bundle);
    for (const filename of SEARCH_PARAMETER_BUNDLE_FILES) {
      indexSearchParameterBundle(readJson(filename) as Bundle<SearchParameter>);
    }
  });

  type Context = {
    medplum: MedplumClient;
    patient: Patient;
    requestingPhysician: Practitioner;
    coverage: Coverage;
    performer: Organization;
    questionnarie: Questionnaire;
    questionnarieResponse: QuestionnaireResponse;
    order: ServiceRequest;
  };

  beforeEach<Context>(async (ctx) => {
    (global.fetch as MockedFunction<typeof fetch>).mockReset()

    const medplum = new MockClient();

    const patient = await medplum.createResource({
      resourceType: 'Patient',
      use: 'official',
      name: [
        {
          given: ['Zinedine'],
          family: 'Zidane',
        },
      ],
      birthDate: '1993-01-01',
      address: [
        {
          line: ['West Lincoln Street'],
          city: 'Phoenix',
          state: 'AZ',
          postalCode: '85004',
        },
      ],
      telecom: [
        {
          system: 'phone',
          value: '+17411709894',
        },
        {
          system: 'email',
          value: 'test@test.com',
        },
      ],
      gender: 'male',
    });

    const requestingPhysician = await medplum.createResource({
      resourceType: 'Practitioner',
      identifier: [
        {
          system: 'http://hl7.org/fhir/sid/us-npi',
          value: '1234567890',
        },
      ],
      name: [
        {
          prefix: ['Dr.'],
          given: ['Pierre'],
          family: 'Gasly',
        },
      ],
      telecom: [
        {
          system: 'phone',
          value: '+17411709894',
        },
        {
          system: 'email',
          value: 'test@test.com',
        },
      ],
      address: [
        {
          use: 'work',
          state: 'NY',
        },
        {
          use: 'work',
          state: 'CA',
        },
      ],
      gender: 'male',
    });

    const performer = await medplum.createResource({
      resourceType: 'Organization',
      identifier: [
        {
          system: 'https://docs.tryvital.io/api-reference/lab-testing/tests',
          value: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        },
      ],
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/organization-type',
              code: 'prov',
            },
          ],
        },
      ],
      name: 'Acme Clinical Labs',
    });

    const questionnarie = await medplum.createResource(buildQuestionnaire());
    const questionnarieResponse = await medplum.createResource(buildQuestionnaireResponse(questionnarie));

    const coverage = await medplum.createResource({
      resourceType: 'Coverage',
      network: 'Medicare',
      subscriber: createReference(patient),
      subscriberId: '1234567890',
      status: 'active',
      beneficiary: createReference(patient),
      payor: [createReference(performer)],
      relationship: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
            code: 'self',
          },
        ],
      },
    });

    const order = await medplum.createResource({
      resourceType: 'ServiceRequest',
      subject: createReference(patient),
      requester: createReference(requestingPhysician),
      performer: [createReference(performer)],
      insurance: [createReference(coverage)],
      status: 'active',
      intent: 'order',
      code: {
        // Diagnosis codes (ICD-10)
        coding: [
          {
            system: 'http://hl7.org/fhir/sid/icd-10-cm',
            code: 'I10.9',
          },
          {
            system: 'http://hl7.org/fhir/sid/icd-10-cm',
            code: 'R50.9',
          },
        ],
      },
      supportingInfo: [createReference(questionnarieResponse)],
      note: [
        // Subjective/symptoms
        {
          text: 'The patient reports experiencing headaches for the past week. The headaches are described as throbbing and are worse in the morning. The patient has also been experiencing nausea and vomiting.',
        },
      ],
      // NOTE: This won't be in the out-of-the-box Medplum UI
      extension: [
        {
          url: 'assessment_plan',
          valueString:
            'Based on the symptoms, a CT scan of the head is recommended to rule out any underlying neurological causes.',
        },
      ],
    } as ServiceRequest);

    Object.assign(ctx, {
      medplum,
      patient,
      requestingPhysician,
      coverage,
      performer,
      questionnarie,
      questionnarieResponse,
      order,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  test<Context>('buildVitalOrder', async (ctx) => {
    const bundle = await buildVitalOrder(ctx.medplum, ctx.order);

    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('transaction');
    expect(bundle.entry?.length).toBe(5);

    // Patient
    const patient = bundle.entry?.find((e: any) => e.resource.resourceType === 'Patient') as
      | BundleEntry<Patient>
      | undefined;
    expect(patient?.resource?.name).toEqual(ctx.patient.name);
    expect(patient?.resource?.address?.[0].country).toEqual('US');

    // Questionnaire
    const questionnaireResponse = bundle.entry?.find(
      (e: any) => e.resource.resourceType === 'QuestionnaireResponse'
    ) as BundleEntry<QuestionnaireResponse> | undefined;
    expect(questionnaireResponse?.resource?.status).toBe('completed');

    // Practitioner
    const practitioner = bundle.entry?.find((e: any) => e.resource.resourceType === 'Practitioner') as
      | BundleEntry<Practitioner>
      | undefined;
    expect(practitioner?.resource).toEqual(ctx.requestingPhysician);

    // ServiceRequest
    const serviceRequest = bundle.entry?.find((e: any) => e.resource.resourceType === 'ServiceRequest') as
      | BundleEntry<ServiceRequest>
      | undefined;
    expect(serviceRequest?.resource).toEqual(ctx.order);

    // Coverage
    const coverage = bundle.entry?.find((e: any) => e.resource.resourceType === 'Coverage') as
      | BundleEntry<Coverage>
      | undefined;
    expect(coverage?.resource).toEqual(ctx.coverage);
  });

  test<Context>('createOrder', async (ctx) => {
    const orderID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    (fetch as any).mockResolvedValue(createFetchResponse({ order: { id: orderID } }));

    const apiKey = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
    const baseURL = 'https://api.dev.tryvital.io';

    await handler(ctx.medplum, {
      bot: { reference: 'Bot/123' },
      input: ctx.order,
      contentType: 'application/fhir+json',
      secrets: {
        VITAL_BASE_URL: {
          name: 'VITAL_BASE_URL',
          valueString: baseURL,
        },
        VITAL_API_KEY: {
          name: 'VITAL_API_KEY',
          valueString: apiKey,
        },
      },
    });

    const expectedBody = await buildVitalOrder(ctx.medplum, ctx.order);

    // Check that the order was sent to the Vital API
    expect(fetch).toHaveBeenCalledWith(`${baseURL}/v3/order/fhir`, {
      method: 'POST',
      body: JSON.stringify(expectedBody),
      headers: {
        'Content-Type': 'application/fhir+json',
        'x-vital-api-key': apiKey,
      },
    });

    // Check that the order ID was saved as an identifier
    const order = await ctx.medplum.readResource(ctx.order.resourceType, ctx.order.id!);
    const vitalIdentifier = order?.identifier?.find((i) => i.system === 'vital-order-id');
    expect(vitalIdentifier?.value).toEqual(orderID);
  });
});

const markers: Marker[] = [
  {
    id: 374,
    name: 'Aluminum, Urine',
    slug: 'aluminum-urine',
    description: 'Aluminum, Urine',
    lab_id: 27,
    provider_id: '071555',
    type: 'biomarker',
    unit: null,
    price: 'N/A',
    aoe: {
      questions: [
        {
          id: 1234567890212,
          required: true,
          code: 'COLVOL',
          value: 'URINE VOLUME (MILLILITERS)',
          type: 'numeric',
          sequence: 1,
          answers: [],
        },
      ],
    },
    expected_results: [],
  },
  {
    id: 172,
    name: 'Triglycerides',
    slug: 'triglycerides',
    description: 'Triglycerides',
    lab_id: 27,
    provider_id: '001172',
    type: null,
    unit: null,
    price: 'N/A',
    aoe: {
      questions: [
        {
          id: 1234567890364,
          required: false,
          code: 'FSTING',
          value: 'FASTING',
          type: 'text',
          sequence: 1,
          answers: [],
        },
      ],
    },
    expected_results: [],
  },
] as const;

type Marker = {
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
};

function buildQuestionnaire(): Questionnaire {
  return {
    resourceType: 'Questionnaire',
    title: 'Medicare Aoe',
    status: 'active',
    item: markers.map((marker) => ({
      linkId: marker.id.toString(),
      text: marker.name,
      type: 'group',
      item: marker.aoe.questions.map<QuestionnaireItem>((question) => ({
        linkId: question.id.toString(),
        text: question.value,
        type: (question.type === 'numeric' ? 'decimal' : question.type) as QuestionnaireItemType,
        required: question.required,
      })),
    })),
  };
}

function buildQuestionnaireResponse(questionnaire: Questionnaire): QuestionnaireResponse {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: questionnaire.id,
    item: [
      {
        linkId: markers[0].id.toString(),
        text: markers[0].name,
        item: [
          {
            linkId: markers[0].aoe.questions[0].id.toString(),
            answer: [
              {
                valueDecimal: 123,
              },
            ],
          },
        ],
      },
      {
        linkId: markers[1].id.toString(),
        text: markers[1].name,
        item: [
          {
            linkId: markers[1].aoe.questions[0].id.toString(),
            answer: [
              {
                valueString: 'Yes',
              },
            ],
          },
        ],
      },
    ],
  };
}

function createFetchResponse(data) {
  return { json: () => new Promise((resolve) => resolve(data)) };
}
