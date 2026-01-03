import {useFrame, useThree} from '@react-three/fiber';
import {useRef} from 'react';
import * as THREE from 'three';
import {FacePosition} from '../hooks/useFaceTracking';
import {calculateCameraPosition} from '../utils/parallaxUtils';

interface ParallaxCameraProps {
    facePosition: FacePosition;
    facePositionRef?: React.MutableRefObject<FacePosition>; // Optional ref for high-freq updates
    screenSize?: { width: number; height: number };
}

export const ParallaxCamera = ({
                                   facePosition,
                                   facePositionRef,
                                   screenSize = {width: 40, height: 22.5}
                               }: ParallaxCameraProps) => {
    const {camera} = useThree();
    const currentPos = useRef(new THREE.Vector3(0, 0, 60)); // Initial camera position

    // Tuning parameters
    const SMOOTHING_FACTOR = 0.3; // Increased responsiveness (was 0.1)

    // Physical-ish mapping - Moved to parallaxUtils

    useFrame(() => {
        // 1. Smoothing & Target Calculation
        // Use ref if available for latest data, otherwise prop
        const latestPos = facePositionRef?.current || facePosition;

        const targetVec = calculateCameraPosition(latestPos);

        // Apply Smoothing
        currentPos.current.lerp(targetVec, SMOOTHING_FACTOR);

        // 2. Camera Positioning
        // Important: Camera must NEVER rotate. STRICT look down -Z.
        camera.position.copy(currentPos.current);
        camera.rotation.set(0, 0, 0);
        camera.updateMatrixWorld();

        // 3. Off-Axis Projection Matrix Calculation
        // Screen Plane: Z=0. Width=W, Height=H.
        // Dimensions relative to center (0,0,0).
        const halfW = screenSize.width / 2;
        const halfH = screenSize.height / 2;

        // Distances from camera (px, py, pz) to screen edges
        // Camera is at (px, py, pz). Looking at -Z.
        // Screen is at Z=0.
        // Near plane distance 'n'.
        // Relationship: (screen_edge - camera_pos) / (screen_z - camera_z) = (near_edge - 0) / n
        // But standard Perspective Matrix is defined at 'near' plane.
        // We map screen corners (at Z=0) to near plane (at Z = pz - near)? 
        // No, standard formula:
        // left = ( (-halfW) - px ) * (near / pz)

        const near = 0.1;
        const far = 1000.0;
        const pz = camera.position.z;

        // Avoid division by zero
        const safePz = Math.max(0.1, pz);

        const left = (-halfW - currentPos.current.x) * (near / safePz);
        const right = (halfW - currentPos.current.x) * (near / safePz);
        const top = (halfH - currentPos.current.y) * (near / safePz);
        const bottom = (-halfH - currentPos.current.y) * (near / safePz);

        camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
    });

    return null;
};

