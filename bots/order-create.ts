import { BotEvent, MedplumClient } from '@medplum/core';
import {
  Resource,
  ServiceRequest,
  Bundle,
  Reference,
  QuestionnaireResponse,
  Coverage,
  Patient,
  Practitioner,
  ProjectSetting,
} from '@medplum/fhirtypes';

/**
 * Handles incoming BotEvent messages and processes ServiceRequest resources.
 *
 * @param medplum - An instance of the Medplum client for interacting with the FHIR server.
 * @param event - The BotEvent containing the incoming message.
 *
 * @returns A Promise that resolves to the response data (if successful) or an error message.
 */
export async function handler(medplum: MedplumClient, event: BotEvent): Promise<any> {
  // Check if event.input is of type Resource
  if (typeof event.input !== 'object' || !('resourceType' in event.input)) {
    return false;
  }

  const resource = event.input as Resource;

  switch (resource.resourceType) {
    case 'ServiceRequest': {
      const bundle = await buildVitalOrder(medplum, resource);
      // console.log(JSON.stringify(bundle, null, 2));
      // return JSON.stringify(bundle, null, 2);
      const orderID = await createVitalOrder(event.secrets, JSON.stringify(bundle));

      await medplum.updateResource<ServiceRequest>({
        ...resource,
        identifier: [
          ...(resource.identifier || []),
          {
            system: 'vidal-order-id',
            use: 'secondary',
            value: orderID,
          },
        ],
      });

      return true;
    }
    default:
      return false;
  }
}

/**
 * Builds a Bundle containing patient, practitioner, service request, coverage, and questionnaire response resources
 * from the provided ServiceRequest.
 *
 * @param medplum - An instance of the Medplum client for interacting with the FHIR server.
 * @param sr - The ServiceRequest resource to use for building the Bundle.
 * @returns A Promise that resolves to the constructed Bundle.
 */
export async function buildVitalOrder(
  medplum: MedplumClient,
  sr: ServiceRequest
): Promise<Bundle<QuestionnaireResponse | Practitioner | ServiceRequest | Coverage | Patient>> {
  if (!sr.subject || !sr.requester) {
    throw new Error('ServiceRequest is missing subject or requester');
  }

  const patient = await medplum.readReference(sr.subject as Reference<Patient>);
  const practitioner = await medplum.readReference(sr.requester as Reference<Practitioner>);

  if (patient.resourceType !== 'Patient' || practitioner.resourceType !== 'Practitioner') {
    throw new Error('ServiceRequest subject or requester is not a Patient or Practitioner');
  }

  const coverage = await getCoverage(medplum, sr);
  const questionnaries = await getQuestionnaires(medplum, sr.supportingInfo || []);

  return {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [
      ...questionnaries.map((qs) => ({ resource: qs })),
      { resource: practitioner },
      { resource: sr },
      { resource: coverage },
      {
        resource: {
          ...patient,
          address: patient.address?.map((address) => ({
            ...address,
            country: address.country || 'US',
          })),
        },
      },
    ],
  };
}

/**
 * Sends a POST request to the Vital API to create a vital order using the provided Bundle.
 *
 * @param secrets - An object containing project settings, including `VITAL_API_KEY` and `VITAL_BASE_URL`.
 * @param body - The stringified JSON representation of the object to send to the Vital API.
 * @param isFhir - A boolean indicating whether the body is in FHIR format.
 * @returns A Promise that resolves to the ID of the created order.
 */
async function createVitalOrder(secrets: Record<string, ProjectSetting>, body: string, isFhir = true): Promise<string> {
  const apiKey = secrets['VITAL_API_KEY'].valueString;
  const baseURL = secrets['VITAL_BASE_URL']?.valueString || 'https://api.dev.tryvital.io';

  if (!apiKey || !baseURL) {
    throw new Error('VITAL_API_KEY and VITAL_BASE_URL are required');
  }

  const url = isFhir ? `${baseURL}/v3/order/fhir` : `${baseURL}/v3/order`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': isFhir ? 'application/fhir+json' : 'application/json',
      'x-vital-api-key': apiKey,
    },
    body: body,
  });

  // Not a 2xx response
  if (resp.status - 200 >= 100) {
    throw new Error('Vital API error: ' + (await resp.text()));
  }

  const { order } = (await resp.json()) as { order: { id: string } };

  return order.id;
}

/**
 * Filters and retrieves QuestionnaireResponse resources from the provided references in the ServiceRequest's supportingInfo.
 *
 * @param medplum - An instance of the Medplum client for interacting with the FHIR server.
 * @param supportingInfo - An array of references potentially containing QuestionnaireResponse resources.
 * @returns A Promise that resolves to an array of QuestionnaireResponse resources found in the references.
 */
async function getQuestionnaires(
  medplum: MedplumClient,
  supportingInfo: Reference[]
): Promise<QuestionnaireResponse[]> {
  const questionnaires = [] as QuestionnaireResponse[];

  for (const ref of supportingInfo) {
    if (ref.type !== 'QuestionnaireResponse' && !ref.reference?.startsWith('QuestionnaireResponse')) {
      continue;
    }

    const q = await medplum.readReference(ref as Reference<QuestionnaireResponse>);
    questionnaires.push(q);
  }

  if (questionnaires.length === 0) {
    throw new Error('Questionnaires are missing');
  }

  return questionnaires;
}

/**
 * Finds the Coverage resource associated with the provided ServiceRequest.
 *
 * @param medplum - An instance of the Medplum client for interacting with the FHIR server.
 * @param sr - The ServiceRequest resource to search for insurance references.
 * @returns A Promise that resolves to the Coverage resource found in the insurance references,
 * or throws an error if no Coverage is found.
 */
async function getCoverage(medplum: MedplumClient, sr: ServiceRequest): Promise<Coverage> {
  const ref = (sr.insurance || []).find((r) => r.type === 'Coverage' || r.reference?.startsWith('Coverage'));

  if (!ref) {
    throw new Error('Coverage is missing');
  }

  return medplum.readReference(ref as Reference<Coverage>);
}

/**
 * Simulates the result of a Vital order by sending a POST request to the Vital API.
 * And then executes a bot to process the result.
 * WARN: This is used for testing purposes only.
 *
 * @param medplum - An instance of the Medplum client for interacting with the FHIR server.
 * @param secrets - An object containing project settings, including `VITAL_API_KEY` and `VITAL_BASE_URL`.
 * @param orderID - The ID of the order to simulate the result for.
 *
 * @returns A Promise that resolves to void.
 */
async function simulateResult(
  medplum: MedplumClient,
  secrets: Record<string, ProjectSetting>,
  orderID: string
): Promise<void> {
  const apiKey = secrets['VITAL_API_KEY'].valueString;
  const baseURL = secrets['VITAL_BASE_URL']?.valueString || 'https://api.dev.tryvital.io';

  if (!apiKey || !baseURL) {
    throw new Error('VITAL_API_KEY and VITAL_BASE_URL are required');
  }

  await fetch(`${baseURL}/v3/order/${orderID}/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vital-api-key': apiKey,
    },
  });

  await medplum.executeBot('d686a5d6-8b55-414f-8d15-b230f0319cee', { id: orderID });
}
