"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

type Spark = {
  position: THREE.Vector3
  velocity: THREE.Vector3
  life: number
}

function box(
  size: [number, number, number],
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function createAnvil() {
  const group = new THREE.Group()
  const top = new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.85, roughness: 0.24 })
  const body = new THREE.MeshStandardMaterial({ color: "#526579", metalness: 0.8, roughness: 0.3 })
  const base = new THREE.MeshStandardMaterial({ color: "#334155", metalness: 0.78, roughness: 0.34 })
  const dark = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.4 })

  group.add(box([2.7, 0.38, 0.88], top, [0, 0.3, 0]))
  group.add(box([1.3, 0.58, 0.7], body, [-0.4, -0.04, 0]))
  group.add(box([1.92, 0.3, 0.82], base, [-0.4, -0.56, 0]))
  group.add(box([0.24, 0.035, 0.2], dark, [0.26, 0.52, 0.46]))

  const horn = new THREE.Mesh(
    new THREE.ConeGeometry(0.43, 1.08, 32),
    new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.9, roughness: 0.2 }),
  )
  horn.position.set(1.53, 0.28, 0)
  horn.rotation.z = Math.PI / 2
  horn.castShadow = true
  horn.receiveShadow = true
  group.add(horn)

  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 1.12, 64),
    new THREE.MeshBasicMaterial({
      color: "#22d3ee",
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  glow.name = "anvilGlow"
  glow.position.set(0.04, 0.535, 0)
  glow.rotation.x = -Math.PI / 2
  group.add(glow)

  group.position.set(0, -1.48, 0)
  return group
}

function createHammer() {
  const group = new THREE.Group()
  const handleMaterial = new THREE.MeshStandardMaterial({
    color: "#7c4a24",
    metalness: 0.18,
    roughness: 0.52,
  })
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.11, 2.34, 24),
    handleMaterial,
  )
  handle.position.set(0, -0.06, 0)
  handle.castShadow = true
  handle.receiveShadow = true

  const head = new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.92, roughness: 0.2 })
  const darkSteel = new THREE.MeshStandardMaterial({ color: "#64748b", metalness: 0.86, roughness: 0.24 })
  const trim = new THREE.MeshStandardMaterial({
    color: "#bae6fd",
    metalness: 0.86,
    roughness: 0.2,
    emissive: "#0ea5e9",
    emissiveIntensity: 0.08,
  })
  const socket = new THREE.MeshStandardMaterial({
    color: "#94a3b8",
    metalness: 0.9,
    roughness: 0.22,
    emissive: "#0ea5e9",
    emissiveIntensity: 0.07,
  })

  group.add(handle)
  group.add(box([0.74, 0.5, 0.58], darkSteel, [0, -1.47, 0]))
  group.add(box([0.42, 0.48, 0.55], head, [0.58, -1.47, 0]))
  group.add(box([0.18, 0.38, 0.5], trim, [0.88, -1.47, 0]))

  const peen = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.62, 4), head)
  peen.position.set(-0.62, -1.47, 0)
  peen.rotation.set(0, Math.PI / 4, Math.PI / 2)
  peen.castShadow = true
  peen.receiveShadow = true
  group.add(peen)

  group.add(box([0.4, 0.28, 0.64], socket, [0, -1.16, 0]))
  group.add(box([0.2, 0.13, 0.68], socket, [0, -0.98, 0]))
  group.add(box([0.15, 0.13, 0.22], trim, [0, 1.06, 0]))
  group.position.set(0.1, 0.85, 0)
  return group
}

function createSparks(count: number) {
  const positions = new Float32Array(count * 3)
  positions.fill(-80)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))

  const material = new THREE.PointsMaterial({
    color: "#fde68a",
    size: 0.045,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  const points = new THREE.Points(geometry, material)
  const sparks: Spark[] = Array.from({ length: count }, () => ({
    position: new THREE.Vector3(-80, -80, -80),
    velocity: new THREE.Vector3(),
    life: 0,
  }))

  return { points, positions, sparks, material }
}

function burstSparks(sparks: Spark[], origin: THREE.Vector3, strength = 1) {
  const count = sparks.length
  sparks.forEach((spark, index) => {
    const angle = (index / count) * Math.PI * 2 + Math.sin(index * 12.9898) * 0.8
    const speed = (0.035 + ((index * 17) % 11) * 0.006) * strength
    spark.position.set(
      origin.x + Math.cos(angle) * 0.18,
      origin.y + Math.sin(angle) * 0.08,
      origin.z + ((index % 9) - 4) * 0.035,
    )
    spark.velocity.set(Math.cos(angle) * speed, (0.045 + ((index * 7) % 10) * 0.006) * strength, Math.sin(angle) * speed * 0.45)
    spark.life = 1
  })
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const x = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return x * x * (3 - 2 * x)
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()

    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose())
    } else {
      material?.dispose()
    }
  })
}

