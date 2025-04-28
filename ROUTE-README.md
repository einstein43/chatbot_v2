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