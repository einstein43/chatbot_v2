// ingest-data.js - A CommonJS script to run our TypeScript ingest function
require('dotenv').config({ path: '.env.local' });

// Import the OpenAI module
const OpenAI = require('openai');

// Import the Pinecone module
const { Pinecone } = require('@pinecone-database/pinecone');

// Set up OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Set up Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Get the index we'll be using
const index = pinecone.Index(process.env.PINECONE_INDEX);

// QA pairs to be ingested
const exampleQAPairs = [
  {
    question: "What are your business hours?",
    answer: "We are open Monday through Friday from 9am to 5pm."
  },
  {
    question: "How do I reset my password?",
    answer: "You can reset your password by clicking on the 'Forgot Password' link on the login page."
  },
  {
    question: "Where is your office located?",
    answer: "Our main office is located at 123 Business Avenue, Suite 500, in downtown."
  },
    {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, PayPal, and bank transfers."
  },
{
    question: "How can I contact customer support?",
    answer: "You can contact customer support via email at support@example.com or call us at (123) 456-7890."
},
{
    question: "Do you offer international shipping?",
    answer: "Yes, we offer international shipping to most countries. Additional fees may apply."
},
{
    question: "Can I track my order?",
    answer: "Yes, once your order is shipped, you will receive a tracking number via email."
},
{
    question: "What is your return policy?",
    answer: "We accept returns within 30 days of purchase. Items must be in original condition."
},
{
    question: "Do you have a mobile app?",
    answer: "Yes, our mobile app is available for download on both iOS and Android platforms."
},
{
    question: "How do I update my account information?",
    answer: "You can update your account information by logging into your account and navigating to the 'Settings' section."
},
{
    question: "What is your privacy policy?",
    answer: "Our privacy policy is available on our website. It outlines how we handle your personal data."
},
{
    question: "Do you offer discounts for bulk orders?",
    answer: "Yes, we offer discounts for bulk orders. Please contact our sales team for more details."
},
{
    question: "How do I subscribe to your newsletter?",
    answer: "You can subscribe to our newsletter by entering your email address in the subscription box on our website."
},
{
    question: "What is the estimated delivery time for orders?",
    answer: "Delivery times vary by location, but most orders are delivered within 5-7 business days."
}
];

/**
 * Generates embeddings for text using OpenAI
 */
async function getEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Upload QA pairs to Pinecone
 */
async function uploadQAPairsToPinecone(qaPairs) {
  try {
    console.log(`Processing ${qaPairs.length} QA pairs for ingestion...`);
    
    // Process in batches to avoid API rate limits
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < qaPairs.length; i += batchSize) {
      batches.push(qaPairs.slice(i, i + batchSize));
    }
    
    let counter = 0;
    for (const batch of batches) {
      const vectors = await Promise.all(
        batch.map(async (pair) => {
          // Generate embedding for each question
          const embedding = await getEmbedding(pair.question);
          
          // Create a unique ID for each vector
          const id = `q${counter++}`;
          
          return {
            id,
            values: embedding,
            metadata: {
              question: pair.question,
              answer: pair.answer
            }
          };
        })
      );
      
      // Upsert vectors to Pinecone
      await index.upsert(vectors);
      console.log(`Uploaded batch of ${batch.length} QA pairs to Pinecone`);
    }
    
    console.log(`Successfully ingested ${qaPairs.length} QA pairs into Pinecone`);
  } catch (error) {
    console.error('Error uploading QA pairs to Pinecone:', error);
    throw new Error('Failed to upload QA pairs to Pinecone');
  }
}

// Self-executing async function
(async () => {
  try {
    await uploadQAPairsToPinecone(exampleQAPairs);
    console.log('Data ingestion complete!');
  } catch (error) {
    console.error('Data ingestion failed:', error);
  }
})();