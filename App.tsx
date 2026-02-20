
import React from 'react';
import CameraAngleDetector from './components/CameraAngleDetector';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
      <header className="w-full max-w-4xl text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-500">
          Angle Detector
        </h1>
        <p className="text-gray-400 mt-2 text-lg">
          Point your camera at any corner or edge to measure its angle.
        </p>
      </header>
      <main className="w-full flex-grow flex items-center justify-center">
        <CameraAngleDetector />
      </main>
      <footer className="w-full max-w-4xl text-center mt-6 text-gray-500 text-sm">
        <p>Powered by Gemini. Detected angles hold for 10 seconds.</p>
      </footer>
    </div>
  );
};

export default App;
