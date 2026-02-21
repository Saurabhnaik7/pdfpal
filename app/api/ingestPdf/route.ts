import { NextResponse } from 'next/server';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import { prisma } from '@/utils/prisma';
import { loadEmbeddingsModel } from '../utils/embeddings';
import { loadVectorStore } from '../utils/vector_store';
import { type MongoClient } from 'mongodb';
import { put } from '@vercel/blob';
import { cookies } from 'next/headers';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import pdf-parse with type ignore
// @ts-ignore
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export async function POST(request: Request) {
  let mongoDbClient: MongoClient | null = null;

  console.log('[IngestPDF] API called');

  try {
    console.log('[IngestPDF] Parsing form data...');
    const formData = await request.formData();
    const file = formData.get('file') as File;

    console.log('[IngestPDF] File received:', file?.name, 'size:', file?.size);

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const fileName = file.name;

    // Get userId from cookie
    console.log('[IngestPDF] Getting user from cookie...');
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('userId');

    if (!userIdCookie || !userIdCookie.value) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    const userId = parseInt(userIdCookie.value, 10);
    console.log('[IngestPDF] User ID:', userId);

    console.log('[IngestPDF] Checking document count...');
    const docAmount = await prisma.document.count({
      where: {
        userId,
      },
    });

    console.log('[IngestPDF] Current document count:', docAmount);

    const maxDocuments = parseInt(process.env.MAX_DOCUMENTS_PER_USER || '3', 10);
    console.log('[IngestPDF] Max documents allowed:', maxDocuments);

    if (docAmount >= maxDocuments) {
      return NextResponse.json({
        error: `You have reached the maximum number of documents (${maxDocuments})`,
      });
    }

    // Upload file to Vercel Blob
    console.log('[IngestPDF] Uploading file to Vercel Blob...');
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
    
    // Immediately return the document ID for redirection
    console.log('[IngestPDF] Document created with ID:', namespace, '- Starting async processing');
    const responseBody = {
      text: 'Document uploaded successfully, processing embeddings...',
      id: namespace,
    };

    // Process embeddings in the background without awaiting
    processEmbeddings(fileUrl, fileName, namespace, userId)
      .catch((error) => {
        console.error('Background embedding processing failed:', error);
      });

    // Return immediately so user can be redirected
    return NextResponse.json(responseBody);

  } catch (error: any) {
    console.error('[IngestPDF] ✗ Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process PDF' },
      { status: 500 }
    );
  }
}

// Separate function to process embeddings in the background
async function processEmbeddings(
  fileUrl: string,
  fileName: string,
  namespace: number,
  userId: number
) {
  let mongoDbClient: MongoClient | null = null;

  try {
    console.log('[IngestPDF:Background] Starting embedding process for doc:', namespace);
    
    // Fetch the PDF
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('[IngestPDF:Background] PDF buffer size:', buffer.byteLength, 'bytes');

    // Parse PDF using pdf-parse with better options
    console.log('[IngestPDF:Background] Parsing PDF...');
    let pdfData;
    try {
      pdfData = await pdfParse(buffer, {
        max: 0, // No limit on pages
        pagerender: undefined, // Use default text extraction
      });
    } catch (parseError: any) {
      console.error('[IngestPDF:Background] PDF parse error:', parseError);
      throw new Error(`Failed to parse PDF: ${parseError.message}`);
    }

    console.log('[IngestPDF:Background] PDF parsed successfully');
    console.log('[IngestPDF:Background] Pages:', pdfData.numpages);
    console.log('[IngestPDF:Background] Total text length:', pdfData.text?.length || 0);
    // console.log('[IngestPDF:Background] First 200 chars:', (pdfData.text || '').substring(0, 200));

    // Check if we got meaningful text
    if (!pdfData.text || pdfData.text.trim().length < 50) {
      console.warn('[IngestPDF:Background] Very little text extracted from PDF. It might be a scanned image.');
      
      // Try to extract text from individual pages
      let allPageText = '';
      if (pdfData.pages && Array.isArray(pdfData.pages)) {
        for (let i = 0; i < pdfData.pages.length; i++) {
          const pageText = pdfData.pages[i]?.text || '';
          allPageText += pageText + '\n';
        }
        console.log('[IngestPDF:Background] Extracted text from pages, total length:', allPageText.length);
        
        if (allPageText.trim().length > 0) {
          pdfData.text = allPageText;
        }
      }
      
      // If still no text, log and return
      if (!pdfData.text || pdfData.text.trim().length < 20) {
        console.error('[IngestPDF:Background] Could not extract text from PDF. The file might be a scanned image without OCR.');
        console.error('[IngestPDF:Background] PDF Info:', {
          pages: pdfData.numpages,
          version: pdfData.version,
          info: pdfData.info,
        });
        return;
      }
    }

    // Create documents from the extracted text
    const rawDocs = [
      new Document({
        pageContent: pdfData.text,
        metadata: {
          source: fileUrl,
          fileName: fileName,
          totalPages: pdfData.numpages,
        },
      }),
    ];

    console.log('[IngestPDF:Background] Created', rawDocs.length, 'document(s) from PDF text');

    /* Split text into chunks */
    console.log('[IngestPDF:Background] Splitting text into chunks...');
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await textSplitter.splitDocuments(rawDocs);

    console.log('[IngestPDF:Background] Split into', splitDocs.length, 'chunks');

    if (splitDocs.length === 0) {
      console.warn('[IngestPDF:Background] No text chunks created');
      return;
    }

    // Add metadata to identify which document these embeddings belong to
    for (const splitDoc of splitDocs) {
      splitDoc.metadata.docstore_document_id = namespace;
    }

    console.log('[IngestPDF:Background] Creating vector store...');

    /* create and store the embeddings in the vectorStore */
    const embeddings = loadEmbeddingsModel();

    const store = await loadVectorStore({
      namespace: namespace.toString(),
      embeddings,
    });
    const vectorstore = store.vectorstore;
    if ('mongoDbClient' in store) {
      mongoDbClient = store.mongoDbClient;
    }

    console.log('[IngestPDF:Background] Adding', splitDocs.length, 'documents to vector store...');
    // embed the PDF documents
    await vectorstore.addDocuments(splitDocs);
    console.log('[IngestPDF:Background] ✓ Successfully completed embedding for doc:', namespace);

  } catch (error: any) {
    console.error('[IngestPDF:Background] ✗ Error processing embeddings:', error.message || error);
  } finally {
    if (mongoDbClient) {
      try {
        await mongoDbClient.close();
      } catch (closeError) {
        console.error('[IngestPDF:Background] Error closing MongoDB client:', closeError);
      }
    }
  }
}
