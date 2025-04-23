import { Pinecone } from '@pinecone-database/pinecone';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY environment variable is not set');
}

if (!process.env.PINECONE_INDEX) {
  throw new Error('PINECONE_INDEX environment variable is not set');
}

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
  // The 'environment' parameter is no longer needed for Pinecone Serverless
});

// Get the index we'll be using
export const index = pinecone.Index(process.env.PINECONE_INDEX);

/**
 * Queries Pinecone for similar vectors
 * @param embedding The embedding vector to search for
 * @param topK Number of most similar vectors to return
 * @returns Promise with the query results
 */
export async function querySimilarQuestions(embedding: number[], topK: number = 1) {
  try {
    const results = await index.query({
      vector: embedding,
      topK,
      includeMetadata: true,
    });

    return results.matches;
  } catch (error) {
    console.error('Error querying Pinecone:', error);
    throw new Error('Failed to query Pinecone');
  }
}