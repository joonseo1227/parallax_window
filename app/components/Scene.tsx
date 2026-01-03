'use client';

import { Canvas } from '@react-three/fiber';
import { useRef, useEffect } from 'react';
import { ParallaxCamera } from './ParallaxCamera';
import { useFaceTracking } from '../hooks/useFaceTracking';
import { Box, Grid, Sphere, Environment, Edges } from '@react-three/drei';

// --- Dimensions Configuration ---
// These must match the logical size used in ParallaxCamera projection
const SCREEN_WIDTH = 40;
const SCREEN_HEIGHT = 22.5; // Aspect Ratio 16:9 approx
const ROOM_DEPTH = 60;

export default function Scene() {
    const { facePosition, facePositionRef, landmarks, videoRef } = useFaceTracking();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Draw Overlay
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear previous frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!landmarks || landmarks.length === 0) return;

        // Configuration
        const w = canvas.width;
        const h = canvas.height;
        ctx.strokeStyle = '#00ff88'; // Cyan/Green neon
        ctx.lineWidth = 2;

        // 1. Calculate Bounding Box
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        // Optimization: Don't iterate all 478 landmarks every frame if performance is key, 
        // but for <500 points it's negligible in JS.
        for (let i = 0; i < landmarks.length; i++) {
            const lm = landmarks[i];
            if (lm.x < minX) minX = lm.x;
            if (lm.x > maxX) maxX = lm.x;
            if (lm.y < minY) minY = lm.y;
            if (lm.y > maxY) maxY = lm.y;
        }

        // Draw Box
        const boxX = minX * w;
        const boxY = minY * h;
        const boxW = (maxX - minX) * w;
        const boxH = (maxY - minY) * h;

        ctx.beginPath();
        ctx.rect(boxX, boxY, boxW, boxH);
        ctx.stroke();

        // 2. Draw Key Points (Nose, Irises)
        // Indices: Nose Tip (1), Left Eye Iris (468), Right Eye Iris (473)
        // Note: Right/Left is subject to mirroring
        const keyPoints = [
            { idx: 1, color: '#ff0088' },   // Nose
            { idx: 468, color: '#ffff00' }, // Iris
            { idx: 473, color: '#ffff00' }  // Iris
        ];

        keyPoints.forEach(kp => {
            const lm = landmarks[kp.idx];
            if (lm) {
                ctx.beginPath();
                ctx.arc(lm.x * w, lm.y * h, 3, 0, 2 * Math.PI);
                ctx.fillStyle = kp.color;
                ctx.fill();
            }
        });

    }, [landmarks]);

    // Calculated positions
    const floorY = -SCREEN_HEIGHT / 2;
    const ceilingY = SCREEN_HEIGHT / 2;
    const leftX = -SCREEN_WIDTH / 2;
    const rightX = SCREEN_WIDTH / 2;
    const backZ = -ROOM_DEPTH;

    // Grid Arguments
    // Floor/Ceiling: [Width, Depth] -> [SCREEN_WIDTH, ROOM_DEPTH]
    // Side Walls: [Depth, Height] -> [ROOM_DEPTH, SCREEN_HEIGHT] (Because rotated)
    // Back Wall: [Width, Height] -> [SCREEN_WIDTH, SCREEN_HEIGHT]

    return (
        <div className="w-full h-full relative bg-black">
            {/* 3D Scene */}
            <Canvas className="absolute top-0 left-0 z-10" shadows>
                <color attach="background" args={['#101010']} />

                {/* Lighting & Environment */}
                <ambientLight intensity={0.2} />
                <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
                <Environment preset="city" />

                {/* Objects */}
                {/* FLOOR Grid */}
                <Grid
                    position={[0, floorY, -ROOM_DEPTH / 2]}
                    args={[SCREEN_WIDTH, ROOM_DEPTH]}
                    cellSize={2}
                    cellThickness={1}
                    cellColor="#6f6f6f"
                    sectionSize={10}
                    sectionThickness={1.5}
                    sectionColor="#9d4b4b"
                    fadeDistance={100}
                />

                {/* CEILING Grid */}
                <Grid
                    position={[0, ceilingY, -ROOM_DEPTH / 2]}
                    args={[SCREEN_WIDTH, ROOM_DEPTH]}
                    cellSize={2}
                    cellThickness={1}
                    cellColor="#6f6f6f"
                    sectionSize={10}
                    sectionThickness={1.5}
                    sectionColor="#4b9d9d" // Cyan-ish
                    fadeDistance={100}
                    rotation={[Math.PI, 0, 0]} // Flip upside down
                />

                {/* LEFT Wall Grid */}
                <Grid
                    position={[leftX, 0, -ROOM_DEPTH / 2]}
                    args={[SCREEN_HEIGHT, ROOM_DEPTH]}
                    cellSize={2}
                    cellThickness={1}
                    cellColor="#6f6f6f"
                    sectionSize={10}
                    sectionThickness={1.5}
                    sectionColor="#4b9d4b" // Green-ish
                    fadeDistance={100}
                    rotation={[0, 0, -Math.PI / 2]}
                />

                {/* RIGHT Wall Grid */}
                <Grid
                    position={[rightX, 0, -ROOM_DEPTH / 2]}
                    // Same logic: rotated 90 deg z.
                    args={[SCREEN_HEIGHT, ROOM_DEPTH]}
                    cellSize={2}
                    cellThickness={1}
                    cellColor="#6f6f6f"
                    sectionSize={10}
                    sectionThickness={1.5}
                    sectionColor="#4b9d4b" // Green-ish
                    fadeDistance={100}
                    rotation={[0, 0, Math.PI / 2]}
                />

                {/* BACK Wall Grid */}
                <Grid
                    position={[0, 0, backZ]}
                    args={[SCREEN_WIDTH, SCREEN_HEIGHT]}
                    cellSize={2}
                    cellThickness={1}
                    cellColor="#6f6f6f"
                    sectionSize={10}
                    sectionThickness={1.5}
                    sectionColor="#9d4b9d" // Purple-ish
                    fadeDistance={100}
                    rotation={[Math.PI / 2, 0, 0]}
                />

                {/* Deeper room box (Wireframe Container) */}
                <Box args={[SCREEN_WIDTH, SCREEN_HEIGHT, ROOM_DEPTH]} position={[0, 0, -ROOM_DEPTH / 2]}>
                    <meshBasicMaterial transparent opacity={0} />
                    <Edges color="#333" />
                </Box>

                {/* Floating Object - Metallic Sphere with Reflections */}
                <Sphere args={[2, 64, 64]} position={[0, 0, -10]}>
                    <meshStandardMaterial
                        color="#ff0080"
                        roughness={0.05}
                        metalness={0.9}
                        envMapIntensity={1}
                    />
                </Sphere>

                {/* Cyan Box with Edges */}
                <Box args={[4, 4, 4]} position={[-10, 5, -30]}>
                    <meshStandardMaterial color="cyan" roughness={0.2} metalness={0.5} />
                    <Edges scale={1} threshold={15} color="white" />
                </Box>

                {/* Orange Box with Edges */}
                <Box args={[2, 8, 2]} position={[10, -5, -20]}>
                    <meshStandardMaterial color="orange" roughness={0.2} metalness={0.5} />
                    <Edges scale={1} threshold={15} color="white" />
                </Box>

                {/* Camera Controller */}
                <ParallaxCamera
                    facePosition={facePosition}
                    facePositionRef={facePositionRef}
                    screenSize={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
                />
            </Canvas>

            {/* UI Overlay / Debug */}
            <div className="absolute top-4 left-4 z-20 bg-black/50 p-4 rounded text-white font-mono text-sm pointer-events-none">
                <p>Tracking: {facePosition.detected ? <span className="text-green-400">ACTIVE</span> : <span className="text-red-400">LOST</span>}</p>
                <p>X: {facePosition.x.toFixed(2)}</p>
                <p>Y: {facePosition.y.toFixed(2)}</p>
                <p>Z: {facePosition.z.toFixed(4)}</p>
            </div>

            {/* Hidden Webcam for processing */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute top-4 right-4 w-32 h-24 object-cover opacity-50 z-20 rounded border border-white/20 pointer-events-auto"
                // Style to mirror logic if needed, but MediaPipe usually handles it.
                // Style to mirror logic if needed, but MediaPipe usually handles it.
                style={{ transform: 'scaleX(-1)' }}
            />
            {/* Overlay Canvas */}
            <canvas
                ref={canvasRef}
                width={640} // Default webcam resolution for coordinate mapping
                height={480}
                className="absolute top-4 right-4 w-32 h-24 z-30 pointer-events-none rounded border border-white/20"
                style={{ transform: 'scaleX(-1)' }}
            />
        </div>
    );
}
