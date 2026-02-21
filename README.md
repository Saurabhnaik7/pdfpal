# PDFPal - Chat with Your PDFs

A modern RAG (Retrieval-Augmented Generation) application that allows you to upload PDF documents and have natural conversations about their content. Built with Next.js, MongoDB Atlas Vector Search, and powered by Cohere embeddings and Groq LLM.

## 🚀 Features

- **PDF Upload & Processing**: Upload PDF files with automatic text extraction and chunking
- **Vector Search**: Efficient semantic search using MongoDB Atlas Vector Search with 1024-dimensional Cohere embeddings
- **RAG Chat**: Context-aware conversations with your documents using Groq's Llama 3.3 70B model
- **Background Processing**: Immediate user feedback with async embedding generation
- **User Authentication**: Cookie-based session management
- **Document Management**: Track multiple documents per user (up to 3 documents)
- **Responsive UI**: Modern interface built with React and Tailwind CSS

## 🛠️ Technology Stack

- **Framework**: Next.js 13 (App Router)
- **Vector Database**: MongoDB Atlas with Vector Search
- **Embeddings**: Cohere (embed-english-v3.0, 1024 dimensions, free tier)
- **LLM**: Groq (llama-3.3-70b-versatile)
- **File Storage**: Vercel Blob Storage
- **Database**: PostgreSQL (Neon) for metadata
- **ORM**: Prisma
- **PDF Processing**: pdf-parse
- **RAG Framework**: LangChain
- **UI**: React, Tailwind CSS, Radix UI

## 📋 Prerequisites

