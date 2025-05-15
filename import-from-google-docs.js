// import-from-google-docs.js - A CommonJS script to import data from Google Docs to Pinecone
require('dotenv').config({ path: '.env.local' });

// Import required modules
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { Pinecone } = require('@pinecone-database/pinecone');

// Check for required Azure OpenAI environment variables
if (!process.env.AZURE_OPENAI_API_KEY) {
  throw new Error('AZURE_OPENAI_API_KEY environment variable is not set');
}

if (!process.env.AZURE_OPENAI_ENDPOINT) {
  throw new Error('AZURE_OPENAI_ENDPOINT environment variable is not set');
}

// Set up Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Get the index we'll be using
const index = pinecone.Index(process.env.PINECONE_INDEX);

/**
 * Generates embeddings for text using Azure OpenAI
 */
async function getEmbedding(text) {
  try {
    // Use the configured embedding model from environment variables or default to this name
    const model = process.env.AZURE_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002';
    console.log(`Using embedding model: ${model}`);
    
    // Azure OpenAI requires a specific URL format
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    const apiKey = process.env.AZURE_OPENAI_API_KEY || '';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2023-05-15';
    
    // Remove trailing slash from endpoint if present
    const baseUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
    
    // Format the URL according to Azure OpenAI requirements
    const url = `${baseUrl}/openai/deployments/${model}/embeddings?api-version=${apiVersion}`;
    
    console.log(`Calling Azure OpenAI embeddings endpoint: ${url}`);
    
    // Make a direct POST request to the Azure API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        input: text
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Azure OpenAI API error:', errorData);
      throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Upload QA pairs and general sources to Pinecone as separate records
 */
async function uploadQAPairsToPinecone(qaPairs, generalSources) {
  try {
    console.log(`Processing ${qaPairs.length} QA pairs and ${generalSources.length} general sources for ingestion...`);
    
    // Process QA pairs in batches to avoid API rate limits
    const batchSize = 10;
    const qaBatches = [];
    
    for (let i = 0; i < qaPairs.length; i += batchSize) {
      qaBatches.push(qaPairs.slice(i, i + batchSize));
    }
    
    // Process and upload QA pairs
    let qaCounter = 0;
    for (const batch of qaBatches) {
      const qaVectors = await Promise.all(
        batch.map(async (pair) => {
          // Generate embedding for each question
          const embedding = await getEmbedding(pair.question);
          
          // Create a unique ID for each QA vector
          const id = `q${qaCounter++}`;
          
          // Create metadata
          const metadata = {
            type: 'qa_pair',
            question: pair.question,
            answer: pair.answer
          };
          
          return {
            id,
            values: embedding,
            metadata
          };
        })
      );
      
      // Upsert QA vectors to Pinecone
      await index.upsert(qaVectors);
      console.log(`Uploaded batch of ${batch.length} QA pairs to Pinecone`);
    }
    
    // Process general sources in batches
    const generalBatches = [];
    for (let i = 0; i < generalSources.length; i += batchSize) {
      generalBatches.push(generalSources.slice(i, i + batchSize));
    }
    
    // Process and upload general sources as separate records
    let generalCounter = 0;
    for (const batch of generalBatches) {
      const generalVectors = await Promise.all(
        batch.map(async (source) => {
          // Generate embedding for each general source
          const embedding = await getEmbedding(source);
          
          // Create a unique ID for each general source vector
          const id = `g${generalCounter++}`;
          
          // Create metadata
          const metadata = {
            type: 'general_source',
            content: source
          };
          
          return {
            id,
            values: embedding,
            metadata
          };
        })
      );
      
      // Upsert general source vectors to Pinecone
      await index.upsert(generalVectors);
      console.log(`Uploaded batch of ${batch.length} general sources to Pinecone`);
    }
    
    console.log(`Successfully ingested ${qaPairs.length} QA pairs into Pinecone`);
    console.log(`Successfully ingested ${generalSources.length} general sources as separate records in Pinecone`);
  } catch (error) {
    console.error('Error uploading data to Pinecone:', error);
    throw new Error('Failed to upload data to Pinecone');
  }
}

/**
 * Parses content from a Google Doc
 * Expected formats:
 * Q: Question
 * A: Answer
 * G: General information
 */
function parseDocContent(content) {
  const qaPairs = [];
  const generalSources = [];
  
  // Split the content by lines and process
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
  
  // First, collect all general sources
  for (const line of lines) {
    if (line.startsWith('G:')) {
      const generalSource = line.substring(2).trim();
      if (generalSource) {
        generalSources.push(generalSource);
      }
    }
  }
  
  console.log(`Found ${generalSources.length} general sources`);
  
  for (const line of lines) {
    // Check if the line contains both Q: and A: on the same line
    if (line.startsWith('Q:') && line.includes('A:')) {
      // Extract the question and answer from the same line
      const parts = line.split('A:');
      if (parts.length >= 2) {
        let question = parts[0].substring(2).trim(); // Remove 'Q:' prefix
        let answer = parts[1].trim();
        
        // Remove any special characters between Q and A
        question = question.replace(/[^\w\s.,?!;:()'"-]/g, ' ').trim();
        
        qaPairs.push({ 
          question, 
          answer
        });
      }
    } else if (line.startsWith('Q:')) {
      // Old logic for handling Q: and A: on separate lines
      const question = line.substring(2).trim();
      // Look for the corresponding answer in the next line
      const nextIndex = lines.indexOf(line) + 1;
      if (nextIndex < lines.length && lines[nextIndex].startsWith('A:')) {
        const answer = lines[nextIndex].substring(2).trim();
        qaPairs.push({ 
          question, 
          answer
        });
      } else {
        console.warn(`Question without answer: ${question}`);
      }
    }
  }
  
  console.log(`Found ${qaPairs.length} valid Q&A pairs`);
  return { qaPairs, generalSources };
}

/**
 * Loads QA pairs and general sources from a Google Doc
 */
async function loadQAPairsFromSheet() {
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
    
    // Parse the document content to find Q&A pairs and general sources
    const { qaPairs, generalSources } = parseDocContent(fullText);
    
    console.log(`Loaded ${qaPairs.length} QA pairs and ${generalSources.length} general sources from Google Docs`);
    return { qaPairs, generalSources };
  } catch (error) {
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

/**
 * Main function to import QA pairs from Google Docs
 */
async function importQAPairsFromGoogleDocs() {
  try {
    console.log('Starting import of Q&A pairs and general sources from Google Docs to Pinecone...');
    
    // Load Q&A pairs from Google Docs
    const { qaPairs, generalSources } = await loadQAPairsFromSheet();
    
    if (qaPairs.length === 0) {
      console.log('No Q&A pairs found in the Google Doc. Make sure the document has content with "Q:" and "A:" prefixes.');
      return;
    }
    
    console.log(`Successfully loaded ${qaPairs.length} Q&A pairs from Google Docs.`);
    console.log(`Found ${generalSources.length} general sources that will be used for low-confidence answers.`);
    console.log(`Uploading all data to Pinecone...`);
    
    // Upload Q&A pairs to Pinecone
    await uploadQAPairsToPinecone(qaPairs, generalSources);
    
    console.log(`Successfully imported ${qaPairs.length} Q&A pairs and ${generalSources.length} general sources to Pinecone!`);
  } catch (error) {
    console.error('Error importing data from Google Docs to Pinecone:', error);
    process.exit(1);
  }
}

// Execute the import function
importQAPairsFromGoogleDocs();