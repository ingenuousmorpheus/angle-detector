import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { AngleAnalysisResult } from '../types';
import AngleDisplay from './AngleDisplay';
import ManualProtractor from '../src/render/ManualProtractor';
import ProtractorOverlay from '../src/ar/ProtractorOverlay';
import { coverCrop } from '../src/camera/cameraTransform';
import { rgbaToGray, type GrayImage } from '../src/vision/grayImage';
import type { Vec2 } from '../src/geometry/angle2d';
import { Camera, Zap, AlertTriangle, Loader, Crosshair, ImageUp, Ruler, Box, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface FrozenFrame {
    canvas: HTMLCanvasElement;
    gray: GrayImage;
    initial: [Vec2, Vec2, Vec2] | null;
    /** Opened with AR Lock: show the 3D Angle Lens protractor on the measurement. */
    ar: boolean;
}

const MAX_FRAME_DPR = 2;

/** AR Lock start: vertex on the crosshair, arms 120° apart, as normalized [edgeA, vertex, edgeB]. */
const arStartPoints = (w: number, h: number): [Vec2, Vec2, Vec2] => {
    const r = 0.28 * Math.min(w, h);
    const n = (x: number, y: number): Vec2 => ({ x: x / w, y: y / h });
    return [
        n(w / 2 - r, h / 2),
        n(w / 2, h / 2),
        n(w / 2 + r * Math.cos(Math.PI / 3), h / 2 - r * Math.sin(Math.PI / 3)),
    ];
};

/** Targeting reticle for the live view: tick ring, gold arc segments, centre dot. */
const HudReticle: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="-100 -100 200 200" className={className} aria-hidden="true">
        <g fill="none" stroke="#38d6ff" strokeLinecap="round">
            <circle r="88" strokeWidth="1" strokeOpacity="0.55" />
            {Array.from({ length: 72 }, (_, i) => {
                const a = (i * 5 * Math.PI) / 180, r0 = i % 6 === 0 ? 78 : 83;
                return <line key={i} x1={r0 * Math.cos(a)} y1={r0 * Math.sin(a)} x2={88 * Math.cos(a)} y2={88 * Math.sin(a)} strokeWidth={i % 6 === 0 ? 1.6 : 0.8} strokeOpacity="0.7" />;
            })}
            <circle r="62" strokeWidth="1.2" strokeDasharray="3 5" strokeOpacity="0.5" />
            <path d="M-6 0H-20M6 0H20M0-6V-20M0 6V20" strokeWidth="1.4" />
        </g>
        <g fill="none" stroke="#fbbf24" strokeWidth="2.4" strokeLinecap="round" opacity="0.85">
            <path d="M-93 -25 A96 96 0 0 1 -60 -75" />
            <path d="M93 25 A96 96 0 0 1 60 75" />
        </g>
        <circle r="2.6" fill="#38d6ff" />
    </svg>
);

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
    const [box, setBox] = useState({ w: 0, h: 0 });

    // Container size for the AR overlay.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const stopCamera = useCallback(() => {
        const video = videoRef.current;
        const stream = video?.srcObject as MediaStream | null;
        stream?.getTracks().forEach((track) => track.stop());
        if (video) video.srcObject = null;
    }, []);

    const startCamera = useCallback(async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                stopCamera(); // never hold two streams
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
    }, [stopCamera]);

    // Release the camera while the app is in the background (Android pause, tab hidden)
    // and reopen it on return if it was running. A frozen frame is kept as it is.
    const resumeCameraRef = useRef(false);
    useEffect(() => {
        const onVisibility = () => {
            const video = videoRef.current;
            if (document.hidden) {
                resumeCameraRef.current = Boolean(video?.srcObject);
                if (resumeCameraRef.current) {
                    stopCamera();
                    setIsCameraOn(false);
                }
            } else if (resumeCameraRef.current) {
                resumeCameraRef.current = false;
                setIsCameraOn(true);
                startCamera();
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [startCamera, stopCamera]);

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

    const freezeFrom = useCallback((canvas: HTMLCanvasElement, initial: [Vec2, Vec2, Vec2] | null = null, ar = false) => {
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setAnalysisResult(null);
        setError(null); // e.g. a camera-denied message no longer applies once a frame is open
        setFrozen({ canvas, gray: rgbaToGray(data, canvas.width, canvas.height), initial, ar });
    }, []);

    const handleFreeze = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        const scale = Math.min(MAX_FRAME_DPR, window.devicePixelRatio || 1);
        const canvas = captureCover(video, video.videoWidth, video.videoHeight, scale);
        if (canvas) freezeFrom(canvas);
    }, [captureCover, freezeFrom]);

    /**
     * AR Lock: freeze with the vertex on the crosshair and both arms pre-placed
     * (120° apart) so the operator only drags each arm handle onto its edge.
     * The angle is still computed by measureFromPoints from those points.
     */
    const handleArLock = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        const scale = Math.min(MAX_FRAME_DPR, window.devicePixelRatio || 1);
        const canvas = captureCover(video, video.videoWidth, video.videoHeight, scale);
        if (canvas) freezeFrom(canvas, arStartPoints(canvas.width, canvas.height), true);
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

    // Developer hook: `?photo=<url>&ar=1` opens an image straight into manual/AR mode.
    // Compiled out of release builds (__DEV_TOOLS__ is false outside `npm run dev`).
    useEffect(() => {
        if (!__DEV_TOOLS__) return;
        const params = new URLSearchParams(window.location.search);
        const url = params.get('photo');
        const ar = params.get('ar') === '1';
        if (!url) return;
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(MAX_FRAME_DPR, window.devicePixelRatio || 1);
            const canvas = captureCover(img, img.naturalWidth, img.naturalHeight, scale);
            if (canvas) freezeFrom(canvas, ar ? arStartPoints(canvas.width, canvas.height) : null, ar);
        };
        img.onerror = () => setError(`Could not open ${url}`);
        img.src = url;
    }, [captureCover, freezeFrom]);

    const handleAnalyze = useCallback(async () => {
        if (!__AI_ASSIST__) return; // release builds: no Gemini client, no network call
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
            const { analyzeImageAngle } = await import('../services/geminiService');
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
            <div ref={containerRef} className="gold-frame relative w-full aspect-video portrait:aspect-[3/4] bg-[#070b10] rounded-xl overflow-hidden">
                {/* Glowing gold corner brackets */}
                <span className="corner top-1.5 left-1.5 border-t-[3px] border-l-[3px] rounded-tl-lg" />
                <span className="corner top-1.5 right-1.5 border-t-[3px] border-r-[3px] rounded-tr-lg" />
                <span className="corner bottom-1.5 left-1.5 border-b-[3px] border-l-[3px] rounded-bl-lg" />
                <span className="corner bottom-1.5 right-1.5 border-b-[3px] border-r-[3px] rounded-br-lg" />
                {/* Transparent poster: Android WebView otherwise paints a large grey "play" placeholder before the camera starts. */}
                <video ref={videoRef} autoPlay playsInline muted poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" className="w-full h-full object-cover"></video>

                {!isCameraOn && !frozen && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 z-10">
                        <Camera className="w-14 h-14 text-cyan-300/80 mb-3 drop-shadow-[0_0_8px_rgba(56,214,255,0.7)]" />
                        <h2 className="font-display text-lg tracking-widest text-cyan-100 mb-4">CAMERA IS OFF</h2>
                        <div className="flex gap-3">
                            <button onClick={() => { setIsCameraOn(true); startCamera(); }} className="gold-btn">
                                <Camera className="w-5 h-5" /> Start Camera
                            </button>
                            <button onClick={() => fileRef.current?.click()} className="gold-btn">
                                <ImageUp className="w-5 h-5" /> Open Photo
                            </button>
                        </div>
                    </div>
                )}

                {!frozen && analysisResult && analysisResult.isAngleFound && videoRef.current && (
                    <AngleDisplay result={analysisResult} videoElement={videoRef.current} />
                )}

                {isCameraOn && !frozen && box.w > 0 && (
                    <div className="absolute inset-0 z-[15] pointer-events-none">
                        <ProtractorOverlay width={box.w} height={box.h} vertex={null} edgeA={null} edgeB={null} displayDeg={null} />
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-center gap-2">
                            <ChevronsLeft className="hidden sm:block w-6 h-6 text-cyan-300/70" />
                            <p className="hud-panel flex items-center gap-2 px-4 py-1.5 text-[11px] sm:text-sm font-semibold uppercase tracking-wide text-slate-100">
                                <Crosshair className="w-4 h-4 text-cyan-300 shrink-0" />
                                <span>Aim the bend at the crosshair, then tap <span className="text-amber-300">AR Lock</span></span>
                            </p>
                            <ChevronsRight className="hidden sm:block w-6 h-6 text-cyan-300/70" />
                        </div>
                    </div>
                )}

                {!frozen && isCameraOn && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                        <HudReticle className="w-[58%] max-w-[22rem] aspect-square opacity-80" />
                    </div>
                )}

                {frozen && (
                    <ManualProtractor
                        frame={frozen.canvas}
                        gray={frozen.gray}
                        initial={frozen.initial}
                        onExit={() => setFrozen(null)}
                        overlay={frozen.ar ? (g) => (
                            <ProtractorOverlay
                                width={g.width}
                                height={g.height}
                                vertex={g.vertex}
                                edgeA={g.edgeA}
                                edgeB={g.edgeB}
                                displayDeg={g.measurement?.found ? g.measurement.displayDeg : null}
                                locked={g.locked}
                            />
                        ) : undefined}
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
                <div className="mt-4 w-full grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 max-w-2xl">
                    <button onClick={handleFreeze} disabled={!isCameraOn} className="gold-btn">
                        <Crosshair className="w-6 h-6 shrink-0" />
                        <span className="text-left">Freeze &amp;<br />Measure</span>
                    </button>
                    <button onClick={handleArLock} disabled={!isCameraOn} className="ar-btn" aria-label="AR Lock">
                        <Box className="w-9 h-9" strokeWidth={1.6} />
                        <span>AR LOCK</span>
                    </button>
                    <button onClick={() => fileRef.current?.click()} className="gold-btn">
                        <ImageUp className="w-6 h-6 shrink-0" />
                        <span className="text-left">Open<br />Photo</span>
                    </button>
                </div>
            )}
            {!frozen && (__AI_ASSIST__ || (analysisResult?.isAngleFound && analysisResult.points)) && (
                <div className="mt-4 flex flex-wrap gap-3 justify-center">
                    {__AI_ASSIST__ && (
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
