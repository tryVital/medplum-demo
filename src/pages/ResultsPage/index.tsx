import { Space, Title } from '@mantine/core';
import { Document, SearchControl } from '@medplum/react';
import { useNavigate } from 'react-router-dom';

export function ResultsPage(): JSX.Element {
  const navigate = useNavigate();

  return (
    <Document>
      <Title>Results</Title>
      <Space h="lg" />
      <SearchControl
        search={{
          resourceType: 'DiagnosticReport',
          fields: ['id', '_lastUpdated', 'conclusion', 'status'],
        }}
        checkboxesEnabled={true}
        onNew={() => console.log('onNew')}
        onClick={(e) => navigate(`/results/${e.resource.id}`)}
      />
    </Document>
  );
}
