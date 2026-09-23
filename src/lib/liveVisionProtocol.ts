/** Stateless protocol helpers for sampled visual context on an existing Live session. */
export const LIVE_VISION_FRAME_INTERVAL_MS = 1500;

export function createLiveVisionInput(data: string, mimeType = 'image/jpeg') {
  // Live API video frames must use the dedicated realtime `video` stream.
  return { video: { data, mimeType } };
}

export function shouldSampleLiveVision(isVideoCallActive: boolean, wsReadyState: number, openState: number): boolean {
  return isVideoCallActive && wsReadyState === openState;
}
