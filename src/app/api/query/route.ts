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

// Define confidence threshold for using OpenAI
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

    // Query Pinecone for similar questions
    console.log(`Querying Pinecone for top ${topK} similar questions`);
    const matches = await querySimilarQuestions(embedding, topK);

    // Format the response
    if (!matches || matches.length === 0) {
      // No matches found, let's try to use general sources
      console.log('No QA matches found, fetching general sources from Pinecone');
      const generalSources = await queryGeneralSources(embedding, 5);
      
      if (!generalSources || generalSources.length === 0) {
        // No general sources either, generate a generic response
        return NextResponse.json(
          { 
            question,
            answer: "I'm sorry, I don't have enough information to answer that question accurately.",
            confidence: 0,
            similarQuestions: [],
            source: 'no_sources'
          },
          { headers: corsHeaders }
        );
      }
      
      // Generate answer using the general sources
      console.log(`Found ${generalSources.length} general sources, generating answer with OpenAI`);
      const generatedAnswer = await generateAnswerFromGeneralSources(question, generalSources);
      
      return NextResponse.json(
        { 
          question,
          answer: generatedAnswer,
          confidence: 0,
          similarQuestions: [],
          source: 'general_sources'
        },
        { headers: corsHeaders }
      );
    }

    // Get the best match
    const bestMatch = matches[0] as PineconeMatch;
    
    // If confidence is below threshold, use OpenAI with general sources
    if (bestMatch.score < CONFIDENCE_THRESHOLD) {
      console.log(`Best match confidence (${bestMatch.score}) below threshold (${CONFIDENCE_THRESHOLD}), fetching general sources`);
      
      // Fetch general sources for context
      const generalSources = await queryGeneralSources(embedding, 5);
      
      if (!generalSources || generalSources.length === 0) {
        // No general sources found, fall back to just using similar questions
        console.log('No general sources found, generating answer based on similar questions');
        const generatedAnswer = await generateAnswer(question, matches);
        
        return NextResponse.json({
          question,
          answer: generatedAnswer,
          confidence: bestMatch.score,
          similarQuestions: matches.map(match => {
            const typedMatch = match as PineconeMatch;
            return {
              question: typedMatch.metadata.question,
              score: typedMatch.score
            };
          }),
          source: 'similar_questions'
        }, { headers: corsHeaders });
      }
      
      // Generate answer using general sources
      console.log(`Found ${generalSources.length} general sources, generating answer with OpenAI`);
      const generatedAnswer = await generateAnswerFromGeneralSources(question, generalSources);
      
      return NextResponse.json({
        question,
        answer: generatedAnswer,
        confidence: bestMatch.score,
        similarQuestions: matches.map(match => {
          const typedMatch = match as PineconeMatch;
          return {
            question: typedMatch.metadata.question,
            score: typedMatch.score
          };
        }),
        source: 'general_sources'
      }, { headers: corsHeaders });
    }
    
    // Use the best match's answer since confidence is high enough
    const metadata = bestMatch.metadata;
    
    return NextResponse.json({
      question,
      answer: metadata.answer,
      confidence: bestMatch.score,
      similarQuestions: matches.map(match => {
        const typedMatch = match as PineconeMatch;
        return {
          question: typedMatch.metadata.question,
          score: typedMatch.score
        };
      }),
      source: 'pinecone_direct'
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