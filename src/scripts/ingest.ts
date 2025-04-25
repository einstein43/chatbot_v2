import { getEmbedding } from '../lib/openai';
import { index } from '../lib/pinecone';

/**
 * Ingest QA pairs into Pinecone
 * This script can be run to load your QA dataset into Pinecone
 */

interface QAPair {
  question: string;
  answer: string;
  generalSources?: string[];
}

/**
 * Upload a batch of QA pairs to Pinecone
 */
export async function uploadQAPairsToPinecone(qaPairs: QAPair[]) {
  try {
    console.log(`Processing ${qaPairs.length} QA pairs for ingestion...`);
    
    // Process in batches to avoid API rate limits
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < qaPairs.length; i += batchSize) {
      batches.push(qaPairs.slice(i, i + batchSize));
    }
    
    let counter = 0;
    for (const batch of batches) {
      const vectors = await Promise.all(
        batch.map(async (pair) => {
          // Generate embedding for each question
          const embedding = await getEmbedding(pair.question);
          
          // Create a unique ID for each vector
          const id = `q${counter++}`;
          
          // Create metadata including general sources if available
          const metadata: any = {
            question: pair.question,
            answer: pair.answer
          };
          
          // Add general sources to metadata if they exist
          if (pair.generalSources && pair.generalSources.length > 0) {
            metadata.generalSources = pair.generalSources;
          }
          
          return {
            id,
            values: embedding,
            metadata
          };
        })
      );
      
      // Upsert vectors to Pinecone
      await index.upsert(vectors);
      console.log(`Uploaded batch of ${batch.length} QA pairs to Pinecone`);
    }
    
    console.log(`Successfully ingested ${qaPairs.length} QA pairs into Pinecone`);
  } catch (error) {
    console.error('Error uploading QA pairs to Pinecone:', error);
    throw new Error('Failed to upload QA pairs to Pinecone');
  }
}

// Example usage:
// To use this script, uncomment the code below and run it with: npx ts-node scripts/ingest.ts

// const exampleQAPairs: QAPair[] = [
//   {
//     question: "What are your business hours?",
//     answer: "We are open Monday through Friday from 9am to 5pm."
//   },
//   {
//     question: "How do I reset my password?",
//     answer: "You can reset your password by clicking on the 'Forgot Password' link on the login page."
//   },
//   {
//     question: "Where is your office located?",
//     answer: "Our main office is located at 123 Business Avenue, Suite 500, in downtown."
//   }
// ];

// // Self-executing async function
// (async () => {
//   try {
//     await uploadQAPairsToPinecone(exampleQAPairs);
//     console.log('Data ingestion complete!');
//   } catch (error) {
//     console.error('Data ingestion failed:', error);
//   }
// })();
