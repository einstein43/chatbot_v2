import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates embeddings for the provided text using OpenAI's embeddings API
 * @param text The text to create embeddings for
 * @returns Promise with the embedding vector
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // Using the latest embedding model
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
 * @returns Promise with the generated answer
 */
export async function generateAnswer(question: string, context?: any[]): Promise<string> {
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

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo", // Using the latest GPT-4 model, adjust as needed
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return response.choices[0].message.content || "I'm sorry, I couldn't generate an answer.";
  } catch (error) {
    console.error('Error generating answer with OpenAI:', error);
    throw new Error('Failed to generate answer with OpenAI');
  }
}

/**
 * Generates an answer using OpenAI's ChatGPT based on the question and general sources as context
 * @param question The user's question
 * @param generalSources Array of general sources from Pinecone to use as context
 * @returns Promise with the generated answer
 */
export async function generateAnswerFromGeneralSources(question: string, generalSources: any[]): Promise<string> {
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

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo", // Using the latest GPT-4 model, adjust as needed
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return response.choices[0].message.content || "I'm sorry, I couldn't generate an answer.";
  } catch (error) {
    console.error('Error generating answer with OpenAI:', error);
    throw new Error('Failed to generate answer with OpenAI');
  }
}