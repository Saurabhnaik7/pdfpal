import { Embeddings } from '@langchain/core/embeddings';
import { loadPineconeStore } from './pinecone';
import { loadMongoDBStore } from './mongo';
import { Callbacks } from '@langchain/core/callbacks/manager';

export async function loadVectorStore({
  namespace,
  embeddings,
}: {
  namespace: string;
  embeddings: Embeddings;
}) {
  const vectorStoreEnv = process.env.NEXT_PUBLIC_VECTORSTORE ?? 'pinecone';

  if (vectorStoreEnv === 'pinecone') {
    return await loadPineconeStore({
      namespace,
      embeddings,
    });
  } else if (vectorStoreEnv === 'mongodb') {
    return await loadMongoDBStore({
      embeddings,
    });
  } else {
    throw new Error(`Invalid vector store id provided: ${vectorStoreEnv}`);
  }
}

export async function loadRetriever({
  embeddings,
  chatId,
  callbacks,
}: {
  // namespace: string;
  embeddings: Embeddings;
  chatId: string;
  callbacks?: Callbacks;
}) {
  let mongoDbClient;
  const store = await loadVectorStore({
    namespace: chatId,
    embeddings,
  });
  const vectorstore = store.vectorstore;
  if ('mongoDbClient' in store) {
    mongoDbClient = store.mongoDbClient;
  }
  
  console.log('[Retriever] Loading for chatId:', chatId);
  console.log('[Retriever] Vector store type:', process.env.NEXT_PUBLIC_VECTORSTORE);
  
  // For Mongo, we will use metadata filtering to separate documents.
  // For Pinecone, we will use namespaces, so no filter is necessary.
  const filter =
    process.env.NEXT_PUBLIC_VECTORSTORE === 'mongodb'
      ? {
          preFilter: {
            docstore_document_id: {
              $eq: parseInt(chatId),
            },
          },
        }
      : undefined;
  
  console.log('[Retriever] Filter:', JSON.stringify(filter, null, 2));
  console.log('[Retriever] ChatId parsed as integer:', parseInt(chatId));
  
  const retriever = vectorstore.asRetriever({
    filter,
    callbacks: callbacks as any,
    k: 4, // Number of documents to retrieve
  });
  console.log('[Retriever] ✓ Retriever created successfully');
  return {
    retriever,
    mongoDbClient,
  };
}
