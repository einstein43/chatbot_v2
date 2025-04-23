# Serverless QA API with OpenAI Embeddings and Pinecone Vector DB

A serverless API built on Vercel that:
- Receives a question from Voiceflow
- Embeds the question using OpenAI
- Queries Pinecone Serverless for the most similar question
- Returns the matching answer

## Tech Stack

- **Vercel**: For serverless deployment
- **Next.js**: For API routes and serverless functions
- **Pinecone Serverless**: Vector database for semantic search
- **OpenAI Embeddings**: For creating vector representations of questions
- **Google Sheets** (Optional): As a data source for QA pairs

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Vercel account for deployment
- OpenAI API key
- Pinecone account with a serverless index
- (Optional) Google service account with Sheets API access

### Environment Setup

1. Clone this repository
2. Install dependencies: `npm install`
3. Copy `.env.local` to create your environment variables:

```
# OpenAI API Keys
OPENAI_API_KEY=your_openai_api_key

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key 
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX=your_pinecone_index

# Optional: Google Sheets API
# GOOGLE_SHEETS_ID=your_google_sheet_id
# GOOGLE_SHEETS_PRIVATE_KEY=your_google_sheets_private_key
# GOOGLE_SHEETS_CLIENT_EMAIL=your_google_sheets_client_email
```

### Pinecone Setup

1. Create a Pinecone account at https://www.pinecone.io/
2. Create a new Serverless index with:
   - Dimensions: 1536 (for OpenAI's text-embedding-3-small model)
   - Metric: cosine
3. Save your API key, environment and index name in `.env.local`

### Data Ingestion

Before using the API, you need to populate your Pinecone index with question-answer pairs:

1. Edit the `src/scripts/ingest.ts` file to add your QA pairs
2. Uncomment the example code at the bottom of the file
3. Run the script with TypeScript: `npx ts-node src/scripts/ingest.ts`

Alternatively, if you want to use Google Sheets as a data source:

1. Install the Google Sheets package: `npm install google-spreadsheet`
2. Uncomment the Google Sheets code in `src/lib/sheets.ts`
3. Add your Google Sheets credentials to `.env.local`
4. Create a script that combines the Sheets loading with Pinecone ingestion

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
