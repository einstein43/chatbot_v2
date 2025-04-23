// Load environment variables from .env.local
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { loadQAPairsFromSheet } from '../lib/sheets';
import { uploadQAPairsToPinecone } from './ingest';

/**
 * Script to import validated Q&A pairs from Google Docs into Pinecone
 * 
 * To use this script:
 * 1. Set up Google Docs:
 *    - Make sure service-account-key.json is in the root directory
 *    - Add your Google Doc ID to .env.local: GOOGLE_DOCS_ID=your-doc-id
 *    - Share your Google Doc with the service account email address from the key file
 *    - Format your document with "Q:" and "A:" prefixes for questions and answers
 * 
 * 2. Run the script with: npx ts-node src/scripts/import-from-sheets.ts
 */

async function importQAPairsFromGoogleDocs() {
  try {
    console.log('Starting import of Q&A pairs from Google Docs to Pinecone...');
    
    // Load Q&A pairs from Google Docs
    const qaPairs = await loadQAPairsFromSheet();
    
    if (qaPairs.length === 0) {
      console.log('No Q&A pairs found in the Google Doc. Make sure the document has content with "Q:" and "A:" prefixes.');
      return;
    }
    
    console.log(`Successfully loaded ${qaPairs.length} Q&A pairs from Google Docs. Uploading to Pinecone...`);
    
    // Upload Q&A pairs to Pinecone
    await uploadQAPairsToPinecone(qaPairs);
    
    console.log(`Successfully imported ${qaPairs.length} Q&A pairs from Google Docs to Pinecone!`);
  } catch (error) {
    console.error('Error importing Q&A pairs from Google Docs to Pinecone:', error);
    process.exit(1);
  }
}

// Execute the import function
if (require.main === module) {
  importQAPairsFromGoogleDocs();
}