- Node.js 18+ and npm
- MongoDB Atlas account (free tier works)
- Cohere API key (free tier available at https://cohere.com)
- Groq API key (free tier available at https://console.groq.com)
- Vercel Blob Storage (or Vercel account)
- PostgreSQL database (Neon free tier works)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pdfpal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # === Database Configuration ===
   # PostgreSQL database for metadata (users, documents)
   DATABASE_URL="postgresql://username:password@host/database"

   # === Vector Store Configuration ===
   NEXT_PUBLIC_VECTORSTORE="mongodb"

   # MongoDB Atlas connection string (standard format, not SRV)
   # Format: mongodb://username:password@host1:port1,host2:port2,host3:port3/database?replicaSet=yourReplicaSet
   MONGODB_URI="mongodb://your_username:your_password@host1:27017,host2:27017,host3:27017/your_database?replicaSet=your-replica-set"

   # MongoDB database and collection names
   MONGODB_DB="pdfpal"
   MONGODB_COLLECTION="pdf_embeddings"

   # === API Keys (Active) ===
   # Groq API key for LLM chat responses
   GROQ_API_KEY="gsk_your_groq_api_key_here"

   # Cohere API key for embeddings (1024 dimensions)
   COHERE_API_KEY="your_cohere_api_key_here"

   # === Vercel Blob Storage ===
   BLOB_READ_WRITE_TOKEN="your_blob_token_here"
   ```

4. **Set up PostgreSQL database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Configure MongoDB Atlas Vector Search**

   a. Create a MongoDB Atlas cluster (free tier M0 works)
   
   b. Create a database named `pdfpal` with a collection named `pdf_embeddings`
   
   c. **IMPORTANT**: Create a vector search index on the `pdf_embeddings` collection:
   
   - Go to Atlas Search → Create Search Index → JSON Editor
   - Use this configuration:
   ```json
   {
     "fields": [
       {
         "type": "vector",
         "path": "embedding",
         "numDimensions": 1024,
         "similarity": "cosine"
       },
       {
         "type": "filter",
         "path": "docstore_document_id"
       }
     ]
   }
   ```
   - Name the index: `vector_index`
   
   d. Get your connection string:
   - Go to Database → Connect → Connect your application
   - Choose "Drivers" and select Node.js
   - **Use the standard connection string format** (not SRV), it looks like:
     ```
     mongodb://username:password@host1:27017,host2:27017,host3:27017/database?replicaSet=atlas-xxxxx-shard-0
     ```
   
   e. Whitelist your IP address in Network Access (or use 0.0.0.0/0 for development)

6. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📝 Usage

1. **Sign Up / Sign In**: Create an account or log in
2. **Upload PDF**: Click the upload button and select a PDF file (max 3 documents per user)
3. **Wait for Processing**: The PDF is processed in the background (usually takes 10-30 seconds)
4. **Start Chatting**: Once processed, ask questions about your document
5. **Context-Aware Responses**: The AI retrieves relevant sections and provides accurate answers

## 🔍 How It Works

1. **Upload**: PDF file is uploaded to Vercel Blob Storage
2. **Text Extraction**: pdf-parse extracts text from the PDF
3. **Chunking**: Text is split into 1000-character chunks with 200-character overlap
4. **Embedding**: Each chunk is converted to a 1024-dimensional vector using Cohere
5. **Storage**: Vectors are stored in MongoDB Atlas with metadata
6. **Query**: User questions are embedded and used for vector similarity search
7. **Retrieval**: Top relevant chunks are retrieved from MongoDB
8. **Generation**: Groq LLM generates a response based on retrieved context

## 🐛 Troubleshooting

### MongoDB Connection Issues

**Error**: `ECONNREFUSED` or DNS resolution failures
- **Solution**: Use standard MongoDB connection string format (not `mongodb+srv://`)
- Ensure your IP is whitelisted in MongoDB Atlas Network Access
- Check that the replica set name is correct in your connection string

### Vector Search Not Working

**Error**: `$vectorSearch is not allowed with 'apiStrict: true'`
- **Solution**: Already fixed - we removed `serverApi: { strict: true }` from MongoDB client config

### Dimension Mismatch

**Error**: `Dimension mismatch: expected 768 but got 1024`
- **Solution**: Ensure your MongoDB Atlas vector index is configured for 1024 dimensions (Cohere embed-english-v3.0)
- Recreate the index if needed with the correct dimensions

### No Documents Retrieved

**Error**: Chat returns "No documents found"
- Check that the PDF processing completed (check console logs for `[IngestPDF:Background] ✓ Successfully completed`)
- Verify the vector index exists and is active in MongoDB Atlas
- Ensure the `docstore_document_id` filter field is included in the index

### PDF Parsing Errors

**Error**: "Could not extract text from PDF"
- The PDF might be scanned images without OCR
- Try using a text-based PDF instead
- Consider implementing OCR with a service like Tesseract (not included)

## 📊 Logging

The application uses consistent `[Module]` prefix logging for easy debugging:

- `[IngestPDF]` - Main PDF upload and document creation
- `[IngestPDF:Background]` - Background embedding processing
- `[Chat]` - Chat API request handling
- `[Retriever]` - Document retrieval from vector store
- `[MongoDB]` - MongoDB connection and operations
- `[Embeddings]` - Embedding model initialization
- `[RAG]` - RAG chain creation and execution

Check your console for detailed operation logs.

## 🚀 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import project in Vercel
3. Add all environment variables from `.env`
4. Deploy

**Important**: Ensure MongoDB Atlas allows connections from Vercel IPs (0.0.0.0/0 for simplicity)

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 💡 Tips

- **Free Tier Limits**:
  - Cohere: 1000 API calls/month (free tier)
  - Groq: High rate limits on free tier
  - MongoDB Atlas: 512MB storage on M0 (free tier)
  - Vercel Blob: 1GB storage (free tier)

- **Optimization**:
  - Adjust chunk size in [ingestPdf/route.ts](app/api/ingestPdf/route.ts) (currently 1000 chars)
  - Modify retrieval k parameter in [vector_store/index.ts](app/api/utils/vector_store/index.ts) (default 4 documents)
  - Temperature setting in [chat/route.ts](app/api/chat/route.ts) (currently 0 for deterministic responses)

## 📞 Support

For issues and questions:
- Check the Troubleshooting section above
- Review console logs for detailed error information
- Ensure all API keys are valid and have sufficient quota
