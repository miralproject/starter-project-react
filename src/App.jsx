import { useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import CameraSection from './components/CameraSection';
import InfoPanel from './components/InfoPanel';
import { CameraService } from './services/CameraService.js';
import { DetectionService } from './services/DetectionService.js';
import { RootFactsService } from './services/RootFactsService.js';
import { APP_CONFIG, TONE_CONFIG, isValidDetection } from './utils/config.js';

function App() {
  const detectionCleanupRef = useRef(null);
  const isRunningRef = useRef(false);
  const cameraRef = useRef(null);
  const detectorRef = useRef(null);
  const generatorRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const personaRef = useRef(TONE_CONFIG.defaultTone);
  const [currentTone, setCurrentTone] = useState(TONE_CONFIG.defaultTone);
  const [fps, setFps] = useState(APP_CONFIG.defaultFpsLimit);
  const [modelStatus, setModelStatus] = useState('Memuat Model AI... 0%');
  const [isRunning, setIsRunning] = useState(false);
  const [appState, setAppState] = useState('idle');
  const [detectionResult, setDetectionResult] = useState(null);
  const [funFactData, setFunFactData] = useState(null);
  const [error, setError] = useState(null);
  const [cameraFacingMode, setCameraFacingMode] = useState('environment');
  const [services, setServices] = useState({
    detector: null,
    camera: null,
    generator: null,
  });

  useEffect(() => {
    let cancelled = false;

    const initServices = async () => {
      try {
        const detector = new DetectionService();
        const camera = new CameraService();
        const generator = new RootFactsService();

        cameraRef.current = camera;
        detectorRef.current = detector;
        generatorRef.current = generator;

        camera.setVideoElement(videoRef.current);
        camera.setCanvasElement(canvasRef.current);
        camera.setFPS(fps);
        generator.setTone(personaRef.current);

        setServices({
          detector,
          camera,
          generator,
        });

        await detector.loadModel((progress) => {
          if (!cancelled) {
            setModelStatus(`Memuat Model AI... ${progress}%`);
          }
        });

        await generator.loadModel((progress) => {
          if (!cancelled) {
            setModelStatus(`Memuat Model AI... ${progress}%`);
          }
        });

        if (!cancelled) {
          setModelStatus('Model AI Siap');
        }
      } catch (initError) {
        if (!cancelled) {
          setError(initError.message);
          setModelStatus('Model Gagal Dimuat');
        }
      }
    };

    initServices();

    return () => {
      cancelled = true;
      if (detectionCleanupRef.current) {
        clearTimeout(detectionCleanupRef.current);
      }
      cameraRef.current?.stopCamera();
    };
  }, []);

  useEffect(() => {
    personaRef.current = currentTone;
    if (generatorRef.current) {
      generatorRef.current.setTone(currentTone);
    }
  }, [currentTone]);

  useEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.setFPS(fps);
    }
  }, [fps]);

  const stopLoop = () => {
    if (detectionCleanupRef.current) {
      clearTimeout(detectionCleanupRef.current);
      detectionCleanupRef.current = null;
    }
  };

  const runDetectionLoop = async () => {
    if (!isRunningRef.current || !detectorRef.current || !cameraRef.current) {
      return;
    }

    if (!cameraRef.current.isReady()) {
      detectionCleanupRef.current = window.setTimeout(runDetectionLoop, APP_CONFIG.detectionRetryInterval);
      return;
    }

    try {
      const frame = cameraRef.current.captureFrame();
      if (!frame) {
        detectionCleanupRef.current = window.setTimeout(runDetectionLoop, APP_CONFIG.detectionRetryInterval);
        return;
      }

      const result = await detectorRef.current.predict(frame);
      setDetectionResult(result);

      if (isValidDetection(result)) {
        isRunningRef.current = false;
        setIsRunning(false);
        stopLoop();
        cameraRef.current.stopCamera();
        setAppState('analyzing');
        setFunFactData(null);

        const generated = await generatorRef.current.generateFacts(result.className);
        setFunFactData(generated?.funFact || 'error');
        setAppState('result');
        return;
      }
    } catch (loopError) {
      setError(loopError.message);
      setAppState('idle');
      isRunningRef.current = false;
      setIsRunning(false);
      cameraRef.current?.stopCamera();
      stopLoop();
      return;
    }

    detectionCleanupRef.current = window.setTimeout(runDetectionLoop, Math.max(1000 / fps, APP_CONFIG.detectionRetryInterval));
  };

  const handleToggleCamera = async () => {
    if (!detectorRef.current?.isLoaded() || !generatorRef.current?.isReady()) {
      setError('Model AI belum siap. Harap tunggu inisialisasi selesai.');
      return;
    }

    if (isRunningRef.current) {
      isRunningRef.current = false;
      setIsRunning(false);
      stopLoop();
      cameraRef.current?.stopCamera();
      setAppState('idle');
      return;
    }

    try {
      setError(null);
      setFunFactData(null);
      setDetectionResult(null);
      setAppState('analyzing');

      await cameraRef.current.loadCameras();
      await cameraRef.current.startCamera(cameraFacingMode);

      isRunningRef.current = true;
      setIsRunning(true);
      stopLoop();
      detectionCleanupRef.current = window.setTimeout(runDetectionLoop, APP_CONFIG.analysisDelayMs);
    } catch (startError) {
      setError(startError.message);
      setAppState('idle');
      isRunningRef.current = false;
      setIsRunning(false);
      cameraRef.current?.stopCamera();
    }
  };

  const handleToneChange = (tone) => {
    setCurrentTone(tone);
  };

  const handleCopyFact = async () => {
    if (!funFactData || funFactData === 'error') {
      return;
    }

    await navigator.clipboard.writeText(funFactData);
  };

  return (
    <div className="app-container">
      <Header modelStatus={modelStatus} />

      <main className="main-content">
        <CameraSection
          isRunning={isRunning}
          onToggleCamera={handleToggleCamera}
          onToneChange={handleToneChange}
          services={services}
          modelStatus={modelStatus}
          error={error}
          currentTone={currentTone}
          fps={fps}
          onFpsChange={setFps}
          cameraFacingMode={cameraFacingMode}
          onCameraFacingModeChange={setCameraFacingMode}
        />

        <InfoPanel
          appState={appState}
          detectionResult={detectionResult}
          funFactData={funFactData}
          error={error}
          onCopyFact={handleCopyFact}
        />
      </main>

      <footer className="footer">
        <p>Powered by TensorFlow.js & Transformers.js</p>
      </footer>

      {error && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '380px',
          padding: '0.875rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#991b1b',
          fontSize: '0.8125rem',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 1000
        }}>
          <strong>Error:</strong> {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#991b1b',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
