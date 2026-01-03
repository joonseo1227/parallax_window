import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { HandData } from '../hooks/useMultimodalTracking';
import { calculateCameraPosition } from '../utils/parallaxUtils';
import { FacePosition } from '../hooks/useFaceTracking';
import { TargetSystemRef } from './TargetSystem';

interface BulletSystemProps {
    handData: HandData | null;
    facePosition: FacePosition;
    screenSize: { width: number; height: number };
    targetsRef?: React.RefObject<TargetSystemRef | null>;
}

interface Bullet {
    id: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    active: boolean;
    life: number;
}

export const BulletSystem = ({ handData, facePosition, screenSize, targetsRef }: BulletSystemProps) => {
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

            let active = newLife > 0 && newPos.z > -200;

            // 3. Collision Detection
            if (active && targetsRef?.current) {
                const targets = targetsRef.current.targets.current;
                if (targets) {
                    for (const target of targets) {
                        if (!target.active) continue;

                        // Check distance (Simple Sphere Collision)
                        // Scale is approx radius/half-size. 
                        const collisionRadius = target.scale;

                        const dist = newPos.distanceTo(target.position);
                        if (dist < collisionRadius + 0.5) { // +0.5 for bullet size safety
                            targetsRef.current.hit(target.id);
                            active = false; // Destroy bullet on impact
                            break;
                        }
                    }
                }
            }

            return {
                ...b,
                position: newPos,
                life: newLife,
                active: active
            };
        }).filter(b => b.active));
    });

    const spawnBullet = (data: HandData) => {
        const startPos = new THREE.Vector3(0, 0, 0);

        // Calculate Camera Position (Eye Position)
        const cameraPos = calculateCameraPosition(facePosition);

        // Raycast Direction: From Camera (Eye) -> Hand (Screen Plane) -> World
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
                    rotation={[Math.PI / 2, 0, 0]} // Align capsule with Z axis
                />
            ))}
        </Instances>
    );
};
