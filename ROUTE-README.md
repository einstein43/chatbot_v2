# API Route Documentation: Query Endpoint

## Overview

This document provides an in-depth explanation of the functionality in the `/api/query/route.ts` file, which implements a sophisticated question-answering API endpoint. The system uses a combination of AI embedding, vector search, and natural language generation to provide accurate answers to user questions.

## Technology Stack

- **Next.js**: Server-side framework for the API endpoint
- **OpenAI**: For generating embeddings and AI-generated answers
- **Pinecone**: Vector database for similarity search
- **TypeScript**: For type safety and improved code quality

## API Endpoints

The file exposes three HTTP methods:

### 1. OPTIONS

```typescript
export async function OPTIONS() {
  return NextResponse.json({}, { 
    status: 204, 
    headers: corsHeaders
  });
}
```

**Purpose**: Handles CORS preflight requests, allowing cross-origin access to the API.

### 2. POST

```typescript
export async function POST(request: NextRequest) { ... }
```

**Purpose**: The main endpoint that processes user questions and returns answers.

### 3. GET

```typescript
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  }, { headers: corsHeaders });
}
```

**Purpose**: A simple health check endpoint to verify the API is operational.

## Request Processing Flow

The POST endpoint follows a sophisticated decision tree to generate the most accurate responses:

1. **Request Parsing**:
   - Extracts the question and optional `topK` parameter from the request body
   - Validates that a question is provided

2. **Embedding Generation**:
   - Converts the question text into a vector embedding using OpenAI
   - This embedding captures the semantic meaning of the question

3. **Similar Question Search**:
   - Queries Pinecone for similar pre-existing questions using the embedding
   - Defaults to retrieving 3 similar questions (configurable via `topK`)

4. **Answer Generation Strategy**:
   - The system uses a multi-layered approach to find the best answer:

### Answer Generation Decision Tree

```
If no similar questions found:
    Query general knowledge sources
    If no general sources found:
        Return generic "insufficient information" response
    Else:
        Generate answer from general sources using OpenAI
Else:
    If best match confidence < CONFIDENCE_THRESHOLD (0.80):
        Query general knowledge sources
        If no general sources found:
            Generate answer based on similar questions using OpenAI
        Else:
            Generate answer from general sources using OpenAI
    Else:
        Return the answer from the best matching question directly
```

## Confidence Threshold Mechanism

The system uses a confidence threshold (set at 0.80) to determine when to trust direct matches versus when to generate new answers:

```typescript
const CONFIDENCE_THRESHOLD = 0.80;
```

When a match has a confidence score below this threshold, the system falls back to more sophisticated answer generation strategies rather than returning the matched answer directly.

## Response Types

The API can return several types of responses depending on the available data:

1. **Direct Match** (`source: 'pinecone_direct'`):
   - When a highly confident match is found
   - Returns the pre-existing answer directly

2. **Generated from General Sources** (`source: 'general_sources'`):
   - When no confident match is found but general knowledge is available
   - Returns an AI-generated answer based on general knowledge sources

3. **Generated from Similar Questions** (`source: 'similar_questions'`):
   - When confidence is low and no general sources are found
   - Returns an AI-generated answer based on similar questions

4. **No Information** (`source: 'no_sources'`):
   - When no matches or general knowledge is available
   - Returns a generic "insufficient information" response

## Response Format

All successful responses follow this structure:

```typescript
{
  question: string,        // The original question
  answer: string,          // The generated or retrieved answer
  confidence: number,      // Confidence score (0-1)
  similarQuestions: Array<{
    question: string,      // Similar question text
    score: number          // Similarity score
  }>,
  source: string           // Source of the answer (see Response Types)
}
```

## Error Handling

The API implements comprehensive error handling:

1. **Missing Question**:
   - Returns a 400 status with an error message

2. **Processing Errors**:
   - Catches and logs any errors during processing
   - Returns a 500 status with a generic error message

## CORS Configuration

The API supports cross-origin requests with these headers:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

This configuration allows the API to be called from any origin, making it suitable for integration with frontend applications hosted on different domains.

## Integration Points

This API integrates with several external services and libraries:

1. **OpenAI**: For embedding generation and answer synthesis
   - `getEmbedding`: Converts text to vector embeddings
   - `generateAnswer`: Creates answers based on similar questions
   - `generateAnswerFromGeneralSources`: Creates answers from general knowledge sources

2. **Pinecone**: For vector similarity search
   - `querySimilarQuestions`: Finds similar pre-existing questions
   - `queryGeneralSources`: Retrieves general knowledge articles

## Performance Considerations

