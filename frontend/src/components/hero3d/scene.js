// The hero scene: a small computer board, built from primitives, that comes apart as the
// page scrolls.
//
// Bottom to top:
//   chassis        brushed aluminium tray
//   thermal plate  thin steel sheet
//   main board     green PCB with traces, memory packages, a controller and ~150 SMD parts
//   CPU module     substrate -> silicon die -> heat spreader, each lifting further
//   shield         the top cover that hides everything while assembled
//   screws         ten of them, which leave first and tumble outward
//
// Everything is driven by one number, progress (0 assembled, 1 fully apart). The React
// wrapper maps scroll position to that number; this file only knows how to draw it.
// Rendering is on demand: a frame is drawn only while something is still easing towards
// its target, so an idle page costs nothing.

import {
  ACESFilmicToneMapping,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  LatheGeometry,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import { boardTextures, brushedTexture, chipTexture } from './textures.js';

const BOARD_W = 10;
const BOARD_D = 6.5;

// Footprints in board-texture coordinates (u, v, width, height, all 0..1 from top-left).
const SOC = [0.25, 0.3, 0.19, 0.3];
const RAM = [0.6, 0.68, 0.76, 0.84].map((u) => [u, 0.16, 0.055, 0.22]);
const CTRL = [0.6, 0.58, 0.13, 0.2];

// Board-texture coordinates -> local x/z on the board (see BoxGeometry's +y face UVs).
function footprint([u, v, w, h]) {
  return {
    x: (u + w / 2 - 0.5) * BOARD_W,
    z: (v + h / 2 - 0.5) * BOARD_D,
    w: w * BOARD_W,
    d: h * BOARD_D,
  };
}

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Remaps progress so a part moves only during its own slice of the scroll. */
function slice(p, start, end) {
  return easeInOut(MathUtils.clamp((p - start) / (end - start), 0, 1));
}

export function createScene(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  // The page background, read from the design tokens so the scene always matches it.
  const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#0c0c0b';
  const scene = new Scene();
  scene.background = new Color(bg);

  // Studio reflections: what makes the metal read as metal.
  const pmrem = new PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.9;

  const camera = new PerspectiveCamera(30, 1, 0.1, 200);

  // --- light ---------------------------------------------------------------------------
  scene.add(new HemisphereLight('#ffffff', '#1a1a18', 0.45));
  const key = new DirectionalLight('#ffffff', 2.2);
  key.position.set(-8, 18, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  key.shadow.camera.far = 60;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 6;
  scene.add(key);

  // A cool rim light from behind: on a dark ground it is what separates the edges of
  // each layer from the background.
  const rim = new DirectionalLight('#dfe6ff', 1.6);
  rim.position.set(10, 9, -14);
  scene.add(rim);

  const ground = new Mesh(new PlaneGeometry(80, 80), new ShadowMaterial({ opacity: 0.55 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.32;
  ground.receiveShadow = true;
  scene.add(ground);

  // --- materials -----------------------------------------------------------------------
  const brushed = brushedTexture();
  const aluminium = new MeshStandardMaterial({
    color: '#d6d6d8',
    metalness: 1,
    roughness: 0.32,
    roughnessMap: brushed,
  });
  const steel = new MeshStandardMaterial({ color: '#b9babd', metalness: 1, roughness: 0.22 });
  const darkSteel = new MeshStandardMaterial({ color: '#6c6d72', metalness: 1, roughness: 0.35 });
  const fr4Edge = new MeshStandardMaterial({ color: '#2a3d2f', roughness: 0.8 });
  const epoxy = new MeshStandardMaterial({ color: '#17171a', roughness: 0.55, metalness: 0.1 });
  const gold = new MeshStandardMaterial({ color: '#d4b36a', metalness: 1, roughness: 0.25 });

  const keepOut = [SOC, ...RAM, CTRL];
  const boardTop = new MeshStandardMaterial({
    map: boardTextures({ keepOut }),
    roughness: 0.48,
    metalness: 0.12,
  });

  const disposables = [envTexture, brushed, boardTop.map];

  // Every exploding part: a group, where it rests, and where it ends up.
  const parts = [];
  function part(object, { y = 0, lift, start = 0.15, end = 0.85, spin = 0, drift = [0, 0], tilt = 0 }) {
    const group = object.isGroup ? object : new Group().add(object);
    group.position.y = y;
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(group);
    parts.push({ group, y, lift, start, end, spin, drift, tilt });
    return group;
  }

  // --- chassis -------------------------------------------------------------------------
  const chassis = new Group();
  const tray = new Mesh(new RoundedBoxGeometry(BOARD_W + 1.1, 0.42, BOARD_D + 1.1, 6, 0.2), aluminium);
  chassis.add(tray);
  // A recessed floor, darker, so the tray reads as a tray.
  const floor = new Mesh(new BoxGeometry(BOARD_W + 0.5, 0.02, BOARD_D + 0.5), darkSteel);
  floor.position.y = 0.205;
  chassis.add(floor);
  part(chassis, { y: 0, lift: -0.9, start: 0.3, end: 0.95 });

  // --- thermal plate -------------------------------------------------------------------
  part(new Mesh(new BoxGeometry(BOARD_W - 0.6, 0.05, BOARD_D - 0.8), steel), {
    y: 0.3,
    lift: 0.9,
    start: 0.3,
    end: 0.95,
  });

  // --- main board ----------------------------------------------------------------------
  const board = new Group();
  const pcb = new Mesh(new BoxGeometry(BOARD_W, 0.1, BOARD_D), [
    fr4Edge,
    fr4Edge,
    boardTop,
    fr4Edge,
    fr4Edge,
    fr4Edge,
  ]);
  board.add(pcb);

  const ramTexture = chipTexture({ title: 'D5', subtitle: '16Gb DRAM', seed: 5 });
  const ctrlTexture = chipTexture({ title: 'IO-7', subtitle: 'controller', seed: 9 });
  disposables.push(ramTexture, ctrlTexture);

  function pack(fp, height, texture) {
    const top = new MeshStandardMaterial({ map: texture, roughness: 0.5, metalness: 0.1 });
    const mesh = new Mesh(new BoxGeometry(fp.w, height, fp.d), [epoxy, epoxy, top, epoxy, epoxy, epoxy]);
    mesh.position.set(fp.x, 0.05 + height / 2, fp.z);
    return mesh;
  }
  for (const ram of RAM) board.add(pack(footprint(ram), 0.12, ramTexture));
  board.add(pack(footprint(CTRL), 0.1, ctrlTexture));

  // SMD parts: capacitors, resistors, inductors - one instanced mesh per material.
  const random = seeded(42);
  const smd = [
    { material: new MeshStandardMaterial({ color: '#b89b74', roughness: 0.6 }), count: 70, size: [0.12, 0.06, 0.07] },
    { material: epoxy, count: 60, size: [0.1, 0.04, 0.06] },
    { material: new MeshStandardMaterial({ color: '#4a4b50', metalness: 0.8, roughness: 0.4 }), count: 18, size: [0.32, 0.18, 0.32] },
  ];
  const inside = (x, z) =>
    keepOut.some((k) => {
      const f = footprint(k);
      return Math.abs(x - f.x) < f.w / 2 + 0.35 && Math.abs(z - f.z) < f.d / 2 + 0.35;
    });
  const dummy = new Object3D();
  for (const kind of smd) {
    const mesh = new InstancedMesh(new BoxGeometry(...kind.size), kind.material, kind.count);
    for (let i = 0; i < kind.count; i += 1) {
      let x;
      let z;
      do {
        x = (random() - 0.5) * (BOARD_W - 0.8);
        z = (random() - 0.5) * (BOARD_D - 0.8);
      } while (inside(x, z));
      dummy.position.set(x, 0.05 + kind.size[1] / 2, z);
      dummy.rotation.set(0, random() < 0.5 ? 0 : Math.PI / 2, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.castShadow = true;
    board.add(mesh);
  }
  part(board, { y: 0.42, lift: 2.0, start: 0.25, end: 0.9 });

  // --- CPU module: three layers that separate further than the rest --------------------
  // They also step towards the camera as they rise, the staircase of a classic exploded
  // view, so each layer stays visible instead of hiding the one below.
  const soc = footprint(SOC);

  const substrate = new Group();
  const subTop = new MeshStandardMaterial({ color: '#27583c', roughness: 0.5 });
  substrate.add(new Mesh(new BoxGeometry(soc.w * 0.95, 0.08, soc.d * 0.95), [fr4Edge, fr4Edge, subTop, fr4Edge, fr4Edge, fr4Edge]));
  // Gold contact grid on the substrate's underside edge, visible as it lifts.
  const pins = new InstancedMesh(new CylinderGeometry(0.025, 0.025, 0.02, 8), gold, 144);
  let n = 0;
  for (let i = 0; i < 12; i += 1) {
    for (let j = 0; j < 12; j += 1) {
      dummy.position.set((i / 11 - 0.5) * soc.w * 0.8, -0.05, (j / 11 - 0.5) * soc.d * 0.8);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      pins.setMatrixAt(n, dummy.matrix);
      n += 1;
    }
  }
  substrate.add(pins);
  substrate.position.set(soc.x, 0, soc.z);
  part(substrate, { y: 0.56, lift: 3.4, start: 0.18, end: 0.88, drift: [-0.6, 1.0] });

  // Silicon: dark, slightly blue, with thin-film iridescence - the one jewel in the scene.
  const silicon = new MeshPhysicalMaterial({
    color: '#1c2233',
    metalness: 0.6,
    roughness: 0.18,
    iridescence: 1,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [220, 520],
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const die = new Mesh(new BoxGeometry(soc.w * 0.42, 0.05, soc.d * 0.42), silicon);
  die.position.set(soc.x, 0, soc.z);
  part(die, { y: 0.64, lift: 5.0, start: 0.16, end: 0.86, drift: [-1.3, 2.1] });

  const lid = new Mesh(new RoundedBoxGeometry(soc.w * 0.9, 0.12, soc.d * 0.9, 4, 0.05), steel);
  lid.position.set(soc.x, 0, soc.z);
  part(lid, { y: 0.74, lift: 6.6, start: 0.14, end: 0.84, drift: [-2.0, 3.2] });

  // --- shield: the top cover ------------------------------------------------------------
  const shield = new Group();
  const cover = new Mesh(new RoundedBoxGeometry(BOARD_W + 0.9, 0.08, BOARD_D + 0.9, 4, 0.04), aluminium);
  shield.add(cover);
  // A grille of slots, so the cover is not a blank slab.
  const slot = new InstancedMesh(new RoundedBoxGeometry(1.4, 0.02, 0.08, 2, 0.01), darkSteel, 18);
  for (let i = 0; i < 18; i += 1) {
    dummy.position.set(2.2 + (i % 2) * 1.6, 0.045, -2.2 + Math.floor(i / 2) * 0.5);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    slot.setMatrixAt(i, dummy.matrix);
  }
  shield.add(slot);
  // The cover lifts up and away towards the back, like a lid being taken off, so it
  // never hides the layers underneath.
  part(shield, { y: 0.92, lift: 7.2, start: 0.08, end: 0.8, drift: [-3.2, -6.5], tilt: -0.22 });
  // Once lifted, its shadow is just a grey slab on the floor; leave it out.
  cover.castShadow = false;
  slot.castShadow = false;

  // --- screws --------------------------------------------------------------------------
  const screwProfile = [
    new Vector2(0, -0.55),
    new Vector2(0.055, -0.52),
    new Vector2(0.055, -0.02),
    new Vector2(0.15, 0),
    new Vector2(0.155, 0.04),
    new Vector2(0.12, 0.08),
    new Vector2(0, 0.085),
  ];
  const screwGeometry = new LatheGeometry(screwProfile, 24);
  const screwSpots = [
    [-5.2, -3.4],
    [5.2, -3.4],
    [-5.2, 3.4],
    [5.2, 3.4],
    [0, -3.4],
    [0, 3.4],
    [-5.2, 0],
    [5.2, 0],
    [-2.6, -3.4],
    [2.6, 3.4],
  ];
  const screwRandom = seeded(7);
  for (const [x, z] of screwSpots) {
    const screw = new Mesh(screwGeometry, steel);
    screw.position.set(x, 0, z);
    const out = new Vector3(x, 0, z).normalize();
    part(screw, {
      y: 1.0,
      lift: 5.6 + screwRandom() * 2.4,
      start: 0.02 + screwRandom() * 0.06,
      end: 0.55 + screwRandom() * 0.15,
      spin: (screwRandom() - 0.5) * 7,
      drift: [out.x * (2.4 + screwRandom() * 2.2), out.z * (2.4 + screwRandom() * 2.2)],
    });
  }

  // --- animation state -----------------------------------------------------------------
  let target = 0;
  let current = 0;
  const pointer = new Vector2();
  const pointerEased = new Vector2();
  let frame = 0;
  let width = 1;
  let height = 1;
  const lookAt = new Vector3();
  const tilt = new Quaternion();
  const axis = new Vector3(1, 0, 0.4).normalize();

  function apply(p) {
    for (const item of parts) {
      const t = slice(p, item.start, item.end);
      item.group.position.set(item.drift[0] * t, item.y + item.lift * t, item.drift[1] * t);
      if (item.tilt) item.group.rotation.x = item.tilt * t;
      if (item.spin) {
        // Screws tumble as they go.
        tilt.setFromAxisAngle(axis, item.spin * t);
        item.group.children[0].quaternion.copy(tilt);
      }
    }

    // The camera sits low enough to see between the layers, rises with the stack and
    // swings a little round it. The pointer adds a few degrees of parallax.
    const distance = width < height ? 34 : 27;
    const azimuth = MathUtils.degToRad(32 + 18 * p) + pointerEased.x * 0.05;
    const elevation = MathUtils.degToRad(30 - 6 * p) + pointerEased.y * 0.02;
    lookAt.set(0, 1.4 + 3.6 * p, 0);
    camera.position.set(
      lookAt.x + Math.sin(azimuth) * Math.cos(elevation) * distance,
      lookAt.y + Math.sin(elevation) * distance,
      lookAt.z + Math.cos(azimuth) * Math.cos(elevation) * distance,
    );
    camera.lookAt(lookAt);
  }

  function render() {
    frame = 0;
    current += (target - current) * 0.09;
    pointerEased.lerp(pointer, 0.08);
    apply(current);
    renderer.render(scene, camera);
    const settling = Math.abs(target - current) > 0.0005 || pointerEased.distanceTo(pointer) > 0.001;
    if (settling) frame = requestAnimationFrame(render);
  }

  function invalidate() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  function resize(w, h) {
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 40 : 30;
    // Shift the picture off-centre so the caption (lower left) has room: to the right on
    // wide screens, upwards on tall ones. setViewOffset moves the frame, not the camera,
    // so perspective is unchanged.
    if (w >= h) camera.setViewOffset(w, h, -w * 0.13, h * 0.02, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.14, w, h);
    camera.updateProjectionMatrix();
    invalidate();
  }

  return {
    setProgress(p) {
      target = MathUtils.clamp(p, 0, 1);
      invalidate();
    },
    setPointer(x, y) {
      pointer.set(x, y);
      invalidate();
    },
    resize,
    dispose() {
      cancelAnimationFrame(frame);
      scene.traverse((object) => {
        if (object.isMesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((m) => m.dispose());
        }
      });
      disposables.forEach((t) => t.dispose());
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
