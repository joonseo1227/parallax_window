import {forwardRef, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';

// Interface for what we expose to the parent/BulletSystem via Ref
export interface TargetSystemRef {
    targets: React.RefObject<Target[]>;
    hit: (id: number) => void;
}

export interface Target {
    id: number;
    position: THREE.Vector3;
    scale: number;
    active: boolean;
    color: string;
    hitTime?: number; // Time when it was hit, for animation
}

interface TargetSystemProps {
    // No props needed initially, maybe count later
}

const COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#1A535C', '#F7FFF7'];

export const TargetSystem = forwardRef<TargetSystemRef, TargetSystemProps>((props, ref) => {
    // Helper to get a random position that doesn't overlap too much with existing ones
    // We'll use a simple retry mechanism
    const getRandomPosition = (existingTargets: Target[] = []): THREE.Vector3 => {
        const MIN_DIST = 6; // Minimum distance between centers (Scale is 3, radius ~1.5 -> 3.0 min dist for touch, so 6 is good spacing)

        for (let attempt = 0; attempt < 10; attempt++) {
            const pos = new THREE.Vector3(
                (Math.random() - 0.5) * 35, // X: Wider range
                (Math.random() - 0.5) * 18, // Y: Wider range
                -5 - Math.random() * 35     // Z: -5 to -40
            );

            let valid = true;
            for (const t of existingTargets) {
                if (t.active && pos.distanceTo(t.position) < MIN_DIST) {
                    valid = false;
                    break;
                }
            }
            if (valid) return pos;
        }
        // Fallback
        return new THREE.Vector3(
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 15,
            -10 - Math.random() * 30
        );
    };

    // Initialize random targets
    const initialTargets = useMemo(() => {
        const t: Target[] = [];
        for (let i = 0; i < 15; i++) {
            t.push({
                id: i,
                position: getRandomPosition(t), // Pass standard array
                scale: 3,
                active: true,
                color: COLORS[Math.floor(Math.random() * COLORS.length)]
            });
        }
        return t;
    }, []);

    const [targets, setTargets] = useState<Target[]>(initialTargets);
    // Ref to current state of targets for performant access in loop
    const targetsRef = useRef<Target[]>(initialTargets);

    // Update ref when state changes
    useMemo(() => {
        targetsRef.current = targets;
    }, [targets]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        targets: targetsRef, // Direct access to the array ref
        hit: (id: number) => {
            setTargets(prev => prev.map(t => {
                if (t.id === id && t.active) {
                    return {...t, active: false, hitTime: Date.now()}; // Mark as hit
                }
                return t;
            }));

            // Allow respawn after delay?
            setTimeout(() => {
                setTargets(prev => {
                    // If it's still the same one in the list (checking ID)
                    const idx = prev.findIndex(p => p.id === id);
                    if (idx === -1) return prev;

                    // Respawn logic
                    const newTargets = [...prev];
                    // Calculate new position avoiding others
                    const newPos = getRandomPosition(prev.filter(t => t.active && t.id !== id));

                    newTargets[idx] = {
                        ...newTargets[idx],
                        active: true,
                        hitTime: undefined,
                        position: newPos,
                        scale: 0 // Start small for spawn animation
                    };
                    return newTargets;
                });
            }, 2000);
        }
    }));

    // Animation Loop
    useFrame((state, delta) => {
        // Optional: Make them float/bob
        const time = state.clock.elapsedTime;

        // We can optimize this by not setting state every frame if visual updates handled by refs,
        // but for < 20 objects, React state is fine for simplicity.
        // However, if we want smooth "bobbing", modulating the Mesh ref is better.
        // For now, let's just do respawn scaling logic here.

        setTargets(prev => prev.map(t => {
            if (!t.active) return t;

            // Spawn in animation
            if (t.scale < 3) {
                return {...t, scale: Math.min(3, t.scale + delta * 5)}; // Animate to 3, faster speed
            }
            return t;
        }));
    });

    return (
        <group>
            {targets.map(t => (
                t.active && (
                    <mesh key={t.id} position={t.position} scale={[t.scale, t.scale, t.scale]}>
                        <icosahedronGeometry args={[1, 0]}/>
                        {/* Low poly sphere */}
                        <meshStandardMaterial color={t.color} roughness={0.3} metalness={0.8}/>
                    </mesh>
                )
            ))}

            {/* Explosion Effects (could be hit particles) */}
            {/* For now, just disappearing is enough, maybe add a poof later */}
        </group>
    );
});

TargetSystem.displayName = 'TargetSystem';
