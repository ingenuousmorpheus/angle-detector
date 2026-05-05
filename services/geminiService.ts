import { GoogleGenAI, Type } from "@google/genai";
import type { AngleAnalysisResult } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        isAngleFound: {
            type: Type.BOOLEAN,
            description: "Set to true if a measurable angle is found, otherwise false."
        },
        description: { 
            type: Type.STRING, 
            description: "A mandatory, brief description of the object in the center. If no angle is found, this must explain why (e.g., 'object is curved', 'view is blurry')." 
        },
        angle: { 
            type: Type.NUMBER, 
            description: "The calculated angle in degrees (0-180). Should be null if isAngleFound is false." 
        },
        points: {
            type: Type.ARRAY,
            description: "An array of three normalized {x, y} coordinates for the angle: [start, vertex, end]. Origin (0,0) is top-left. Should be null if isAngleFound is false.",
            items: {
                type: Type.OBJECT,
                properties: {
                    x: { type: Type.NUMBER, description: "Normalized x-coordinate (0.0 to 1.0)." },
                    y: { type: Type.NUMBER, description: "Normalized y-coordinate (0.0 to 1.0)." }
                },
                 required: ['x', 'y']
            }
        }
    },
    required: ['isAngleFound', 'description']
};


export const analyzeImageAngle = async (base64ImageData: string): Promise<AngleAnalysisResult> => {
    const systemInstruction = `You are a professional industrial metrologist. Your task is to measure angles with extreme accuracy, specifically focusing on the central target (bullseye) area of the image.
The "bullseye" is defined as the central 15% of the image (centered at x=0.5, y=0.5).

CRITICAL RULES:
1. ONLY measure the angle whose vertex (pivot point) is inside the central bullseye. 
2. If multiple angles are visible, strictly ignore any that do not have their vertex in the center.
3. Look for mechanical tools (protractors, angle finders). If a digital display or scale is visible near the vertex, use its value as the definitive angle.
4. Precision: Provide the angle to exactly 2 decimal places.
5. Point Placement: The 'vertex' coordinate MUST be the exact intersection of the two lines. The 'start' and 'end' points should be placed directly along the visible edges forming the angle.`;

    const prompt = `Measure the primary angle whose vertex is located within the central bullseye area of this image. 
Return the precise angle and the normalized coordinates [start, vertex, end]. 
The vertex must be within the range x:[0.42-0.58], y:[0.35-0.65]. 
If no clear angle vertex is in this bullseye, set isAngleFound to false.`;

    const imagePart = {
        inlineData: {
            mimeType: 'image/jpeg',
            data: base64ImageData,
        },
    };

    const textPart = {
        text: prompt,
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [imagePart, textPart] },
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: analysisSchema,
            }
        });

        const jsonString = response.text;
        const result = JSON.parse(jsonString) as AngleAnalysisResult;
        
        // Basic validation for core fields
        if (typeof result.isAngleFound !== 'boolean' || typeof result.description !== 'string') {
             throw new Error("Invalid response format from AI: core fields are missing.");
        }

        // Robust handling of angle data
        if (result.isAngleFound) {
            if (
                typeof result.angle !== 'number' ||
                !Array.isArray(result.points) ||
                result.points.length !== 3
            ) {
                // If AI claims success but data is bad, downgrade to a failure but keep the description.
                result.isAngleFound = false;
                result.angle = null;
                result.points = null;
            }
        } else {
             // Ensure angle and points are null if not found
            result.angle = null;
            result.points = null;
        }

        return result;

// Fix: Corrected syntax for the catch block. The extraneous 'a' was causing a compile error.
    } catch (error) {
        console.error("Error analyzing image with Gemini:", error);
        if (error instanceof Error && error.message.includes('JSON')) {
             throw new Error("The AI returned an invalid response. Please try again.");
        }
        throw new Error("Failed to analyze image. The AI model could not process the request.");
    }
};
