'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';

import {
  KITE_DARK_STOPS,
  KITE_LIGHT_STOPS,
} from '@/components/brand/CareerKiteMark';

type Kite3DProps = {
  /** Colour of the C ring and string (matches the theme's text colour). */
  inkColor: string;
  dotColor: string;
};

/* Proportions follow the 2D mark (64-unit viewBox, C radius 19.5 → 1). */
const C_RADIUS = 1;
const C_TUBE = 0.22;
const C_GAP = 1.28;
const C_OPENING_ANGLE = 0.7;
const KITE_REST = new THREE.Vector3(1.12, 0.86, 0.15);
const KITE_TILT_Z = -0.35;
const DOT = new THREE.Vector3(-0.08, -0.05, 0.12);
const LAUNCH_SECONDS = 1.4;
const STRING_POINTS = 24;

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function kiteHalfGeometry(side: 'left' | 'right'): THREE.BufferGeometry {
  const x = side === 'left' ? -0.58 : 0.58;
  const [top, bottom] = side === 'left' ? KITE_LIGHT_STOPS : KITE_DARK_STOPS;
  const mid = new THREE.Color(top).lerp(new THREE.Color(bottom), 0.45);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [0, 0.8, 0, x, 0.19, -0.32, 0, -0.8, 0],
      3,
    ),
  );
  const t = new THREE.Color(top);
  const b = new THREE.Color(bottom);
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(
      [t.r, t.g, t.b, mid.r, mid.g, mid.b, b.r, b.g, b.b],
      3,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function KiteScene({ inkColor, dotColor }: Kite3DProps) {
  const rig = useRef<THREE.Group>(null);
  const kite = useRef<THREE.Group>(null);

  const left = useMemo(() => kiteHalfGeometry('left'), []);
  const right = useMemo(() => kiteHalfGeometry('right'), []);
  // A raw THREE.Line (via <primitive>) sidesteps the JSX <line> name clash;
  // primitives are not auto-disposed, so the effect below cleans it up.
  const stringLine = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(STRING_POINTS * 3), 3),
    );
    const material = new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0.6,
    });
    return new THREE.Line(geometry, material);
  }, []);
  useEffect(() => {
    (stringLine.material as THREE.LineBasicMaterial).color.set(inkColor);
  }, [stringLine, inkColor]);
  useEffect(
    () => () => {
      stringLine.geometry.dispose();
      (stringLine.material as THREE.LineBasicMaterial).dispose();
    },
    [stringLine],
  );
  const curve = useMemo(
    () =>
      new THREE.QuadraticBezierCurve3(
        DOT.clone(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ),
    [],
  );
  const scratch = useMemo(
    () => ({ tail: new THREE.Vector3(), point: new THREE.Vector3() }),
    [],
  );
  const capStart = useMemo<[number, number, number]>(() => {
    const a = C_OPENING_ANGLE + C_GAP / 2;
    return [Math.cos(a) * C_RADIUS, Math.sin(a) * C_RADIUS, 0];
  }, []);
  const capEnd = useMemo<[number, number, number]>(() => {
    const a = C_OPENING_ANGLE - C_GAP / 2;
    return [Math.cos(a) * C_RADIUS, Math.sin(a) * C_RADIUS, 0];
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const k = kite.current;
    const r = rig.current;
    if (!k || !r) return;

    const launch = easeOutCubic(Math.min(t / LAUNCH_SECONDS, 1));
    k.position.set(
      THREE.MathUtils.lerp(DOT.x, KITE_REST.x, launch) +
        Math.sin(t * 0.7) * 0.05,
      THREE.MathUtils.lerp(DOT.y, KITE_REST.y, launch) +
        Math.sin(t * 1.1) * 0.07,
      KITE_REST.z,
    );
    k.scale.setScalar(0.25 + 0.75 * launch);
    k.rotation.set(
      Math.sin(t * 0.6) * 0.14,
      Math.sin(t * 0.45) * 0.38,
      KITE_TILT_Z + Math.sin(t * 0.8) * 0.08,
    );

    const ease = 1 - Math.exp(-delta * 3);
    r.rotation.y += (state.pointer.x * 0.35 - r.rotation.y) * ease;
    r.rotation.x += (-state.pointer.y * 0.2 - r.rotation.x) * ease;

    const tail = scratch.tail
      .set(0, -0.78, 0)
      .applyEuler(k.rotation)
      .multiplyScalar(k.scale.x)
      .add(k.position);
    curve.v2.copy(tail);
    curve.v1.set(
      (DOT.x + tail.x) / 2 + 0.05,
      Math.min(DOT.y, tail.y) - 0.12,
      0.1,
    );
    const positions = stringLine.geometry.attributes
      .position as THREE.BufferAttribute;
    for (let i = 0; i < STRING_POINTS; i++) {
      curve.getPoint(i / (STRING_POINTS - 1), scratch.point);
      positions.setXYZ(i, scratch.point.x, scratch.point.y, scratch.point.z);
    }
    // eslint-disable-next-line react-hooks/immutability -- three.js buffers are updated in place each frame by design
    positions.needsUpdate = true;
  });

  return (
    <group ref={rig}>
      <mesh rotation-z={C_OPENING_ANGLE + C_GAP / 2}>
        <torusGeometry
          args={[C_RADIUS, C_TUBE, 28, 120, Math.PI * 2 - C_GAP]}
        />
        <meshStandardMaterial
          color={inkColor}
          roughness={0.38}
          metalness={0.08}
        />
      </mesh>
      <mesh position={capStart}>
        <sphereGeometry args={[C_TUBE, 24, 16]} />
        <meshStandardMaterial
          color={inkColor}
          roughness={0.38}
          metalness={0.08}
        />
      </mesh>
      <mesh position={capEnd}>
        <sphereGeometry args={[C_TUBE, 24, 16]} />
        <meshStandardMaterial
          color={inkColor}
          roughness={0.38}
          metalness={0.08}
        />
      </mesh>
      <mesh position={DOT}>
        <sphereGeometry args={[0.12, 24, 16]} />
        <meshStandardMaterial
          color={dotColor}
          emissive={dotColor}
          emissiveIntensity={0.35}
          roughness={0.3}
        />
      </mesh>
      <primitive object={stringLine} />
      <group ref={kite}>
        <mesh geometry={left}>
          <meshStandardMaterial
            vertexColors
            side={THREE.DoubleSide}
            roughness={0.42}
          />
        </mesh>
        <mesh geometry={right}>
          <meshStandardMaterial
            vertexColors
            side={THREE.DoubleSide}
            roughness={0.42}
          />
        </mesh>
      </group>
    </group>
  );
}

/* Scene bounds (C ring to kite tip) in scene units, used to fit any panel shape. */
const SCENE_WIDTH = 3.3;
const SCENE_HEIGHT = 3.1;
const SCENE_CENTER: [number, number] = [0.28, 0.2];

function FitToViewport({ children }: { children: ReactNode }) {
  const viewport = useThree((state) => state.viewport);
  const scale = Math.min(
    (viewport.width * 0.78) / SCENE_WIDTH,
    (viewport.height * 0.78) / SCENE_HEIGHT,
  );
  return (
    <group
      scale={scale}
      position={[-SCENE_CENTER[0] * scale, -SCENE_CENTER[1] * scale, 0]}
    >
      {children}
    </group>
  );
}

/** Real-time 3D CareerKite mark. Load lazily; render only when motion is allowed. */
export default function Kite3D(props: Kite3DProps) {
  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 6.2], fov: 34 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      aria-hidden
    >
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#f7ffe6', '#101410', 0.9]} />
      <directionalLight position={[2.5, 3, 4]} intensity={1.8} />
      <directionalLight position={[-3, -1, 2]} intensity={0.35} />
      <FitToViewport>
        <KiteScene {...props} />
      </FitToViewport>
    </Canvas>
  );
}
