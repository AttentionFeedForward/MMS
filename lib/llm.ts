import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_BASE_URL;

if (!apiKey || !baseURL) {
  console.warn("Missing OPENAI_API_KEY or OPENAI_BASE_URL environment variables.");
}

const client = new OpenAI({
  apiKey: apiKey,
  baseURL: baseURL,
  dangerouslyAllowBrowser: false,
});

export async function parseTextWithLLM(text: string, docType: string) {
    if (!text || !text.trim()) return {};

    // Simplified prompt for testing if it's prompt related
    // let prompt = `Extract JSON. Text: ${text.substring(0, 100)}. Fields: manufacturerName`;

    // if (docType) {
        let prompt = `You are a helpful assistant that extracts structured data from OCR text of documents. 
    The text is from a ${docType}. 
    Please extract the following fields and return them in JSON format only (no markdown, no code blocks).
    If a field is not found, return null.
    
    Fields to extract based on document type:
    
    If type is LICENSE (Business License):
    - manufacturerName (String): The name of the company/manufacturer.
    
    If type is ISO_QUALITY, ISO_SAFETY, or ISO_ENV (ISO Certificates):
    - manufacturerName (String): The name of the certified organization.
    - expiryDate (String): The expiration date in YYYY-MM-DD format.
    
    If type is CERTIFICATE (Product Certificate):
    - materialName (String): The name of the product/material.
    - model (String): The model or specification (e.g., DN100, HRB400E).
    
    If type is TYPE_REPORT (Type Inspection Report):
    - manufacturerName (String): The name of the manufacturer.
    - materialName (String): The name of the product.
    - model (String): The model or specification.
    - reportDate (String): The date of the report in YYYY-MM-DD format.

    OCR Text:
    ${text.substring(0, 3000)}
    `;
    // }

    try {
        const response = await client.chat.completions.create({
            model: process.env.OPENAI_MODEL || "qwen-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            stream: false, 
            max_tokens: 2048, // Increase max tokens
        });

        const content = response.choices?.[0]?.message?.content || "{}";
    // Clean up markdown if present
    const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse JSON from LLM response:", jsonStr);
        return {};
    }
    } catch (error) {
        console.error("LLM Parse Error:", error);
        return {};
    }
}
