import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'framer-motion'
import * as THREE from 'three'

// ── Primary node ────────────────────────────────────────────────────────────
function PrimaryNode({ opsPerSec }) {
  const mesh   = useRef()
  const glow   = useRef()
  const light  = useRef()
  const reduce = useReducedMotion()

  useFrame((_, delta) => {
    if (!mesh.current || reduce) return
    mesh.current.rotation.y += delta * 0.4
    mesh.current.rotation.x += delta * 0.15

    // Pulse scale with ops activity
    const pulse = 1 + Math.sin(Date.now() * 0.003) * 0.04
    const boost = Math.min(opsPerSec / 30, 1) * 0.08
    mesh.current.scale.setScalar(pulse + boost)
    if (glow.current)  glow.current.scale.setScalar((pulse + boost) * 1.35)
    if (light.current) light.current.intensity = 1.2 + boost * 4
  })

  return (
    <group>
      <pointLight ref={light} color="#C8FF00" intensity={1.2} distance={8} />

      {/* Inner solid sphere */}
      <mesh ref={mesh}>
        <icosahedronGeometry args={[0.6, 3]} />
        <meshStandardMaterial
          color="#C8FF00"
          emissive="#C8FF00"
          emissiveIntensity={0.6}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      {/* Outer wireframe glow */}
      <mesh ref={glow} scale={1.35}>
        <icosahedronGeometry args={[0.6, 1]} />
        <meshBasicMaterial color="#C8FF00" wireframe transparent opacity={0.12} />
      </mesh>
    </group>
  )
}

// ── Replica node ────────────────────────────────────────────────────────────
function ReplicaNode({ angle, radius, id, replaying }) {
  const mesh   = useRef()
  const reduce = useReducedMotion()

  const targetPos = useMemo(() => new THREE.Vector3(
    Math.cos(angle) * radius,
    Math.sin(angle * 0.3) * 0.6,
    Math.sin(angle) * radius,
  ), [angle, radius])

  const currentPos = useRef(targetPos.clone().multiplyScalar(3))

  useFrame((_, delta) => {
    if (!mesh.current || reduce) return
    currentPos.current.lerp(targetPos, delta * 2.5)
    mesh.current.position.copy(currentPos.current)
    mesh.current.rotation.y += delta * 0.6
  })

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[0.32, 2]} />
      <meshStandardMaterial
        color="#00D4FF"
        emissive="#00D4FF"
        emissiveIntensity={0.45}
        metalness={0.2}
        roughness={0.5}
      />
    </mesh>
  )
}

// ── Replication stream particles ─────────────────────────────────────────────
function ReplicationStream({ replicaAngle, radius }) {
  const COUNT  = 18
  const points = useRef()
  const reduce = useReducedMotion()

  const target = useMemo(() => new THREE.Vector3(
    Math.cos(replicaAngle) * radius,
    Math.sin(replicaAngle * 0.3) * 0.6,
    Math.sin(replicaAngle) * radius,
  ), [replicaAngle, radius])

  const offsets = useMemo(() =>
    Array.from({ length: COUNT }, (_, i) => i / COUNT), [])

  const positions = useMemo(() => new Float32Array(COUNT * 3), [])

  useFrame(() => {
    if (!points.current || reduce) return
    const t = (Date.now() * 0.0008) % 1
    for (let i = 0; i < COUNT; i++) {
      const p = (t + offsets[i]) % 1
      positions[i * 3]     = target.x * p
      positions[i * 3 + 1] = target.y * p
      positions[i * 3 + 2] = target.z * p
    }
    points.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.055} color="#C8FF00" transparent opacity={0.7} sizeAttenuation />
    </points>
  )
}

// ── Background particles ────────────────────────────────────────────────────
function Starfield() {
  const ref      = useRef()
  const reduce   = useReducedMotion()
  const COUNT    = 300
  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      arr[i*3]   = (Math.random() - 0.5) * 20
      arr[i*3+1] = (Math.random() - 0.5) * 20
      arr[i*3+2] = (Math.random() - 0.5) * 20
    }
    return arr
  }, [])

  useFrame((_, d) => { if (ref.current && !reduce) ref.current.rotation.y += d * 0.01 })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.018} color="#F0EFE8" transparent opacity={0.18} sizeAttenuation />
    </points>
  )
}

// ── Scene root ──────────────────────────────────────────────────────────────
function Scene({ metrics }) {
  const replicas   = metrics?.replicas ?? []
  const opsPerSec  = metrics?.ops_per_sec ?? 0
  const RADIUS     = 2.8

  return (
    <>
      <ambientLight intensity={0.08} />
      <Starfield />
      <PrimaryNode opsPerSec={opsPerSec} />
      {replicas.map((r, i) => {
        const angle = (i / replicas.length) * Math.PI * 2
        return (
          <group key={r.id}>
            <ReplicaNode angle={angle} radius={RADIUS} id={r.id} />
            <ReplicationStream replicaAngle={angle} radius={RADIUS} />
          </group>
        )
      })}
    </>
  )
}

// ── Canvas export ───────────────────────────────────────────────────────────
export default function ClusterScene({ metrics }) {
  return (
    <Canvas
      camera={{ position: [0, 2.5, 7], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
      frameloop="always"
    >
      <Scene metrics={metrics} />
    </Canvas>
  )
}
