import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeImageAngle } from '../services/geminiService';
import type { AngleAnalysisResult } from '../types';
import AngleDisplay from './AngleDisplay';
import { Camera, AlertTriangle, Loader } from 'lucide-react';

type DetectionState = 'idle' | 'starting' | 'scanning' | 'analyzing' | 'holding';

const HOLD_DURATION_MS = 10_000;
const SCAN_INTERVAL_MS = 2_500;

const CameraAngleDetector: React.FC = () => {
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [detectionState, setDetectionState] = useState<DetectionState>('idle');
    const [analysisResult, setAnalysisResult] = useState<AngleAnalysisResult | null>(null);
    const [holdCountdown, setHoldCountdown] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
    const scanTimerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    const clearAllTimers = useCallback(() => {
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        holdTimerRef.current = null;
        scanTimerRef.current = null;
        countdownIntervalRef.current = null;
    }, []);

    const captureFrame = useCallback((): string | null => {
        if (!videoRef.current || !canvasRef.current) return null;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video.videoWidth === 0 || video.videoHeight === 0) return null;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    }, []);

    const startHold = useCallback((result: AngleAnalysisResult) => {
        if (!mountedRef.current) return;
        setAnalysisResult(result);
        setDetectionState('holding');
        setHoldCountdown(HOLD_DURATION_MS / 1000);

        countdownIntervalRef.current = setInterval(() => {
            if (!mountedRef.current) return;
            setHoldCountdown(prev => {
                if (prev <= 1) return 0;
                return prev - 1;
            });
        }, 1000);

        holdTimerRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            setAnalysisResult(null);
            setHoldCountdown(0);
            setDetectionState('scanning');
        }, HOLD_DURATION_MS);
    }, []);

    const analyzeFrame = useCallback(async () => {
        if (!mountedRef.current) return;
        const base64 = captureFrame();
        if (!base64) {
            // Video not ready yet, retry soon
            if (mountedRef.current) {
                setDetectionState('scanning');
            }
            return;
        }

        setDetectionState('analyzing');
        setCameraError(null);

        try {
            const result = await analyzeImageAngle(base64);
            if (!mountedRef.current) return;

            if (result.isAngleFound && result.angle !== null) {
                startHold(result);
            } else {
                // No angle found, keep scanning
                setDetectionState('scanning');
            }
        } catch (err) {
            if (!mountedRef.current) return;
            console.error('Analysis error:', err);
            setCameraError(err instanceof Error ? err.message : 'Analysis failed');
            setDetectionState('scanning');
        }
    }, [captureFrame, startHold]);

    // Scanning loop: when in 'scanning' state, periodically analyze frames
    useEffect(() => {
        if (detectionState !== 'scanning') return;

        scanTimerRef.current = setTimeout(() => {
            if (mountedRef.current && detectionState === 'scanning') {
                analyzeFrame();
            }
        }, SCAN_INTERVAL_MS);

        return () => {
            if (scanTimerRef.current) {
                clearTimeout(scanTimerRef.current);
                scanTimerRef.current = null;
            }
        };
    }, [detectionState, analyzeFrame]);

    const startCamera = useCallback(async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setCameraError('Your browser does not support camera access.');
            return;
        }

        setDetectionState('starting');
        setCameraError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            if (!mountedRef.current) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Wait for video to be ready
                videoRef.current.onloadedmetadata = () => {
                    if (!mountedRef.current) return;
                    setCameraReady(true);
                    setDetectionState('scanning');
                };
            }
        } catch (err) {
            console.error('Camera error:', err);
            setCameraError('Could not access camera. Please check permissions.');
            setDetectionState('idle');
        }
    }, []);

    // Auto-start camera on mount
    useEffect(() => {
        mountedRef.current = true;
        startCamera();

        return () => {
            mountedRef.current = false;
            clearAllTimers();
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [startCamera, clearAllTimers]);

    const getStatusText = () => {
        switch (detectionState) {
            case 'idle':
            case 'starting':
                return 'Starting camera...';
            case 'scanning':
                return 'Scanning for angles...';
            case 'analyzing':
                return 'Detecting angle...';
            case 'holding':
                return `Holding result (${holdCountdown}s)`;
        }
    };

    const getStatusColor = () => {
        switch (detectionState) {
            case 'holding':
                return 'text-cyan-300';
            case 'analyzing':
                return 'text-yellow-300';
            default:
                return 'text-gray-400';
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
            <div className="relative w-full aspect-video bg-gray-800 rounded-lg shadow-2xl overflow-hidden border-2 border-gray-700">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                />

                {!cameraReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 z-10">
                        {cameraError ? (
                            <>
                                <AlertTriangle className="w-16 h-16 text-red-400 mb-4" />
                                <p className="text-red-300 text-center px-4">{cameraError}</p>
                                <button
                                    onClick={startCamera}
                                    className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-md font-bold transition-transform transform hover:scale-105"
                                >
                                    Retry
                                </button>
                            </>
                        ) : (
                            <>
                                <Camera className="w-16 h-16 text-gray-400 mb-4 animate-pulse" />
                                <p className="text-gray-300">Starting camera...</p>
                            </>
                        )}
                    </div>
                )}

                {/* Angle overlay */}
                {analysisResult && analysisResult.isAngleFound && videoRef.current && (
                    <AngleDisplay result={analysisResult} videoElement={videoRef.current} />
                )}

                {/* Crosshair guide */}
                {cameraReady && !analysisResult && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                        <div className="w-24 h-24 md:w-32 md:h-32 border-2 border-cyan-400 border-dashed rounded-full opacity-40"></div>
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full absolute"></div>
                    </div>
                )}

                {/* Scanning pulse indicator */}
                {detectionState === 'analyzing' && (
                    <div className="absolute top-3 right-3 z-30 flex items-center space-x-2 bg-black bg-opacity-60 rounded-full px-3 py-1.5">
                        <Loader className="animate-spin w-4 h-4 text-yellow-300" />
                        <span className="text-yellow-300 text-sm font-mono">Detecting...</span>
                    </div>
                )}

                {detectionState === 'scanning' && cameraReady && (
                    <div className="absolute top-3 right-3 z-30 flex items-center space-x-2 bg-black bg-opacity-60 rounded-full px-3 py-1.5">
                        <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-green-300 text-sm font-mono">Scanning</span>
                    </div>
                )}

                {/* Result display banner */}
                {analysisResult && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 p-4 z-30 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <p className="text-base text-gray-200 font-mono">
                                {analysisResult.angle !== null ? (
                                    <>
                                        <span className="font-bold text-3xl text-cyan-300">
                                            {analysisResult.angle.toFixed(1)}°
                                        </span>
                                        <span className="text-gray-300 ml-3">
                                            {analysisResult.description}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className="font-bold text-yellow-400">No Angle: </span>
                                        <span className="text-gray-300">{analysisResult.description}</span>
                                    </>
                                )}
                            </p>
                            {holdCountdown > 0 && (
                                <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                                    <div className="w-10 h-10 rounded-full border-2 border-cyan-400 flex items-center justify-center">
                                        <span className="text-cyan-300 font-bold text-sm">{holdCountdown}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            {/* Status bar */}
            <div className="mt-4 flex items-center space-x-2">
                {(detectionState === 'scanning' || detectionState === 'analyzing') && (
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                )}
                {detectionState === 'holding' && (
                    <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                )}
                <span className={`text-sm font-mono ${getStatusColor()}`}>
                    {getStatusText()}
                </span>
            </div>

            {cameraError && cameraReady && (
                <div className="mt-3 flex items-center space-x-2 bg-red-900/50 text-red-300 px-4 py-2 rounded-md">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-sm">{cameraError}</span>
                </div>
            )}
        </div>
    );
};

export default CameraAngleDetector;
