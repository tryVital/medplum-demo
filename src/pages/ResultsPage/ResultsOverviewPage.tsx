import { Button, Group, Loader } from '@mantine/core';
import { DiagnosticReport } from '@medplum/fhirtypes';
import { Document, ResourceTable, useMedplum, useResource } from '@medplum/react';
import { useParams } from 'react-router-dom';

export function ResultsOverviewPage(): JSX.Element {
  const { id } = useParams();
  const result = useResource<DiagnosticReport>({ reference: `DiagnosticReport/${id}` });
  if (!result) {
    return <Loader />;
  }
  const medplum = useMedplum();

  const handleDownload = async () => {
    const baseURL = result.identifier?.[0].system;
    if (!baseURL) return;

    const project = medplum.getProject();
    if (!project) return;

    const apiKey =
      project.secret?.find((secret) => secret.name === 'VITAL_API_KEY')?.valueString || '<your-api-key-here>';
    if (!apiKey) return;

    fetch(`${baseURL}/result/pdf`, {
      method: 'GET',
      headers: {
        'x-vital-api-key': apiKey,
      },
    })
      .then((response) => response.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'results.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
  };

  return (
    <Document>
      <Group justify="end">
        <Button onClick={handleDownload}>Download PDF Results</Button>
      </Group>
      <ResourceTable value={result} />
    </Document>
  );
}
