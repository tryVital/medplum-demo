import { BotEvent, MedplumClient } from '@medplum/core';
import {
  Binary,
  Bundle,
  DiagnosticReport,
  Media,
  Observation,
  Patient,
  ProjectSetting,
  Reference,
} from '@medplum/fhirtypes';

type OrderEvent = {
  id: string;
};

/**
 * Handles the order-result event
 *
 * @param medplum - The MedplumClient
 * @param event - The BotEvent
 *
 * @returns A promise that resolves to true if the event was handled successfully
 */
export async function handler(medplum: MedplumClient, event: BotEvent): Promise<any> {
  // Check if event.input is of type Resource
  if (typeof event.input !== 'object' || !('id' in event.input)) {
    return false;
  }

  const orderID = (event.input as OrderEvent).id;
  return saveResults(medplum, event, orderID);
}

/**
 * Fetches the results from the Vital API and saves them to the Medplum server
 *
 * @param medplum - The MedplumClient
 * @param event - The BotEvent
 * @param orderID - The order ID
 *
 * @returns A promise that resolves to true if the results were saved successfully
 */
async function saveResults(medplum: MedplumClient, event: BotEvent, orderID: string): Promise<any> {
  const apiKey = event.secrets['VITAL_API_KEY'].valueString;
  const baseURL = event.secrets['VITAL_BASE_URL'].valueString || 'https://api.dev.tryvital.io';

  if (!apiKey || !baseURL) {
    throw new Error('VITAL_API_KEY and VITAL_BASE_URL are required');
  }

  const FETCH_RESULT_URL = baseURL + `/v3/order/${orderID}/result/fhir`;

  const resp = await fetch(FETCH_RESULT_URL, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-vital-api-key': apiKey,
    },
  });

  // Not a 2xx response
  if (resp.status - 200 >= 100) {
    throw new Error('Vital API error: ' + (await resp.text()));
  }

  const bundle = (await resp.json()) as Bundle;

  const patient = bundle.entry?.[0] as Patient;

  const obs = bundle.entry?.filter((entry) => entry.resource?.resourceType === 'Observation');
  if (!obs) {
    throw new Error('No observations found');
  }

  const observations: Reference<Observation>[] = [];
  const metadata = obs[0].resource as Observation;

  for (const entry of obs) {
    const observation = entry.resource as Observation;
    observation.subject = {
      reference: `Patient/${patient.id}`,
    };

    // TODO: Make sure this mappings are corrected in the API level
    observation.valueString = observation.valueString || undefined;
    observation.valueQuantity = observation.valueQuantity || undefined;
    observation.valueRange = observation.valueRange || undefined;
    observation.code = {
      coding: (observation.code?.coding || []).map((coding) => ({
        system: coding.system || 'http://loinc.org',
        code: coding.code || '',
        display: coding.display || '',
      })),
    };

    const { id } = await medplum.createResource(observation);
    observations.push({
      reference: `Observation/${id}`,
    });
  }

  // TODO: Update service request with the orderID
  const diagnosticReport = {
    resourceType: 'DiagnosticReport',
    status: metadata.status,
    identifier: [
      {
        system: `${baseURL}/v3/order/${orderID}/result/pdf`,
        value: orderID,
      },
    ],
    code: {
      coding: (metadata.code.coding || []).map((coding) => ({
        system: coding.system || 'http://loinc.org',
        code: coding.code || '',
        display: coding.display || '',
      })),
    },
    subject: {
      type: 'Patient',
      reference: `Patient/${patient.id}`,
    },
    effectiveDateTime: metadata.effectiveDateTime,
    issued: metadata.issued,
    result: observations,
    conclusion: metadata.interpretation?.[0].coding?.[0].display,
  } as DiagnosticReport;

  const isProd = event.secrets['VITAL_IS_PROD']?.valueBoolean;

  if (!isProd) {
    const binary = await updatePDFResult(medplum, event.secrets, orderID);

    // Create a Media, representing an attachment
    const media = await medplum.createResource({
      resourceType: 'Media',
      status: 'completed',
      content: {
        contentType: 'application/pdf',
        url: 'Binary/' + binary.id,
        title: 'report.pdf',
      },
    } as Media);

    diagnosticReport.media = [
      {
        comment: 'PDF Result',
        link: {
          reference: `Media/${media.id}`,
          type: 'Media',
        },
      },
    ];
  }

  await medplum.createResource(diagnosticReport);

  return true;
}

/**
 * Fetches the PDF result from the Vital API and saves it to the Medplum server
 *
 * @param medplum - The MedplumClient
 * @param secrets - The project secrets
 * @param orderID - The order ID
 *
 * @returns A promise that resolves to the Binary resource
 */
async function updatePDFResult(
  medplum: MedplumClient,
  secrets: Record<string, ProjectSetting>,
  orderID: string
): Promise<Binary> {
  const apiKey = secrets['VITAL_API_KEY'].valueString;
  const baseURL = secrets['VITAL_BASE_URL']?.valueString || 'https://api.dev.tryvital.io';

  if (!apiKey || !baseURL) {
    throw new Error('VITAL_API_KEY and VITAL_BASE_URL are required');
  }

  const response = await fetch(`${baseURL}/v3/order/${orderID}/result/pdf`, {
    method: 'GET',
    headers: {
      'x-vital-api-key': apiKey,
    },
  });

  // Create the PDF
  const binary = await medplum.createPdf({
    // @ts-expect-error Type mismatch
    data: await response.arrayBuffer(),
  });

  if (!binary.url) {
    throw new Error('Binary is missing');
  }

  console.log('PDF URL:', binary.url);

  return binary;
}
