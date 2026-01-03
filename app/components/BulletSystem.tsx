import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { HandData } from '../hooks/useMultimodalTracking';
import { calculateCameraPosition } from '../utils/parallaxUtils';
import { FacePosition } from '../hooks/useFaceTracking';

interface BulletSystemProps {
    handData: HandData | null;
    facePosition: FacePosition;
    screenSize: { width: number; height: number };
}

interface Bullet {
    id: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    active: boolean;
    life: number;
}

export const BulletSystem = ({ handData, facePosition, screenSize }: BulletSystemProps) => {
    const [bullets, setBullets] = useState<Bullet[]>([]);
    const lastFireTime = useRef(0);

    // Mapping constants (should match Scene.tsx)
    const HALF_W = screenSize.width / 2;
    const HALF_H = screenSize.height / 2;

    useFrame((state, delta) => {
        const now = state.clock.elapsedTime;

        // 1. Spawning Logic
        if (handData && handData.isGunPose && handData.isFiring) {
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
                // Kill if too far or generic cleanup
                active: newLife > 0 && newPos.z > -200
            };
        }).filter(b => b.active));
    });

    const spawnBullet = (data: HandData) => {
        // Map Hand Coordinates (Normalized 0..1) to World
        // Note: For this specific request, we ignore hand position for SPARING point,
        // but triggered by hand.
        // Screen Center at Z=0 is (0,0,0) in our World, assuming Scene centering.
        // We want unconditional firing from center.

        const startPos = new THREE.Vector3(0, 0, 0);

        // Calculate Camera Position (Eye Position)
        const cameraPos = calculateCameraPosition(facePosition);

        // Raycast Direction: From Camera (Eye) -> Hand (Screen Plane) -> World
        // Vector = StartPos - CameraPos
        // (Hand is at StartPos)
        const direction = new THREE.Vector3().subVectors(startPos, cameraPos).normalize();

        const newBullet: Bullet = {
            id: Math.random(),
            position: startPos,
            velocity: direction,
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
                    rotation={[Math.PI / 2, 0, 0]} // Align capsule with Z axis (default)
                // TODO: Rotate bullet to match direction? 
                // Capsule default is Y-axis alignment. Rotation [PI/2, 0, 0] makes it Z-axis aligned.
                // If we want it to point in velocity dir, we need lookAt.
                // For now, simple Z alignment is fine as they fly "into" the screen.
                />
            ))}
        </Instances>
    );
};
