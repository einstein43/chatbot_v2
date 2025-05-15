import OpenAI from 'openai';

// Check for required Azure OpenAI environment variables
if (!process.env.AZURE_OPENAI_API_KEY) {
  throw new Error('AZURE_OPENAI_API_KEY environment variable is not set');
}

if (!process.env.AZURE_OPENAI_ENDPOINT) {
  throw new Error('AZURE_OPENAI_ENDPOINT environment variable is not set');
}

// Configure a single OpenAI client for gpt-4o-mini
export const openai = new OpenAI({
  apiKey: process.env.AZURE_GPT4_API_KEY || process.env.AZURE_OPENAI_API_KEY,
  baseURL: process.env.AZURE_GPT4_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT,
  defaultQuery: { 'api-version': process.env.AZURE_GPT4_API_VERSION || '2025-01-01-preview' },
  defaultHeaders: { 'api-key': process.env.AZURE_GPT4_API_KEY || process.env.AZURE_OPENAI_API_KEY }
});

// Azure OpenAI uses deployment names instead of model names
export const EMBEDDING_MODELS = {
  DEFAULT: process.env.AZURE_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002',
  LARGE: process.env.AZURE_EMBEDDING_DEPLOYMENT_LARGE || 'text-embedding-ada-002'
};

export const COMPLETION_MODELS = {
  // All models use gpt-4o-mini
  FAST: process.env.AZURE_COMPLETION_DEPLOYMENT_STANDARD || 'gpt-4o-minio-mini',
  STANDARD: process.env.AZURE_COMPLETION_DEPLOYMENT_STANDARD || 'gpt-4o-mini',
  PRECISE: process.env.AZURE_COMPLETION_DEPLOYMENT_PRECISE || 'gpt-4o-mini'
};

// Model selection thresholds
const QUESTION_COMPLEXITY_THRESHOLD = 50; // Character count for complex questions

// Interface for OpenAI API errors
interface OpenAIError {
  response?: {
    status?: number;
    data?: {
      error?: {
        code?: string;
      }
    }
  }
}

/**
 * Determines question complexity based on various factors
 * @param question The user's question
 * @returns Complexity score and factors considered
 */
export function assessQuestionComplexity(question: string): { 
  isComplex: boolean, 
  factors: string[] 
} {
  const factors = [];
  
  // Check question length
  if (question.length > QUESTION_COMPLEXITY_THRESHOLD) {
    factors.push('question length');
  }
  
  // Check for multiple sub-questions (contains multiple question marks)
  if ((question.match(/\?/g) || []).length > 1) {
    factors.push('multiple sub-questions');
  }
  
  // Check for complex logical operators
  if (question.match(/\b(en|of|maar|alhoewel|niet|behalve|tenzij)\b/gi)) {
    factors.push('logical operators');
  }
  
  // Check for technical terms or specialized vocabulary
  const technicalTerms = [
    'how to', 'explain', 'compare', 'difference', 'technical', 'complex',
    'analyze', 'implementation', 'architecture', 'infrastructure'
  ];
  
  if (technicalTerms.some(term => question.toLowerCase().includes(term))) {
    factors.push('technical terms');
  }
  
  return {
    isComplex: factors.length > 0,
    factors
  };
}

/**
 * Selects the appropriate embedding model based on question complexity
 * @param question The text to create embeddings for
 * @returns Selected model name
 */
function selectEmbeddingModel(question: string): string {
  const { isComplex } = assessQuestionComplexity(question);
  
  // Use the large model for complex questions, otherwise use the small/default model
  return isComplex ? EMBEDDING_MODELS.LARGE : EMBEDDING_MODELS.DEFAULT;
}

/**
 * Selects the appropriate completion model based on various factors
 * @param question The user's question
 * @param confidence Optional confidence score from vector search
 * @param contextSize Optional size of context being provided
 * @returns Selected model name
 */
function selectCompletionModel(
  question: string, 
  confidence?: number, 
  contextSize?: number
): string {
  // Always use gpt-4o-mini regardless of the input parameters
  console.log(`Using ${COMPLETION_MODELS.STANDARD} for all questions`);
  return COMPLETION_MODELS.STANDARD;
}

/**
 * Generates embeddings for the provided text using Azure OpenAI embeddings API
 * @param text The text to create embeddings for
 * @returns Promise with the embedding vector
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    // Select the appropriate embedding model based on question complexity
    const model = selectEmbeddingModel(text);
    console.log(`Using embedding model: ${model}`);
    
    // Azure OpenAI requires a specific URL format
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    const apiKey = process.env.AZURE_OPENAI_API_KEY || '';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
    
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
 * Generates an answer using Azure OpenAI ChatGPT based on the question and context
 * @param question The user's question
 * @param context Optional context from similar questions/answers in the database
 * @param forceModel Optional parameter to force a specific model
 * @returns Promise with the generated answer
 */
