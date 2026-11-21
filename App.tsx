import React from 'react';
import CameraAngleDetector from './components/CameraAngleDetector';
import AngleLensLogo from './components/AngleLensLogo';

const App: React.FC = () => {
  return (
    <div className="app-bg min-h-screen text-white flex flex-col items-center px-3 pt-3 pb-4 font-hud">
      <header className="relative w-full max-w-4xl flex flex-col items-center">
        <div className="flex items-center gap-3">
          <AngleLensLogo className="w-14 h-12 md:w-16 md:h-14" />
          <div className="flex flex-col items-center">
            <h1 className="gold-text font-display font-black text-3xl md:text-5xl tracking-wider leading-none">ANGLE LENS</h1>
            <p className="mt-1 flex items-center gap-2 text-[11px] md:text-sm font-semibold tracking-[0.2em] text-slate-200">
              <span className="h-px w-5 md:w-8 bg-slate-400/70" />
              PROFESSIONAL ANGLE FINDER
              <span className="h-px w-5 md:w-8 bg-slate-400/70" />
            </p>
          </div>
        </div>
        <div className="hud-panel mt-3 w-full max-w-2xl px-5 py-2.5 text-center">
          <p className="text-sm md:text-lg font-semibold uppercase tracking-wide text-slate-100">
            Freeze the frame, tap the vertex and both edges, and <span className="text-amber-300">read the angle.</span>
          </p>
        </div>
      </header>
      <main className="w-full flex-grow flex items-start justify-center mt-3">
        <CameraAngleDetector />
      </main>
      <footer className="w-full max-w-4xl text-center mt-5 text-slate-500 text-xs md:text-sm">
        <p>Angles are computed geometrically from the points you place (2D apparent angle — keep the camera square to the bend). No accuracy is claimed without calibration.</p>
      </footer>
    </div>
  );
};

export default App;
