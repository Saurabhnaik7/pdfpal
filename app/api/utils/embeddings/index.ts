import { CohereEmbeddings } from '@langchain/cohere';

export function loadEmbeddingsModel() {
  console.log('[Embeddings] Loading Cohere model (embed-english-v3.0, 1024 dimensions)');
  // Use Cohere embeddings - free tier available
  // Note: Make sure your MongoDB Atlas Vector Index is set to 1024 dimensions!
  return new CohereEmbeddings({
    apiKey: process.env.COHERE_API_KEY,
    model: 'embed-english-v3.0', // Produces 1024-dimensional embeddings
  });
}
