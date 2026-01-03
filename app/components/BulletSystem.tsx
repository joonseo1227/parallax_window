import {useRef, useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {Instance, Instances} from '@react-three/drei';
import * as THREE from 'three';
import {HandData} from '../hooks/useMultimodalTracking';
import {calculateCameraPosition} from '../utils/parallaxUtils';
import {FacePosition} from '../hooks/useFaceTracking';
import {TargetSystemRef} from './TargetSystem';

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

export const BulletSystem = ({handData, facePosition, screenSize, targetsRef}: BulletSystemProps) => {
    const [bullets, setBullets] = useState<Bullet[]>([]);
    const [fragments, setFragments] = useState<Fragment[]>([]);
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
        setBullets(prev => {
            const nextBullets: Bullet[] = [];
            const newFragments: Fragment[] = [];

            prev.forEach(b => {
                if (!b.active) return;

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

                                // Create Explosion Fragments
                                const explosionFragments = createExplosion(newPos, b.velocity);
                                newFragments.push(...explosionFragments);

                                break;
                            }
                        }
                    }
                }

                if (active) {
                    nextBullets.push({
                        ...b,
                        position: newPos,
                        life: newLife,
                        active: active
                    });
                }
            });

            // Add new fragments to state if any (using functional update inside setFragments to batch, but we need to do it outside this setBullets call or combine them. 
            // React state updates schedule re-renders. We can't setFragments inside setBullets updater easily.
            // Better approach: separate logic or use a ref for temp storage if high frequency.
            // For simplicity in this loop, we'll just queue them and update headers.
            if (newFragments.length > 0) {
                // Schedule fragment update
                setTimeout(() => {
                    setFragments(prev => [...prev, ...newFragments]);
                }, 0);
            }

            return nextBullets;
        });

        // 3. Update Fragments
        setFragments(prev => prev.map(f => {
            const newPos = f.position.clone().add(f.velocity.clone().multiplyScalar(delta));
            // Add gravity/drag?
            // f.velocity.y -= delta * 10; // Gravity
            const newLife = f.life - delta;

            return {
                ...f,
                position: newPos,
                life: newLife
            };
        }).filter(f => f.life > 0));
    });

    const spawnBullet = (data: HandData) => {
        // We want to shoot FROM the user (Camera) TO the screen center (0,0,0)

        const screenCenter = new THREE.Vector3(0, 0, 0);
        const cameraPos = calculateCameraPosition(facePosition);

        // Direction: Camera -> Screen Center
        const direction = new THREE.Vector3().subVectors(screenCenter, cameraPos).normalize();

        // Spawn position: In front of the camera so it's visible, but travelling inward
        // Camera is usually around Z=60. Screen is Z=0.
        // Let's spawn it 10 units in front of the camera
        const spawnPos = cameraPos.clone().add(direction.clone().multiplyScalar(10));

        const newBullet: Bullet = {
            id: Math.random(),
            position: spawnPos,
            velocity: direction,
            active: true,
            life: 3.0 // Lifecycle should be enough to cross the room
        };

        setBullets(prev => [...prev, newBullet]);
    };

    const createExplosion = (position: THREE.Vector3, incidentVelocity: THREE.Vector3): Fragment[] => {
        const fragmentCount = 12;
        const fragments: Fragment[] = [];

        for (let i = 0; i < fragmentCount; i++) {
            // Random direction
            const spread = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ).normalize();

            // Mix incident velocity (forward momentum) with spread
            // Incident velocity is normalized in Bullet, ensuring we keep some forward momentum
            const velocity = incidentVelocity.clone().multiplyScalar(20 + Math.random() * 20) // Base speed
                .add(spread.multiplyScalar(30 + Math.random() * 20)); // Explosive force

            fragments.push({
                id: Math.random(), // Simple ID
                position: position.clone(),
                velocity: velocity,
                life: 0.5 + Math.random() * 0.5, // 0.5s to 1.0s
                color: Math.random() > 0.5 ? '#ffaa00' : '#ff4400',
                size: 0.2 + Math.random() * 0.3 // Revert to original size
            });
        }
        return fragments;
    };

    return (
        <>
            {/* Bullets */}
            <Instances range={100}>
                <capsuleGeometry args={[0.2, 1, 8]}/>
                <meshStandardMaterial emissive="#ffdd00" emissiveIntensity={2} color="white"/>

                {bullets.map(b => (
                    <Instance
                        key={b.id}
                        position={b.position}
                        rotation={[Math.PI / 2, 0, 0]} // Align capsule with Z axis
                    />
                ))}
            </Instances>

            {/* Explosion Fragments */}
            <Instances range={200}>
                <boxGeometry args={[1, 1, 1]}/>
                <meshStandardMaterial emissive="#ff5500" emissiveIntensity={3} toneMapped={false}/>

                {fragments.map(f => (
                    <Instance
                        key={f.id}
                        position={f.position}
                        scale={[f.size, f.size, f.size]}
                        color={f.color}
                        rotation={[Math.random() * Math.PI, Math.random() * Math.PI, 0]}
                    />
                ))}
            </Instances>
        </>
    );
};

interface Fragment {
    id: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    color: string;
    size: number;
}
