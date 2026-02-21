import { NextRequest, NextResponse } from 'next/server';
import type { Message as VercelChatMessage } from 'ai';
import { createRAGChain } from '@/utils/ragChain';

import type { Document } from '@langchain/core/documents';
import { HumanMessage, AIMessage, ChatMessage } from '@langchain/core/messages';
import { ChatGroq } from '@langchain/groq';
import { type MongoClient } from 'mongodb';
import { loadRetriever } from '../utils/vector_store';
import { loadEmbeddingsModel } from '../utils/embeddings';

export const runtime =
  process.env.NEXT_PUBLIC_VECTORSTORE === 'mongodb' ? 'nodejs' : 'edge';

const formatVercelMessages = (message: VercelChatMessage) => {
  if (message.role === 'user') {
    return new HumanMessage(message.content);
  } else if (message.role === 'assistant') {
    return new AIMessage(message.content);
  } else {
    console.warn(
      `Unknown message type passed: "${message.role}". Falling back to generic message type.`,
    );
    return new ChatMessage({ content: message.content, role: message.role });
  }
};

/**
 * This handler initializes and calls a retrieval chain. It composes the chain using
 * LangChain Expression Language. See the docs for more information:
 *
 * https://js.langchain.com/docs/get_started/quickstart
 * https://js.langchain.com/docs/guides/expression_language/cookbook#conversational-retrieval-chain
 */
export async function POST(req: NextRequest) {
  console.log('[Chat] API called');
  let mongoDbClient: MongoClient | undefined;

  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    if (!messages.length) {
      throw new Error('No messages provided.');
    }
    const formattedPreviousMessages = messages
      .slice(0, -1)
      .map(formatVercelMessages);
    const currentMessageContent = messages[messages.length - 1].content;
    const chatId = body.chatId;

    console.log('[Chat] Processing message for chatId:', chatId, '- Message count:', messages.length);

    const model = new ChatGroq({
      model: 'llama-3.3-70b-versatile',
      temperature: 0,
      apiKey: process.env.GROQ_API_KEY,
    });

    console.log('[Chat] Loading embeddings model...');
    const embeddings = loadEmbeddingsModel();

    let retrievedDocuments: Document[] = [];
    let resolveWithDocuments: (value: Document[]) => void;
    const documentPromise = new Promise<Document[]>((resolve) => {
      resolveWithDocuments = resolve;
      // Timeout after 5 seconds if callback never fires
      setTimeout(() => {
        console.log('[CHAT] Document retrieval timeout - no documents found');
        resolve([]);
      }, 5000);
    });

    const retrieverInfo = await loadRetriever({
      chatId,
      embeddings,
      callbacks: [
        {
          handleRetrieverEnd(documents) {
            // Extract retrieved source documents so that they can be displayed as sources
            // on the frontend.
            console.log('[CHAT] Retrieved', documents?.length || 0, 'documents');
            if (documents && documents.length > 0) {
              retrievedDocuments = documents;
            }
            resolveWithDocuments(documents || []);
          },
        },
      ],
    });

    const retriever = retrieverInfo.retriever;
    mongoDbClient = retrieverInfo.mongoDbClient;

    console.log('[CHAT] Creating RAG chain for chatId:', chatId);
    const ragChain = await createRAGChain(model, retriever);

    const stream = await ragChain.stream({
      input: currentMessageContent,
      chat_history: formattedPreviousMessages,
    });

    const documents = await documentPromise;
    
    console.log('[CHAT] Final documents count:', documents?.length || 0);
    
    // If no documents were retrieved, return a helpful message
    if (!documents || documents.length === 0) {
      return NextResponse.json({
        error: 'No relevant documents found. The PDF might still be processing, or there may be no embeddings for this document yet.',
      }, { status: 404 });
    }
    
    const serializedSources = Buffer.from(
      JSON.stringify(
        documents.map((doc) => {
          return {
            pageContent: doc.pageContent.slice(0, 50) + '...',
            metadata: doc.metadata,
          };
        }),
      ),
    ).toString('base64');

    // Convert to bytes so that we can pass into the HTTP response
    const byteStream = stream.pipeThrough(new TextEncoderStream());

    return new Response(byteStream, {
      headers: {
        'x-message-index': (formattedPreviousMessages.length + 1).toString(),
        'x-sources': serializedSources,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    if (mongoDbClient) {
      await mongoDbClient.close();
    }
  }
}
