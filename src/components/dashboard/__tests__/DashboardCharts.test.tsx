import { render, screen } from '@testing-library/react';

import DashboardCharts from '@/components/dashboard/DashboardCharts';

describe('DashboardCharts', () => {
  it('rerenders safely when loading changes from true to false', () => {
    const { rerender } = render(
      <DashboardCharts
        instanceStats={[]}
        connectedCount={0}
        disconnectedCount={0}
        loading
      />,
    );

    rerender(
      <DashboardCharts
        instanceStats={[
          {
            instanceId: 'inst-1',
            instanceName: 'Loja Centro',
            groupsCount: 4,
            participantsCount: 120,
            status: 'connected',
          },
        ]}
        connectedCount={1}
        disconnectedCount={0}
        loading={false}
        helpdeskLeadsDailyData={[
          { day: '2026-03-20', label: '20/03', leads: 3 },
          { day: '2026-03-21', label: '21/03', leads: 5 },
        ]}
      />,
    );

    expect(screen.getByText('Distribuição de Status')).toBeInTheDocument();
    expect(screen.getByText('Grupos por Instância')).toBeInTheDocument();
  });
});
