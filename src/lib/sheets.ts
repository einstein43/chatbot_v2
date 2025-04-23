/**
 * Utility functions for loading data from Google Sheets
 * This is an optional data source for Pinecone
 * 
 * Note: To use this, you'll need to:
 * 1. Uncomment the Google Sheets environment variables in .env.local
 * 2. Install the google-spreadsheet package with: npm install google-spreadsheet
 * 3. Uncomment the import and code below
 */

// import { GoogleSpreadsheet } from 'google-spreadsheet';

/**
 * Loads QA pairs from a Google Sheet
 * Expected format: Sheet with columns "Question" and "Answer"
 */
export async function loadQAPairsFromSheet() {
  // Uncomment this code when ready to use Google Sheets
  
  /*
  if (!process.env.GOOGLE_SHEETS_ID) {
    throw new Error('GOOGLE_SHEETS_ID environment variable is not set');
  }
  
  if (!process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
    throw new Error('GOOGLE_SHEETS_PRIVATE_KEY environment variable is not set');
  }
  
  if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
    throw new Error('GOOGLE_SHEETS_CLIENT_EMAIL environment variable is not set');
  }

  try {
    // Initialize the Google Sheet
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID);
    
    // Auth with service account
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
    
    await doc.loadInfo();
    
    // Get the first sheet
    const sheet = doc.sheetsByIndex[0];
    
    // Load rows
    const rows = await sheet.getRows();
    
    // Format into QA pairs
    const qaPairs = rows.map(row => ({
      question: row.Question,
      answer: row.Answer
    })).filter(pair => pair.question && pair.answer);
    
    return qaPairs;
  } catch (error) {
    console.error('Error loading data from Google Sheets:', error);
    throw new Error('Failed to load data from Google Sheets');
  }
  */
  
  return [];
}