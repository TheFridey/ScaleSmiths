"use client"

import { Component, ComponentType, ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { forgePanels } from "@/lib/v2/forge-panels"

const TARGET_RENDER_FPS = 30
const TARGET_FRAME_MS = 1000 / TARGET_RENDER_FPS

interface ClientSceneCanvasProps {
  className?: string
  isForgeStep?: boolean
  activePanelId?: string | null
  onPanelFocus?: (panelId: string | null) => void
}

interface SceneBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface SceneBoundaryState {
  hasError: boolean
}

class SceneBoundary extends Component<SceneBoundaryProps, SceneBoundaryState> {
  state: SceneBoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

function useSceneFallback() {
  const [shouldFallback, setShouldFallback] = useState(true)

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const mobileViewport = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches
    const lowMemory = "deviceMemory" in navigator && Number(navigator.deviceMemory) <= 4
    const lowConcurrency = navigator.hardwareConcurrency <= 4

    setShouldFallback(reducedMotion || mobileViewport || lowMemory || lowConcurrency)
  }, [])

  return shouldFallback
}

function StaticSceneFallback() {
  return (
    <div
      aria-hidden="true"
      data-v2-scene-fallback="true"
      className="h-full w-full bg-[radial-gradient(circle_at_22%_22%,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_78%_28%,rgba(20,241,178,0.10),transparent_24%),radial-gradient(circle_at_50%_82%,rgba(253,230,138,0.08),transparent_30%)]"
    />
  )
}

function createParticlePositions(particleCount: number) {
  const values = new Float32Array(particleCount * 3)

  for (let index = 0; index < particleCount; index += 1) {
    values[index * 3] = (Math.random() - 0.5) * 8
    values[index * 3 + 1] = Math.random() * 3.6 - 0.4
    values[index * 3 + 2] = (Math.random() - 0.5) * 6
  }

  return values
}

