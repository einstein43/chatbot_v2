import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Model selection constants
export const EMBEDDING_MODELS = {
  DEFAULT: 'text-embedding-3-small',
  LARGE: 'text-embedding-3-large'
};

export const COMPLETION_MODELS = {
  FAST: 'gpt-3.5-turbo',
  STANDARD: 'gpt-4-turbo',
  PRECISE: 'gpt-4'
};

// Model selection thresholds
const QUESTION_COMPLEXITY_THRESHOLD = 50; // Character count for complex questions
const CONFIDENCE_THRESHOLD_FOR_GPT4 = 0.70; // Below this confidence, use GPT-4

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
  if (question.match(/\b(and|or|but|however|not|except|unless)\b/gi)) {
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
  const { isComplex, factors } = assessQuestionComplexity(question);
  
  // Log the factors affecting model selection
  console.log(`Question complexity assessment: ${isComplex ? 'complex' : 'simple'}, factors: ${factors.join(', ')}`);
  
  // For very low confidence, always use the most powerful model
  if (confidence !== undefined && confidence < CONFIDENCE_THRESHOLD_FOR_GPT4) {
    console.log(`Using ${COMPLETION_MODELS.STANDARD} due to low confidence: ${confidence}`);
    return COMPLETION_MODELS.STANDARD;
  }
  
  // For large context, use a more powerful model
  if (contextSize !== undefined && contextSize > 5) {
    console.log(`Using ${COMPLETION_MODELS.STANDARD} due to large context size: ${contextSize}`);
    return COMPLETION_MODELS.STANDARD;
  }
  
  // Default selection based on complexity
  if (isComplex) {
    console.log(`Using ${COMPLETION_MODELS.STANDARD} due to question complexity`);
    return COMPLETION_MODELS.STANDARD;
  }
  
  // Use the fastest model for simple questions with high confidence
  console.log(`Using ${COMPLETION_MODELS.FAST} for simple question`);
  return COMPLETION_MODELS.FAST;
}

/**
 * Generates embeddings for the provided text using OpenAI's embeddings API
 * @param text The text to create embeddings for
 * @returns Promise with the embedding vector
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    // Select the appropriate embedding model based on question complexity
    const model = selectEmbeddingModel(text);
    console.log(`Using embedding model: ${model}`);
    
    const response = await openai.embeddings.create({
      model,
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Generates an answer using OpenAI's ChatGPT based on the question and context
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

    // Select the appropriate model based on complexity, confidence, and context size
    const model = forceModel || selectCompletionModel(
      question, 
      context && context.length > 0 ? context[0].score : undefined,
      context?.length
    );

    console.log(`Using completion model: ${model} for question`);

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return response.choices[0].message.content || "I'm sorry, I couldn't generate an answer.";
  } catch (error: unknown) {
    console.error('Error generating answer with OpenAI:', error);
    
    // Cast error to OpenAIError type to access its properties
    const apiError = error as OpenAIError;
    
    // If the error is due to the model (e.g., token limit), fallback to a simpler model
    if (apiError.response?.status === 400 && apiError.response?.data?.error?.code === 'context_length_exceeded') {
      console.log('Falling back to a simpler model due to context length limitations');
      return generateAnswer(question, context, COMPLETION_MODELS.FAST);
    }
    
    throw new Error('Failed to generate answer with OpenAI');
  }
}

/**
 * Generates an answer using OpenAI's ChatGPT based on the question and general sources as context
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

    // Select the appropriate model based on complexity, confidence, and context size
    const model = forceModel || selectCompletionModel(
      question, 
      generalSources && generalSources.length > 0 ? generalSources[0].score : undefined,
      generalSources?.length
    );

    console.log(`Using completion model: ${model} for question with general sources`);

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return response.choices[0].message.content || "I'm sorry, I couldn't generate an answer.";
  } catch (error: unknown) {
    console.error('Error generating answer with OpenAI:', error);
    
    // Cast error to OpenAIError type to access its properties
    const apiError = error as OpenAIError;
    
    // If the error is due to the model (e.g., token limit), fallback to a simpler model
    if (apiError.response?.status === 400 && apiError.response?.data?.error?.code === 'context_length_exceeded') {
      console.log('Falling back to a simpler model due to context length limitations');
      return generateAnswerFromGeneralSources(question, generalSources, COMPLETION_MODELS.FAST);
    }
    
    throw new Error('Failed to generate answer with OpenAI');
  }
}