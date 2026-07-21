"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createNikonZfCameraModel } from "@/lib/three/create-nikon-zf-model";

export function NikonCameraViewer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd8d5cf);
    scene.fog = new THREE.Fog(0xd8d5cf, 13, 22);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    camera.position.set(4.25, 3.15, 9.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.minDistance = 6.2;
    controls.maxDistance = 14;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.maxPolarAngle = Math.PI * 0.68;
    controls.target.set(0, 0.18, 0.78);
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.34;
    controls.update();

    const model = createNikonZfCameraModel();
    model.rotation.y = -0.38;
    scene.add(model);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(10, 128),
      new THREE.MeshStandardMaterial({ color: 0xc7c2b9, roughness: 0.92, metalness: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.26;
    floor.receiveShadow = true;
    scene.add(floor);

    const key = new THREE.DirectionalLight(0xfff3e3, 4.8);
    key.position.set(-5.5, 7.5, 6.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 24;
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.0004;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xc9dcff, 2.2);
    fill.position.set(5, 2.5, 4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffd2a6, 3.2);
    rim.position.set(4.5, 4.5, -5.5);
    scene.add(rim);

    scene.add(new THREE.HemisphereLight(0xf4f4f1, 0x514b44, 1.8));

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    let frame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      controlsRef.current = null;
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.InstancedMesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) value.dispose();
          }
          material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  const resetView = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.object.position.set(4.25, 3.15, 9.2);
    controls.target.set(0, 0.18, 0.78);
    controls.update();
  };

  return (
    <main className="relative h-dvh min-h-[640px] overflow-hidden bg-[#171715] text-stone-100">
      <div ref={mountRef} className="absolute inset-0" aria-label="Interactive 3D model of a Nikon Z f camera" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-6 p-5 sm:p-8 lg:p-10">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-black/50">Procedural object study / 01</p>
          <h1 className="mt-2 font-serif text-3xl font-medium tracking-[-0.035em] text-[#11110f] sm:text-5xl">Nikon Z f</h1>
          <p className="mt-2 max-w-sm text-xs leading-5 text-black/55 sm:text-sm">
            Reconstructed in Three.js from a single reference image. Every surface is generated in code.
          </p>
        </div>

        <figure className="hidden w-28 overflow-hidden rounded-sm border border-black/15 bg-white/60 p-1.5 shadow-2xl backdrop-blur sm:block lg:w-36">
          <Image src="/camera.jpg" alt="Original camera reference" width={500} height={500} className="h-auto w-full" priority />
          <figcaption className="px-1 pb-0.5 pt-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-black/45">Reference / 500 px</figcaption>
        </figure>
      </div>

      <div className="absolute bottom-0 left-0 z-10 p-5 sm:p-8 lg:p-10">
        <div className="flex items-end gap-3">
          <button
            type="button"
            onClick={() => setAutoRotate((value) => !value)}
            className="flex h-11 items-center gap-2 rounded-full border border-black/15 bg-[#eeeae2]/80 px-4 text-xs font-semibold text-black/70 shadow-lg backdrop-blur-md transition hover:bg-[#f7f4ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50"
            aria-label={autoRotate ? "Pause model rotation" : "Resume model rotation"}
          >
            {autoRotate ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {autoRotate ? "Pause" : "Rotate"}
          </button>
          <button
            type="button"
            onClick={resetView}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-black/15 bg-[#eeeae2]/80 text-black/70 shadow-lg backdrop-blur-md transition hover:bg-[#f7f4ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50"
            aria-label="Reset camera view"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-black/45">Drag to orbit · Scroll to zoom</p>
      </div>

      <div className="pointer-events-none absolute bottom-0 right-0 z-10 hidden p-8 text-right text-black/45 sm:block lg:p-10">
        <dl className="space-y-1 font-mono text-[9px] uppercase tracking-[0.17em]">
          <div className="flex justify-end gap-5"><dt>Geometry</dt><dd className="text-black/70">Procedural</dd></div>
          <div className="flex justify-end gap-5"><dt>Material</dt><dd className="text-black/70">PBR</dd></div>
          <div className="flex justify-end gap-5"><dt>View</dt><dd className="text-black/70">Interactive 360°</dd></div>
        </dl>
      </div>
    </main>
  );
}