function createForgeLabelTexture(label: string) {
  const canvas = document.createElement("canvas")
  const width = 512
  const height = 180
  const context = canvas.getContext("2d")

  canvas.width = width
  canvas.height = height

  if (!context) return new THREE.CanvasTexture(canvas)

  context.clearRect(0, 0, width, height)
  context.fillStyle = "rgba(8, 17, 31, 0.82)"
  context.strokeStyle = "rgba(103, 232, 249, 0.72)"
  context.lineWidth = 5
  context.beginPath()
  context.roundRect(14, 14, width - 28, height - 28, 28)
  context.fill()
  context.stroke()

  context.fillStyle = "rgba(248, 251, 255, 0.94)"
  context.font = "700 48px Arial, sans-serif"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText(label, width / 2, height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function ManualForgeScene({
  className,
  isForgeStep = false,
  activePanelId,
  onPanelFocus,
}: ClientSceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activePanelRef = useRef(activePanelId ?? null)
  const forgeStepRef = useRef(isForgeStep)
  const panelFocusRef = useRef(onPanelFocus)

  useEffect(() => {
    activePanelRef.current = activePanelId ?? null
  }, [activePanelId])

  useEffect(() => {
    forgeStepRef.current = isForgeStep
  }, [isForgeStep])

  useEffect(() => {
    panelFocusRef.current = onPanelFocus
  }, [onPanelFocus])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    })
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100)
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const panelMeshes: Array<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> & { userData: { panelId: string; baseScale: number } }> = []
    const disposables: Array<{ dispose: () => void }> = []
    let frame: number | null = null
    let frameTimer: number | null = null
    let disposed = false
    let hoveredPanel: string | null = null
    let canvasVisible = true
    const targetScale = new THREE.Vector3(1, 1, 1)

    camera.position.set(0, 2.15, 7.1)
    camera.lookAt(0, 0.35, 0)

    const ambientLight = new THREE.AmbientLight("#ffffff", 0.42)
    const amberLight = new THREE.PointLight("#f59e0b", 1.8, 12)
    const cyanLight = new THREE.PointLight("#22d3ee", 1.25, 10)
    const whiteLight = new THREE.DirectionalLight("#ffffff", 0.7)
    amberLight.position.set(0, 0.65, 0)
    cyanLight.position.set(-3, 2.6, 3)
    whiteLight.position.set(2, 4, 4)
    scene.add(ambientLight, amberLight, cyanLight, whiteLight)

    const platformGroup = new THREE.Group()
    const baseGeometry = new THREE.CylinderGeometry(1.35, 1.75, 0.34, 8)
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: "#263241",
      metalness: 0.78,
      roughness: 0.34,
      emissive: "#111827",
      emissiveIntensity: 0.15,
    })
    const base = new THREE.Mesh(baseGeometry, baseMaterial)
    base.position.y = -0.12
    base.rotation.y = Math.PI / 8

    const topGeometry = new THREE.BoxGeometry(1.72, 0.22, 0.92)
    const topMaterial = new THREE.MeshStandardMaterial({
      color: "#475569",
      metalness: 0.86,
      roughness: 0.26,
      emissive: "#0f172a",
      emissiveIntensity: 0.14,
    })
    const top = new THREE.Mesh(topGeometry, topMaterial)
    top.position.y = 0.18

    const hornGeometry = new THREE.ConeGeometry(0.34, 0.86, 24)
    const hornMaterial = topMaterial.clone()
    const leftHorn = new THREE.Mesh(hornGeometry, hornMaterial)
    leftHorn.position.set(-1.17, 0.18, 0)
    leftHorn.rotation.z = Math.PI / 2
    const rightHorn = new THREE.Mesh(hornGeometry, hornMaterial)
    rightHorn.position.set(1.17, 0.18, 0)
    rightHorn.rotation.z = -Math.PI / 2
    platformGroup.add(base, top, leftHorn, rightHorn)
    scene.add(platformGroup)

    const ringGeometry = new THREE.RingGeometry(1.85, 2.15, 96)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: "#f59e0b",
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const moltenRing = new THREE.Mesh(ringGeometry, ringMaterial)
    moltenRing.rotation.x = -Math.PI / 2
    moltenRing.position.y = -0.34
    scene.add(moltenRing)

    const particleGeometry = new THREE.BufferGeometry()
    const particleMaterial = new THREE.PointsMaterial({
      color: "#67e8f9",
      size: 0.038,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    })
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(createParticlePositions(70), 3))
    const particles = new THREE.Points(particleGeometry, particleMaterial)
    scene.add(particles)

    forgePanels.forEach((panel, index) => {
      const panelTexture = createForgeLabelTexture(panel.label)
      const panelGeometry = new THREE.PlaneGeometry(1.06, 0.48)
      const panelMaterial = new THREE.MeshBasicMaterial({
        map: panelTexture,
        transparent: true,
        opacity: 0.86,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const panelMesh = new THREE.Mesh(panelGeometry, panelMaterial) as (typeof panelMeshes)[number]
      const angle = (index / forgePanels.length) * Math.PI * 2
      panelMesh.userData = { panelId: panel.id, baseScale: 1 }
      panelMesh.position.set(Math.cos(angle) * 2.9, 1.08 + Math.sin(index * 1.7) * 0.18, Math.sin(angle) * 1.75)
      panelMesh.lookAt(camera.position)
      panelMeshes.push(panelMesh)
      scene.add(panelMesh)
      disposables.push(panelTexture, panelGeometry, panelMaterial)
    })

    disposables.push(
      baseGeometry,
      baseMaterial,
      topGeometry,
      topMaterial,
      hornGeometry,
      hornMaterial,
      ringGeometry,
      ringMaterial,
      particleGeometry,
      particleMaterial,
    )

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const width = Math.max(1, Math.floor(bounds.width))
      const height = Math.max(1, Math.floor(bounds.height))

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const canRender = () => !disposed && !document.hidden && canvasVisible

    const cancelRenderLoop = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame)
        frame = null
      }
      if (frameTimer !== null) {
        window.clearTimeout(frameTimer)
        frameTimer = null
      }
    }

    const scheduleRenderLoop = (delay = TARGET_FRAME_MS) => {
      if (!canRender() || frame !== null || frameTimer !== null) return
      frameTimer = window.setTimeout(() => {
        frameTimer = null
        if (!canRender()) return
        frame = requestAnimationFrame(animate)
      }, delay)
    }

    const syncRenderLoop = () => {
      if (canRender()) {
        scheduleRenderLoop(0)
      } else {
        cancelRenderLoop()
      }
    }

    const updatePointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)

      const hit = raycaster.intersectObjects(panelMeshes, false)[0]?.object as (typeof panelMeshes)[number] | undefined
      const nextPanel = hit?.userData.panelId ?? null

      if (nextPanel !== hoveredPanel) {
        hoveredPanel = nextPanel
        canvas.style.cursor = nextPanel ? "pointer" : "default"
        panelFocusRef.current?.(nextPanel)
      }
    }

    const clickPanel = () => {
      if (hoveredPanel) panelFocusRef.current?.(hoveredPanel)
    }

    const leaveCanvas = () => {
      hoveredPanel = null
      canvas.style.cursor = "default"
      panelFocusRef.current?.(null)
    }

    const animate = () => {
      frame = null

      if (!canRender()) {
        return
      }

      const elapsed = performance.now() / 1000
      const targetZ = forgeStepRef.current ? 5.75 : 7.1
      const targetY = forgeStepRef.current ? 1.86 : 2.15
      camera.position.z += (targetZ - camera.position.z) * 0.045
      camera.position.y += (targetY - camera.position.y) * 0.045
      camera.lookAt(0, 0.25, 0)

      platformGroup.rotation.y = Math.sin(elapsed * 0.2) * 0.045
      moltenRing.rotation.z = elapsed * 0.08
      ringMaterial.opacity = 0.34 + Math.sin(elapsed * 1.5) * 0.08
      amberLight.intensity = 1.5 + Math.sin(elapsed * 1.8) * 0.38
      cyanLight.intensity = 1.05 + Math.sin(elapsed * 1.2 + 1.4) * 0.22
      particles.rotation.y = elapsed * 0.025
      particles.position.y = Math.sin(elapsed * 0.45) * 0.08

      panelMeshes.forEach((panel, index) => {
        const orbit = elapsed * 0.16 + (index / panelMeshes.length) * Math.PI * 2
        const panelId = panel.userData.panelId
        const active = panelId === activePanelRef.current || panelId === hoveredPanel
        const nextScale = active ? 1.16 : 1

        panel.position.x = Math.cos(orbit) * 2.9
        panel.position.z = Math.sin(orbit) * 1.75
        panel.position.y = 1.1 + Math.sin(elapsed * 0.85 + index) * 0.12
        targetScale.set(nextScale, nextScale, nextScale)
        panel.scale.lerp(targetScale, 0.08)
        panel.lookAt(camera.position)
        panel.material.opacity = active ? 1 : 0.76
      })

      renderer.render(scene, camera)
      scheduleRenderLoop()
    }

    const handleVisibilityChange = () => {
      syncRenderLoop()
    }

    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver(
          ([entry]) => {
            canvasVisible = entry?.isIntersecting ?? true
            syncRenderLoop()
          },
          { threshold: 0.01 },
        )
      : null

    resize()
    window.addEventListener("resize", resize)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    observer?.observe(canvas)
    canvas.addEventListener("pointermove", updatePointer)
    canvas.addEventListener("pointerleave", leaveCanvas)
    canvas.addEventListener("click", clickPanel)

    // The forge has ambient motion, but it does not need a full 60fps render loop.
    // Throttling and visibility pausing keeps the premium feel while reducing GPU work.
    scheduleRenderLoop(0)

    return () => {
      disposed = true
      window.removeEventListener("resize", resize)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      observer?.disconnect()
      canvas.removeEventListener("pointermove", updatePointer)
      canvas.removeEventListener("pointerleave", leaveCanvas)
      canvas.removeEventListener("click", clickPanel)
      cancelRenderLoop()
      disposables.forEach((item) => item.dispose())
      renderer.dispose()
      scene.clear()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-v2-scene-canvas="true"
      className={className}
    />
  )
}

