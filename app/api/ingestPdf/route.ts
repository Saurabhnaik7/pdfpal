import { NextResponse } from 'next/server';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { prisma } from '@/utils/prisma';
import { loadEmbeddingsModel } from '../utils/embeddings';
import { loadVectorStore } from '../utils/vector_store';
import { type MongoClient } from 'mongodb';
import { put } from '@vercel/blob';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  let mongoDbClient: MongoClient | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const fileName = file.name;

    // Get userId from cookie
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('userId');

    if (!userIdCookie || !userIdCookie.value) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    const userId = parseInt(userIdCookie.value, 10);

    const docAmount = await prisma.document.count({
      where: {
        userId,
      },
    });

    if (docAmount > 3) {
      return NextResponse.json({
        error: 'You have reached the maximum number of documents',
      });
    }

    // Upload file to Vercel Blob
    console.log('Uploading file to Vercel Blob...');
    const blob = await put(
      `pdfs/${Date.now()}-${fileName}`,
      file,
      {
        access: 'public',
      }
    );

    const fileUrl = blob.url;

    // Create document record in database
    const doc = await prisma.document.create({
      data: {
        fileName,
        fileUrl,
        userId,
      },
    });

    const namespace = doc.id;

    try {
      /* load from remote pdf URL */
      const response = await fetch(fileUrl);
      const buffer = await response.blob();
      const loader = new PDFLoader(buffer);
      const rawDocs = await loader.load();

      /* Split text into chunks */
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const splitDocs = await textSplitter.splitDocuments(rawDocs);
      // Necessary for Mongo - we'll query on this later.
      for (const splitDoc of splitDocs) {
        splitDoc.metadata.docstore_document_id = namespace;
      }

      console.log('creating vector store...');

      /* create and store the embeddings in the vectorStore */
      const embeddings = loadEmbeddingsModel();

      const store = await loadVectorStore({
        namespace: doc.id,
        embeddings,
      });
      const vectorstore = store.vectorstore;
      if ('mongoDbClient' in store) {
        mongoDbClient = store.mongoDbClient;
      }

      // embed the PDF documents
      await vectorstore.addDocuments(splitDocs);
    } catch (error) {
      console.log('error', error);
      return NextResponse.json({ error: 'Failed to ingest your data' });
    } finally {
      if (mongoDbClient) {
        await mongoDbClient.close();
      }
    }

    return NextResponse.json({
      text: 'Successfully embedded pdf',
      id: namespace,
    });
  } catch (error: any) {
    console.error('Error in ingestPdf:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process PDF' },
      { status: 500 }
    );
  }
}
