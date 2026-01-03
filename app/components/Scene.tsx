'use client';

import {Canvas} from '@react-three/fiber';
import {useEffect, useRef, useState} from 'react';
import {ParallaxCamera} from './ParallaxCamera';
import {useMultimodalTracking} from '../hooks/useMultimodalTracking';
import {BulletSystem} from './BulletSystem';
import {TargetSystem, TargetSystemRef} from './TargetSystem'; // Import
import {Box, Edges, Environment, Grid} from '@react-three/drei';

// --- Dimensions Configuration ---
// Base height for consistent scaling
const BASE_SCREEN_HEIGHT = 22.5;
const ROOM_DEPTH = 60;

export default function Scene() {
    // UPDATED: Use Multimodal Hook
    const {facePosition, facePositionRef, handData, videoRef} = useMultimodalTracking();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const targetsRef = useRef<TargetSystemRef>(null); // Shared Ref

    // Responsive screen dimensions based on viewport aspect ratio
    const [screenSize, setScreenSize] = useState({
        width: BASE_SCREEN_HEIGHT * (16 / 9),
        height: BASE_SCREEN_HEIGHT
    });

    // Update screen dimensions on window resize
    useEffect(() => {
        const updateScreenSize = () => {
            const aspectRatio = window.innerWidth / window.innerHeight;
            setScreenSize({
                width: BASE_SCREEN_HEIGHT * aspectRatio,
                height: BASE_SCREEN_HEIGHT
            });
        };

        // Set initial size
        updateScreenSize();

        // Add resize listener
        window.addEventListener('resize', updateScreenSize);

        // Cleanup
        return () => window.removeEventListener('resize', updateScreenSize);
    }, []);

    const SCREEN_WIDTH = screenSize.width;
    const SCREEN_HEIGHT = screenSize.height;

    // Draw Overlay (Face + Hand)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Configuration
        const w = canvas.width;
        const h = canvas.height;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // 1. Draw Hand / Gesture Feedback
        if (handData) {
            // Draw Reticle if Gun Pose
            if (handData.isGunPose) {
                const tip = handData.indexTipPos;
                const tx = tip.x * w;
                const ty = tip.y * h;

                ctx.save();
                ctx.strokeStyle = '#ff3333';
                ctx.lineWidth = 3;
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'red';

                // Draw Crosshair
                ctx.beginPath();
                ctx.arc(tx, ty, 20, 0, Math.PI * 2);
                ctx.moveTo(tx - 30, ty);
                ctx.lineTo(tx + 30, ty);
                ctx.moveTo(tx, ty - 30);
                ctx.lineTo(tx, ty + 30);
                ctx.stroke();

                if (handData.isFiring) {
                    ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
                    ctx.fill();
                }
                ctx.restore();
            }

            // Optional: Draw processed skeleton or just Index Tip
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(handData.indexTipPos.x * w, handData.indexTipPos.y * h, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        // 2. Draw Face Feedback (Simplified Box)
        if (facePosition.detected) {
            // We don't have raw face landmarks here anymore to keep performance high, 
            // but we can visualize detection status.
            ctx.fillStyle = '#00ff88';
            ctx.font = '16px monospace';
            ctx.fillText("FACE TRACKED", 10, h - 10);
        }

    }, [facePosition.detected, handData]); // Dependency on handData state updates

    // Calculated positions
    const floorY = -SCREEN_HEIGHT / 2;
    const ceilingY = SCREEN_HEIGHT / 2;
    const leftX = -SCREEN_WIDTH / 2;
    const rightX = SCREEN_WIDTH / 2;
    const backZ = -ROOM_DEPTH;

    return (
        <div className="w-full h-full relative bg-black">
            {/* 3D Scene */}
            <Canvas className="absolute top-0 left-0 z-10" shadows>
                <color attach="background" args={['#101010']}/>

                {/* Lighting & Environment */}
                <ambientLight intensity={0.2}/>
                <pointLight position={[10, 10, 10]} intensity={1.5} castShadow/>
                <Environment preset="city"/>

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
                    sectionColor="#4b9d9d" // Green-ish
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
                    <meshBasicMaterial transparent opacity={0}/>
                    <Edges color="#333"/>
                </Box>

                {/* NEW: Targets */}
                <TargetSystem ref={targetsRef}/>

                {/* NEW: Bullet System */}
                <BulletSystem
                    handData={handData}
                    facePosition={facePosition}
                    screenSize={screenSize}
                    targetsRef={targetsRef} // Pass Ref for collision
                />

                {/* Camera Controller */}
                <ParallaxCamera
                    facePosition={facePosition}
                    facePositionRef={facePositionRef}
                    screenSize={screenSize}
                />
            </Canvas>

            {/* UI Overlay / Debug */}
            <div
                className="absolute top-4 left-4 z-20 bg-black/50 p-4 rounded text-white font-mono text-sm pointer-events-none">
                <p>Tracking: {facePosition.detected ? <span className="text-green-400">FACE ACTIVE</span> :
                    <span className="text-red-400">FACE LOST</span>}</p>
                <p>Hand: {handData ? (handData.isGunPose ?
                    <span className="text-red-500 font-bold">GUN DETECTED</span> : "Hand Visible") : "No Hand"}</p>
                {handData?.isFiring && <p className="text-yellow-400 font-bold animate-pulse">FIRING!</p>}
            </div>

            {/* Hidden Webcam for processing */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute top-4 right-4 w-32 h-24 object-cover opacity-50 z-20 rounded border border-white/20 pointer-events-auto"
                style={{transform: 'scaleX(-1)'}}
            />
            {/* Overlay Canvas */}
            <canvas
                ref={canvasRef}
                width={640} // Default webcam resolution for coordinate mapping
                height={480}
                className="absolute top-4 right-4 w-32 h-24 z-30 pointer-events-none rounded border border-white/20"
                style={{transform: 'scaleX(-1)'}}
            />
        </div>
    );
}