function createFiberScene(fiber: typeof import("@react-three/fiber")) {
  const { Canvas, useFrame, useThree } = fiber

  function FiberRenderGovernor({
    activePanelId,
    isForgeStep,
  }: {
    activePanelId?: string | null
    isForgeStep?: boolean
  }) {
    const { gl, invalidate } = useThree()

    useEffect(() => {
      const canvas = gl.domElement
      let frame: number | null = null
      let frameTimer: number | null = null
      let canvasVisible = true
      let disposed = false

      const canRender = () => !disposed && !document.hidden && canvasVisible

      const cancelRenderLoop = () => {
        if (frame !== null) {
          cancelAnimationFrame(frame)
          frame = null
        }
        if (frameTimer !== null) {
          window.clearTimeout(frameTimer)
          frameTimer = null
        }
      }

      const animate = () => {
        frame = null

        if (!canRender()) {
          return
        }

        invalidate()
        scheduleRenderLoop()
      }

      const scheduleRenderLoop = (delay = TARGET_FRAME_MS) => {
        if (!canRender() || frame !== null || frameTimer !== null) return
        frameTimer = window.setTimeout(() => {
          frameTimer = null
          if (!canRender()) return
          frame = requestAnimationFrame(animate)
        }, delay)
      }

      const syncRenderLoop = () => {
        if (canRender()) {
          scheduleRenderLoop(0)
          invalidate()
        } else {
          cancelRenderLoop()
        }
      }

      const handleVisibilityChange = () => {
        syncRenderLoop()
      }

      const observer = "IntersectionObserver" in window
        ? new IntersectionObserver(
            ([entry]) => {
              canvasVisible = entry?.isIntersecting ?? true
              syncRenderLoop()
            },
            { threshold: 0.01 },
          )
        : null

      document.addEventListener("visibilitychange", handleVisibilityChange)
      observer?.observe(canvas)

      // R3F runs in demand mode below. This small governor invalidates at ~30fps
      // only while visible, avoiding the default continuous 60fps render loop.
      syncRenderLoop()

      return () => {
        disposed = true
        document.removeEventListener("visibilitychange", handleVisibilityChange)
        observer?.disconnect()
        cancelRenderLoop()
      }
    }, [gl, invalidate])

    useEffect(() => {
      invalidate()
    }, [activePanelId, isForgeStep, invalidate])

    return null
  }

  function Particles() {
    const pointsRef = useRef<THREE.Points>(null)
    const positions = useMemo(() => createParticlePositions(70), [])

    useFrame(({ clock }) => {
      if (!pointsRef.current) return
      const elapsed = clock.getElapsedTime()
      pointsRef.current.rotation.y = elapsed * 0.025
      pointsRef.current.position.y = Math.sin(elapsed * 0.45) * 0.08
    })

    return (
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color="#67e8f9" size={0.038} transparent opacity={0.7} depthWrite={false} />
      </points>
    )
  }

  function ForgePlatform() {
    const groupRef = useRef<THREE.Group>(null)
    const ringRef = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null)
    const amberRef = useRef<THREE.PointLight>(null)
    const cyanRef = useRef<THREE.PointLight>(null)

    useFrame(({ clock }) => {
      const elapsed = clock.getElapsedTime()
      if (groupRef.current) groupRef.current.rotation.y = Math.sin(elapsed * 0.2) * 0.045
      if (ringRef.current) {
        ringRef.current.rotation.z = elapsed * 0.08
        ringRef.current.material.opacity = 0.34 + Math.sin(elapsed * 1.5) * 0.08
      }
      if (amberRef.current) amberRef.current.intensity = 1.5 + Math.sin(elapsed * 1.8) * 0.38
      if (cyanRef.current) cyanRef.current.intensity = 1.05 + Math.sin(elapsed * 1.2 + 1.4) * 0.22
    })

    return (
      <>
        <ambientLight intensity={0.42} />
        <pointLight ref={amberRef} position={[0, 0.65, 0]} intensity={1.8} color="#f59e0b" distance={12} />
        <pointLight ref={cyanRef} position={[-3, 2.6, 3]} intensity={1.25} color="#22d3ee" distance={10} />
        <directionalLight position={[2, 4, 4]} intensity={0.7} color="#ffffff" />
        <group ref={groupRef}>
          <mesh position={[0, -0.12, 0]} rotation={[0, Math.PI / 8, 0]}>
            <cylinderGeometry args={[1.35, 1.75, 0.34, 8]} />
            <meshStandardMaterial color="#263241" metalness={0.78} roughness={0.34} emissive="#111827" emissiveIntensity={0.15} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <boxGeometry args={[1.72, 0.22, 0.92]} />
            <meshStandardMaterial color="#475569" metalness={0.86} roughness={0.26} emissive="#0f172a" emissiveIntensity={0.14} />
          </mesh>
          <mesh position={[-1.17, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.34, 0.86, 24]} />
            <meshStandardMaterial color="#475569" metalness={0.86} roughness={0.26} emissive="#0f172a" emissiveIntensity={0.14} />
          </mesh>
          <mesh position={[1.17, 0.18, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.34, 0.86, 24]} />
            <meshStandardMaterial color="#475569" metalness={0.86} roughness={0.26} emissive="#0f172a" emissiveIntensity={0.14} />
          </mesh>
        </group>
        <mesh ref={ringRef} position={[0, -0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.85, 2.15, 96]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.42} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </>
    )
  }

  function ForgePanelMesh({
    panel,
    index,
    activePanelId,
    onPanelFocus,
  }: {
    panel: (typeof forgePanels)[number]
    index: number
    activePanelId?: string | null
    onPanelFocus?: (panelId: string | null) => void
  }) {
    const meshRef = useRef<THREE.Mesh>(null)
    const texture = useMemo(() => createForgeLabelTexture(panel.label), [panel.label])

    useEffect(() => {
      return () => texture.dispose()
    }, [texture])

    useFrame(({ camera, clock }) => {
      if (!meshRef.current) return
      const elapsed = clock.getElapsedTime()
      const orbit = elapsed * 0.16 + (index / forgePanels.length) * Math.PI * 2
      const active = activePanelId === panel.id
      const targetScale = active ? 1.16 : 1

      meshRef.current.position.x = Math.cos(orbit) * 2.9
      meshRef.current.position.z = Math.sin(orbit) * 1.75
      meshRef.current.position.y = 1.1 + Math.sin(elapsed * 0.85 + index) * 0.12
      meshRef.current.scale.x += (targetScale - meshRef.current.scale.x) * 0.08
      meshRef.current.scale.y += (targetScale - meshRef.current.scale.y) * 0.08
      meshRef.current.scale.z += (targetScale - meshRef.current.scale.z) * 0.08
      meshRef.current.lookAt(camera.position)
    })

    return (
      <mesh
        ref={meshRef}
        onPointerOver={(event) => {
          event.stopPropagation()
          onPanelFocus?.(panel.id)
        }}
        onPointerOut={(event) => {
          event.stopPropagation()
          onPanelFocus?.(null)
        }}
        onClick={(event) => {
          event.stopPropagation()
          onPanelFocus?.(panel.id)
        }}
      >
        <planeGeometry args={[1.06, 0.48]} />
        <meshBasicMaterial map={texture} transparent opacity={activePanelId === panel.id ? 1 : 0.78} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    )
  }

  function CameraRig({ isForgeStep = false }: { isForgeStep?: boolean }) {
    useFrame(({ camera }) => {
      const targetZ = isForgeStep ? 5.75 : 7.1
      const targetY = isForgeStep ? 1.86 : 2.15
      camera.position.z += (targetZ - camera.position.z) * 0.045
      camera.position.y += (targetY - camera.position.y) * 0.045
      camera.lookAt(0, 0.25, 0)
    })

    return null
  }

  function FiberForgeScene({
    className,
    isForgeStep,
    activePanelId,
    onPanelFocus,
  }: ClientSceneCanvasProps) {
    return (
      <Canvas
        aria-hidden="true"
        data-v2-scene-canvas="true"
        className={className}
        camera={{ position: [0, 2.15, 7.1], fov: 48 }}
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <FiberRenderGovernor activePanelId={activePanelId} isForgeStep={isForgeStep} />
          <CameraRig isForgeStep={isForgeStep} />
          <ForgePlatform />
          <Particles />
          {forgePanels.map((panel, index) => (
            <ForgePanelMesh
              key={panel.id}
              panel={panel}
              index={index}
              activePanelId={activePanelId}
              onPanelFocus={onPanelFocus}
            />
          ))}
        </Suspense>
      </Canvas>
    )
  }

  return FiberForgeScene
}

export function ClientSceneCanvas(props: ClientSceneCanvasProps) {
  const shouldFallback = useSceneFallback()
  const [SceneComponent, setSceneComponent] = useState<ComponentType<ClientSceneCanvasProps> | null>(null)

  useEffect(() => {
    if (shouldFallback) return

    let mounted = true

    import("@react-three/fiber")
      .then((fiber) => {
        if (!mounted) return
        setSceneComponent(() => createFiberScene(fiber))
      })
      .catch(() => {
        if (!mounted) return
        setSceneComponent(() => ManualForgeScene)
      })

    return () => {
      mounted = false
    }
  }, [shouldFallback])

  if (shouldFallback) return <StaticSceneFallback />

  const Scene = SceneComponent ?? ManualForgeScene

  return (
    <SceneBoundary fallback={<StaticSceneFallback />}>
      <Scene {...props} />
    </SceneBoundary>
  )
}

export default ClientSceneCanvas
