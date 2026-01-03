import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { HandData } from '../hooks/useMultimodalTracking';

interface BulletSystemProps {
    handData: HandData | null;
    screenSize: { width: number; height: number };
}

interface Bullet {
    id: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    active: boolean;
    life: number;
}

export const BulletSystem = ({ handData, screenSize }: BulletSystemProps) => {
    const [bullets, setBullets] = useState<Bullet[]>([]);
    const lastFireTime = useRef(0);

    // Mapping constants (should match Scene.tsx)
    const HALF_W = screenSize.width / 2;
    const HALF_H = screenSize.height / 2;

    useFrame((state, delta) => {
        const now = state.clock.elapsedTime;

        // 1. Spawning Logic
        if (handData && handData.isGunPose && handData.isFiring) {
            // Debounce slightly in case frame-perfect triggers overlap, 
            // though hook handles cooldown.
            // We use the timestamp from hook or just verify we haven't fired for this specific visual event yet?
            // The hook sends `isFiring` as true for a frame.

            // Check if we already processed this "burst"
            if (now - lastFireTime.current > 0.1) {
                spawnBullet(handData);
                lastFireTime.current = now;
            }
        }

        // 2. Update Bullets
        setBullets(prev => prev.map(b => {
            if (!b.active) return b;

            const newPos = b.position.clone().add(b.velocity.clone().multiplyScalar(delta * 200)); // Speed
            const newLife = b.life - delta;

            return {
                ...b,
                position: newPos,
                life: newLife,
                active: newLife > 0 && newPos.z > -200 // Kill if too far
            };
        }).filter(b => b.active));
    });

    const spawnBullet = (data: HandData) => {
        // Map Hand Coordinates (Normalized 0..1) to World
        // Normalized: x[0..1], y[0..1]
        // World: x[-20..20], y[-11.25..11.25] (at Z=0 roughly)
        // Note: data.indexTipPos.x is normalized.

        // Mediapipe: x:0(left)..1(right), y:0(top)..1(bottom)
        const wx = (data.indexTipPos.x - 0.5) * screenSize.width;
        const wy = -(data.indexTipPos.y - 0.5) * screenSize.height;

        // Z? Hand z is relative. Let's assume Screen Plane + offset
        const wz = 0;

        const startPos = new THREE.Vector3(-wx, wy, wz); // Mirror X for webcam

        // Velocity: Shoot 'forward' into the screen (-Z)
        // We could angle it based on wrist-index vector for more realism?
        // For now, straight forward.
        const velocity = new THREE.Vector3(0, 0, -1);

        const newBullet: Bullet = {
            id: Math.random(),
            position: startPos,
            velocity: velocity,
            active: true,
            life: 3.0
        };

        setBullets(prev => [...prev, newBullet]);
    };

    return (
        <Instances range={100}>
            <capsuleGeometry args={[0.2, 1, 8]} />
            <meshStandardMaterial emissive="#ffdd00" emissiveIntensity={2} color="white" />

            {bullets.map(b => (
                <Instance
                    key={b.id}
                    position={b.position}
                    rotation={[Math.PI / 2, 0, 0]} // Align capsule with Z axis
                />
            ))}
        </Instances>
    );
};
