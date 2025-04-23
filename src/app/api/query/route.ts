import { NextRequest, NextResponse } from 'next/server';
import { getEmbedding } from '@/lib/openai';
import { querySimilarQuestions } from '@/lib/pinecone';

interface RequestBody {
  question: string;
  topK?: number;
}

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Handle preflight OPTIONS request for CORS
 */
export async function OPTIONS() {
  return NextResponse.json({}, { 
    status: 204, 
    headers: corsHeaders
  });
}

/**
 * API endpoint that receives a question from Voiceflow,
 * embeds it using OpenAI, and returns similar questions/answers from Pinecone
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body: RequestBody = await request.json();
    
    // Validate the request
    if (!body.question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const question = body.question.trim();
    const topK = body.topK || 1;

    // Generate embedding for the question
    console.log(`Generating embedding for question: "${question}"`);
    const embedding = await getEmbedding(question);

    // Query Pinecone for similar questions
    console.log(`Querying Pinecone for top ${topK} similar questions`);
    const matches = await querySimilarQuestions(embedding, topK);

    // Format the response
    if (!matches || matches.length === 0) {
      return NextResponse.json(
        { 
          question,
          answer: "I'm sorry, I don't know the answer to that question.",
          confidence: 0,
          similarQuestions: [] 
        },
        { status: 404, headers: corsHeaders }
      );
    }

    // Return the best matching answer
    const bestMatch = matches[0];
    const metadata = bestMatch.metadata as { question: string; answer: string };
    
    return NextResponse.json({
      question,
      answer: metadata.answer,
      confidence: bestMatch.score,
      similarQuestions: matches.map(match => ({
        question: (match.metadata as { question: string }).question,
        score: match.score
      }))
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  }, { headers: corsHeaders });
}