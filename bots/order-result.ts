import { BotEvent, MedplumClient, createReference } from '@medplum/core';
import {
  Binary,
  Bundle,
  BundleEntry,
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

  const bundle = await fetchFhirResults(event.secrets, orderID);
  const isProd = false;

  if (isProd) {
    // TODO: Make it createPDFResultMedia or something like this
    const binary = await updatePDFResult(medplum, {}, orderID);

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
  }

  // TODO: Pass media to createDiagnosticReport
  const diagnosticReport = await createDiagnoticReport(medplum, bundle, orderID);
}

/**
 * Fetches the results from the Vital API
 *
 * @param event - The BotEvent
 * @param orderID - The order ID
 *
 * @returns A promise that resolves to the FHIR Bundle
 */
export async function fetchFhirResults(secrets: Record<string, ProjectSetting>, orderID: string): Promise<Bundle> {
  const apiKey = secrets['VITAL_API_KEY'].valueString;
  const baseURL = secrets['VITAL_BASE_URL'].valueString || 'https://api.dev.tryvital.io';

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

  if (!resp.ok) {
    throw new Error(`Failed to fetch results: ${resp.status} ${await resp.json()}`);
  }

  return resp.json();
}

/**
 * Saves the results to the Medplum server
 *
 * @param medplum - The MedplumClient
 * @param bundle - The FHIR Bundle
 * @param orderID - The order ID
 *
 * @returns A promise that resolves to true if the results were saved successfully
 */
export async function createDiagnoticReport(
  medplum: MedplumClient,
  bundle: Bundle,
  orderID: string
): Promise<DiagnosticReport> {
  const patient = bundle.entry?.find((e: any) => e.resource.resourceType === 'Patient')?.resource as
    | Patient
    | undefined;

  if (!patient || !patient.id) {
    throw new Error('No patient found in bundle');
  }

  if (!(await medplum.readResource('Patient', patient.id))) {
    throw new Error('Patient not found in Medplum');
  }

  const observationEntries = bundle.entry?.filter((entry) => entry.resource?.resourceType === 'Observation') as
    | BundleEntry<Observation>[]
    | undefined;
  if (!observationEntries || observationEntries.length === 0) {
    throw new Error('No observations found in bundle');
  }

  const respBundle = await medplum.executeBatch({
    resourceType: 'Bundle',
    type: 'transaction',
    entry: observationEntries.map((entry) => ({
      resource: entry.resource,
      request: {
        method: 'POST',
        url: 'Observation',
      },
    })),
  });
  const observations = respBundle.entry?.map((entry) => createReference(entry.resource as Observation)) || [];

  const metadata = observationEntries[0].resource!;
  const diagnosticReport: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    status: metadata.status,
    identifier: [
      {
        system: 'vital_order_id',
        value: orderID,
      },
    ],
    code: metadata.code,
    subject: metadata.subject,
    effectiveDateTime: metadata.effectiveDateTime,
    issued: metadata.issued,
    conclusion: metadata.interpretation?.[0].coding?.[0].display,
    conclusionCode: [
      {
        coding: metadata.interpretation?.[0].coding,
      },
    ],
    result: observations,
  };

  return medplum.createResource(diagnosticReport);
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
