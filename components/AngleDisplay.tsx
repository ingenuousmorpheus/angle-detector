import React, { useMemo } from 'react';
import type { AngleAnalysisResult, Point } from '../types';

interface AngleDisplayProps {
    result: AngleAnalysisResult;
    videoElement: HTMLVideoElement;
}

const AngleDisplay: React.FC<AngleDisplayProps> = ({ result, videoElement }) => {
    const { angle, points } = result;

    // Gracefully handle cases where angle/points might be missing or null
    if (angle === null || !points) {
        return null;
    }

    const scaledPoints = useMemo(() => {
        if (!videoElement) return null;
        const rect = videoElement.getBoundingClientRect();
        return points.map(p => ({
            x: p.x * rect.width,
            y: p.y * rect.height
        })) as [Point, Point, Point];
    }, [points, videoElement]);

    if (!scaledPoints) return null;
    
    const [start, vertex, end] = scaledPoints;

    const pathData = `M ${start.x} ${start.y} L ${vertex.x} ${vertex.y} L ${end.x} ${end.y}`;

    // Position the text near the vertex
    // Calculate a point slightly away from the vertex for the text label
    const angleRad = Math.atan2(start.y - vertex.y, start.x - vertex.x) + Math.atan2(end.y - vertex.y, end.x - vertex.x);
    const textAngle = angleRad / 2;
    const textDist = 40; // distance from vertex
    const textX = vertex.x + textDist * Math.cos(textAngle);
    const textY = vertex.y + textDist * Math.sin(textAngle);


    return (
        <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none z-30"
            viewBox={`0 0 ${videoElement.getBoundingClientRect().width} ${videoElement.getBoundingClientRect().height}`}
        >
            <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3.5" result="coloredBlur"></feGaussianBlur>
                    <feMerge>
                        <feMergeNode in="coloredBlur"></feMergeNode>
                        <feMergeNode in="SourceGraphic"></feMergeNode>
                    </feMerge>
                </filter>
            </defs>

            <path
                d={pathData}
                stroke="url(#gradient)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                filter="url(#glow)"
                style={{ animation: 'dash 1s ease-in-out forwards' }}
            />
            
            <circle cx={vertex.x} cy={vertex.y} r="6" fill="#fef08a" filter="url(#glow)" />
            
            <text
                x={textX}
                y={textY}
                fill="#fef08a"
                fontSize="24"
                fontWeight="bold"
                textAnchor="middle"
                alignmentBaseline="middle"
                style={{
                    filter: 'drop-shadow(0 0 5px rgba(0,0,0,0.8))',
                    animation: 'fade-in 0.5s ease-out'
                }}
            >
                {angle.toFixed(1)}°
            </text>

            <style>{`
                @keyframes dash {
                    from {
                        stroke-dasharray: 1000;
                        stroke-dashoffset: 1000;
                    }
                    to {
                        stroke-dasharray: 1000;
                        stroke-dashoffset: 0;
                    }
                }
                @keyframes fade-in {
                    from { opacity: 0; transform: scale(0.8); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>

            <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="100%" stopColor="#84cc16" />
                </linearGradient>
            </defs>
        </svg>
    );
};

export default AngleDisplay;
