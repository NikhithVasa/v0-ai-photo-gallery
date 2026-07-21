import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type CameraModelOptions = {
  castShadow?: boolean;
  receiveShadow?: boolean;
  detail?: "full" | "reduced";
};

export type CameraModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

const LENS_Y = -0.18;

function makeLeatherTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is required for procedural materials");

  context.fillStyle = "#777";
  context.fillRect(0, 0, size, size);
  let seed = 0x21f0aaad;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 0xffffffff;
  };

  for (let index = 0; index < 7600; index += 1) {
    const x = random() * size;
    const y = random() * size;
    const radiusX = 1.2 + random() * 2.8;
    const radiusY = 0.8 + random() * 2.1;
    const value = Math.round(72 + random() * 90);
    context.beginPath();
    context.ellipse(x, y, radiusX, radiusY, random() * Math.PI, 0, Math.PI * 2);
    context.fillStyle = `rgb(${value}, ${value}, ${value})`;
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3.5, 2.6);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeLabelTexture(
  text: string,
  width = 512,
  height = 160,
  font = "700 96px Arial",
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is required for procedural labels");
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f1f1ed";
  context.font = font;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, width / 2, height / 2 + 3);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function addLabel(
  parent: THREE.Object3D,
  text: string,
  width: number,
  height: number,
  position: THREE.Vector3,
  font?: string,
): THREE.Mesh {
  const texture = makeLabelTexture(text, 512, 160, font);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  label.position.copy(position);
  label.renderOrder = 4;
  parent.add(label);
  return label;
}

function addRadialRibs(
  parent: THREE.Object3D,
  material: THREE.Material,
  count: number,
  radius: number,
  z: number,
  depth: number,
  height = 0.055,
): THREE.InstancedMesh {
  const ribGeometry = new THREE.BoxGeometry(height, (Math.PI * radius * 1.45) / count, depth);
  const ribs = new THREE.InstancedMesh(ribGeometry, material, count);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const axis = new THREE.Vector3(0, 0, 1);
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    position.set(Math.cos(angle) * radius, LENS_Y + Math.sin(angle) * radius, z);
    quaternion.setFromAxisAngle(axis, angle);
    matrix.compose(position, quaternion, scale);
    ribs.setMatrixAt(index, matrix);
  }
  ribs.instanceMatrix.needsUpdate = true;
  ribs.castShadow = true;
  ribs.receiveShadow = true;
  parent.add(ribs);
  return ribs;
}

function addDialKnurl(
  parent: THREE.Object3D,
  material: THREE.Material,
  count: number,
  radius: number,
  height: number,
): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(0.075, height, (Math.PI * radius * 1.35) / count);
  const teeth = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const axis = new THREE.Vector3(0, 1, 0);
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    quaternion.setFromAxisAngle(axis, -angle);
    matrix.compose(position, quaternion, scale);
    teeth.setMatrixAt(index, matrix);
  }
  teeth.instanceMatrix.needsUpdate = true;
  teeth.castShadow = true;
  parent.add(teeth);
  return teeth;
}

function cylinderAlongZ(
  radiusTop: number,
  radiusBottom: number,
  depth: number,
  segments = 96,
): THREE.CylinderGeometry {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, depth, segments, 1, false);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

