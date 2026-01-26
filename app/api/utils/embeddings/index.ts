import { OpenAIEmbeddings } from '@langchain/openai';

export function loadEmbeddingsModel() {
  return new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-3-small',
  });
}