export function ForgeHeroScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const disableE2eCanvas = typeof window !== "undefined" && window.localStorage.getItem("scalesmiths.e2e.disableCanvas") === "true"

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setClearColor("#07111f", 1)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog("#07111f", 6, 13)

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, 0.05, 7.1)

    scene.add(new THREE.AmbientLight("#ffffff", 0.82))

    const keyLight = new THREE.DirectionalLight("#ffffff", 1.8)
    keyLight.position.set(3.5, 4, 3)
    keyLight.castShadow = true
    scene.add(keyLight)

    const cyanLight = new THREE.PointLight("#22d3ee", 7.4, 6)
    cyanLight.position.set(0, -0.7, 2.1)
    scene.add(cyanLight)

    const warmLight = new THREE.PointLight("#fde68a", 1.8, 7)
    warmLight.position.set(-2.8, 1.8, 1.4)
    scene.add(warmLight)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 10),
      new THREE.MeshStandardMaterial({ color: "#08111f", roughness: 0.8, metalness: 0.15 }),
    )
    floor.position.y = -1.9
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    const grid = new THREE.GridHelper(12, 24, "#164e63", "#0f2638")
    grid.position.y = -1.89
    scene.add(grid)

    const anvil = createAnvil()
    const hammer = createHammer()
    scene.add(anvil, hammer)

    const emberGroup = new THREE.Group()
    Array.from({ length: 30 }, (_, index) => {
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.015 + (((index * 11) % 9) / 100), 10, 10),
        new THREE.MeshBasicMaterial({
          color: index % 3 === 0 ? "#fde68a" : "#22d3ee",
          transparent: true,
          opacity: index % 3 === 0 ? 0.5 : 0.32,
        }),
      )
      ember.position.set(((index * 37) % 100) / 100 * 7 - 3.5, ((index * 53) % 100) / 100 * 2.3 - 1.1, -1.6 - ((index * 29) % 100) / 100 * 2.7)
      emberGroup.add(ember)
      return ember
    })
    scene.add(emberGroup)

    const { points, positions, sparks, material: sparkMaterial } = createSparks(78)
    scene.add(points)

    let animationFrame = 0
    let sparkedCycle = -1
    let baseSparkSize = 0.045
    let scrollEnergy = 0
    let lastScrollY = window.scrollY
    let lastScrollSparkY = lastScrollY
    const clock = new THREE.Clock()

    const setResponsiveSize = () => {
      const width = canvas.clientWidth || window.innerWidth
      const height = canvas.clientHeight || window.innerHeight
      const mobile = window.matchMedia("(max-width: 767px)").matches
      const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.3 : 1.75)

      renderer.setPixelRatio(pixelRatio)
      renderer.setSize(width, height, false)
      camera.aspect = width / Math.max(height, 1)
      camera.fov = mobile ? 46 : 40
      camera.position.set(0, mobile ? 0.18 : 0.05, mobile ? 6.3 : 7.1)
      camera.updateProjectionMatrix()

      const scale = mobile ? 0.78 : 1
      anvil.scale.setScalar(scale)
      hammer.scale.setScalar(mobile ? 0.74 : 1)
      cyanLight.intensity = mobile ? 5.4 : 7.4
      baseSparkSize = mobile ? 0.035 : 0.045
      sparkMaterial.size = baseSparkSize
    }

    const resizeObserver = new ResizeObserver(setResponsiveSize)
    resizeObserver.observe(canvas)
    setResponsiveSize()

    const handleScroll = () => {
      if (reducedMotion) return
      const nextScrollY = window.scrollY
      const delta = nextScrollY - lastScrollY
      lastScrollY = nextScrollY
      scrollEnergy = Math.min(1.6, scrollEnergy + Math.min(Math.abs(delta) / 220, 0.38))

      if (Math.abs(nextScrollY - lastScrollSparkY) > 72 && Math.abs(delta) > 4) {
        lastScrollSparkY = nextScrollY
        const direction = delta > 0 ? 1 : -1
        burstSparks(sparks, new THREE.Vector3(0.08 + direction * 0.18, -0.94, 0), 0.48 + Math.min(Math.abs(delta) / 180, 0.35))
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })

    const animate = () => {
      animationFrame = requestAnimationFrame(animate)
      const elapsed = clock.getElapsedTime()
      const cycle = 4.2
      const phase = (elapsed % cycle) / cycle
      const cycleIndex = Math.floor(elapsed / cycle)
      const windUp = reducedMotion ? 0 : smoothstep(0.1, 0.4, phase) * (1 - smoothstep(0.42, 0.58, phase))
      const downSwing = reducedMotion ? 0 : smoothstep(0.56, 0.72, phase)
      const recover = reducedMotion ? 0 : smoothstep(0.75, 1, phase)
      const strike = reducedMotion ? 0.22 : downSwing * (1 - recover)
      const impactPulse = !reducedMotion && strike > 0.78 ? Math.sin(Math.min(1, (strike - 0.78) / 0.22) * Math.PI) : 0
      const idle = reducedMotion ? 0 : Math.sin(elapsed * 1.45) * 0.025

      hammer.rotation.z = -0.42 - windUp * 0.23 + strike * 0.28 + idle * 0.25
      hammer.position.y = 1.18 + windUp * 0.13 - strike * 0.39 + idle
      hammer.position.x = 0.12 + windUp * 0.07 - strike * 0.08

      if (!reducedMotion && impactPulse > 0.85 && sparkedCycle !== cycleIndex) {
        sparkedCycle = cycleIndex
        burstSparks(sparks, new THREE.Vector3(0.18, -0.94, 0), 0.62)
      }

      let visibleSparks = 0
      scrollEnergy *= 0.92
      sparks.forEach((spark, index) => {
        if (spark.life <= 0) return
        spark.life -= 0.022
        spark.velocity.y -= 0.0023
        spark.position.add(spark.velocity)
        positions[index * 3] = spark.position.x
        positions[index * 3 + 1] = spark.position.y
        positions[index * 3 + 2] = spark.position.z
        visibleSparks += 1

        if (spark.life <= 0) {
          positions[index * 3] = -80
          positions[index * 3 + 1] = -80
          positions[index * 3 + 2] = -80
        }
      })
      points.geometry.attributes.position.needsUpdate = true
      sparkMaterial.opacity = visibleSparks > 0 ? 0.78 : 0
      sparkMaterial.size = baseSparkSize * (1 + Math.min(scrollEnergy, 1) * 0.28)

      const glow = anvil.getObjectByName("anvilGlow") as THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | undefined
      if (glow) glow.material.opacity = 0.24 + Math.sin(elapsed * 2.1) * 0.08 + impactPulse * 0.18 + Math.min(scrollEnergy, 0.8) * 0.08
      cyanLight.intensity = (window.matchMedia("(max-width: 767px)").matches ? 5.4 : 7.4) + impactPulse * 1.6 + Math.min(scrollEnergy, 1) * 1.1
      warmLight.intensity = 1.8 + impactPulse * 1.2 + Math.min(scrollEnergy, 1) * 0.75

      emberGroup.children.forEach((ember, index) => {
        ember.position.y += Math.sin(elapsed * 0.8 + index) * (0.0009 + scrollEnergy * 0.0007)
      })

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener("scroll", handleScroll)
      resizeObserver.disconnect()
      disposeObject(scene)
      renderer.dispose()
    }
  }, [])

  if (disableE2eCanvas) {
    return null
  }

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="h-full w-full opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(34,211,238,0.10),transparent_32%),linear-gradient(180deg,rgba(7,17,31,0.16),rgba(7,17,31,0.72)_72%,rgba(7,17,31,0.94))]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:64px_64px] opacity-65" />
    </div>
  )
}