- The API uses `console.log` statements to track processing steps, useful for debugging
- Embedding generation and AI answer generation may introduce latency
- The multi-tier fallback strategy ensures answers are provided even when direct matches aren't found

## Usage Example

A typical request to this API would look like:

```javascript
const response = await fetch('/api/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    question: 'What services does your company offer?',
    topK: 5  // optional
  })
});

const result = await response.json();
```





# Serverless QA API with Azure OpenAI Embeddings and Pinecone Vector DB

A serverless API built on Vercel that:
- Receives a question from Voiceflow
- Embeds the question using Azure OpenAI
- Queries Pinecone Serverless for the most similar question
- Returns the matching answer

## Tech Stack

- **Vercel**: For serverless deployment
- **Next.js**: For API routes and serverless functions
- **Pinecone Serverless**: Vector database for semantic search
- **Azure OpenAI**: For creating vector representations of questions and generating answers
- **Google Docs** (Optional): As a data source for QA pairs

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Vercel account for deployment
- Azure OpenAI resource with appropriate deployments
- Pinecone account with a serverless index
- (Optional) Google service account with Docs API access

### Environment Setup

1. Clone this repository
2. Install dependencies: `npm install`
3. Copy `.env.local.example` to create your own `.env.local` file:

```
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_azure_openai_api_key
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_OPENAI_API_VERSION=2023-12-01-preview

# Azure OpenAI Deployment Names
AZURE_EMBEDDING_DEPLOYMENT=embedding-deployment-name
AZURE_EMBEDDING_DEPLOYMENT_LARGE=embedding-large-deployment-name
AZURE_COMPLETION_DEPLOYMENT_FAST=gpt-35-turbo-deployment-name
AZURE_COMPLETION_DEPLOYMENT_STANDARD=gpt-4-deployment-name
AZURE_COMPLETION_DEPLOYMENT_PRECISE=gpt-4-precise-deployment-name

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=your_pinecone_index

# Optional: Google Docs API
GOOGLE_DOCS_ID=your_google_doc_id
```

### Azure OpenAI Setup

1. Create an Azure OpenAI resource in the [Azure Portal](https://portal.azure.com)
2. Deploy the following models in your Azure OpenAI resource:
   - **Embedding models**: Create deployments for `text-embedding-ada-002`
   - **Completion models**: Create deployments for `gpt-4`
3. Note the deployment names, endpoint, and API key to use in your `.env.local` file

### Pinecone Setup

1. Create a Pinecone account at https://www.pinecone.io/
2. Create a new Serverless index with:
   - Dimensions: 1536 (for Azure OpenAI's text-embedding-3-small model)
   - Metric: cosine
3. Save your API key and index name in `.env.local`

### Data Ingestion

Before using the API, you need to populate your Pinecone index with question-answer pairs:

1. Edit the `src/scripts/ingest.ts` file to add your QA pairs
2. Uncomment the example code at the bottom of the file
3. Run the script with TypeScript: `npx ts-node src/scripts/ingest.ts`

Alternatively, if you want to use Google Docs as a data source:

1. Install the Google Docs package: `npm install google-docs`
2. Uncomment the Google Docs code in `src/lib/docs.ts`
3. Add your Google Docs credentials to `.env.local`
4. Create a script that combines the Docs loading with Pinecone ingestion

## API Usage

### Query Endpoint: `/api/query`

**Method**: POST

**Request Body**:
```json
{
  "question": "What are your business hours?",
  "topK": 1
}
```

**Response**:
```json
{
  "question": "What are your business hours?",
  "answer": "We are open Monday through Friday from 9am to 5pm.",
  "confidence": 0.95,
  "similarQuestions": [
    {
      "question": "What are your business hours?",
      "score": 0.95
    }
  ]
}
```

**Parameters**:
- `question` (required): The question to search for
- `topK` (optional): Number of similar questions to return (default: 1)

### Health Check: `/api/query`

**Method**: GET

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-04-22T12:34:56.789Z"
}
```

## Voiceflow Integration

To integrate with Voiceflow:

1. Deploy this API to Vercel
2. In your Voiceflow project, use the HTTP Request block with:
   - Method: POST
   - URL: Your deployed API endpoint (e.g., `https://your-app.vercel.app/api/query`)
   - Body: `{"question": "{user_question}"}`
3. Parse the response in Voiceflow to continue the conversation flow

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000/api/query](http://localhost:3000/api/query) in your browser to check if the API is running.

## Deployment

Deploy to Vercel using either:

1. Vercel CLI: `vercel deploy`
2. GitHub integration with Vercel for automatic deployments

Make sure to add all environment variables in the Vercel project settings.

## License

MIT
