import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeImageAngle, isAiAvailable } from '../services/geminiService';
import type { AngleAnalysisResult } from '../types';
import AngleDisplay from './AngleDisplay';
import ManualProtractor from '../src/render/ManualProtractor';
import { coverCrop } from '../src/camera/cameraTransform';
import { rgbaToGray, type GrayImage } from '../src/vision/grayImage';
import type { Vec2 } from '../src/geometry/angle2d';
import { Camera, Zap, AlertTriangle, Loader, Crosshair, ImageUp, Ruler } from 'lucide-react';

interface FrozenFrame {
    canvas: HTMLCanvasElement;
    gray: GrayImage;
    initial: [Vec2, Vec2, Vec2] | null;
}

const MAX_FRAME_DPR = 2;

const CameraAngleDetector: React.FC = () => {
    const [isCameraOn, setIsCameraOn] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AngleAnalysisResult | null>(null);
    const [frozen, setFrozen] = useState<FrozenFrame | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const lastAnalyzedFrame = useRef<HTMLCanvasElement | null>(null);
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
                setError("Could not access camera. Please check permissions — or use Open Photo.");
                setIsCameraOn(false);
            }
        } else {
            setError("Your browser does not support camera access. Use Open Photo instead.");
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

    /**
     * Draw `source` into a new canvas exactly as `object-cover` displays it in the container,
     * so normalized coordinates on the canvas == normalized coordinates on screen.
     */
    const captureCover = useCallback((source: CanvasImageSource, srcW: number, srcH: number, scale: number): HTMLCanvasElement | null => {
        const box = containerRef.current?.getBoundingClientRect();
        if (!box || !srcW || !srcH) return null;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(box.width * scale);
        canvas.height = Math.round(box.height * scale);
        const crop = coverCrop(srcW, srcH, canvas.width, canvas.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
        return canvas;
    }, []);

    const freezeFrom = useCallback((canvas: HTMLCanvasElement, initial: [Vec2, Vec2, Vec2] | null = null) => {
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setAnalysisResult(null);
        setFrozen({ canvas, gray: rgbaToGray(data, canvas.width, canvas.height), initial });
    }, []);

    const handleFreeze = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        const scale = Math.min(MAX_FRAME_DPR, window.devicePixelRatio || 1);
        const canvas = captureCover(video, video.videoWidth, video.videoHeight, scale);
        if (canvas) freezeFrom(canvas);
    }, [captureCover, freezeFrom]);

    const handlePhoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(MAX_FRAME_DPR, window.devicePixelRatio || 1);
            const canvas = captureCover(img, img.naturalWidth, img.naturalHeight, scale);
            URL.revokeObjectURL(img.src);
            if (canvas) freezeFrom(canvas);
        };
        img.onerror = () => setError('Could not open that image.');
        img.src = URL.createObjectURL(file);
    }, [captureCover, freezeFrom]);

    // `?photo=<url>` opens an image straight into manual mode (fixtures, field photos, testing).
    useEffect(() => {
        const url = new URLSearchParams(window.location.search).get('photo');
        if (!url) return;
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(MAX_FRAME_DPR, window.devicePixelRatio || 1);
            const canvas = captureCover(img, img.naturalWidth, img.naturalHeight, scale);
            if (canvas) freezeFrom(canvas);
        };
        img.onerror = () => setError(`Could not open ${url}`);
        img.src = url;
    }, [captureCover, freezeFrom]);

    const handleAnalyze = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        if (resultTimeoutRef.current) {
            clearTimeout(resultTimeoutRef.current);
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        const video = videoRef.current;
        const canvas = captureCover(video, video.videoWidth, video.videoHeight, 1);
        if (!canvas) {
            setError("Could not get canvas context.");
            setIsLoading(false);
            return;
        }
        lastAnalyzedFrame.current = canvas;
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
    }, [captureCover]);

    /** Use the AI's points as a starting placement; the angle is then computed by geometry. */
    const refineAiResult = useCallback(() => {
        const frame = lastAnalyzedFrame.current;
        if (!frame || !analysisResult?.points) return;
        if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
        freezeFrom(frame, analysisResult.points);
    }, [analysisResult, freezeFrom]);

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
            {/* Portrait phones/tablets get a taller frame (3:4) so the workpiece stays
                visible behind the toolbar and readout; landscape/desktop keep 16:9.
                Capture uses the tested coverCrop at whatever aspect is displayed,
                and the angle is computed from normalized points in pixel space,
                so the math is aspect-independent. */}
            <div ref={containerRef} className="relative w-full aspect-video portrait:aspect-[3/4] bg-gray-800 rounded-lg shadow-2xl overflow-hidden border-2 border-gray-700">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>

                {!isCameraOn && !frozen && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 z-10">
                        <Camera className="w-16 h-16 text-gray-400 mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Camera is off</h2>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setIsCameraOn(true); startCamera(); }}
                                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-md font-bold transition-transform transform hover:scale-105"
                            >
                                Start Camera
                            </button>
                            <button
                                onClick={() => fileRef.current?.click()}
                                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-md font-bold transition-transform transform hover:scale-105"
                            >
                                Open Photo
                            </button>
                        </div>
                    </div>
                )}

                {!frozen && analysisResult && analysisResult.isAngleFound && videoRef.current && (
                    <AngleDisplay result={analysisResult} videoElement={videoRef.current} />
                )}

                {!frozen && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                        <div className="w-24 h-24 md:w-32 md:h-32 border-2 border-cyan-400 border-dashed rounded-full opacity-50"></div>
                         <div className="w-1 h-1 bg-cyan-400 rounded-full absolute"></div>
                    </div>
                )}

                {frozen && (
                    <ManualProtractor
                        frame={frozen.canvas}
                        gray={frozen.gray}
                        initial={frozen.initial}
                        onExit={() => setFrozen(null)}
                    />
                )}

                {!frozen && analysisResult && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 p-3 z-30 animate-fade-in">
                        <p className="text-base text-gray-200 font-mono text-center">
                            {analysisResult.angle !== null ? (
                                <>
                                    <span className="font-bold text-xl text-cyan-300">{analysisResult.angle.toFixed(1)}° </span>
                                    <span className="text-yellow-400 text-sm">AI estimate (unverified) </span>
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
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />

            {error && (
                <div className="mt-4 flex items-center space-x-2 bg-red-900/50 text-red-300 px-4 py-2 rounded-md">
                    <AlertTriangle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            )}

            {!frozen && (
                <div className="mt-6 flex flex-wrap gap-3 justify-center">
                    <button
                        onClick={handleFreeze}
                        disabled={!isCameraOn}
                        className="flex items-center justify-center space-x-3 px-8 py-4 bg-yellow-300 text-gray-900 font-bold rounded-full shadow-lg transition-all transform hover:scale-105 hover:bg-yellow-200 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:scale-100"
                    >
                        <Crosshair className="w-6 h-6" />
                        <span>Freeze &amp; Measure</span>
                    </button>
                    <button
                        onClick={() => fileRef.current?.click()}
                        className="flex items-center justify-center space-x-3 px-6 py-4 bg-gray-700 text-white font-bold rounded-full shadow-lg transition-all transform hover:scale-105 hover:bg-gray-600"
                    >
                        <ImageUp className="w-6 h-6" />
                        <span>Open Photo</span>
                    </button>
                    {isAiAvailable() && (
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
                                    <span>AI Analyze</span>
                                </>
                            )}
                        </button>
                    )}
                    {analysisResult?.isAngleFound && analysisResult.points && (
                        <button
                            onClick={refineAiResult}
                            className="flex items-center justify-center space-x-3 px-6 py-4 bg-lime-400 text-gray-900 font-bold rounded-full shadow-lg transition-all transform hover:scale-105"
                        >
                            <Ruler className="w-6 h-6" />
                            <span>Measure AI points</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default CameraAngleDetector;
