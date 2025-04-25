# Chatbot v2 - Project Summary

## Overview

This is a serverless question-answering chatbot powered by OpenAI embeddings and Pinecone vector database. The system enables semantic searching through Q&A pairs and general information sources, with a fallback mechanism for low-confidence matches.

## Architecture

The project follows a serverless architecture:
- **Frontend**: Client application that sends queries to the API
- **API**: Serverless functions that process queries and return responses
- **Vector Database**: Pinecone for storing and retrieving vector embeddings

## Key Components

### Data Sources
- **Google Docs**: Primary data source where Q&A pairs and general information can be maintained
- **Manual Entry**: Support for manual entry of Q&A pairs via code

### Data Processing
- **Embeddings**: OpenAI text embeddings for semantic representation of questions
- **Vector Storage**: Pinecone vector database for efficient similarity search
- **Data Types**: Two record types in the database:
  - Q&A pairs (type: "qa_pair")
  - General information sources (type: "general_source")

### API Endpoints
- **/api/query/**: Processes natural language questions and returns best matching answers

## Key Files

### Data Management
- **import-from-google-docs.js**: Script for ingesting data from Google Docs into Pinecone
  - Processes content prefixed with "Q:", "A:", and "G:" from Google Docs
  - Creates separate records for Q&A pairs and general information
  - Generates vector embeddings via OpenAI
  - Stores records in Pinecone with appropriate metadata
  
- **src/scripts/ingest.ts**: TypeScript template for data ingestion (alternative to the JS script)

### Core Libraries
- **src/lib/openai.ts**: Handles interactions with OpenAI API
  - Generates text embeddings for semantic similarity
  
- **src/lib/pinecone.ts**: Manages Pinecone vector database operations
  - Upserts new records
  - Queries for similar vectors
  
- **src/lib/sheets.ts**: Provides functionality for loading data from Google Docs
  - Authenticates with Google APIs
  - Processes document content

### API Routes
- **src/app/api/query/route.ts**: Serverless API endpoint for handling queries
  - Receives natural language questions
  - Converts questions to vector embeddings
  - Searches Pinecone for similar vectors
  - Returns best-matching answers

## Data Format

### Google Doc Format
- **Q: [Question]**: Marks the start of a question
- **A: [Answer]**: Provides the answer to a question
- **G: [Information]**: General information used for low-confidence matches

### Pinecone Records
- **QA Pairs**:
  - ID format: `q[number]` (e.g., q0, q1, q2)
  - Metadata: `{ type: "qa_pair", question: "...", answer: "..." }`
  
- **General Sources**:
  - ID format: `g[number]` (e.g., g0, g1, g2)
  - Metadata: `{ type: "general_source", content: "..." }`

## Search Process

1. User submits a question
2. Question is converted to a vector embedding
3. Pinecone searches for similar vectors
4. If a QA pair with high confidence (>0.85) is found, its answer is returned
5. If no high-confidence match exists, general information sources are leveraged for response

## Configuration

Environment variables (.env.local):
- `OPENAI_API_KEY`: For generating embeddings
- `PINECONE_API_KEY`: For accessing Pinecone
- `PINECONE_INDEX`: Name of the Pinecone index
- `GOOGLE_DOCS_ID`: ID of the Google Doc containing QA data (optional)

## Deployment

- Designed for easy deployment on Vercel or similar serverless platforms
- Next.js framework for API routes
- No database requirements other than Pinecone