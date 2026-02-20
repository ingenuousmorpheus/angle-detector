import React, { useMemo } from 'react';
import type { AngleAnalysisResult, Point } from '../types';

interface AngleDisplayProps {
    result: AngleAnalysisResult;
    videoElement: HTMLVideoElement;
}

const AngleDisplay: React.FC<AngleDisplayProps> = ({ result, videoElement }) => {
    const { angle, points } = result;

    if (angle === null || !points) {
        return null;
    }

    const rect = videoElement.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const scaledPoints = useMemo(() => {
        if (!width || !height) return null;
        return points.map(p => ({
            x: p.x * width,
            y: p.y * height
        })) as [Point, Point, Point];
    }, [points, width, height]);

    if (!scaledPoints) return null;

    const [start, vertex, end] = scaledPoints;

    const pathData = `M ${start.x} ${start.y} L ${vertex.x} ${vertex.y} L ${end.x} ${end.y}`;

    // Calculate arc for angle visualization
    const arcRadius = Math.min(40, Math.min(width, height) * 0.06);
    const angle1 = Math.atan2(start.y - vertex.y, start.x - vertex.x);
    const angle2 = Math.atan2(end.y - vertex.y, end.x - vertex.x);
    const arcStart = {
        x: vertex.x + arcRadius * Math.cos(angle1),
        y: vertex.y + arcRadius * Math.sin(angle1)
    };
    const arcEnd = {
        x: vertex.x + arcRadius * Math.cos(angle2),
        y: vertex.y + arcRadius * Math.sin(angle2)
    };

    // Determine sweep direction
    let angleDiff = angle2 - angle1;
    if (angleDiff < 0) angleDiff += 2 * Math.PI;
    const largeArc = angleDiff > Math.PI ? 1 : 0;
    const sweep = 1;

    const arcPath = `M ${arcStart.x} ${arcStart.y} A ${arcRadius} ${arcRadius} 0 ${largeArc} ${sweep} ${arcEnd.x} ${arcEnd.y}`;

    // Position text label near the vertex, offset toward the bisector of the angle
    const bisectorAngle = angle1 + angleDiff / 2;
    const textDist = arcRadius + 25;
    const textX = vertex.x + textDist * Math.cos(bisectorAngle);
    const textY = vertex.y + textDist * Math.sin(bisectorAngle);

    return (
        <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none z-30"
            viewBox={`0 0 ${width} ${height}`}
        >
            <defs>
                <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="100%" stopColor="#84cc16" />
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Angle lines */}
            <path
                d={pathData}
                stroke="url(#line-gradient)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                filter="url(#glow)"
            />

            {/* Arc showing the angle */}
            <path
                d={arcPath}
                stroke="#fef08a"
                strokeWidth="2"
                fill="none"
                opacity="0.8"
            />

            {/* Vertex dot */}
            <circle cx={vertex.x} cy={vertex.y} r="5" fill="#fef08a" filter="url(#glow)" />

            {/* Endpoint dots */}
            <circle cx={start.x} cy={start.y} r="3" fill="#84cc16" opacity="0.8" />
            <circle cx={end.x} cy={end.y} r="3" fill="#84cc16" opacity="0.8" />

            {/* Angle label */}
            <text
                x={textX}
                y={textY}
                fill="#fef08a"
                fontSize="22"
                fontWeight="bold"
                textAnchor="middle"
                alignmentBaseline="middle"
                style={{
                    filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.9))',
                }}
            >
                {angle.toFixed(1)}°
            </text>
        </svg>
    );
};

export default AngleDisplay;
