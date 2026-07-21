import type { Metadata } from "next";
import { NikonCameraViewer } from "@/components/nikon-camera-viewer";

export const metadata: Metadata = {
  title: "Nikon Z f — Procedural 3D Study",
  description: "An interactive procedural Three.js reconstruction of a Nikon Z f camera.",
};

export default function CameraPage() {
  return <NikonCameraViewer />;
}
