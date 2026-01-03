import * as THREE from 'three';
import {FacePosition} from '../hooks/useFaceTracking';

// Tuning parameters matching ParallaxCamera defaults
export const PARALLAX_CONSTANTS = {
    SCALE_X: 30,
    SCALE_Y: 20,
    BASE_Z: 60,
    Z_RANGE: 40,
    MIN_Z: 10,
};

/**
 * Calculates the virtual camera position based on normalized face coordinates.
 * This logic ensures both the Camera component and BulletSystem use the same "eye" position.
 */
export const calculateCameraPosition = (
    facePosition: FacePosition,
    smoothingTarget?: THREE.Vector3
): THREE.Vector3 => {
    if (!facePosition.detected) {
        // Return center/default position if face is not detected
        return new THREE.Vector3(0, 0, PARALLAX_CONSTANTS.BASE_Z);
    }

    // Invert X: moving head left (neg X) means camera moves left to see "around" corners
    const px = -facePosition.x * PARALLAX_CONSTANTS.SCALE_X;

    // Invert Y: moving head up (neg Y) means camera moves up
    // Wait, facePosition.y is already flipped in useFaceTracking? 
    // In useFaceTracking: y = -(nose.y - 0.5) * 2; -> Up is +1, Down is -1.
    // In ParallaxCamera: py = latestPos.y * SCALE_Y.
    const py = facePosition.y * PARALLAX_CONSTANTS.SCALE_Y;

    // Z logic
    // facePosition.z is undefined range but relative.
    const pz = PARALLAX_CONSTANTS.BASE_Z + (facePosition.z * PARALLAX_CONSTANTS.Z_RANGE);

    return new THREE.Vector3(px, py, Math.max(PARALLAX_CONSTANTS.MIN_Z, pz));
};
