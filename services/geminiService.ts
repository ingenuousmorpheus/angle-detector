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
            description: "True if a measurable angle is clearly visible in the image, false otherwise."
        },
        description: {
            type: Type.STRING,
            description: "Brief description of what forms the angle (e.g., 'corner of a phone', 'two pencils meeting'). If no angle found, explain why."
        },
        angle: {
            type: Type.NUMBER,
            description: "The measured angle in degrees (0-360). Must be null if isAngleFound is false."
        },
        points: {
            type: Type.ARRAY,
            description: "Three normalized {x, y} coordinate points: [start_of_line_1, vertex, end_of_line_2]. Origin (0,0) is top-left of image. Must be null if isAngleFound is false.",
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

const PROMPT = `You are acting as a digital protractor. Your job is to detect and measure angles visible in this camera image.

Look for any angle formed by:
- Edges or corners of objects (phones, books, cards, boxes, screens, papers, furniture)
- Two straight lines or edges that meet at a point
- Fingers or hands forming a V-shape or angle
- Any two distinct straight edges that converge at a vertex

Instructions:
1. Identify the most prominent angle visible in the image.
2. Measure the angle in degrees as accurately as possible, like a protractor would.
3. Provide three points that define the angle: a point along the first edge, the vertex where they meet, and a point along the second edge.
4. The points must be normalized coordinates (0.0 to 1.0) relative to the image dimensions.
5. Measure the interior angle at the vertex (the angle between the two edges on the inside).

If no clear angle with distinct straight edges is visible, set isAngleFound to false.

Common angles to watch for: 90° (right angle/corner), 45°, 60°, 120°, 180° (straight line).
Be precise - if it looks like a right angle (corner of a phone/book), it should be close to 90°.`;

export const analyzeImageAngle = async (base64ImageData: string): Promise<AngleAnalysisResult> => {
    const imagePart = {
        inlineData: {
            mimeType: 'image/jpeg' as const,
            data: base64ImageData,
        },
    };

    const textPart = {
        text: PROMPT,
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: analysisSchema,
            }
        });

        const jsonString = response.text;
        if (!jsonString) {
            throw new Error("Empty response from AI model.");
        }

        const result = JSON.parse(jsonString) as AngleAnalysisResult;

        if (typeof result.isAngleFound !== 'boolean' || typeof result.description !== 'string') {
            throw new Error("Invalid response format from AI.");
        }

        if (result.isAngleFound) {
            if (
                typeof result.angle !== 'number' ||
                !Array.isArray(result.points) ||
                result.points.length !== 3 ||
                !result.points.every(p => typeof p.x === 'number' && typeof p.y === 'number')
            ) {
                result.isAngleFound = false;
                result.angle = null;
                result.points = null;
            }
        } else {
            result.angle = null;
            result.points = null;
        }

        return result;

    } catch (error) {
        console.error("Error analyzing image with Gemini:", error);
        if (error instanceof Error && error.message.includes('JSON')) {
            throw new Error("AI returned an invalid response. Retrying...");
        }
        throw new Error("Failed to analyze image. Check your API key and network connection.");
    }
};
