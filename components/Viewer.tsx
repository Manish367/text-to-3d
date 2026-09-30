"use client";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Bounds, Center } from "@react-three/drei";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

export default function Viewer({ url, autoRotate }: { url: string; autoRotate: boolean }) {
  return (
    <Canvas camera={{ position: [2.5, 1.6, 3.5], fov: 40 }} dpr={[1, 2]}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 3]} intensity={1.4} />
      <Suspense fallback={null}>
        <Environment preset="city" />
        <Bounds fit clip observe margin={1.35}>
          <Center>
            <Model url={url} />
          </Center>
        </Bounds>
      </Suspense>
      <OrbitControls makeDefault enableDamping autoRotate={autoRotate} autoRotateSpeed={2.2} />
    </Canvas>
  );
}
