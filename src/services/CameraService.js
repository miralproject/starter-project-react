import { getCameraConfig, getCameraConstraints, getCameraErrorMessage, isMobileDevice } from '../utils/common.js';

export class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.config = getCameraConfig();
  }

  setVideoElement(videoElement) {
    this.video = videoElement;
  }

  setCanvasElement(canvasElement) {
    this.canvas = canvasElement;
  }

  async loadCameras() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('MediaStream API tidak tersedia di browser ini.');
    }

    const probeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const devices = await navigator.mediaDevices.enumerateDevices();
    probeStream.getTracks().forEach((track) => track.stop());

    return devices.filter((device) => device.kind === 'videoinput');
  }

  async startCamera(selectedFacingMode = this.config.facingMode) {
    this.stopCamera();

    try {
      const constraints = getCameraConstraints(selectedFacingMode);
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!this.video) {
        throw new Error('Elemen video belum terpasang.');
      }

      this.video.srcObject = this.stream;
      this.video.setAttribute('playsinline', 'true');
      await this.video.play();

      return this.stream;
    } catch (error) {
      this.stopCamera();
      throw new Error(getCameraErrorMessage(error));
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }
  }

  setFPS(fps) {
    const nextFPS = Number(fps);

    if (Number.isNaN(nextFPS) || nextFPS <= 0) {
      return;
    }

    this.config.defaultFPS = nextFPS;
  }

  isActive() {
    return !!this.stream?.active;
  }

  isReady() {
    return this.isActive() && !!this.video && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !this.video.paused;
  }

  captureFrame() {
    if (!this.isReady() || !this.video || !this.canvas) {
      return null;
    }

    const width = this.video.videoWidth || 1;
    const height = this.video.videoHeight || 1;
    const context = this.canvas.getContext('2d');

    this.canvas.width = width;
    this.canvas.height = height;
    context.drawImage(this.video, 0, 0, width, height);

    return this.canvas;
  }

  getFacingMode() {
    return isMobileDevice() ? 'environment' : 'user';
  }
}
