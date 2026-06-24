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
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.11, 2.8, 20),
    new THREE.MeshStandardMaterial({
      color: "#38bdf8",
      metalness: 0.55,
      roughness: 0.3,
      emissive: "#0284c7",
      emissiveIntensity: 0.25,
    }),
  )
  handle.rotation.z = Math.PI / 2
  handle.castShadow = true

  const head = new THREE.MeshStandardMaterial({ color: "#e2e8f0", metalness: 0.92, roughness: 0.18 })
  const trim = new THREE.MeshStandardMaterial({ color: "#7dd3fc", metalness: 0.82, roughness: 0.2 })

  group.add(handle)
  group.add(box([1, 0.42, 0.48], head, [0, -1.43, 0]))
  group.add(box([0.32, 0.33, 0.42], trim, [-0.63, -1.43, 0]))
  group.add(box([0.32, 0.33, 0.42], trim, [0.63, -1.43, 0]))
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

function burstSparks(sparks: Spark[], origin: THREE.Vector3) {
  const count = sparks.length
  sparks.forEach((spark, index) => {
    const angle = (index / count) * Math.PI * 2 + Math.sin(index * 12.9898) * 0.8
    const speed = 0.035 + ((index * 17) % 11) * 0.006
    spark.position.set(
      origin.x + Math.cos(angle) * 0.18,
      origin.y + Math.sin(angle) * 0.08,
      origin.z + ((index % 9) - 4) * 0.035,
    )
    spark.velocity.set(Math.cos(angle) * speed, 0.045 + ((index * 7) % 10) * 0.006, Math.sin(angle) * speed * 0.45)
    spark.life = 1
  })
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
      sparkMaterial.size = mobile ? 0.035 : 0.045
    }

    const resizeObserver = new ResizeObserver(setResponsiveSize)
    resizeObserver.observe(canvas)
    setResponsiveSize()

    const animate = () => {
      animationFrame = requestAnimationFrame(animate)
      const elapsed = clock.getElapsedTime()
      const cycle = 4.2
      const phase = (elapsed % cycle) / cycle
      const cycleIndex = Math.floor(elapsed / cycle)
      const active = !reducedMotion && phase > 0.58 && phase < 0.86
      const strike = active ? Math.sin(((phase - 0.58) / 0.28) * Math.PI) : reducedMotion ? 0.28 : 0.05

      hammer.rotation.z = -0.55 + (1 - strike) * 0.38
      hammer.position.y = 0.2 + (1 - strike) * 0.82
      hammer.position.x = 0.12 - strike * 0.14

      if (active && phase > 0.71 && sparkedCycle !== cycleIndex) {
        sparkedCycle = cycleIndex
        burstSparks(sparks, new THREE.Vector3(0.18, -0.94, 0))
      }

      let visibleSparks = 0
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
      sparkMaterial.opacity = visibleSparks > 0 ? 0.95 : 0

      const glow = anvil.getObjectByName("anvilGlow") as THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | undefined
      if (glow) glow.material.opacity = 0.24 + Math.sin(elapsed * 2.1) * 0.08

      emberGroup.children.forEach((ember, index) => {
        ember.position.y += Math.sin(elapsed * 0.8 + index) * 0.0009
      })

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      disposeObject(scene)
      renderer.dispose()
    }
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="h-full w-full opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(34,211,238,0.10),transparent_32%),linear-gradient(180deg,rgba(7,17,31,0.16),rgba(7,17,31,0.72)_72%,rgba(7,17,31,0.94))]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:64px_64px] opacity-65" />
    </div>
  )
}
