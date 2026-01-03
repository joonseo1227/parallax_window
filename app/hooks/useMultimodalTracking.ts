import {useEffect, useRef, useState} from 'react';
import {FaceLandmarker, FilesetResolver, HandLandmarker, NormalizedLandmark} from '@mediapipe/tasks-vision';

export interface FacePosition {
    x: number; // -1 to 1
    y: number; // -1 to 1
    z: number; // Estimated distance
    detected: boolean;
}

export interface HandData {
    landmarks: NormalizedLandmark[];
    isGunPose: boolean;
    isFiring: boolean;
    wristPos: { x: number, y: number, z: number };
    indexTipPos: { x: number, y: number, z: number };
}

export const useMultimodalTracking = () => {
    // Face State
    const [facePosition, setFacePosition] = useState<FacePosition>({x: 0, y: 0, z: 0, detected: false});
    const facePositionRef = useRef<FacePosition>({x: 0, y: 0, z: 0, detected: false});

    // Hand State
    const [handData, setHandData] = useState<HandData | null>(null);
    const handDataRef = useRef<HandData | null>(null);

    // Raw Refs for loop access
    const videoRef = useRef<HTMLVideoElement>(null);
    const requestRef = useRef<number>(0);
    const lastVideoTimeRef = useRef<number>(-1);

    // Recoil Detection Refs
    const lastIndexTipY = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const lastGunPoseTimeRef = useRef<number>(0); // Timestamp of last valid gun pose
    const recoilCoolDown = useRef<number>(0);

    useEffect(() => {
        let faceLandmarker: FaceLandmarker;
        let handLandmarker: HandLandmarker;

        const initMediaPipe = async () => {
            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
            );

            // Initialize Face Landmarker
            faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                    delegate: "GPU"
                },
                outputFaceBlendshapes: true,
                runningMode: "VIDEO",
                numFaces: 1
            });

            // Initialize Hand Landmarker
            handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 1
            });

            startWebcam();
        };

        const startWebcam = async () => {
            if (!videoRef.current) return;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {width: 640, height: 480, frameRate: 30}
                });
                videoRef.current.srcObject = stream;
                videoRef.current.addEventListener('loadeddata', predictWebcam);
            } catch (err) {
                console.error("Error accessing webcam:", err);
            }
        };

        const predictWebcam = () => {
            if (!faceLandmarker || !handLandmarker || !videoRef.current) return;

            const video = videoRef.current;
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                requestRef.current = requestAnimationFrame(predictWebcam);
                return;
            }

            // Check if video frame has advanced
            if (video.currentTime !== lastVideoTimeRef.current) {
                lastVideoTimeRef.current = video.currentTime;
                const startTimeMs = performance.now();

                // 1. Face Detection
                const faceResults = faceLandmarker.detectForVideo(video, startTimeMs);
                if (faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0) {
                    const landmarks = faceResults.faceLandmarks[0];
                    const nose = landmarks[1];
                    // Normalize: x: -1 (left) to 1 (right), y: -1 (bottom) to 1 (top)
                    const x = (nose.x - 0.5) * 2;
                    const y = -(nose.y - 0.5) * 2;
                    const z = nose.z;

                    const newFacePos = {x, y, z, detected: true};
                    facePositionRef.current = newFacePos;
                    setFacePosition(newFacePos);
                } else {
                    const lostPos = {...facePositionRef.current, detected: false};
                    facePositionRef.current = lostPos;
                    setFacePosition(lostPos);
                }

                // 2. Hand Detection
                const handResults = handLandmarker.detectForVideo(video, startTimeMs);
                if (handResults.landmarks && handResults.landmarks.length > 0) {
                    const landmarks = handResults.landmarks[0]; // Assume 1 hand

                    // Analyze Gesture
                    const {isGunPose, isFiring, indexTip, wrist} = analyzeHandGesture(landmarks, startTimeMs);

                    const newHandData: HandData = {
                        landmarks,
                        isGunPose,
                        isFiring,
                        wristPos: {x: wrist.x, y: wrist.y, z: wrist.z},
                        indexTipPos: {x: indexTip.x, y: indexTip.y, z: indexTip.z}
                    };

                    handDataRef.current = newHandData;
                    setHandData(newHandData);
                } else {
                    handDataRef.current = null;
                    setHandData(null);
                }
            }

            requestRef.current = requestAnimationFrame(predictWebcam);
        };

        // --- Gesture Logic ---
        const analyzeHandGesture = (landmarks: NormalizedLandmark[], timeMs: number) => {
            // Hand Landmarks Indices:
            // 0: Wrist
            // 4: Thumb Tip, 3: IP, 2: MCP
            // 8: Index Tip, 5: Index MCP
            // 12: Middle Tip, 9: Middle MCP
            // 16: Ring Tip, 13: Ring MCP
            // 20: Pinky Tip, 17: Pinky MCP

            const wrist = landmarks[0];
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const indexMCP = landmarks[5];
            const middleTip = landmarks[12];
            const middleMCP = landmarks[9];
            const ringTip = landmarks[16];
            const ringMCP = landmarks[13];
            const pinkyTip = landmarks[20];
            const pinkyMCP = landmarks[17];

            // 1. Check Gun Pose (Geometry)
            // Condition: Index Extended, Others Folded, Thumb Upish

            // Helper: Is finger folded? (Tip closer to wrist than MCP)
            // Distance squared check is faster, but simple approximation works for normalized coords
            const distSq = (p1: NormalizedLandmark, p2: NormalizedLandmark) =>
                (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;

            // Geometry Logic Update:
            // 1. Side View: Tip is far from wrist in 2D.
            const isIndexLong2D = distSq(indexTip, wrist) > distSq(indexMCP, wrist) * 1.5;

            // 2. Front View (Pointing at camera): 2D length is short due to foreshortening,
            // but Tip Z should be significantly smaller (closer to camera) than MCP Z.
            const isIndexPointingForward = (indexTip.z - indexMCP.z) < -0.05;

            const isIndexExtended = isIndexLong2D || isIndexPointingForward;

            // Updated Folded Logic: Compare Tip to PIP (Middle Joint) instead of MCP (Knuckle)
            // This is more lenient and works better when showing back of hand.
            // PIP Indices: Middle(10), Ring(14), Pinky(18)
            const middlePIP = landmarks[10];
            const ringPIP = landmarks[14];
            const pinkyPIP = landmarks[18];

            const isMiddleFolded = distSq(middleTip, wrist) < distSq(middlePIP, wrist);
            const isRingFolded = distSq(ringTip, wrist) < distSq(ringPIP, wrist);
            const isPinkyFolded = distSq(pinkyTip, wrist) < distSq(pinkyPIP, wrist);

            // Thumb is tricky. For a gun, thumb is usually up or out.
            // Let's just check if others are folded and index is out.
            // Also check if index tip is "above" index MCP (y is smaller is higher in image, but careful with rotation)
            // Let's rely on folded state of others mostly.

            const isGunPose = isIndexExtended && isMiddleFolded && isRingFolded && isPinkyFolded;

            // 2. Check Recoil (Velocity)
            let isFiring = false;

            if (isGunPose) {
                // Calculate Vertical Velocity of Index Tip
                // coordinate system: y 0 is top.
                // "Up" movement means y decreases.

                const currentY = indexTip.y;
                const lastY = lastIndexTipY.current;
                const dt = timeMs - lastTimeRef.current; // ms

                if (dt > 0 && dt < 100) { // Avoid glitches on large time gaps
                    const speedY = (currentY - lastY) / dt; // units per ms.
                    // Moving UP means currentY < lastY, so speedY is NEGATIVE.

                    // Threshold: Experimentally determined. 
                    // e.g. -0.002 per ms means moving 0.2 units (20% screen) in 100ms.
                    // Lowered to -0.0005 to catch lighter flicks (like -0.0007).
                    const RECOIL_THRESHOLD = -0.0005;

                    // Debug speed to tune sensitivity
                    // console.log("SpeedY:", speedY.toFixed(5));

                    if (speedY < RECOIL_THRESHOLD && recoilCoolDown.current <= 0) {
                        isFiring = true;
                        recoilCoolDown.current = 400;
                        // console.log("FIRE DETECTED!", speedY);
                    }
                }

                lastIndexTipY.current = currentY;
                lastTimeRef.current = timeMs;
            }

            if (recoilCoolDown.current > 0) {
                recoilCoolDown.current -= (timeMs - (lastTimeRef.current || timeMs)); // decay
            }

            return {isGunPose, isFiring, indexTip, wrist};
        };


        initMediaPipe();

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (faceLandmarker) faceLandmarker.close();
            if (handLandmarker) handLandmarker.close();
            if (videoRef.current && videoRef.current.srcObject) {
                const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
                tracks.forEach(track => track.stop());
            }
        };
    }, []);

    return {facePosition, facePositionRef, handData, handDataRef, videoRef};
};
