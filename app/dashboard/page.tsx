import DashboardClient from './dashboard-client';
import {prisma} from '@/utils/prisma';

export default async function Page() {
  // Note: Without authentication, fetching all documents
  // Consider adding a session/auth mechanism or using query params
  const docsList = await prisma.document.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <div>
      <DashboardClient docsList={docsList} />
    </div>
  );
}
