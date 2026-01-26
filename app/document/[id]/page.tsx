import { prisma } from '@/utils/prisma';
import DocumentClient from './document-client';

export default async function Page({ params }: { params: { id: string } }) {
  const currentDoc = await prisma.document.findFirst({
    where: {
      id: params.id,
    },
  });

  if (!currentDoc) {
    return <div>This document was not found</div>;
  }

  return (
    <div>
      <DocumentClient currentDoc={currentDoc} userImage={undefined} />
    </div>
  );
}
