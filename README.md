# 🎯 Parallax Window

An immersive **webcam-based 3D shooting game** that transforms your screen into a parallax window. Track targets with your face movement and shoot them using hand gestures — no controller needed!

## 🎬 Demo

**🌐 Live Demo:** https://parallax-window.vercel.app/

https://github.com/user-attachments/assets/244ec3c9-e0f7-445f-ba9b-d492f964337c

> **Note:** Requires webcam access


## ✨ Features

### 🪟 **Off-Axis Parallax Camera**
Experience 3D space through a "window" effect — move your head left/right and the perspective adjusts in real-time, creating an illusion of depth as if you're looking into an actual room.

### 👆 **Hand Gesture Shooting**
- Make a "gun pose" with your hand (point with index finger, thumb up)
- Aim with your fingertip
- Natural shooting interaction detected via webcam

### 💥 **Dynamic Visual Effects**
- Glowing bullet trails with capsule geometry
- Explosive particle fragments on impact (12 particles per hit)
- Respawning targets with scale-in animations
- Cyberpunk-style grid environment with color-coded walls

### 🎨 **Immersive Environment**
- 15 metallic low-poly targets floating in 3D space
- 6-sided grid room (floor, ceiling, 4 walls)
- Real-time lighting and shadows
- Smooth camera transitions

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (React 19)
- **3D Rendering:** [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) + [Three.js](https://threejs.org/)
- **3D Helpers:** [@react-three/drei](https://github.com/pmndrs/drei)
- **Computer Vision:** [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) (Face & Hand Tracking)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- A modern browser with webcam support (Chrome/Edge recommended)
- Good lighting conditions for optimal tracking

### Installation

```bash
# Clone the repository
git clone https://github.com/joonseo1227/parallax_window.git
cd parallax_window

# Install dependencies
npm install
# or
pnpm install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**⚠️ Important:** Allow webcam access when prompted!

## 🎮 How to Play

1. **Position yourself** in front of the webcam with good lighting
2. **Move your head** left/right to see the parallax effect in action
3. **Make a gun gesture** with your hand:
   - Point with your index finger
   - Thumb up (like 👍 + 👉 combined)
4. A **red crosshair** appears at your fingertip
5. **Pinch** your thumb and index finger together to shoot
6. Hit the colorful floating targets!

## 📐 Technical Highlights

### Off-Axis Projection Matrix
The camera uses a custom perspective projection matrix that adjusts based on face position, creating the "parallax window" illusion. Implemented in `app/components/ParallaxCamera.tsx`:

```typescript
// Screen plane at Z=0, camera dynamically positioned
const left = (-halfW - currentPos.current.x) * (near / safePz);
const right = (halfW - currentPos.current.x) * (near / safePz);
camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
```

### Multimodal Tracking
Face and hand tracking run concurrently via MediaPipe's Vision tasks:
- **Face Landmarker**: 60fps updates via `requestAnimationFrame` for smooth camera movement
- **Hand Landmarker**: Detects 21 keypoints + custom gesture recognition
- Optimized with refs to avoid React re-render bottlenecks

### Collision Detection
Simple sphere-based collision between bullets and targets with immediate visual feedback and particle explosion system.

## 📁 Project Structure

```
app/
├── components/
│   ├── Scene.tsx              # Main 3D scene setup
│   ├── ParallaxCamera.tsx     # Off-axis projection camera
│   ├── BulletSystem.tsx       # Bullet spawning & collision
│   └── TargetSystem.tsx       # Target management & respawn
├── hooks/
│   ├── useFaceTracking.ts     # MediaPipe face detection
│   ├── useHandTracking.ts     # MediaPipe hand + gesture detection
│   └── useMultimodalTracking.ts # Combined face + hand hook
├── utils/
│   └── parallaxUtils.ts       # Camera position calculations
└── page.tsx                   # Entry point
```

## 📄 License

MIT
