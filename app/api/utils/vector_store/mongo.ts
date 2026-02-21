import { MongoClient, ServerApiVersion } from 'mongodb';
import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';
import { Embeddings } from '@langchain/core/embeddings';

export async function loadMongoDBStore({
  embeddings,
}: {
  embeddings: Embeddings;
}) {
  const uri = process.env.MONGODB_ATLAS_URI ?? '';
  
  if (!uri) {
    throw new Error('MONGODB_ATLAS_URI environment variable is not set');
  }

  console.log('[MongoDB] Attempting to connect to MongoDB Atlas...');
  
  const mongoDbClient = new MongoClient(uri, {
    // Remove serverApi strict mode - it blocks $vectorSearch
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await mongoDbClient.connect();
    console.log('[MongoDB] Successfully connected to MongoDB Atlas');
    
    // Ping to verify connection
    await mongoDbClient.db('admin').command({ ping: 1 });
    console.log('[MongoDB] Connection verified');

    const dbName = process.env.MONGODB_ATLAS_DB_NAME ?? '';
    const collectionName = process.env.MONGODB_ATLAS_COLLECTION_NAME ?? '';
    
    if (!dbName || !collectionName) {
      throw new Error('MongoDB database name or collection name not set');
    }
    
    const collection = mongoDbClient.db(dbName).collection(collectionName);

    const vectorstore = new MongoDBAtlasVectorSearch(embeddings, {
      indexName: process.env.MONGODB_ATLAS_INDEX_NAME ?? 'vector_index',
      collection,
    });

    return {
      vectorstore,
      mongoDbClient,
    };
  } catch (error) {
    await mongoDbClient.close();
    console.error('MongoDB connection error:', error);
    throw error;
  }
}
