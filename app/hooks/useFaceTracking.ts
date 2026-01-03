import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface FacePosition {
  x: number; // -1 to 1 (left to right)
  y: number; // -1 to 1 (bottom to top)
  z: number; // Estimated distance
  detected: boolean;
}

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export const useFaceTracking = () => {
  const [facePosition, setFacePosition] = useState<FacePosition>({ x: 0, y: 0, z: 0, detected: false });
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[]>([]);
  const facePositionRef = useRef<FacePosition>({ x: 0, y: 0, z: 0, detected: false });
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    let faceLandmarker: FaceLandmarker;

    const initMediaPipe = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });

      startWebcam();
    };

    const startWebcam = async () => {
      if (!videoRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener('loadeddata', predictWebcam);
      } catch (err) {
        console.error("Error accessing webcam:", err);
      }
    };

    const predictWebcam = () => {
      if (!faceLandmarker || !videoRef.current) return;

      const startTimeMs = performance.now();
      if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
        const results = faceLandmarker.detectForVideo(videoRef.current, startTimeMs);

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];
          // Use point between eyes (e.g., nose bridge) as center.
          // MediaPipe Face Mesh: 168 is between eyes, 1 is nose tip. 
          // Let's us average of irises or just use the noise tip for simplicity first, then refine.
          // Iris indices: Left: 468-472, Right: 473-477.

          // Simple approach: Use bounding box center or specific landmark.
          // Using landmark 1 (nose tip) for now.
          const nose = landmarks[1];

          // Normalize coordinates
          // MediaPipe returns x, y normalized [0, 1]. x: 0 left, 1 right. y: 0 top, 1 bottom.
          // We want: x: -1 (left) to 1 (right). y: -1 (bottom) to 1 (top).

          const x = (nose.x - 0.5) * 2;
          const y = -(nose.y - 0.5) * 2; // Flip Y because screen Y is down

          // Estimate Z based on face width or iris distance.
          // Simple depth estimation: 1 / scale. roughly implies distance.
          // Closer face = larger coordinates difference.
          // Let's use simple z coordinate from landmark[1].z which is relative to face center. 
          // Actually, mediapipe z is relative to the image plane, but not absolute distance.
          // Better: use inter-pupillary distance or just standard z from mediapipe (it's normalized somewhat).
          // For the "Window" effect, we roughly need "head position".
          const z = nose.z; // TODO: Refine Z scaling


          const newPos = { x, y, z, detected: true };
          facePositionRef.current = newPos;
          setFacePosition(newPos);
          setLandmarks(landmarks);
        } else {
          facePositionRef.current = { ...facePositionRef.current, detected: false };
          setFacePosition(prev => ({ ...prev, detected: false }));
          setLandmarks([]);
        }
      }

      requestRef.current = requestAnimationFrame(predictWebcam);
    };

    initMediaPipe();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (faceLandmarker) faceLandmarker.close();
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  return { facePosition, facePositionRef, landmarks, videoRef };
};
