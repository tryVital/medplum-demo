import { Loader } from '@mantine/core';
import { DiagnosticReport } from '@medplum/fhirtypes';
import { DiagnosticReportDisplay, Document, useResource } from '@medplum/react';
import { useParams } from 'react-router-dom';

export function ResultsReportPage(): JSX.Element {
  const { id } = useParams();
  const result = useResource<DiagnosticReport>({ reference: `DiagnosticReport/${id}` });
  if (!result) {
    return <Loader />;
  }

  return (
    <Document>
      <DiagnosticReportDisplay value={result} />
    </Document>
  );
}
