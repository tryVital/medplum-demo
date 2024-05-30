import { Loader, Tabs } from '@mantine/core';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { Document, useResource } from '@medplum/react';
import { DiagnosticReport } from '@medplum/fhirtypes';

export function ResultsDetailsPage(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams();
  const result = useResource<DiagnosticReport>({ reference: `DiagnosticReport/${id}` });
  if (!result) {
    return <Loader />;
  }

  return (
    <Document>
      <Tabs onChange={(t) => navigate(`./${t}`)}>
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="report">Report</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <Outlet />
    </Document>
  );
}
