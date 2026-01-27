import { prisma } from "@/utils/prisma";
import DocumentClient from "./document-client";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: { id: string };
}) {
  const docId = Number(params.id);

  if (Number.isNaN(docId)) {
    notFound();
  }

  const currentDoc = await prisma.document.findUnique({
    where: {
      id: docId,
    },
  });

  if (!currentDoc) {
    notFound();
  }

  return (
    <div>
      <DocumentClient currentDoc={currentDoc} userImage={undefined} />
    </div>
  );
}
