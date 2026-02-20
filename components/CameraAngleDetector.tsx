import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeImageAngle } from '../services/geminiService';
import type { AngleAnalysisResult } from '../types';
import AngleDisplay from './AngleDisplay';
import { Camera, Zap, AlertTriangle, Loader } from 'lucide-react';

const CameraAngleDetector: React.FC = () => {
    const [isCameraOn, setIsCameraOn] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AngleAnalysisResult | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const startCamera = useCallback(async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setIsCameraOn(true);
                    setError(null);
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                setError("Could not access camera. Please check permissions.");
                setIsCameraOn(false);
            }
        } else {
            setError("Your browser does not support camera access.");
        }
    }, []);
    
    useEffect(() => {
        // Clear timeout on unmount
        return () => {
            if (resultTimeoutRef.current) {
                clearTimeout(resultTimeoutRef.current);
            }
             if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleAnalyze = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        if (resultTimeoutRef.current) {
            clearTimeout(resultTimeoutRef.current);
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) {
            setError("Could not get canvas context.");
            setIsLoading(false);
            return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        try {
            const result = await analyzeImageAngle(imageDataUrl);
            setAnalysisResult(result);
            resultTimeoutRef.current = setTimeout(() => {
                setAnalysisResult(null);
            }, 8000); // Result disappears after 8 seconds
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
            <div className="relative w-full aspect-video bg-gray-800 rounded-lg shadow-2xl overflow-hidden border-2 border-gray-700">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                
                {!isCameraOn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 z-10">
                        <Camera className="w-16 h-16 text-gray-400 mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Camera is off</h2>
                        <button
                            onClick={() => { setIsCameraOn(true); startCamera(); }}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-md font-bold transition-transform transform hover:scale-105"
                        >
                            Start Camera
                        </button>
                    </div>
                )}

                {analysisResult && analysisResult.isAngleFound && videoRef.current && (
                    <AngleDisplay result={analysisResult} videoElement={videoRef.current} />
                )}

                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <div className="w-24 h-24 md:w-32 md:h-32 border-2 border-cyan-400 border-dashed rounded-full opacity-50"></div>
                     <div className="w-1 h-1 bg-cyan-400 rounded-full absolute"></div>
                </div>
                
                {analysisResult && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 p-3 z-30 animate-fade-in">
                        <p className="text-base text-gray-200 font-mono text-center">
                            {analysisResult.angle !== null ? (
                                <>
                                    <span className="font-bold text-xl text-cyan-300">{analysisResult.angle.toFixed(1)}° </span>
                                    <span className="text-gray-300">- {analysisResult.description}</span>
                                </>
                            ) : (
                                <>
                                    <span className="font-bold text-yellow-400">No Angle Detected: </span>
                                    <span className="text-gray-300">{analysisResult.description}</span>
                                </>
                            )}
                        </p>
                    </div>
                )}
            </div>
            <canvas ref={canvasRef} className="hidden"></canvas>
            
            {error && (
                <div className="mt-4 flex items-center space-x-2 bg-red-900/50 text-red-300 px-4 py-2 rounded-md">
                    <AlertTriangle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            )}
            
            <div className="mt-6">
                <button 
                    onClick={handleAnalyze} 
                    disabled={!isCameraOn || isLoading}
                    className="flex items-center justify-center space-x-3 px-8 py-4 bg-cyan-500 text-gray-900 font-bold rounded-full shadow-lg transition-all transform hover:scale-105 hover:bg-cyan-400 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:scale-100"
                >
                    {isLoading ? (
                        <>
                            <Loader className="animate-spin w-6 h-6" />
                            <span>Analyzing...</span>
                        </>
                    ) : (
                        <>
                            <Zap className="w-6 h-6" />
                            <span>Analyze Angle</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default CameraAngleDetector;