/**
 * Camera & Multimodal Vision Manager for Maryam
 * 
 * Rules:
 * 1. OFF by default. Requires explicit owner permission.
 * 2. Visual indicator whenever camera stream is live.
 * 3. Never records or persists video/images by default.
 * 4. Captures single base64 JPEG snapshots on demand for Gemini Vision analysis.
 * 5. Clean failure handling (permission denied, unavailable, disconnected).
 */

export interface CameraState {
  isActive: boolean;
  hasPermission: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown';
  error: string | null;
  stream: MediaStream | null;
  facingMode: 'user' | 'environment';
}

export type CameraStateListener = (state: CameraState) => void;

export class CameraManager {
  private static instance: CameraManager | null = null;

  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private isRequestingCamera: boolean = false;

  private state: CameraState = {
    isActive: false,
    hasPermission: false,
    permissionStatus: 'unknown',
    error: null,
    stream: null,
    facingMode: 'user',
  };

  private listeners: Set<CameraStateListener> = new Set();

  private constructor() {
    // Hidden canvas for frame extraction
    if (typeof window !== 'undefined') {
      this.canvasElement = document.createElement('canvas');
      this.canvasElement.width = 640;
      this.canvasElement.height = 480;
    }
  }

  public static getInstance(): CameraManager {
    if (!CameraManager.instance) {
      CameraManager.instance = new CameraManager();
    }
    return CameraManager.instance;
  }

  public getState(): CameraState {
    return { ...this.state };
  }

  public getVideoDimensions(): { width: number; height: number } {
    if (this.videoElement) {
      return {
        width: this.videoElement.videoWidth || 0,
        height: this.videoElement.videoHeight || 0,
      };
    }
    return { width: 0, height: 0 };
  }

  public isMediaStreamActive(): boolean {
    if (!this.stream) return false;
    return this.stream.active && this.stream.getVideoTracks().some((t) => t.readyState === 'live');
  }

  public subscribe(listener: CameraStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((fn) => fn(currentState));
  }

  /**
   * Attaches an HTMLVideoElement (e.g. from UI preview component)
   */
  public attachVideoElement(videoEl: HTMLVideoElement | null) {
    this.videoElement = videoEl;
    if (this.videoElement && this.stream) {
      this.videoElement.srcObject = this.stream;
      this.videoElement.play().catch(() => {});
    }
  }

  /**
   * Requests camera permission and starts live video feed
   */
  public async startCamera(facingMode: 'user' | 'environment' = this.state.facingMode): Promise<{ success: boolean; error?: string }> {
    if (this.isRequestingCamera) {
      return { success: false, error: 'Camera request already in progress' };
    }
    this.isRequestingCamera = true;
    try {
      if (this.state.isActive && this.stream) {
        return { success: true };
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = 'Camera API is not supported in this browser environment.';
        this.state = {
          ...this.state,
          isActive: false,
          permissionStatus: 'denied',
          error: errorMsg,
        };
        this.notify();
        return { success: false, error: errorMsg };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: { ideal: facingMode },
        },
        audio: false, // Audio handled separately by audioManager
      });

      this.stream = stream;

      // Create internal video element if none attached
      if (!this.videoElement) {
        this.videoElement = document.createElement('video');
        this.videoElement.setAttribute('playsinline', 'true');
        this.videoElement.setAttribute('muted', 'true');
      }

      this.videoElement.srcObject = stream;
      await this.videoElement.play();

      this.state = {
        isActive: true,
        hasPermission: true,
        permissionStatus: 'granted',
        error: null,
        stream,
        facingMode,
      };

      // Listen for stream track ending
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          this.stopCamera('Camera stream ended by device/user');
        };
      });

      this.notify();
      return { success: true };
    } catch (err: any) {
      let errorMsg = 'Failed to access camera.';
      let permStatus: 'denied' | 'unknown' = 'unknown';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera permission was denied by Mohsin / browser settings.';
        permStatus = 'denied';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera device found on this system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Camera is currently in use by another application.';
      } else if (err.message) {
        errorMsg = err.message;
      }

      this.state = {
        ...this.state,
        isActive: false,
        hasPermission: false,
        permissionStatus: permStatus,
        error: errorMsg,
        stream: null,
      };
      this.notify();
      return { success: false, error: errorMsg };
    } finally {
      this.isRequestingCamera = false;
    }
  }

  public async switchCamera(): Promise<{ success: boolean; error?: string }> {
    const nextFacingMode = this.state.facingMode === 'user' ? 'environment' : 'user';
    this.stopCamera('Switching camera');
    return this.startCamera(nextFacingMode);
  }

  /**
   * Stops the live camera stream cleanly
   */
  public stopCamera(reason: string = 'User requested camera off') {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.state = {
      ...this.state,
      isActive: false,
      error: null,
      stream: null,
    };
    this.notify();
  }

  /**
   * Captures a base64 JPEG snapshot asynchronously, ensuring video frame is ready
   */
  public async captureSnapshotBase64Async(): Promise<string | null> {
    if (!this.state.isActive || !this.stream) {
      console.warn('[CameraManager] Cannot capture frame: camera stream is not active');
      return null;
    }

    if (!this.videoElement) {
      this.videoElement = document.createElement('video');
      this.videoElement.setAttribute('playsinline', 'true');
      this.videoElement.setAttribute('muted', 'true');
      this.videoElement.srcObject = this.stream;
      await this.videoElement.play().catch(() => {});
    } else if (this.videoElement.srcObject !== this.stream) {
      this.videoElement.srcObject = this.stream;
      await this.videoElement.play().catch(() => {});
    }

    // Wait until video element has dimensions and readyState >= 2 (HAVE_CURRENT_DATA)
    let attempts = 0;
    while (
      attempts < 15 &&
      (!this.videoElement.videoWidth ||
        !this.videoElement.videoHeight ||
        this.videoElement.readyState < 2)
    ) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }

    return this.captureSnapshotBase64();
  }

  /**
   * Captures a base64 JPEG snapshot from the live camera stream
   */
  public captureSnapshotBase64(): string | null {
    if (!this.state.isActive || !this.videoElement || !this.canvasElement) {
      return null;
    }

    try {
      const width = this.videoElement.videoWidth || 640;
      const height = this.videoElement.videoHeight || 480;

      if (width === 0 || height === 0) {
        console.warn('[CameraManager] Video dimensions are 0x0, frame capture aborted');
        return null;
      }

      this.canvasElement.width = width;
      this.canvasElement.height = height;

      const ctx = this.canvasElement.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(this.videoElement, 0, 0, width, height);

      // Return raw base64 JPEG data (without data:image/jpeg;base64, prefix for API)
      const dataUrl = this.canvasElement.toDataURL('image/jpeg', 0.85);
      const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

      if (base64Data.length < 500) {
        console.warn('[CameraManager] Captured frame base64 is suspiciously short');
        return null;
      }

      console.log(`[CameraManager] Live camera snapshot captured successfully (${width}x${height}, ${base64Data.length} chars)`);
      return base64Data;
    } catch (err) {
      console.warn('[CameraManager] Error capturing snapshot:', err);
      return null;
    }
  }
}

export const cameraManager = CameraManager.getInstance();
