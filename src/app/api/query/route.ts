import { NextRequest, NextResponse } from 'next/server';
import { getEmbedding, generateAnswer, generateAnswerFromGeneralSources } from '@/lib/openai';
import { querySimilarQuestions, queryGeneralSources } from '@/lib/pinecone';

interface RequestBody {
  question: string;
  topK?: number;
}

// Define the interface for the match object to fix the 'any' type error
interface PineconeMatch {
  id: string;
  score: number;
  metadata: {
    question: string;
    answer: string;
  };
}

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Define confidence threshold
const CONFIDENCE_THRESHOLD = 0.80;

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
    const topK = body.topK || 3; // Default number of similar questions to return

    // Generate embedding for the question
    console.log(`Generating embedding for question: "${question}"`);
    const embedding = await getEmbedding(question);

    // Execute queries in parallel for better performance
    console.log(`Executing parallel queries to Pinecone for question: "${question}"`);
    const [similarQuestions, generalSources] = await Promise.all([
      // Query for similar questions
      querySimilarQuestions(embedding, topK),
      // Also fetch general sources in parallel
      queryGeneralSources(embedding, 5)
    ]);

    console.log(`Found ${similarQuestions?.length || 0} similar questions and ${generalSources?.length || 0} general sources`);

    // Format the response
    let response;
    
    if (!similarQuestions || similarQuestions.length === 0) {
      // No matches found, return Dutch message
      response = { 
        question,
        answer: "dat antwoord weet ik niet.",
        confidence: 0,
        similarQuestions: [],
        source: 'no_sources'
      };
    } else {
      // Get the best match
      const bestMatch = similarQuestions[0] as PineconeMatch;
      
      // If confidence is below threshold, return Dutch message
      if (bestMatch.score < CONFIDENCE_THRESHOLD) {
        console.log(`Best match confidence (${bestMatch.score}) below threshold (${CONFIDENCE_THRESHOLD}), returning Dutch message`);
        
        response = {
          question,
          answer: "dat antwoord weet ik niet.",
          confidence: bestMatch.score,
          similarQuestions: similarQuestions.map(match => {
            const typedMatch = match as PineconeMatch;
            return {
              question: typedMatch.metadata.question,
              score: typedMatch.score
            };
          }),
          source: 'low_confidence'
        };
      } else {
        // Use the best match's answer since confidence is high enough
        const metadata = bestMatch.metadata;
        
        response = {
          question,
          answer: metadata.answer,
          confidence: bestMatch.score,
          similarQuestions: similarQuestions.map(match => {
            const typedMatch = match as PineconeMatch;
            return {
              question: typedMatch.metadata.question,
              answer: typedMatch.metadata.answer,
              score: typedMatch.score
            };
          }),
          source: 'pinecone_direct'
        };
      }
    }
    
    // Return the formatted response
    return NextResponse.json(response, { headers: corsHeaders });

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