export async function generateAnswer(
  question: string, 
  context?: any[], 
  forceModel?: string
): Promise<string> {
  try {
    let systemPrompt = "You are a helpful assistant that answers questions accurately and concisely.";
    
    // If we have context, add it to the prompt
    if (context && context.length > 0) {
      systemPrompt += " Use the following information to help answer the question, but don't reference the source directly:";
      
      // Add each context item to the system prompt
      context.forEach((item, index) => {
        if (item.metadata?.question && item.metadata?.answer) {
          systemPrompt += `\n\nSource ${index + 1}:\nQuestion: ${item.metadata.question}\nAnswer: ${item.metadata.answer}`;
        }
      });
    }

    // Always use gpt-4o-mini
    const model = forceModel || COMPLETION_MODELS.STANDARD;
    console.log(`Using completion model: ${model} for question`);
    
    // Always use the gpt-4o-mini endpoint
    const endpoint = process.env.AZURE_GPT4_ENDPOINT || '';
    const apiKey = process.env.AZURE_GPT4_API_KEY || process.env.AZURE_OPENAI_API_KEY || '';
    const apiVersion = process.env.AZURE_GPT4_API_VERSION || '2025-01-01-preview';
    
    // Remove trailing slash from endpoint if present
    const baseUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
    
    // Format the URL according to Azure OpenAI requirements for chat completions
    const url = `${baseUrl}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;
    
    console.log(`Calling Azure OpenAI chat completions endpoint: ${url}`);
    
    // Prepare the request body
    const requestBody = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ],
      temperature: 0.7,
      max_tokens: 500
    };
    
    // Make a direct POST request to the Azure API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Azure OpenAI API error:', errorData);
      throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content || "I'm sorry, I couldn't generate an answer.";
  } catch (error: unknown) {
    console.error('Error generating answer with OpenAI:', error);
    throw new Error('Failed to generate answer with OpenAI');
  }
}

/**
 * Generates an answer using Azure OpenAI ChatGPT based on the question and general sources as context
 * @param question The user's question
 * @param generalSources Array of general sources from Pinecone to use as context
 * @param forceModel Optional parameter to force a specific model
 * @returns Promise with the generated answer
 */
export async function generateAnswerFromGeneralSources(
  question: string, 
  generalSources: any[],
  forceModel?: string
): Promise<string> {
  try {
    let systemPrompt = "You are a helpful assistant that answers questions accurately and concisely based on the provided context.";
    
    // If we have general sources, add them to the prompt
    if (generalSources && generalSources.length > 0) {
      systemPrompt += " Use the following general sources to answer the question, but don't reference these sources directly in your answer:";
      
      // Add each general source to the system prompt
      generalSources.forEach((source, index) => {
        if (source.metadata?.content) {
          systemPrompt += `\n\nSource ${index + 1}:\n${source.metadata.content}`;
        }
      });
    } else {
      systemPrompt += " If you don't know the answer based on the provided context, just say you don't have enough information to answer accurately.";
    }

    // Always use gpt-4o-mini
    const model = forceModel || COMPLETION_MODELS.STANDARD;
    console.log(`Using completion model: ${model} for question with general sources`);
    
    // Always use the gpt-4o-mini endpoint
    const endpoint = process.env.AZURE_GPT4_ENDPOINT || '';
    const apiKey = process.env.AZURE_GPT4_API_KEY || process.env.AZURE_OPENAI_API_KEY || '';
    const apiVersion = process.env.AZURE_GPT4_API_VERSION || '2025-01-01-preview';
    
    // Remove trailing slash from endpoint if present
    const baseUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
    
    // Format the URL according to Azure OpenAI requirements for chat completions
    const url = `${baseUrl}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;
    
    console.log(`Calling Azure OpenAI chat completions endpoint: ${url}`);
    
    // Prepare the request body
    const requestBody = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ],
      temperature: 0.7,
      max_tokens: 500
    };
    
    // Make a direct POST request to the Azure API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Azure OpenAI API error:', errorData);
      throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content || "I'm sorry, I couldn't generate an answer.";
  } catch (error: unknown) {
    console.error('Error generating answer with OpenAI:', error);
    throw new Error('Failed to generate answer with OpenAI');
  }
}