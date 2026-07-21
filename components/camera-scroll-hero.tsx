"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createNikonZfCameraModel } from "@/lib/three/create-nikon-zf-model";
import { RotatingHeroKeyword } from "@/components/rotating-hero-keyword";
import { SITE_NAME } from "@/lib/seo";

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

const mix = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

function smoothstep(from: number, to: number, value: number) {
  const progress = clamp((value - from) / (to - from));
  return progress * progress * (3 - 2 * progress);
}

export function CameraScrollHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const imageFrameRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const mount = canvasMountRef.current;
    const copy = copyRef.current;
    const imageFrame = imageFrameRef.current;
    const caption = captionRef.current;
    if (!section || !mount || !copy || !imageFrame || !caption) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd8d5cf);
    scene.fog = new THREE.Fog(0xd8d5cf, 14, 23);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    const startCamera = new THREE.Vector3(4.25, 3.15, 9.2);
    const endCamera = new THREE.Vector3(0.25, 0.0, 4.62);
    const startTarget = new THREE.Vector3(0.55, 0.18, 0.78);
    const endTarget = new THREE.Vector3(0.25, -0.06, 0.58);
    const target = startTarget.clone();
    camera.position.copy(startCamera);
    camera.lookAt(target);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    mount.appendChild(renderer.domElement);

    const model = createNikonZfCameraModel();
    model.rotation.y = -0.42;
    model.position.x = 2.25;
    model.scale.setScalar(0.72);
    scene.add(model);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(11, 128),
      new THREE.MeshStandardMaterial({ color: 0xc7c2b9, roughness: 0.92 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.26;
    floor.receiveShadow = true;
    scene.add(floor);

    const key = new THREE.DirectionalLight(0xfff2df, 4.8);
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

    let progress = 0;
    let targetProgress = 0;
    let animationFrame = 0;
    let sectionTop = 0;
    let scrollDistance = 1;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const measure = () => {
      const rect = section.getBoundingClientRect();
      sectionTop = window.scrollY + rect.top;
      scrollDistance = Math.max(1, section.offsetHeight - window.innerHeight);
      const { width, height } = mount.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const readScroll = () => {
      targetProgress = clamp((window.scrollY - sectionTop) / scrollDistance);
    };

    const renderFrame = () => {
      progress = reducedMotion ? targetProgress : mix(progress, targetProgress, 0.085);
      const turn = smoothstep(0.08, 0.52, progress);
      const approach = smoothstep(0.44, 0.74, progress);
      const imageTransition = smoothstep(0.70, 0.93, progress);
      const copyFade = 1 - smoothstep(0.035, 0.19, progress);
      const canvasFade = 1 - smoothstep(0.78, 0.92, progress);

      model.rotation.y = mix(-0.42, -Math.PI, turn);
      model.position.x = mix(2.25, 0, turn);
      model.position.y = mix(0.08, 0, approach);
      model.scale.setScalar(mix(0.72, 1, smoothstep(0.08, 0.42, progress)));
      camera.position.lerpVectors(startCamera, endCamera, approach);
      target.lerpVectors(startTarget, endTarget, approach);
      camera.lookAt(target);

      copy.style.opacity = String(copyFade);
      copy.style.transform = `translate3d(0, ${mix(0, -32, 1 - copyFade)}px, 0)`;
      mount.style.opacity = String(canvasFade);

      const initialHeight = clamp((58 / 1.68) * (window.innerWidth / window.innerHeight), 40, 60);
      imageFrame.style.opacity = String(smoothstep(0.72, 0.82, progress));
      imageFrame.style.width = `${mix(58, 100, imageTransition)}vw`;
      imageFrame.style.height = `${mix(initialHeight, 100, imageTransition)}vh`;
      imageFrame.style.borderRadius = `${mix(18, 0, imageTransition)}px`;
      imageFrame.style.boxShadow = `0 ${mix(18, 0, imageTransition)}px ${mix(70, 0, imageTransition)}px rgba(0,0,0,${mix(0.28, 0, imageTransition)})`;
      caption.style.opacity = String(smoothstep(0.88, 0.97, progress));

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(renderFrame);
    };

    measure();
    readScroll();
    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("resize", measure);
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(mount);
    renderFrame();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("resize", measure);
      resizeObserver.disconnect();
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

  return (
    <section ref={sectionRef} aria-labelledby="home-heading" className="relative h-[360svh] bg-stone-200">
      <div className="sticky top-0 h-svh overflow-hidden">
        <div ref={canvasMountRef} className="absolute inset-0 will-change-[opacity]" aria-hidden="true" />

        <div
          ref={copyRef}
          className="pointer-events-none absolute inset-0 z-10 mx-auto flex max-w-screen-2xl items-start px-5 pb-12 pt-8 will-change-[opacity,transform] sm:px-8 sm:pt-12 lg:px-12 lg:pt-16"
        >
          <div className="max-w-[43rem]">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">A professional wedding photography workspace</p>
            <h1 id="home-heading" className="font-editorial text-[clamp(3.1rem,7vw,6.6rem)] font-medium leading-[0.88] tracking-[-0.045em] text-stone-950">
              <span className="block">The <RotatingHeroKeyword /> is a story.</span>
              <span className="mt-[0.14em] block">Know the whole plot.</span>
            </h1>
            <p className="mt-7 max-w-md text-sm leading-6 text-stone-700 sm:text-base sm:leading-7">
              From the first import to the private gallery, {SITE_NAME} keeps the work clear and the photographs central.
            </p>
            <div className="pointer-events-auto mt-7 flex flex-wrap gap-x-6 gap-y-3">
              <Link href="/login?mode=signup" className="inline-flex min-h-11 items-center border-b-2 border-orange-700 text-sm font-semibold text-stone-950 transition-colors hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-4">
                Start your workspace
              </Link>
              <Link href="/how-ai-works" className="inline-flex min-h-11 items-center text-sm font-medium text-stone-700 transition-colors hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-4">
                See how AI search works
              </Link>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 font-mono text-[9px] uppercase tracking-[0.24em] text-black/45 sm:bottom-8">
          Scroll to turn the story over
        </div>

        <div
          ref={imageFrameRef}
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-stone-950 opacity-0 will-change-[width,height,opacity]"
        >
          <Image
            src="/First%20look.png"
            alt="A newlywed couple sharing a quiet first-look moment on their wedding day"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/45 via-transparent to-transparent" aria-hidden="true" />
          <figcaption
            ref={captionRef}
            className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-xs uppercase leading-5 tracking-widest text-stone-50 opacity-0 sm:p-8 lg:p-12"
          >
            <span>The frame stays the focus.</span>
            <span className="hidden text-right sm:block">Organize · Find · Finish · Deliver</span>
          </figcaption>
        </div>
      </div>
    </section>
  );
}
