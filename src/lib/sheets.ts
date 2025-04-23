/**
 * Utility functions for loading data from Google Docs
 * This is an optional data source for Pinecone
 */

import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for QA pairs loaded from Google Docs
 */
export interface QAPair {
  question: string;
  answer: string;
}

/**
 * Parses Q&A content from a Google Doc
 * Expected format may be either:
 * Q: Question 1
 * A: Answer 1
 * 
 * Or with the question and answer on the same line:
 * Q: Question 1♂ A: Answer 1
 * 
 * @param content The document content as string
 * @returns Array of QA pairs
 */
function parseQAFormat(content: string): QAPair[] {
  const qaPairs: QAPair[] = [];
  
  // Split the content by lines and process
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
  
  for (const line of lines) {
    // Check if the line contains both Q: and A: on the same line
    if (line.startsWith('Q:') && line.includes('A:')) {
      // Extract the question and answer from the same line
      const parts = line.split('A:');
      if (parts.length >= 2) {
        let question = parts[0].substring(2).trim(); // Remove 'Q:' prefix
        let answer = parts[1].trim();
        
        // Remove any special characters (like ♂) between Q and A
        question = question.replace(/[^\w\s.,?!;:()'"-]/g, ' ').trim();
        
        qaPairs.push({ question, answer });
      }
    } else if (line.startsWith('Q:')) {
      // Old logic for handling Q: and A: on separate lines
      const question = line.substring(2).trim();
      // Look for the corresponding answer in the next line
      const nextIndex = lines.indexOf(line) + 1;
      if (nextIndex < lines.length && lines[nextIndex].startsWith('A:')) {
        const answer = lines[nextIndex].substring(2).trim();
        qaPairs.push({ question, answer });
      } else {
        console.warn(`Question without answer: ${question}`);
      }
    }
  }
  
  console.log(`Found ${qaPairs.length} valid Q&A pairs`);
  return qaPairs;
}

/**
 * Loads QA pairs from a Google Doc with Q: A: format
 * Expected format: 
 * Q: Question
 * A: Answer
 */
export async function loadQAPairsFromSheet(): Promise<QAPair[]> {
  if (!process.env.GOOGLE_DOCS_ID) {
    throw new Error('GOOGLE_DOCS_ID environment variable is not set');
  }

  try {
    // Load the service account key file
    const keyFilePath = path.join(process.cwd(), 'service-account-key.json');
    const serviceAccountCreds = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
    
    // Set up Google Auth
    const auth = new google.auth.JWT({
      email: serviceAccountCreds.client_email,
      key: serviceAccountCreds.private_key,
      scopes: ['https://www.googleapis.com/auth/documents.readonly']
    });
    
    // Initialize the Google Docs API
    const docs = google.docs({ version: 'v1', auth });
    
    // Get the document content
    const response = await docs.documents.get({
      documentId: process.env.GOOGLE_DOCS_ID
    });
    
    const document = response.data;
    
    if (!document || !document.body || !document.body.content) {
      throw new Error('Document body is empty or not accessible');
    }
    
    // Extract text content from the document
    let fullText = '';
    
    // Process all content elements
    document.body.content.forEach(item => {
      if (item.paragraph && item.paragraph.elements) {
        item.paragraph.elements.forEach(element => {
          if (element.textRun && element.textRun.content) {
            fullText += element.textRun.content;
          }
        });
      } else if (item.table) {
        // Handle tables if present
        if (item.table.tableRows) {
          item.table.tableRows.forEach(row => {
            if (row.tableCells) {
              row.tableCells.forEach(cell => {
                if (cell.content) {
                  cell.content.forEach(cellItem => {
                    if (cellItem.paragraph && cellItem.paragraph.elements) {
                      cellItem.paragraph.elements.forEach(element => {
                        if (element.textRun && element.textRun.content) {
                          fullText += element.textRun.content;
                        }
                      });
                    }
                  });
                }
              });
            }
            // Add a newline after each row to maintain structure
            fullText += '\n';
          });
        }
      }
    });
    
    console.log('Successfully extracted content from Google Doc');
    
    // Parse the document content to find Q&A pairs
    const qaPairs = parseQAFormat(fullText);
    
    console.log(`Loaded ${qaPairs.length} QA pairs from Google Docs`);
    return qaPairs;
  } catch (error: any) {
    console.error('Error loading data from Google Docs:', error);
    
    // Better error reporting
    let errorMessage = 'Unknown error';
    
    if (error.message) {
      errorMessage = error.message;
    } else if (error.response && error.response.data && error.response.data.error) {
      // Handle Google API specific errors
      const apiError = error.response.data.error;
      errorMessage = `Google API error - [${apiError.code}] ${apiError.message}`;
      
      // Add guidance for common errors
      if (apiError.status === 'PERMISSION_DENIED') {
        errorMessage += '. Make sure you have shared the document with the service account email from your service-account-key.json file';
      } else if (apiError.status === 'NOT_FOUND') {
        errorMessage += '. Check if the document ID is correct in your .env.local file';
      }
    }
    
    throw new Error(`Failed to load data from Google Docs: ${errorMessage}`);
  }
}