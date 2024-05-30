import { AppShell, ErrorBoundary, Loading, Logo, useMedplum, useMedplumProfile } from '@medplum/react';
import { IconMenuOrder, IconUser, IconReportMedical } from '@tabler/icons-react';
import { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { PatientHistory } from './components/PatientHistory';
import { PatientOverview } from './components/PatientOverview';
import { Timeline } from './components/Timeline';
import { HomePage } from './pages/HomePage';
import { LandingPage } from './pages/LandingPage';
import { PatientPage } from './pages/PatientPage';
import { ResourcePage } from './pages/ResourcePage';
import { SignInPage } from './pages/SignInPage';
import { OrdersNewPage } from './pages/OrdersNewPage';
import { ResultsPage } from './pages/ResultsPage';
import { OrdersPage } from './pages/OrdersPage';
import { ResultsDetailsPage } from './pages/ResultsPage/ResultsDetailsPage';
import { ResultsOverviewPage } from './pages/ResultsPage/ResultsOverviewPage';
import { ResultsReportPage } from './pages/ResultsPage/ResultsReportPage';

export function App(): JSX.Element | null {
  const medplum = useMedplum();
  const profile = useMedplumProfile();

  if (medplum.isLoading()) {
    return null;
  }

  return (
    <AppShell
      logo={<Logo size={24} />}
      menus={[
        {
          title: 'My Links',
          links: [
            { icon: <IconUser />, label: 'Patients', href: '/' },
            { icon: <IconMenuOrder />, label: 'Orders', href: '/orders' },
            { icon: <IconReportMedical />, label: 'Results', href: '/results' },
          ],
        },
      ]}
    >
      <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={profile ? <HomePage /> : <LandingPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/new" element={<OrdersNewPage />} />
            <Route path="/service-requests" element={<ResultsPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/results/:id" element={<ResultsDetailsPage />}>
              <Route index element={<ResultsOverviewPage />} />
              <Route path="overview" element={<ResultsOverviewPage />} />
              <Route path="report" element={<ResultsReportPage />} />
            </Route>
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/Patient/:id" element={<PatientPage />}>
              <Route index element={<PatientOverview />} />
              <Route path="overview" element={<PatientOverview />} />
              <Route path="timeline" element={<Timeline />} />
              <Route path="history" element={<PatientHistory />} />
            </Route>
            <Route path="/:resourceType/:id" element={<ResourcePage />} />
            <Route path="/:resourceType/:id/_history/:versionId" element={<ResourcePage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