export function createNikonZfCameraModel(options: CameraModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Nikon Zf Camera";

  const nodes: Record<string, THREE.Object3D> = { root };
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};
  const castShadow = options.castShadow ?? true;
  const receiveShadow = options.receiveShadow ?? true;

  const leatherBump = makeLeatherTexture();
  const blackMetal = new THREE.MeshPhysicalMaterial({
    color: 0x101113,
    roughness: 0.32,
    metalness: 0.78,
    clearcoat: 0.2,
    clearcoatRoughness: 0.3,
  });
  const darkMetal = new THREE.MeshPhysicalMaterial({
    color: 0x08090a,
    roughness: 0.24,
    metalness: 0.7,
    clearcoat: 0.28,
    clearcoatRoughness: 0.24,
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x080909,
    roughness: 0.68,
    metalness: 0.03,
  });
  const leather = new THREE.MeshStandardMaterial({
    color: 0x10110f,
    roughness: 0.78,
    metalness: 0.02,
    bumpMap: leatherBump,
    bumpScale: 0.055,
  });
  const silver = new THREE.MeshStandardMaterial({ color: 0xaeb0b2, roughness: 0.28, metalness: 0.92 });
  const white = new THREE.MeshStandardMaterial({ color: 0xdadbd8, roughness: 0.42, metalness: 0.16 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x0c211a,
    roughness: 0.07,
    metalness: 0.1,
    transmission: 0.24,
    thickness: 0.36,
    ior: 1.52,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    transparent: true,
    opacity: 0.94,
  });
  const innerGlass = new THREE.MeshPhysicalMaterial({
    color: 0x17140b,
    roughness: 0.16,
    metalness: 0.42,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
  });

  const register = <T extends THREE.Object3D>(id: string, object: T, fractureGroup = id): T => {
    object.name = id;
    nodes[id] = object;
    destructionGroups[fractureGroup] ??= [];
    destructionGroups[fractureGroup].push(object);
    object.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
        child.castShadow = castShadow;
        child.receiveShadow = receiveShadow;
      }
    });
    return object;
  };

  const body = register(
    "camera-body",
    new THREE.Mesh(new RoundedBoxGeometry(3.8, 2.22, 1.0, 8, 0.13), blackMetal),
    "body-shell",
  );
  body.position.y = -0.02;
  root.add(body);
  colliders["camera-body"] = { type: "box", size: [3.8, 2.22, 1.0], offset: [0, -0.02, 0] };

  const lowerBevel = new THREE.Mesh(new RoundedBoxGeometry(3.62, 0.20, 1.02, 5, 0.09), darkMetal);
  lowerBevel.position.set(0, -1.06, 0.01);
  root.add(lowerBevel);

  const topPlate = register(
    "top-plate",
    new THREE.Mesh(new RoundedBoxGeometry(3.62, 0.29, 0.96, 5, 0.075), darkMetal),
    "body-shell",
  );
  topPlate.position.set(0, 1.05, 0.01);
  root.add(topPlate);

  const leatherPanel = register(
    "front-leather-panel",
    new THREE.Mesh(new RoundedBoxGeometry(2.62, 1.35, 0.075, 5, 0.05), leather),
    "body-shell",
  );
  leatherPanel.position.set(-0.43, -0.28, 0.52);
  root.add(leatherPanel);

  const grip = register(
    "right-grip",
    new THREE.Mesh(new RoundedBoxGeometry(0.62, 1.58, 0.32, 6, 0.12), leather),
    "body-shell",
  );
  grip.position.set(1.46, -0.20, 0.58);
  root.add(grip);

  const leftShoulder = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.76, 0.16, 4, 0.05), leather);
  leftShoulder.position.set(-1.53, -0.15, 0.53);
  root.add(leftShoulder);

  const prismShape = new THREE.Shape();
  prismShape.moveTo(-0.82, 0);
  prismShape.lineTo(0.82, 0);
  prismShape.lineTo(0.54, 0.84);
  prismShape.lineTo(0.25, 1.03);
  prismShape.lineTo(-0.28, 1.03);
  prismShape.lineTo(-0.56, 0.84);
  prismShape.closePath();
  const prismGeometry = new THREE.ExtrudeGeometry(prismShape, {
    depth: 0.78,
    bevelEnabled: true,
    bevelSize: 0.055,
    bevelThickness: 0.055,
    bevelSegments: 3,
    curveSegments: 2,
  });
  prismGeometry.center();
  const prism = register("viewfinder-prism", new THREE.Mesh(prismGeometry, darkMetal), "viewfinder");
  prism.position.set(0, 1.20, 0.01);
  root.add(prism);

  const brandPlate = register(
    "brand-plate",
    new THREE.Mesh(new RoundedBoxGeometry(1.30, 0.48, 0.075, 4, 0.035), darkMetal),
    "viewfinder",
  );
  brandPlate.position.set(0, 1.25, 0.445);
  root.add(brandPlate);
  addLabel(root, "Nikon", 1.08, 0.34, new THREE.Vector3(0, 1.26, 0.487), "700 104px Arial");
  addLabel(root, "Zƒ", 0.47, 0.22, new THREE.Vector3(-1.02, 0.60, 0.532), "italic 500 90px Georgia");

  const hotShoe = register("hot-shoe", new THREE.Group(), "viewfinder");
  hotShoe.position.set(0, 1.72, -0.06);
  root.add(hotShoe);
  const shoeBase = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.08, 0.50, 3, 0.025), darkMetal);
  hotShoe.add(shoeBase);
  for (const x of [-0.25, 0.25]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.09, 0.50), silver);
    rail.position.set(x, 0.07, 0);
    hotShoe.add(rail);
  }

  const makeDial = (id: string, x: number, radius: number, height: number, teethCount: number) => {
    const dial = register(id, new THREE.Group(), "controls");
    dial.position.set(x, 1.30, 0.02);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 64), darkMetal);
    dial.add(base);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, 0.018, 64), blackMetal);
    cap.position.y = height / 2 + 0.012;
    dial.add(cap);
    addDialKnurl(dial, darkMetal, teethCount, radius + 0.018, height * 0.86);
    root.add(dial);
    return dial;
  };

  const leftDial = makeDial("top-left-dial", -1.30, 0.39, 0.24, 48);
  const centerDial = makeDial("top-center-dial", -0.55, 0.30, 0.21, 36);
  const shutterDial = makeDial("shutter-dial", 1.14, 0.43, 0.25, 52);
  leftDial.rotation.y = 0.05;
  centerDial.rotation.y = -0.1;
  shutterDial.rotation.y = 0.04;

  const dialMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xe3e3df, toneMapped: false });
  for (const dial of [leftDial, centerDial, shutterDial]) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.17), dialMarkerMaterial);
    marker.position.set(0, 0.14, 0.15);
    dial.add(marker);
  }

  const shutterRelease = register(
    "shutter-release",
    new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.055, 48), silver),
    "controls",
  );
  shutterRelease.position.set(1.14, 1.47, 0.02);
  root.add(shutterRelease);

  const smallButton = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 32), blackMetal);
  smallButton.position.set(1.70, 1.20, 0.18);
  root.add(smallButton);

  const mountRing = register(
    "lens-mount",
    new THREE.Mesh(new THREE.TorusGeometry(1.14, 0.075, 20, 96), silver),
    "lens-assembly",
  );
  mountRing.position.set(0, LENS_Y, 0.58);
  root.add(mountRing);

  const lensAssembly = register("lens-assembly", new THREE.Group(), "lens-assembly");
  lensAssembly.scale.set(0.88, 0.88, 1);
  root.add(lensAssembly);
  const lensSections: Array<[string, number, number, number, number, THREE.Material]> = [
    ["rear-barrel", 1.12, 1.17, 0.30, 0.74, darkMetal],
    ["rear-lens-ring", 1.20, 1.22, 0.36, 0.96, rubber],
    ["focus-ring", 1.38, 1.42, 0.72, 1.42, rubber],
    ["front-taper", 1.50, 1.40, 0.38, 1.95, blackMetal],
    ["front-barrel", 1.52, 1.52, 0.30, 2.27, darkMetal],
  ];
  for (const [id, frontRadius, rearRadius, depth, z] of lensSections) {
    const mesh = register(id, new THREE.Mesh(cylinderAlongZ(frontRadius, rearRadius, depth), id.includes("ring") ? rubber : darkMetal), "lens-assembly");
    mesh.position.set(0, LENS_Y, z);
    lensAssembly.add(mesh);
  }

  if (options.detail !== "reduced") {
    addRadialRibs(lensAssembly, rubber, 112, 1.435, 1.42, 0.68, 0.065);
    addRadialRibs(lensAssembly, rubber, 72, 1.235, 0.96, 0.33, 0.055);
  }

  const thinRing = new THREE.Mesh(new THREE.TorusGeometry(1.31, 0.025, 12, 128), silver);
  thinRing.position.set(0, LENS_Y, 2.00);
  lensAssembly.add(thinRing);
  const outerRim = register(
    "front-retaining-ring",
    new THREE.Mesh(cylinderAlongZ(1.56, 1.56, 0.16), darkMetal),
    "lens-assembly",
  );
  outerRim.position.set(0, LENS_Y, 2.48);
  lensAssembly.add(outerRim);

  const innerRim = new THREE.Mesh(new THREE.TorusGeometry(1.31, 0.10, 24, 128), blackMetal);
  innerRim.position.set(0, LENS_Y, 2.58);
  lensAssembly.add(innerRim);
  const aperture = new THREE.Mesh(new THREE.CircleGeometry(1.13, 96), innerGlass);
  aperture.position.set(0, LENS_Y, 2.595);
  lensAssembly.add(aperture);
  const iris = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.82, 12), new THREE.MeshStandardMaterial({ color: 0x050504, roughness: 0.5, metalness: 0.2 }));
  iris.position.set(0, LENS_Y, 2.61);
  lensAssembly.add(iris);
  const frontGlass = register(
    "front-glass",
    new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), glass),
    "lens-assembly",
  );
  frontGlass.scale.set(1.18, 1.18, 0.17);
  frontGlass.position.set(0, LENS_Y, 2.66);
  lensAssembly.add(frontGlass);

  const frontHighlight = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 0.77, 96),
    new THREE.MeshBasicMaterial({ color: 0x4e8170, transparent: true, opacity: 0.30, toneMapped: false }),
  );
  frontHighlight.position.set(0, LENS_Y, 2.842);
  lensAssembly.add(frontHighlight);

  const lensLabel = addLabel(lensAssembly, "NIKKOR  Z  24–70mm", 1.18, 0.12, new THREE.Vector3(0, 0.84, 2.56), "500 42px Arial");
  lensLabel.rotation.x = -0.08;

  const functionButton = register(
    "function-button",
    new THREE.Mesh(cylinderAlongZ(0.13, 0.13, 0.09, 48), darkMetal),
    "controls",
  );
  functionButton.position.set(1.18, 0.08, 0.58);
  root.add(functionButton);
  const buttonRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 12, 48), silver);
  buttonRing.position.set(1.18, 0.08, 0.625);
  root.add(buttonRing);

  for (const x of [-1.91, 1.91]) {
    const lug = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 12, 40), silver);
    lug.position.set(x, 0.58, 0.04);
    lug.rotation.y = Math.PI / 2;
    root.add(lug);
  }

  const screenTexture = new THREE.TextureLoader().load("/First%20look.png");
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.anisotropy = 8;
  const rearScreen = register(
    "rear-screen",
    new THREE.Mesh(
      new RoundedBoxGeometry(2.22, 1.38, 0.08, 4, 0.06),
      new THREE.MeshPhysicalMaterial({ color: 0x08090a, roughness: 0.14, metalness: 0.28, clearcoat: 0.7 }),
    ),
    "body-shell",
  );
  rearScreen.position.set(-0.25, -0.12, -0.535);
  root.add(rearScreen);
  const rearScreenImage = register(
    "rear-screen-image",
    new THREE.Mesh(
      new THREE.PlaneGeometry(2.06, 1.20),
      new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }),
    ),
    "body-shell",
  );
  rearScreenImage.position.set(-0.25, -0.12, -0.581);
  rearScreenImage.rotation.y = Math.PI;
  root.add(rearScreenImage);

  const lensSocket = new THREE.Object3D();
  lensSocket.name = "lens-socket";
  lensSocket.position.set(0, LENS_Y, 0.58);
  root.add(lensSocket);
  sockets["lens-socket"] = lensSocket;
  const shutterSocket = new THREE.Object3D();
  shutterSocket.name = "shutter-socket";
  shutterSocket.position.copy(shutterRelease.position);
  root.add(shutterSocket);
  sockets["shutter-socket"] = shutterSocket;

  colliders["lens-assembly"] = { type: "cylinder", radius: 1.56, depth: 2.25, axis: "z", offset: [0, LENS_Y, 1.58] };
  colliders["viewfinder-prism"] = { type: "box", size: [1.65, 1.05, 0.78], offset: [0, 1.58, 0] };

  root.userData.sculptRuntime = {
    nodes,
    sockets,
    colliders,
    destructionGroups,
  } satisfies CameraModelRuntime;
  root.userData.reference = {
    source: "/camera.jpg",
    approximation: "Single-view procedural reconstruction; rear and underside inferred.",
  };

  root.rotation.y = -0.06;
  root.position.y = 0.08;
  return root;
}
