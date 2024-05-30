import { Space, Title } from '@mantine/core';
import { Document, SearchControl } from '@medplum/react';
import { useNavigate } from 'react-router-dom';

export function OrdersPage(): JSX.Element {
  const navigate = useNavigate();

  return (
    <Document>
      <Title>Orders</Title>
      <Space h="lg" />
      <SearchControl
        search={{
          resourceType: 'ServiceRequest',
          fields: ['id', '_lastUpdated', 'status', 'code', 'subject', 'performer'],
        }}
        checkboxesEnabled={true}
        onNew={() => navigate('/orders/new')}
        onClick={(e) => navigate(`/ServiceRequest/${e.resource.id}`)}
        onAuxClick={console.log}
      />
    </Document>
  );
}
