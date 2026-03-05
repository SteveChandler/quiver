"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import { createOceanMaterial } from "./ocean-material";
import { OCEAN_GEOMETRY } from "./ocean-constants";
import type { OceanUniforms } from "./forecast-to-ocean";

// ── Props ─────────────────────────────────────────────────────────────────────

interface OceanSurfaceProps {
  uniforms: OceanUniforms;
  /** Vertex subdivision count — defaults to OCEAN_GEOMETRY.defaultSegments. */
  segments?: number;
  /** Scene-scale Y offset applied to mesh position (tide level). */
  tideOffset?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * OceanSurface
 *
 * Renders an animated horizontal plane using a CustomShaderMaterial (CSM)
 * built on MeshToonMaterial. All wave and color uniforms are driven by the
 * `uniforms` prop (converted from live forecast data) and updated every frame
 * via R3F's useFrame hook.
 *
 * GPU resources (material + geometry) are created once with useMemo and
 * disposed on unmount to avoid leaks.
 */
export function OceanSurface({
  uniforms,
  segments,
  tideOffset = 0,
}: OceanSurfaceProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Create material once — owns its GPU lifetime.
  const material = useMemo<CustomShaderMaterial>(
    () => createOceanMaterial(),
    []
  );

  // Create geometry once. Rotate to lie flat (XZ plane) so Y is up.
  const geometry = useMemo<THREE.PlaneGeometry>(() => {
    const seg = segments ?? OCEAN_GEOMETRY.defaultSegments;
    const geo = new THREE.PlaneGeometry(
      OCEAN_GEOMETRY.width,
      OCEAN_GEOMETRY.depth,
      seg,
      seg
    );
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [segments]);

  // Dispose GPU resources when component unmounts.
  useEffect(() => {
    return () => {
      material.dispose();
      geometry.dispose();
    };
  }, [material, geometry]);

  // Sync tide offset to mesh Y position each render cycle.
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.y = tideOffset;
    }
  }, [tideOffset]);

  // Per-frame update: advance time and sync all wave uniforms from props.
  useFrame((_state, delta) => {
    const mat = material as CustomShaderMaterial & {
      uniforms: Record<string, THREE.IUniform>;
    };

    // Advance clock.
    // eslint-disable-next-line react-hooks/immutability -- Three.js uniform mutation is expected per-frame
    mat.uniforms.u_time.value += delta;

    // --- Wave band 1 ---
    mat.uniforms.u_wave1_amp.value = uniforms.wave1.amplitude;
    mat.uniforms.u_wave1_freq.value = uniforms.wave1.frequency;
    mat.uniforms.u_wave1_speed.value = uniforms.wave1.speed;
    (mat.uniforms.u_wave1_dir.value as THREE.Vector2).set(
      uniforms.wave1.direction[0],
      uniforms.wave1.direction[1]
    );
    mat.uniforms.u_wave1_steepness.value = uniforms.wave1.steepness;

    // --- Wave band 2 ---
    mat.uniforms.u_wave2_amp.value = uniforms.wave2.amplitude;
    mat.uniforms.u_wave2_freq.value = uniforms.wave2.frequency;
    mat.uniforms.u_wave2_speed.value = uniforms.wave2.speed;
    (mat.uniforms.u_wave2_dir.value as THREE.Vector2).set(
      uniforms.wave2.direction[0],
      uniforms.wave2.direction[1]
    );
    mat.uniforms.u_wave2_steepness.value = uniforms.wave2.steepness;

    // --- Wave band 3 (wind chop) ---
    mat.uniforms.u_wave3_amp.value = uniforms.wave3.amplitude;
    mat.uniforms.u_wave3_freq.value = uniforms.wave3.frequency;
    mat.uniforms.u_wave3_speed.value = uniforms.wave3.speed;
    (mat.uniforms.u_wave3_dir.value as THREE.Vector2).set(
      uniforms.wave3.direction[0],
      uniforms.wave3.direction[1]
    );
    mat.uniforms.u_wave3_steepness.value = uniforms.wave3.steepness;

    // --- Wind chop foam density ---
    mat.uniforms.u_wind_chop.value = uniforms.windChop;
  });

  return <mesh ref={meshRef} material={material} geometry={geometry} />;
}
