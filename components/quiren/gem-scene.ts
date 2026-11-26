import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The stage: a surreal glacial desert. Back to front: hazy sky and fog, pale dunes, a flat sand terrace on the
 * right, a wet mirror floor, dry golden scrub, a smooth sandstone wall with one great round opening, two spheres,
 * and a chiselled glacier block on a snow apron, a terracotta X held in a frost-rimmed pocket in its face.
 * One fixed canvas behind the page; the page moves the camera between poses.
 */

export type Pose = {
  pos: [number, number, number];
  tgt: [number, number, number];
  fov: number;
  roll: number; // radians
  spin: number; // unused, kept for pose compatibility
  veilL: number; // dark veil behind left-hand text, 0..1
  veilR: number; // dark veil behind right-hand text, 0..1
  orb?: number; // the far sphere, 0 hides it
};

const FLOOR_Y = -1.85;
/** Scene clock shared by materials built outside the scene function (sand cloud shadows). */
const SCENE_TIME = { value: 0 };
/** The far sphere: centre xyz and radius, set once the sandbar is built; sand under it is darkened. */
const ORB_REST = new THREE.Vector4(3.55, -1.5, -2.05, 0.23);

// the ice spire: base on the floor, leaning toward the upper right
const SPIRE_BASE = new THREE.Vector3(0.0, FLOOR_Y - 0.05, 0);
const SPIRE_LEAN = -0.04;
const CORE_LOCAL = new THREE.Vector3(-0.08, 1.38, 0.0);
const coreWorld = (() => {
  const v = CORE_LOCAL.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), SPIRE_LEAN).add(SPIRE_BASE);
  return [v.x, v.y, v.z] as const;
})();
const [CX, CY] = coreWorld;

export const POSES = {
  // wide establishing shot of the diorama
  hero: { pos: [-0.25, -0.72, 7.6], tgt: [-0.05, -0.12, 0], fov: 34, roll: 0, spin: 0, veilL: 0.5, veilR: 0.25 },
  // gliding forward through the space
  manifesto: { pos: [-1.55, -0.55, 5.9], tgt: [-1.35, -0.1, 0], fov: 34, roll: -0.01, spin: 0, veilL: 0.15, veilR: 0.1 },
  partners: { pos: [0.35, -0.35, 4.3], tgt: [0.2, -0.05, 0], fov: 35, roll: 0.01, spin: 0, veilL: 0.55, veilR: 0.4 },
  // macro: the frosted ice and the glowing core, held on the left of the frame
  macro: { pos: [CX + 0.7, CY + 0.15, 3.0], tgt: [CX + 1.15, CY, 0], fov: 36, roll: 0.03, spin: 0, veilL: 0.3, veilR: 0.55, orb: 0 },
  macroB: { pos: [CX + 0.4, CY - 0.1, 2.75], tgt: [CX + 1.05, CY + 0.05, 0], fov: 37, roll: 0.07, spin: 0, veilL: 0.35, veilR: 0.6, orb: 0 },
  macroC: { pos: [CX + 0.8, CY + 0.4, 3.1], tgt: [CX + 1.1, CY + 0.2, 0], fov: 36, roll: -0.04, spin: 0, veilL: 0.45, veilR: 0.55, orb: 0 },
  pull: { pos: [0.2, -0.3, 3.6], tgt: [0.6, -0.1, 0], fov: 35, roll: 0.02, spin: 0, veilL: 0.5, veilR: 0.4, orb: 0 },
  // back out to the full panorama
  final: { pos: [0.1, -0.66, 7.4], tgt: [0.0, -0.12, 0], fov: 34, roll: 0, spin: 0, veilL: 0.25, veilR: 0.25 },
  // stills
  stillCore: { pos: [CX + 0.2, CY + 0.1, 2.6], tgt: [CX, CY, 0], fov: 36, roll: -0.15, spin: 0, veilL: 0, veilR: 0 },
  stillWide: { pos: [0.6, -0.5, 10.5], tgt: [-0.2, -0.3, 0], fov: 32, roll: 0, spin: 0, veilL: 0, veilR: 0 },
} satisfies Record<string, Pose>;
export type PoseName = keyof typeof POSES;

const C = (hex: string) => new THREE.Color(hex);
const ss = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---------- small seeded noise for the geometry ----------
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}
function hash3(x: number, y: number, z: number) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (i: number, j: number, k: number) => hash3(xi + i, yi + j, zi + k);
  return L(
    L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v),
    L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  ) * 2 - 1;
}
const fbm = (x: number, y: number, z: number) => vnoise(x, y, z) * 0.6 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.28 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.12;

// ---------- geometry ----------
/**
 * A chiselled glacial shard, measured off the reference: it stands on a blunt lower point in the water, is widest a
 * little below the middle and narrows to a crown past the top of the frame; its widest band is slanted (fuller low on
 * the left, high on the right). Ridged crystal relief, then flat cleavage planes for hard faceted edges. Base at y = 0.
 */
function spireGeometry() {
  const H = 4.7;
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 64);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g, 1e-5);
  const r = rng(11);
  const planes = Array.from({ length: 30 }, () => {
    const n = new THREE.Vector3(r() * 2 - 1, (r() * 2 - 1) * 0.6, r() * 2 - 1).normalize();
    return { n, k: 0.78 + r() * 0.12 };
  });
  const ridged = (x: number, y: number, z: number) => 1 - Math.abs(vnoise(x, y, z));
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3(), q = new THREE.Vector3();
  const ext = new THREE.Vector3(1.2, H / 2, 1.0);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = v.clone();
    const t = (d.y + 1) / 2;
    const tp = t < 0.42 ? (0.5 * t) / 0.42 : 0.5 + (0.5 * (t - 0.42)) / 0.58;
    const w = 0.1 + 1.12 * Math.pow(Math.sin(Math.PI * tp), 0.72);
    const s = w / Math.max(Math.sqrt(1 - d.y * d.y), 0.05);
    const rg = ridged(d.x * 2.1 + 4, d.y * 3.2, d.z * 2.1) * 0.6 + ridged(d.x * 5.2, d.y * 7.5 + 2, d.z * 5.2) * 0.4;
    const bump = 1 + (rg - 0.55) * 0.07;
    v.set(d.x * s * bump, t * H, d.z * s * 0.84 * bump);
    // cleavage planes, measured against an ellipsoid around the middle of the shard
    q.set(v.x, v.y - H * 0.47, v.z);
    for (const pl of planes) {
      const support = Math.sqrt((ext.x * pl.n.x) ** 2 + (ext.y * pl.n.y) ** 2 + (ext.z * pl.n.z) ** 2);
      const dist = q.dot(pl.n) - support * pl.k;
      if (dist > 0) q.addScaledVector(pl.n, -dist);
    }
    v.set(q.x, q.y + H * 0.47, q.z);
    // slant the widest band and lean the crown a touch to the right
    v.y += v.x * 0.32 * Math.sin(Math.PI * Math.min(1, v.y / H));
    v.x += (v.y / H) * 0.15;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox!.min.y, 0);
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

/** The emblem: two chunky bevelled bars crossed at right angles, turned 45 degrees so it reads as an X. */
function coreGeometry() {
  const a = new RoundedBoxGeometry(1.5, 0.46, 0.46, 8, 0.16);
  const b = new RoundedBoxGeometry(1.5, 0.46, 0.46, 8, 0.16).rotateZ(Math.PI / 2);
  return mergeGeometries([a, b])!.rotateZ(Math.PI / 4);
}

/** Terracotta clay, warm on the lit lobes and deep in the junction, spattered with frost that clings to the underside. */
function terracottaFrost() {
  const m = new THREE.MeshStandardMaterial({ color: C("#C25232"), roughness: 0.48, emissive: C("#D46635"), emissiveIntensity: 0.02 });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj; varying vec3 vWN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position; vWN = normalize(mat3(modelMatrix) * normal);");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vObj; varying vec3 vWN;\n${NOISE_GLSL}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 deep = vec3(0.24, 0.03, 0.02), mid = vec3(0.5, 0.07, 0.04), hi = vec3(0.8, 0.22, 0.09);
        float junction = 1.0 - smoothstep(0.15, 0.45, length(vObj.xy));
        vec3 clay = mix(mid, hi, smoothstep(-0.2, 0.9, vWN.y) * 0.8 + snoise(vObj * 6.0) * 0.12);
        clay = mix(clay, deep, max(junction * 0.75, smoothstep(0.0, -0.8, vWN.y) * 0.4));
        clay *= 0.93 + snoise(vObj * 22.0) * 0.07;
        // frost spatter: irregular flecks, denser underneath and on the edges
        // clusters: a slow mask decides where frost gathers (edges, underside), fine noise breaks it into crystals
        vec3 an = abs(normalize(vObj));
        float edge = smoothstep(0.55, 0.9, max(abs(vObj.z) / 0.23, 0.0));
        float mask = smoothstep(0.5, 0.85, snoise(vObj * 2.6 + 4.0) * 0.6 + smoothstep(0.2, -0.8, vWN.y) * 0.45 + edge * 0.3);
        float sp = snoise(vObj * 18.0) * 0.6 + snoise(vObj * 46.0) * 0.4;
        float frost = mask * smoothstep(0.2, 0.36, sp) * 0.85;
        diffuseColor.rgb = mix(clay, vec3(0.95, 0.96, 0.97), frost);
        float frostR = frost;`,
      )
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n        roughnessFactor = mix(roughnessFactor, 0.9, frostR);");
  };
  return m;
}

/** Dune heights in world space: a slope rising at the left behind the aperture, long dunes falling to the right far off. */
function duneHeight(x: number, z: number) {
  // the shoreline on the left, receding behind the sandbar on the right
  const shoreZ = -1.35 + 0.06 * Math.sin(x * 1.3) - 0.3 * ss(-1.4, 0.4, x);
  const bank = ss(shoreZ + 0.06, shoreZ - 1.7, z) * (0.26 + 0.06 * fbm(x * 0.6, 7.0, z * 0.6)) * ss(0.8, -0.6, x);
  const base = FLOOR_Y - 0.06 + bank;
  // the slope behind the scrub, falling from the back left into the middle
  const across = x + 0.32 * (z + 2.0);
  const drift = 1.35 * Math.pow(ss(-0.4, -6.5, across), 1.5) * ss(-1.7, -3.4, z);
  // a smooth dune profile: long gentle windward side, steeper lee, soft crest
  const dune = (u: number) => {
    const f = u - Math.floor(u);
    return f < 0.7 ? Math.sin((f / 0.7) * Math.PI * 0.5) ** 2 : Math.cos(((f - 0.7) / 0.3) * Math.PI * 0.5) ** 2;
  };
  // rows of dunes running across the view, each row a little higher and hazier
  const w1 = fbm(x * 0.05, 1.0, z * 0.05);
  const row1 = ss(-3.2, -6.5, z) * dune((z + 3.2) / -7 + x * 0.012 + w1 * 0.3) * (0.75 + 0.35 * fbm(x * 0.09, 2.0, 0)) * 0.95;
  const row2 = ss(-8, -12, z) * dune((z + 8) / -9 - x * 0.01 + w1 * 0.35 + 0.3) * 1.25;
  const swell = ss(-6, -14, z) * (0.7 + 0.6 * fbm(x * 0.04, 3.0, z * 0.04));
  // the right side climbs toward the far right edge
  const right = ss(2.5, 14, x) * ss(-4, -10, z) * 1.5;
  const ripple = Math.sin((x * 0.6 - z * 2.2) * 6 + fbm(x * 0.5, 0, z * 0.5) * 4) * 0.004 * ss(-2.5, -5, z);
  return base + drift + row1 + row2 + swell + right + ripple;
}

const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`;

/** The ice body: refractive, its roughness and normals broken up by frost in object space. */
function frostIce(mat: THREE.MeshPhysicalMaterial) {
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vObj;\n${NOISE_GLSL}`)
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        float fLow = snoise(vObj * 1.6 + 4.0);
        float fMid = snoise(vObj * 6.5);
        float fHi = snoise(vObj * 24.0);
        float crust = smoothstep(0.2, 0.9, fLow * 0.5 + (vObj.y - 2.6) * 0.5 + fMid * 0.2);
        float veins = smoothstep(0.3, 0.9, snoise(vObj * vec3(3.2, 1.6, 3.2) + 9.0));
        float coreWin = exp(-pow((vObj.y - 1.31) / 0.8, 2.0));
        roughnessFactor = clamp(mix(0.28 + crust * 0.4 + veins * 0.25, 0.07, coreWin * 0.85) + fMid * 0.06 + fHi * 0.05, 0.05, 1.0);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        float fMid2 = snoise(vObj.zxy * 6.5 + 17.3);
        vec3 pert = vec3(fMid, fMid2, fLow * 0.6 - fMid * 0.4) * (0.022 + crust * 0.04)
                  + vec3(fHi, -fHi * 0.6 + fMid2 * 0.3, 0.0) * (0.012 + crust * 0.05);
        normal = normalize(normal + pert);`,
      );
  };
  return mat;
}

/** Milky frost over the ice: a crust toward the crown, white veins gathered in the middle crevices, rime on the edges. */
function frostShell() {
  const m = new THREE.MeshStandardMaterial({ color: C("#ECEEF0"), roughness: 0.95, transparent: true, depthWrite: false });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vObj;\n${NOISE_GLSL}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float shade = snoise(vObj * 3.0 + 7.0) * 0.5 + 0.5;
        diffuseColor.rgb = mix(vec3(0.769, 0.792, 0.816), vec3(0.925, 0.933, 0.941), smoothstep(0.2, 0.8, shade));`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        float n6 = snoise(vObj * 6.0);
        float crustA = smoothstep(0.0, 0.3, snoise(vObj * 1.8 + 2.0) * 0.45 + n6 * 0.25 + (vObj.y - 2.5) * 0.7 + vObj.x * 0.35);
        // veins gather around the middle of the spire, in the crevices
        float band = exp(-pow((vObj.y - 2.4) / 1.2, 2.0)) * (1.0 - exp(-pow((vObj.y - 1.31) / 0.6, 2.0)) * 0.8);
        float cloud = smoothstep(0.15, 0.85, snoise(vObj * vec3(1.9, 1.1, 1.9) + 3.0) * 0.6 + snoise(vObj * 5.0) * 0.25 + 0.2);
        float vein = cloud * (0.25 + band * 0.35) * (1.0 - smoothstep(1.2, 2.3, length(vObj.xz) * 0.0 + abs(vObj.y - 1.31)) * 0.55);
        float smoke = smoothstep(0.1, 0.7, snoise(vObj * vec3(1.6, 0.8, 1.6) + 11.0)) * (0.15 + band * 0.35) * (1.0 - exp(-pow((vObj.y - 1.31) / 0.7, 2.0)) * 0.9);
        float rimF = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.2);
        float grains = smoothstep(0.74, 0.9, snoise(vObj * 55.0)) * 0.35;
        // rime: clumps of crystals, gathered where a slow mask allows, broken up by fine noise
        float rimeMask = smoothstep(0.1, 0.55, snoise(vObj * 1.4 + 8.0) + rimF * 0.6 + max(vObj.y - 2.8, 0.0) * 0.5);
        float win = exp(-pow((vObj.y - 1.38) / 1.05, 2.0)) * smoothstep(-0.2, 0.5, normal.z);
        float crack = rimeMask * smoothstep(-0.05, 0.35, snoise(vObj * 14.0) * 0.6 + snoise(vObj * 38.0) * 0.4) * 0.75 * (1.0 - win * 0.92);
        float foot = smoothstep(0.5, 0.0, vObj.y) * 0.6;
        float veil = (0.06 + (snoise(vObj * 1.2 + 3.0) * 0.5 + 0.5) * 0.1) * (1.0 - exp(-pow((vObj.y - 1.31) / 0.75, 2.0)) * 0.95);
        diffuseColor.a *= clamp((max(max(crustA * 0.9, veil), smoke * 0.7) + vein * 0.6 + grains) * (1.0 - win * 0.9) + rimF * 0.35 + foot + crack, 0.0, 0.92);`,
      );
  };
  return m;
}

/** Air and frost crystals trapped in the ice, round opaque points so the refraction pass sees them. */
function bubbles(count: number) {
  const r = rng(31);
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const nearCore = r() < 0.5;
    const rad = nearCore ? 0.62 + r() * 0.3 : 0.75 + r() * 0.45;
    const th = r() * Math.PI * 2, ph = Math.acos(r() * 2 - 1);
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * rad * 0.85;
    pos[i * 3 + 1] = Math.cos(ph) * rad * (nearCore ? 1.1 : 2.2);
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * rad * 0.65;
    size[i] = r() < 0.05 ? 4 + r() * 4 : 1.0 + r() * 2.2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("size", new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float size; uniform float uScale; uniform float uTime;
      void main(){
        vec3 p = position;
        p.y += sin(uTime * 0.3 + position.x * 7.0) * 0.005;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = size * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      void main(){
        vec2 c = gl_PointCoord - 0.5; float d = length(c);
        if (d > 0.5) discard;
        float rim = smoothstep(0.22, 0.48, d);
        gl_FragColor = vec4(mix(vec3(0.62,0.61,0.68), vec3(0.93,0.93,0.96), rim), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Points(g, m);
}

/** Fine grain for the frosted half of the sphere. */
/** Pitted mineral stone: fine grain, soft mottling and small pits with raised rims, for bump and roughness. */
function grainTexture() {
  const S = 512;
  const f = new Float32Array(S * S);
  const r = rng(77);
  for (let i = 0; i < S * S; i++) {
    const x = i % S, y = (i / S) | 0;
    f[i] = 0.5 + (r() - 0.5) * 0.3 + vnoise(x * 0.04, y * 0.04, 0) * 0.12 + vnoise(x * 0.2, y * 0.2, 3) * 0.06;
  }
  for (let k = 0; k < 900; k++) {
    const cx = r() * S, cy = r() * S, rad = 0.6 + r() * r() * 3.2;
    for (let dy = -Math.ceil(rad * 1.6); dy <= rad * 1.6; dy++)
      for (let dx = -Math.ceil(rad * 1.6); dx <= rad * 1.6; dx++) {
        const d = Math.hypot(dx, dy) / rad;
        const xx = (Math.round(cx + dx) + S) % S, yy = (Math.round(cy + dy) + S) % S;
        f[yy * S + xx] += d < 1 ? -0.45 * (1 - d * d) : d < 1.5 ? 0.12 * (1 - (d - 1) / 0.5) : 0;
      }
  }
  const data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    const v = Math.max(0, Math.min(255, Math.round(f[i] * 255)));
    data.set([v, v, v, 255], i * 4);
  }
  const t = new THREE.DataTexture(data, S, S);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  t.needsUpdate = true;
  return t;
}

/** Matte granular sand: tone from world-space noise, a fine grain, and a rare sparkle. */
/** The main scene target. Sand drawn anywhere else (the mirror, the ice's refraction) takes a cheap path. */
const MAIN_TARGET: { rt: THREE.WebGLRenderTarget | null } = { rt: null };

function sandMaterial(lo: string, hi: string, opts: { vertical?: [string, string, number, number]; streaks?: number; ripples?: number; orb?: THREE.Vector4 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: C("#ffffff"), roughness: 0.92, metalness: 0 });
  const lod = { value: 0 };
  m.onBeforeRender = (r) => {
    lod.value = r.getRenderTarget() === MAIN_TARGET.rt ? 0 : 1;
  };
  m.onBeforeCompile = (s) => {
    s.uniforms.uLod = lod;
    s.uniforms.uLo = { value: C(lo) };
    s.uniforms.uHi = { value: C(hi) };
    s.uniforms.uVa = { value: C(opts.vertical?.[0] ?? lo) };
    s.uniforms.uVb = { value: C(opts.vertical?.[1] ?? hi) };
    s.uniforms.uVr = { value: new THREE.Vector2(opts.vertical?.[2] ?? 0, opts.vertical?.[3] ?? 0) };
    s.uniforms.uSt = { value: opts.streaks ?? 0 };
    s.uniforms.uRp = { value: opts.ripples ?? 0 };
    s.uniforms.uClock = SCENE_TIME;
    s.uniforms.uOrb = { value: opts.orb ?? new THREE.Vector4(0, -99, 0, 0.001) };
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vW;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vW; uniform vec3 uLo, uHi, uVa, uVb; uniform vec2 uVr; uniform float uSt, uRp, uClock, uLod; uniform vec4 uOrb;\n${NOISE_GLSL}
float rippleH(vec2 p){
  // wind ripples: crests run roughly along x, wavelength ~9cm, bent and broken by noise, steep lee side
  float warp = snoise(vec3(p * 0.9, 1.3)) * 1.6 + snoise(vec3(p * 3.0, 4.1)) * 0.35;
  float u = (p.y * 0.96 + p.x * 0.28) * 11.0 + warp;
  float f = fract(u);
  float h = f < 0.72 ? smoothstep(0.0, 0.72, f) : 1.0 - smoothstep(0.72, 1.0, f);
  float breakup = smoothstep(-0.35, 0.45, snoise(vec3(p * 1.7, 7.0)));
  return h * breakup;
}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float tone = snoise(vW * 0.12) * 0.25 + 0.5;
        vec3 sand = mix(uLo, uHi, smoothstep(0.15, 0.95, tone));
        if (uVr.y > uVr.x) sand = mix(uVa, uVb, smoothstep(uVr.x, uVr.y, vW.y + snoise(vW * 3.0) * 0.03));
        float grain = hash12(floor(vW.xz * 260.0) + floor(vW.y * 260.0)) - 0.5;
        sand *= 1.0 + grain * 0.07;
        // wind streaks: long horizontal bands, strongest far off
        if (uLod < 0.5) sand *= 1.0 + uSt * (snoise(vec3(vW.x * 0.03, vW.y * 7.0, vW.z * 0.25)) * 0.05 + snoise(vec3(vW.x * 0.08, vW.y * 22.0, vW.z * 0.9)) * 0.025) * smoothstep(-2.0, -9.0, vW.z);
        // patchy tone: sun-bleached crests, darker damp hollows, a few coarse grains of other minerals
        if (uLod < 0.5) sand *= 1.0 + uRp * (snoise(vW * 1.4) * 0.05 + snoise(vW * 6.0) * 0.025);
        float camD = length(vW - cameraPosition);
        float rpc = uRp > 0.0 && uLod < 0.5 && camD < 22.0 ? mix(rippleH(vW.xz), 0.5, smoothstep(14.0, 22.0, camD)) : 0.5;
        sand *= 1.0 + uRp * (rpc - 0.5) * 0.12;
        float coarse = hash12(floor(vW.xz * 520.0) + 3.0);
        float pd = 1.0 - smoothstep(3.0, 8.0, length(vW - cameraPosition));
        sand = mix(sand, sand * vec3(0.8, 0.76, 0.72), uRp * pd * step(0.993, coarse));
        sand = mix(sand, min(sand * 1.12, vec3(1.0)), uRp * pd * step(0.993, hash12(floor(vW.xz * 520.0) + 11.0)));
        float wet = smoothstep(${(FLOOR_Y + 0.035).toFixed(3)}, ${(FLOOR_Y - 0.005).toFixed(3)}, vW.y);
        sand = mix(sand, sand * vec3(0.46, 0.37, 0.3), wet);
        // shadows of high thin clouds sliding slowly over the dunes, cooler in the shade
        vec2 cp = vW.xz * vec2(0.07, 0.11) - vec2(uClock * 0.018, uClock * 0.004);
        float cloud = smoothstep(0.05, 0.6, snoise(vec3(cp, uClock * 0.01)) * 0.7 + snoise(vec3(cp * 2.3, 3.0)) * 0.3);
        sand *= mix(vec3(1.0), vec3(0.86, 0.87, 0.9), cloud * 0.8);
        // contact shadow of the resting sphere: tight dark ring at the base, soft cast toward the right (away from the key light)
        vec2 od = vW.xz - uOrb.xz;
        float near = smoothstep(uOrb.w * 1.9, uOrb.w * 0.6, length(od));
        float castSh = exp(-pow((od.x - uOrb.w * 0.9) / (uOrb.w * 1.5), 2.0) - pow(od.y / (uOrb.w * 0.85), 2.0));
        sand *= 1.0 - near * near * 0.55 - castSh * 0.32;
        diffuseColor.rgb = sand;`,
      )
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n        roughnessFactor = mix(roughnessFactor, 0.22, wet);")
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        float rfade = 1.0 - smoothstep(6.0, 16.0, length(vW - cameraPosition));
        if (uRp > 0.0 && uLod < 0.5 && rfade > 0.0) {
          // ripple and grain relief, by finite differences in world space, faded with distance to avoid shimmer
          float e = 0.006;
          float h0 = rippleH(vW.xz);
          vec2 g = vec2(rippleH(vW.xz + vec2(e, 0.0)) - h0, rippleH(vW.xz + vec2(0.0, e)) - h0) / e * 0.008;
          g += vec2(snoise(vW * 140.0), snoise(vW * 140.0 + 9.0)) * 0.035;
          float fade = rfade;
          vec3 wn = normalize(vec3(-g.x, 1.0, -g.y));
          vec3 vn = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
          vec3 up = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          normal = normalize(normal + (vn - up) * uRp * fade);
        }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float sp = step(0.9985, hash12(floor(vW.xz * 420.0) + 7.0));
        totalEmissiveRadiance += vec3(sp) * 0.08;`,
      );
  };
  return m;
}

/** Feathery dry foliage: fine strokes fanning from a centre, warm amber, softened as if slightly out of focus. */
function featherTexture() {
  const S = 256;
  const raw = document.createElement("canvas");
  raw.width = raw.height = S;
  const x = raw.getContext("2d")!;
  const r = rng(5);
  const tones = [[168, 119, 73], [194, 149, 104], [140, 94, 54]];
  for (let i = 0; i < 380; i++) {
    const a = r() * Math.PI * 2;
    const d0 = r() * S * 0.12, d1 = d0 + S * (0.06 + r() * 0.26) * (0.6 + 0.4 * Math.abs(Math.sin(a * 2.3)));
    const t = tones[Math.floor(r() * tones.length)];
    x.strokeStyle = `rgba(${t[0]},${t[1]},${t[2]},${0.05 + r() * 0.14})`;
    x.lineWidth = 0.5 + r() * 0.9;
    x.beginPath();
    x.moveTo(S / 2 + Math.cos(a) * d0, S / 2 + Math.sin(a) * d0);
    x.quadraticCurveTo(S / 2 + Math.cos(a + 0.3) * (d0 + d1) / 2, S / 2 + Math.sin(a + 0.3) * (d0 + d1) / 2, S / 2 + Math.cos(a) * d1, S / 2 + Math.sin(a) * d1);
    x.stroke();
  }
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const o = cv.getContext("2d")!;
  o.filter = "blur(1.6px)";
  o.drawImage(raw, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft dark blob for contact shadows. */
function shadowTexture() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const x = cv.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.75)");
  g.addColorStop(0.5, "rgba(0,0,0,0.3)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

/** Wind: tips sway with the square of their height above the sand. */
const WIND_GLSL = /* glsl */ `
const vec2 WDIR = vec2(0.97, 0.24);
// gust strength at a point: slow swells rolling downwind, with quicker flurries riding on them
float gustAt(vec2 p, float t){
  float x = dot(p, WDIR);
  float g = 0.5 + 0.28 * sin(t * 0.41 - x * 0.75) + 0.16 * sin(t * 1.07 - x * 1.9 + 1.3) + 0.08 * sin(t * 2.6 - x * 3.4 + 0.4);
  return max(g, 0.06);
}`;

/**
 * Wind on the scrub, in three layers: the whole bush bends downwind with the gusts (bend grows with the square of
 * height, length roughly kept), each branch swings on its own phase about where it starts, and the foliage flutters.
 */
function windSway(mat: THREE.Material, uTime: { value: number }, flutter: number) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = uTime;
    s.vertexShader = s.vertexShader
      .replace("#include <common>", `#include <common>\nuniform float uTime; attribute vec3 aRoot; attribute vec4 aBr;\n${WIND_GLSL}`)
      .replace(
        "#include <project_vertex>",
        `vec4 wp = modelMatrix * vec4(transformed, 1.0);
        float t = uTime;
        vec3 W = vec3(WDIR.x, 0.0, WDIR.y);
        float g = gustAt(aRoot.xz, t);
        float h = max(wp.y - aRoot.y, 0.0);
        float ph = dot(aRoot, vec3(3.1, 1.7, 2.3));
        // trunk: lean downwind with the gust, a slow rocking on top
        float bend = h * h * (0.05 * g + 0.012 * sin(t * 1.35 + ph));
        vec3 off = W * bend;
        off.y -= bend * bend / (h + 0.08) * 0.5;
        // branch: swings about its own start, faster and freer the finer it is
        float d = length(wp.xyz - aBr.xyz);
        float bph = dot(aBr.xyz, vec3(17.3, 9.1, 13.7));
        float bs = d * (0.04 + 0.025 * aBr.w) * (0.35 + g) * sin(t * (1.9 + aBr.w * 0.55) + bph);
        vec3 side = normalize(vec3(-W.z, 0.3, W.x));
        off += side * bs + W * abs(bs) * 0.6;
        // foliage: quick small flutter, stronger in a gust
        float fph = dot(wp.xyz, vec3(41.0, 29.0, 37.0));
        off += ${flutter.toFixed(4)} * (0.4 + g) * vec3(sin(t * 8.3 + fph), sin(t * 10.7 + fph * 1.3) * 0.6, sin(t * 7.1 + fph * 0.7));
        wp.xyz += off;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
}


// ---------- scene ----------
export type GemScene = ReturnType<typeof createGemScene>;

export function createGemScene(canvas: HTMLCanvasElement, opts: { reduced?: boolean; onFirstFrame?: () => void } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", alpha: false });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  let dprCap = Math.min(window.devicePixelRatio || 1, 1.25);
  renderer.setPixelRatio(dprCap);

  const scene = new THREE.Scene();
  const FOG = C("#D5D3CE");
  scene.fog = new THREE.FogExp2(FOG, 0.03);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 160);
  const uTime = { value: 0 };

  // ---- sky: silver-grey, lighter centre-left, darker upper-right, melting into the fog at the horizon
  const skyMat = () =>
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { a: { value: C("#DEDCD8") }, b: { value: C("#AEB4BA") }, fogC: { value: FOG }, glow: { value: C("#eeece8") } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 a, b, fogC, glow; varying vec3 vP;
        void main(){
          float t = smoothstep(0.02, 0.55, vP.y);
          vec3 c = mix(a, b, t);
          float g = pow(max(dot(vP, normalize(vec3(0.1, 0.06, -1.0))), 0.0), 6.0);
          c = mix(c, glow, g * 0.7);
          c = mix(fogC, c, smoothstep(-0.02, 0.22, vP.y));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 24), skyMat());
  sky.frustumCulled = false;
  scene.add(sky);

  // ---- environment light for reflections: the same sky over a sand-coloured ground, a soft bright panel upper left
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat()));
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(9.5, 48), new THREE.MeshBasicMaterial({ color: C("#a8927a"), side: THREE.DoubleSide }));
  envGround.rotation.x = -Math.PI / 2;
  envGround.position.y = -0.6;
  envScene.add(envGround);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ color: C("#ffffff"), side: THREE.DoubleSide }));
  panel.position.set(-5, 5, 3);
  panel.lookAt(0, 0, 0);
  envScene.add(panel);
  const env = pmrem.fromScene(envScene, 0.03).texture;
  scene.environment = env;

  // ---- dunes: one heightfield, matte pale sand
  const duneGeo = new THREE.PlaneGeometry(80, 52, 560, 330);
  duneGeo.rotateX(-Math.PI / 2);
  duneGeo.translate(0, 0, -25);
  {
    const p = duneGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, duneHeight(p.getX(i), p.getZ(i)));
    duneGeo.computeVertexNormals();
  }
  const dunes = new THREE.Mesh(duneGeo, sandMaterial("#C9BCAE", "#DDD5CA", { streaks: 1 }));
  scene.add(dunes);

  // ---- the sandbar on the right: a gently sloping sunlit top, a crisp front edge, a dark wet foot in the water
  const barGeo = new THREE.PlaneGeometry(10.4, 4.2, 520, 168);
  barGeo.rotateX(-Math.PI / 2);
  barGeo.translate(4.6, 0, -3.0);
  const barHeight = (x: number, z: number) => {
    const zf = -1.3 - 0.1 * ss(-0.6, 4.0, x) + fbm(x * 0.4, 5.0, 0) * 0.05; // the front edge
    const front = ss(zf + 0.01, zf - 0.07 - 0.5 * ss(0.6, -0.6, x), z);
    const leftEnd = ss(-0.6, 0.3, x + (zf - z) * 0.35) * (0.35 + 0.65 * ss(-0.2, 1.4, x));
    // a soft rounded lip, then a long low top with broad wind-blown undulation
    const top = 0.06 + 0.07 * Math.max(0, zf - z) + 0.03 * ss(0, 14, x) + fbm(x * 0.9, 6.0, z * 0.9) * 0.018 + fbm(x * 3.1, 1.0, z * 3.1) * 0.004;
    return FLOOR_Y - 0.03 + front * leftEnd * (top + 0.03);
  };
  {
    const p = barGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, barHeight(p.getX(i), p.getZ(i)));
    barGeo.computeVertexNormals();
  }
  // the far sphere sits in the sand on the bar, sunk a little
  {
    const ox = 3.55, oz = -2.05, rr = 0.23;
    ORB_REST.set(ox, barHeight(ox, oz) + rr * 0.9, oz, rr);
  }
  const terrace = new THREE.Mesh(barGeo, sandMaterial("#B08F6E", "#CDB08F", { vertical: ["#8B6644", "#C8AB8A", FLOOR_Y + 0.02, FLOOR_Y + 0.2], ripples: 1, orb: ORB_REST }));
  scene.add(terrace);
  const shadowTex = shadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, color: C("#2a1a10"), opacity: 0.9 });
  const addShadow = (x: number, z: number, sx: number, sz: number, o = 1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), shadowMat.clone());
    (m.material as THREE.MeshBasicMaterial).opacity = 0.9 * o;
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, FLOOR_Y + 0.004, z);
    m.renderOrder = 1;
    scene.add(m);
    return m;
  };
  addShadow(4.9, -1.05, 10.2, 0.32, 0.8);

  // ---- the wet mirror floor: reflection rendered, blurred, mixed over an earthy base
  const reflectRes = () => [Math.round((window.innerWidth * dprCap) / 3), Math.round((window.innerHeight * dprCap) / 3)];
  const [rw, rh] = reflectRes();
  const floor = new Reflector(new THREE.PlaneGeometry(200, 200), {
    textureWidth: rw,
    textureHeight: rh,
    clipBias: 0.003,
    shader: {
      name: "WetMirror",
      uniforms: {
        color: { value: null },
        tDiffuse: { value: null },
        tBlur: { value: null },
        textureMatrix: { value: null },
        baseA: { value: C("#8d8178") },
        baseB: { value: C("#b8aea4") },
        fogC: { value: FOG },
        fogD: { value: 0.03 },
        mirror: { value: 0.9 },
        mixBlur: { value: 0.45 },
        mixStrength: { value: 1.6 },
        uT: { value: 0 },
      },
      vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
        void main(){ vUv = textureMatrix * vec4(position,1.0); vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D tDiffuse, tBlur; uniform vec3 baseA, baseB, fogC; uniform float fogD, mirror, mixBlur, mixStrength, uT; varying vec4 vUv; varying vec3 vW;
        ${NOISE_GLSL}
        ${WIND_GLSL}
        // slope of the water surface: four wind-driven wave trains plus a little noise chop
        vec2 waveGrad(vec2 p, float t){
          vec2 g = vec2(0.0);
          vec2 d1 = normalize(vec2(0.18, 1.0)); g += d1 * cos(dot(p, d1) * 9.0 - t * 1.25) * 0.0105;
          vec2 d2 = normalize(vec2(-0.35, 1.0)); g += d2 * cos(dot(p, d2) * 15.0 - t * 1.8 + 1.7) * 0.0095;
          vec2 d3 = normalize(vec2(0.65, 1.0)); g += d3 * cos(dot(p, d3) * 24.0 - t * 2.35 + 0.5) * 0.0085;
          vec2 d4 = normalize(vec2(1.0, 0.25)); g += d4 * cos(dot(p, d4) * 33.0 - t * 2.9 + 2.2) * 0.007;
          float e = 0.015;
          vec3 q = vec3(p * 3.5, t * 0.35);
          float h0 = snoise(q);
          g += vec2(snoise(q + vec3(e * 3.5, 0.0, 0.0)) - h0, snoise(q + vec3(0.0, e * 3.5, 0.0)) - h0) / e * 0.0028;
          return g;
        }
        void main(){
          float n = snoise(vec3(vW.xz * 0.8, 0.0));
          float n2 = snoise(vec3(vW.xz * 4.0, 3.0));
          vec2 uv = vUv.xy / vUv.w;
          float dist = length(vW.xz - cameraPosition.xz);
          // ripples: rougher where a gust touches the water, fading out far off where they would only shimmer
          float gust = gustAt(vW.xz, uT);
          vec2 g = waveGrad(vW.xz, uT) * (0.45 + 0.75 * gust) * (1.0 - smoothstep(9.0, 26.0, dist));
          vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
          // the reflection is bent by the slope, stretched more vertically, as on real water
          uv += vec2(N.x * 0.22, N.z * 0.42) + vec2(n2 * 0.0008, n * 0.0015);
          vec3 sharp = texture2D(tDiffuse, uv).rgb;
          vec3 soft = texture2D(tBlur, uv).rgb;
          float rough = clamp(mixBlur * 0.5 + n * 0.12 + length(g) * 4.0, 0.0, 1.0);
          vec3 refl = mix(sharp, soft, rough);
          // what lies under a shallow film: wet sand, darker in the hollows
          vec3 V = normalize(cameraPosition - vW);
          vec3 base = mix(baseA, baseB, smoothstep(-0.4, 0.6, n) * 0.7 + smoothstep(2.0, 12.0, dist) * 0.3);
          base *= 0.92 + snoise(vec3(vW.xz * 9.0, 1.0)) * 0.05;
          // Fresnel: more see-through looking down near the camera, a mirror toward the horizon
          float cosT = clamp(dot(V, N), 0.0, 1.0);
          float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
          float fres = mirror * clamp(mix(0.6, 1.0, F * 1.6), 0.0, 1.0);
          vec3 c = base * (1.0 - fres) + refl * fres * mixStrength * 0.68;
          // sky caught on the faces tilted toward the light
          c += vec3(0.9, 0.89, 0.86) * pow(clamp(N.x * -6.0 + N.z * 2.0, 0.0, 1.0), 3.0) * 0.06 * fres;
          float f = 1.0 - exp(-pow(fogD * dist, 2.0));
          c = mix(c, fogC, f);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    },
  });
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  scene.add(floor);

  // separable blur of the reflection: wider vertically, which streaks it like wet sand
  const rtOpts = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace } as const;
  const blurA = new THREE.WebGLRenderTarget(rw, rh, rtOpts);
  const blurB = new THREE.WebGLRenderTarget(rw, rh, rtOpts);
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tIn: { value: null }, dir: { value: new THREE.Vector2() } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tIn; uniform vec2 dir; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tIn, vUv) * 0.2270270270;
        c += (texture2D(tIn, vUv + dir * 1.3846153846) + texture2D(tIn, vUv - dir * 1.3846153846)) * 0.3162162162;
        c += (texture2D(tIn, vUv + dir * 3.2307692308) + texture2D(tIn, vUv - dir * 3.2307692308)) * 0.0702702703;
        gl_FragColor = c;
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const floorMat = floor.material as THREE.ShaderMaterial;
  floorMat.uniforms.tBlur.value = blurB.texture;
  function blurPass(src: THREE.Texture, dst: THREE.WebGLRenderTarget, dx: number, dy: number) {
    blurMat.uniforms.tIn.value = src;
    blurMat.uniforms.dir.value.set(dx / dst.width, dy / dst.height);
    renderer.setRenderTarget(dst);
    renderer.render(quadScene, quadCam);
  }

  // ---- the sandstone wall: one wide sweeping arc down the left edge, a thick rounded inner edge
  const wallShape = new THREE.Shape();
  // measured off the target: top edge at 8% of the width, furthest left at 35% height, meeting the sand at 17%
  wallShape.moveTo(-14, -3).lineTo(-1.2, -3).lineTo(-1.5, -2.1);
  wallShape.splineThru(
    [
      [-1.93, -1.68], [-2.39, -1.45], [-2.86, -1.19], [-3.21, -0.87], [-3.44, -0.44], [-3.57, 0.09], [-3.62, 0.62], [-3.46, 1.38], [-3.19, 1.89], [-2.8, 2.5], [-2.4, 3.2],
    ].map(([x, y]) => new THREE.Vector2(x - 0.07, y)),
  );
  wallShape.lineTo(-2.47, 9).lineTo(-14, 9).lineTo(-14, -3);
  let wallGeo: THREE.BufferGeometry = new THREE.ExtrudeGeometry(wallShape, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.09, bevelSegments: 8, curveSegments: 96 });
  wallGeo.deleteAttribute("uv");
  wallGeo.deleteAttribute("normal");
  wallGeo = mergeVertices(wallGeo, 1e-4);
  wallGeo.computeVertexNormals();
  const wallMat = new THREE.MeshStandardMaterial({ color: C("#ffffff"), roughness: 0.9 });
  wallMat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vW; varying vec3 vWN;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);");
    s.fragmentShader = s.fragmentShader.replace("#include <common>", `#include <common>\nvarying vec3 vW; varying vec3 vWN;\n${NOISE_GLSL}`).replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float t = smoothstep(-2.0, 3.0, vW.y);
      vec3 stone = mix(vec3(0.698, 0.655, 0.608), vec3(0.769, 0.725, 0.678), t);
      stone *= 1.0 + snoise(vW * 2.2) * 0.03 + snoise(vW * 14.0) * 0.025 + (fract(sin(dot(floor(vW.xy * 300.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.03;
      // the inner edge catches the light
      float edge = smoothstep(0.15, 0.85, vWN.x);
      diffuseColor.rgb = mix(stone, vec3(0.859, 0.824, 0.780), edge * 0.85);`,
    );
  };
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(0, 0, 0.3);
  scene.add(wall);

  // ---- dry desert scrub: gnarled forking branches, feathery foliage clusters at the tips, swaying
  const branchGeos: THREE.BufferGeometry[] = [];
  const tips: { p: THREE.Vector3; br: THREE.Vector3; depth: number; root: THREE.Vector3 }[] = [];
  {
    const r = rng(91);
    let root = new THREE.Vector3();
    const wood0 = C("#5E3619"), wood1 = C("#7D4B28");
    const wind = new THREE.Vector3(0.12, 0, 0.03);
    const side = new THREE.Vector3();
    const grow = (p0: THREE.Vector3, d: THREE.Vector3, len: number, rad: number, depth: number, maxd: number) => {
      // a crooked branch: four points with sideways kinks
      side.set(-d.y, d.x, (r() - 0.5) * 0.6).normalize();
      const pts = [p0.clone()];
      for (let k = 1; k <= 3; k++) {
        const q = p0.clone().addScaledVector(d, (len * k) / 3);
        q.addScaledVector(side, (r() - 0.5) * len * 0.22).add(new THREE.Vector3(0, 0, (r() - 0.5) * len * 0.15));
        pts.push(q);
      }
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, rad, 5, false);
      tube.deleteAttribute("uv");
      const c = wood0.clone().lerp(wood1, depth / maxd);
      const col = new Float32Array(tube.attributes.position.count * 3);
      for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
      tube.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const nv = tube.attributes.position.count;
      const ar = new Float32Array(nv * 3), ab = new Float32Array(nv * 4);
      for (let i = 0; i < nv; i++) {
        ar.set([root.x, root.y, root.z], i * 3);
        ab.set([p0.x, p0.y, p0.z, depth], i * 4);
      }
      tube.setAttribute("aRoot", new THREE.BufferAttribute(ar, 3));
      tube.setAttribute("aBr", new THREE.BufferAttribute(ab, 4));
      branchGeos.push(tube);
      const end = pts[3];
      if (depth >= 3 && r() < 0.2) tips.push({ p: pts[2].clone(), br: p0.clone(), depth, root: root.clone() });
      if (depth >= maxd) {
        if (r() < 0.8) tips.push({ p: end.clone(), br: p0.clone(), depth, root: root.clone() });
        return;
      }
      const n = r() < 0.4 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 1.2;
        const spread = 0.35 + r() * 0.5;
        const nd = d.clone().multiplyScalar(1 - spread * 0.6).add(new THREE.Vector3(Math.cos(a) * spread, 0, Math.sin(a) * spread * 0.6)).add(wind).normalize();
        if (nd.y < 0.2) nd.y = 0.2;
        grow(end, nd.normalize(), len * (0.7 + r() * 0.2), rad * 0.7, depth + 1, maxd);
      }
    };
    // [x, z, trunks, trunk length, trunk radius, depth]: one tall lacy bush against the wall, two low ones trailing right
    const bushes: [number, number, number, number, number, number][] = [
      [-3.7, -2.15, 6, 0.5, 0.011, 6],
      [-3.05, -2.3, 4, 0.44, 0.009, 6],
      [-4.3, -2.4, 3, 0.4, 0.01, 6],
      [-2.4, -1.8, 7, 0.15, 0.006, 5],
      [-1.85, -1.75, 6, 0.13, 0.005, 5],
      [-1.35, -1.7, 5, 0.11, 0.005, 5],
    ];
    for (const [bx, bz, n, len, rad, depth] of bushes) {
      const gy = duneHeight(bx, bz) - 0.02;
      root = new THREE.Vector3(bx, gy, bz);
      for (let k = 0; k < n; k++) {
        const p0 = new THREE.Vector3(bx + (r() - 0.5) * 0.3, gy, bz + (r() - 0.5) * 0.2);
        const d = new THREE.Vector3((r() - 0.5) * 1.3 + 0.35, 1, (r() - 0.5) * 0.6).normalize();
        grow(p0, d, len * (0.85 + r() * 0.3), rad, 0, depth);
      }
    }
  }
  const twigMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  windSway(twigMat, uTime, 0.0015);
  const twigMesh = new THREE.Mesh(mergeGeometries(branchGeos)!, twigMat);
  scene.add(twigMesh);

  const plumeTex = featherTexture();
  const plumeMat = new THREE.MeshStandardMaterial({ map: plumeTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1, alphaTest: 0.015 });
  windSway(plumeMat, uTime, 0.009);
  const plumeGeos: THREE.BufferGeometry[] = [];
  {
    const r = rng(17);
    for (const tip of tips) {
      if (r() < 0.3) continue;
      const t = tip.p;
      const s = 0.035 + r() * 0.06;
      for (let k = 0; k < 2; k++) {
        const g = new THREE.PlaneGeometry(s * 1.3, s);
        g.rotateZ(r() * Math.PI);
        g.rotateY(k * Math.PI * 0.5 + r() * 0.8);
        g.translate(t.x + (r() - 0.5) * 0.05, t.y + (r() - 0.3) * 0.05, t.z);
        const nv = g.attributes.position.count;
        const ar = new Float32Array(nv * 3), ab = new Float32Array(nv * 4);
        for (let i = 0; i < nv; i++) {
          ar.set([tip.root.x, tip.root.y, tip.root.z], i * 3);
          ab.set([tip.br.x, tip.br.y, tip.br.z, tip.depth + 1], i * 4);
        }
        g.setAttribute("aRoot", new THREE.BufferAttribute(ar, 3));
        g.setAttribute("aBr", new THREE.BufferAttribute(ab, 4));
        plumeGeos.push(g);
      }
    }
  }
  const plumes = new THREE.Mesh(mergeGeometries(plumeGeos)!, plumeMat);
  plumes.renderOrder = 3;
  scene.add(plumes);

  // ---- two spheres: split charcoal and frost on the wet floor at the left; a small dark one far right in the haze
  const ballR = 0.34;
  const grain = grainTexture();
  const ball = new THREE.Group();
  const darkHalf = new THREE.Mesh(
    new THREE.SphereGeometry(ballR, 96, 48, -Math.PI / 2, Math.PI),
    new THREE.MeshPhysicalMaterial({ color: C("#0c0d0f"), roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.15 }),
  );
  // frosted stone: soft broad sheen, and glints from tiny facets that catch the sun as the view moves
  const frostMat = new THREE.MeshPhysicalMaterial({ color: C("#93989C"), roughness: 0.42, bumpMap: grain, bumpScale: 0.3, envMapIntensity: 1.1, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  frostMat.onBeforeCompile = (sh) => {
    sh.uniforms.uSun = { value: new THREE.Vector3(-8, 3.2, 1.5).normalize() };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj; uniform vec3 uSun;\nvec3 h33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }")
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n        float mot = h33(floor(vObj * 60.0)).x;\n        diffuseColor.rgb *= 0.95 + mot * 0.07;\n        float fl = h33(floor(vObj * 420.0) + 3.0).y;\n        diffuseColor.rgb *= fl > 0.9 ? 1.35 : (fl < 0.12 ? 0.7 : 0.97);",
      )
      .replace(
        "#include <opaque_fragment>",
        `vec3 cell = floor(vObj * 700.0);
        vec3 rnd = h33(cell);
        vec3 fn = normalize(normal + (h33(cell + 7.0) - 0.5) * 1.6);
        vec3 Lv = normalize((viewMatrix * vec4(uSun, 0.0)).xyz);
        vec3 Hv = normalize(Lv + normalize(vViewPosition));
        float gl = step(0.965, rnd.x) * pow(max(dot(fn, -Hv * vec3(1.0, 1.0, 1.0)), 0.0), 40.0);
        gl += step(0.965, rnd.x) * pow(max(dot(fn, normalize(Lv - normalize(vViewPosition))), 0.0), 40.0);
        outgoingLight += vec3(1.0, 0.98, 0.94) * gl * 1.6 * max(dot(normal, Lv) * 0.6 + 0.4, 0.0);
        #include <opaque_fragment>`,
      );
  };
  const frostHalf = new THREE.Mesh(new THREE.SphereGeometry(ballR, 96, 48, Math.PI / 2, Math.PI), frostMat);
  // where the sphere enters the water: a thin bright meniscus
  const sink = ballR * 0.84;
  const meniscus = new THREE.Mesh(
    new THREE.TorusGeometry(Math.sqrt(ballR * ballR - sink * sink) + 0.004, 0.007, 8, 96),
    new THREE.MeshPhysicalMaterial({ color: C("#eef1f3"), roughness: 0.05, transparent: true, opacity: 0.75, envMapIntensity: 1.3 }),
  );
  meniscus.rotation.x = Math.PI / 2;
  meniscus.scale.z = 0.45;
  meniscus.position.y = -sink + 0.002;
  ball.add(darkHalf, frostHalf, meniscus);
  ball.position.set(-2.85, FLOOR_Y + ballR * 0.84, 1.45);
  ball.rotation.y = 0.15;
  scene.add(ball);
  addShadow(-2.85, 1.45, 0.95, 0.95, 0.95);
  // the sphere reflects its real surroundings: one cube capture from its centre, with the water stood in by a plain tone
  let ballEnv: THREE.Texture | null = null;
  const captureBallEnv = () => {
    const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    const cube = new THREE.CubeCamera(0.05, 120, rt);
    cube.position.copy(ball.position);
    const stand = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: C("#9c928a"), fog: true }));
    stand.rotation.x = -Math.PI / 2;
    stand.position.y = FLOOR_Y;
    const hidden = [ball, floor];
    hidden.forEach((o) => (o.visible = false));
    scene.add(stand);
    cube.update(renderer, scene);
    scene.remove(stand);
    hidden.forEach((o) => (o.visible = true));
    ballEnv = pmrem.fromCubemap(rt.texture).texture;
    rt.dispose();
    for (const m of [darkHalf.material, frostMat, meniscus.material] as THREE.MeshStandardMaterial[]) {
      m.envMap = ballEnv;
      m.needsUpdate = true;
    }
  };
  const orb = new THREE.Mesh(new THREE.SphereGeometry(ORB_REST.w, 64, 32), new THREE.MeshPhysicalMaterial({ color: C("#1B1D1F"), roughness: 0.3, clearcoat: 0.45, clearcoatRoughness: 0.2 }));
  orb.position.set(ORB_REST.x, ORB_REST.y, ORB_REST.z);
  scene.add(orb);

  // ---- life in the air: sand grains hopping downwind, spindrift off the dune crests, dust motes catching the light
  const drift = (kind: number, count: number, box: [number, number, number, number, number, number], seed: number, size: [number, number], color: string, alpha: number, ground?: (x: number, z: number) => number) => {
    const r = rng(seed);
    const pos = new Float32Array(count * 3), rnd = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const x = box[0] + r() * (box[1] - box[0]), z = box[4] + r() * (box[5] - box[4]);
      pos.set([x, (ground ? ground(x, z) : 0) + box[2] + r() * (box[3] - box[2]), z], i * 3);
      rnd.set([r(), r(), r(), r()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 4));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime, uSpan: { value: box[1] - box[0] }, uX0: { value: box[0] }, uSize: { value: new THREE.Vector2(...size) }, uCol: { value: C(color) }, uA: { value: alpha }, uFog: { value: FOG }, uFogD: { value: 0.03 } },
      vertexShader: /* glsl */ `
        uniform float uTime, uSpan, uX0; uniform vec2 uSize; attribute vec4 aRnd; varying float vA; varying float vFog;
        ${WIND_GLSL}
        void main(){
          vec3 p = position;
          float t = uTime;
          float g = gustAt(p.xz, t);
          ${kind === 0 ? `
          // saltation: grains leap in low arcs downwind, only when the gust is strong enough to lift them
          float speed = 0.9 + aRnd.x * 0.8;
          float travel = t * speed * (0.5 + g) + aRnd.y * uSpan;
          p.x = uX0 + mod(p.x - uX0 + travel, uSpan);
          p.z += travel * WDIR.y * 0.25;
          float hop = fract(t * (1.4 + aRnd.z * 1.2) + aRnd.w);
          p.y += sin(hop * 3.14159) * (0.03 + aRnd.z * 0.09) * g;
          float lift = smoothstep(0.42, 0.75, g);
          vA = lift * (0.4 + 0.6 * aRnd.w);
          ` : kind === 1 ? `
          // spindrift: a thin veil streaming off the crests, rising and thinning as it goes
          float life = fract(t * (0.12 + aRnd.x * 0.1) + aRnd.y);
          p.x += life * (1.6 + aRnd.z) * (0.6 + g);
          p.y += life * 0.35 + sin(life * 9.0 + aRnd.w * 6.0) * 0.03;
          p.z += life * 0.3;
          vA = sin(life * 3.14159) * smoothstep(0.45, 0.85, g);
          ` : `
          // motes: drift slowly downwind, wander, swirl a little in the gusts
          float travel = t * (0.05 + aRnd.x * 0.06) * (0.6 + g);
          p.x = uX0 + mod(p.x - uX0 + travel + aRnd.y * uSpan, uSpan);
          p.y += sin(t * (0.3 + aRnd.z * 0.4) + aRnd.w * 6.28) * 0.12;
          p.z += cos(t * (0.25 + aRnd.x * 0.3) + aRnd.y * 6.28) * 0.12;
          vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(t * (0.8 + aRnd.z) + aRnd.w * 6.28));
          `}
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = mix(uSize.x, uSize.y, aRnd.z) * 300.0 / -mv.z;
          float d = -mv.z;
          vFog = 1.0 - exp(-pow(0.03 * d, 2.0));
          // fade the wrap seam at both ends
          vA *= smoothstep(0.0, 0.08, (p.x - uX0) / uSpan) * smoothstep(1.0, 0.92, (p.x - uX0) / uSpan);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol, uFog; uniform float uA; varying float vA; varying float vFog;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, ${kind === 2 ? "0.0" : "0.15"}, d) * vA * uA;
          if (a < 0.003) discard;
          gl_FragColor = vec4(mix(uCol, uFog, vFog * 0.7), a);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    pts.renderOrder = 5;
    scene.add(pts);
    return pts;
  };
  drift(0, 1600, [0.4, 7.5, 0.0, 0.01, -3.4, -1.7], 401, [0.004, 0.009], "#C8AA88", 0.85, barHeight); // over the sandbar
  drift(0, 700, [-2.3, 0.2, 0.0, 0.01, -2.4, -1.6], 402, [0.004, 0.008], "#DCD2C4", 0.7, duneHeight); // over the left bank
  drift(1, 700, [-3.0, 9.0, 0.0, 0.12, -9.0, -6.0], 403, [0.02, 0.06], "#E6E0D7", 0.22, duneHeight); // off the far crests
  drift(2, 260, [-4.5, 6.0, -1.7, 1.2, -3.5, 2.5], 404, [0.006, 0.016], "#FFF8EE", 0.55); // motes

  // ---- the ice spire
  const spire = new THREE.Group();
  spire.position.copy(SPIRE_BASE);
  spire.rotation.z = SPIRE_LEAN;
  const SHOW_ICE = true;
  spire.visible = SHOW_ICE;
  scene.add(spire);
  const iceGeo = spireGeometry();
  const iceMat = frostIce(
    new THREE.MeshPhysicalMaterial({
      color: C("#ffffff"),
      transmission: 1,
      roughness: 0.1,
      thickness: 1.2,
      ior: 1.33,
      attenuationColor: C("#cfcfdc"),
      attenuationDistance: 4.5,
      specularIntensity: 0.7,
      envMapIntensity: 0.6,
    }),
  );
  const ice = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(iceGeo, iceMat);
    spire.add(ice);
  const rime = new THREE.Mesh(iceGeo, frostShell());
    rime.scale.setScalar(1.004);
  rime.renderOrder = 2;
  spire.add(rime);
  const iceCheap = new THREE.MeshStandardMaterial({ color: C("#dfe2e6"), roughness: 0.4, transparent: true, opacity: 0.7 });
  addShadow(SPIRE_BASE.x, 0.05, 1.6, 1.1, 0.6).visible = SHOW_ICE;

  const core = new THREE.Mesh(coreGeometry(), terracottaFrost());
  core.position.copy(CORE_LOCAL);
  core.scale.setScalar(0.8);
  spire.add(core);
  const coreLight = new THREE.PointLight(C("#D46635"), 0.7, 2.6, 2);
  coreLight.position.copy(CORE_LOCAL);
  spire.add(coreLight);
  const air = bubbles(1600);
  air.position.set(CORE_LOCAL.x, CORE_LOCAL.y + 0.15, CORE_LOCAL.z);
  spire.add(air);
  const airMat = air.material as THREE.ShaderMaterial;

  // the mirror sees a cheap stone (no second refraction pass), then gets blurred
  // once per frame: the ice's transmission pass draws the floor a second time, which would re-render the mirror
  let inMirror = false;
  let frameNo = 0, reflectedAt = -1;
  const reflectBefore = floor.onBeforeRender.bind(floor);
  floor.onBeforeRender = (...a: Parameters<typeof floor.onBeforeRender>) => {
    if (inMirror || reflectedAt === frameNo) return;
    reflectedAt = frameNo;
    inMirror = true;
    ice.material = iceCheap;
    rime.visible = false;
    plumes.visible = false;
    reflectBefore(...a);
    ice.material = iceMat;
    rime.visible = true;
    plumes.visible = true;
    const prev = renderer.getRenderTarget();
    const src = floor.getRenderTarget().texture;
    blurPass(src, blurA, 1.2, 0);
    blurPass(blurA.texture, blurB, 0, 3.2);
    blurPass(blurB.texture, blurA, 2.2, 0);
    blurPass(blurA.texture, blurB, 0, 6.0);
    renderer.setRenderTarget(prev);
    inMirror = false;
  };

  // ---- light: overcast daylight from the upper left, warm bounce from the sand below
  const key = new THREE.DirectionalLight(C("#fff4e8"), 2.25);
  key.position.set(-8, 3.2, 1.5);
  scene.add(key);
  const bounce = new THREE.DirectionalLight(C("#C89B74"), 0.45);
  bounce.position.set(0.5, -4, 3);
  scene.add(bounce);
  const back = new THREE.DirectionalLight(C("#dfe6ee"), 0.7);
  back.position.set(4, 3, -6);
  scene.add(back);
  scene.add(new THREE.HemisphereLight(C("#d3d6da"), C("#b39a80"), 0.62));

  // ---------- motion ----------
  const cur = { pos: new THREE.Vector3(...POSES.hero.pos), tgt: new THREE.Vector3(...POSES.hero.tgt), fov: 34, roll: 0, veilL: 0.5, veilR: 0.25, orb: 1 };
  const goal = { ...cur, pos: cur.pos.clone(), tgt: cur.tgt.clone() };
  const pointer = new THREE.Vector2();
  const pointerS = new THREE.Vector2();
  // the core turns only with the scroll, in its direction
  let turnGoal = 0, turn = 0;
  let time = 0;
  let w = 1, h = 1;
  let narrow = false;
  let first = true;
  const up = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Vector3();
  const look = new THREE.Matrix4();

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    narrow = w / h < 0.9;
    renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio();
    sceneRT.setSize(Math.round(w * pr), Math.round(h * pr));
    gradeMat.uniforms.uTexel.value.set(1 / Math.round(w * pr), 1 / Math.round(h * pr));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // three sizes the ice's transmission target from camera.viewport (it is otherwise unused for a plain camera):
    // half resolution is plenty behind frosted ice and halves the cost of the second scene pass
    (camera as THREE.PerspectiveCamera & { viewport?: THREE.Vector4 }).viewport = new THREE.Vector4(0, 0, Math.round(w * pr * 0.5), Math.round(h * pr * 0.5));
    const [a, b] = reflectRes();
    floor.getRenderTarget().setSize(a, b);
    blurA.setSize(a, b);
    blurB.setSize(a, b);
    airMat.uniforms.uScale.value = h * renderer.getPixelRatio() * 0.0055;
  }

  function lerpPose(a: Pose, b: Pose, t: number): Pose {
    const L = THREE.MathUtils.lerp;
    return {
      pos: [L(a.pos[0], b.pos[0], t), L(a.pos[1], b.pos[1], t), L(a.pos[2], b.pos[2], t)],
      tgt: [L(a.tgt[0], b.tgt[0], t), L(a.tgt[1], b.tgt[1], t), L(a.tgt[2], b.tgt[2], t)],
      fov: L(a.fov, b.fov, t),
      roll: L(a.roll, b.roll, t),
      spin: 0,
      veilL: L(a.veilL, b.veilL, t),
      veilR: L(a.veilR, b.veilR, t),
      orb: L(a.orb ?? 1, b.orb ?? 1, t),
    };
  }

  /** Phones: step back and centre the spire so the type never sits on it. */
  function fit(p: Pose): Pose {
    if (!narrow) return p;
    return { ...p, pos: [p.pos[0] * 0.5 + 0.2, p.pos[1] + 0.15, p.pos[2] * 1.5], tgt: [p.tgt[0] * 0.3 + 0.2, p.tgt[1] + 0.25, p.tgt[2]], fov: p.fov + 10 };
  }

  function setGoal(p: Pose, snap = false) {
    const f = fit(p);
    goal.pos.set(...f.pos);
    goal.tgt.set(...f.tgt);
    goal.fov = f.fov;
    goal.roll = f.roll;
    goal.veilL = f.veilL;
    goal.veilR = f.veilR;
    goal.orb = f.orb ?? 1;
    if (snap) {
      cur.pos.copy(goal.pos);
      cur.tgt.copy(goal.tgt);
      Object.assign(cur, { fov: goal.fov, roll: goal.roll, veilL: goal.veilL, veilR: goal.veilR, orb: goal.orb });
    }
  }

  // frame pacing: judge the machine during the first seconds (loader and hero, before anyone scrolls), settle on a
  // resolution once, then never resize again, so the picture never pops or stalls mid-scroll
  let slow = 0, sampled = 0, judged = false;
  function adapt(dt: number) {
    if (judged) return;
    sampled += dt;
    if (dt > 1 / 50) slow += dt;
    if (sampled > 2.5) {
      judged = true;
      const r = slow / sampled;
      const next = r > 0.5 ? 0.85 : r > 0.25 ? 1.0 : r > 0.1 ? 1.1 : dprCap;
      if (next < dprCap) {
        dprCap = next;
        renderer.setPixelRatio(dprCap);
        resize();
      }
    }
  }

  // ---- final grade: the scene renders linear into a multisampled target, then one pass tone maps it and sharpens
  // detail, lifts contrast with a gentle S-curve and adds saturation (more where colour is weak, so skin of the
  // sand and clay gets richer without the reds clipping)
  const sceneRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 });
  MAIN_TARGET.rt = sceneRT;
  const gradeMat = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: sceneRT.texture }, uTexel: { value: new THREE.Vector2(1, 1) }, uSharp: { value: 0.55 }, uContrast: { value: 0.38 }, uSat: { value: 1.22 }, uVib: { value: 0.4 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tScene; uniform vec2 uTexel; uniform float uSharp, uContrast, uSat, uVib; varying vec2 vUv;
      vec3 tm(vec3 c){ return clamp(toneMapping(c), 0.0, 1.0); }
      void main(){
        vec3 c = tm(texture2D(tScene, vUv).rgb);
        vec3 n = tm(texture2D(tScene, vUv + vec2(uTexel.x, 0.0)).rgb) + tm(texture2D(tScene, vUv - vec2(uTexel.x, 0.0)).rgb)
               + tm(texture2D(tScene, vUv + vec2(0.0, uTexel.y)).rgb) + tm(texture2D(tScene, vUv - vec2(0.0, uTexel.y)).rgb);
        c = max(c + (c - n * 0.25) * uSharp, 0.0);
        // grade in a perceptual space
        vec3 g = pow(c, vec3(1.0 / 2.2));
        g = mix(g, g * g * (3.0 - 2.0 * g), uContrast);
        float l = dot(g, vec3(0.2126, 0.7152, 0.0722));
        float sat = max(g.r, max(g.g, g.b)) - min(g.r, min(g.g, g.b));
        g = mix(vec3(l), g, uSat + uVib * (1.0 - smoothstep(0.0, 0.35, sat)));
        // dither by half a step of 8-bit output so soft gradients (sky, ice) never band
        g += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        c = pow(clamp(g, 0.0, 1.0), vec3(2.2));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const gradeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), gradeMat);
  gradeQuad.frustumCulled = false;
  const gradeScene = new THREE.Scene();
  gradeScene.add(gradeQuad);

  /** Advance one frame. `visible` false keeps the camera moving but skips the draw (a curtain covers it). */
  function frame(dt: number, visible: boolean) {
    dt = Math.min(dt, 1 / 20);
    time += dt;
    frameNo++;
    const k = 1 - Math.exp(-dt * 2.6);
    cur.pos.lerp(goal.pos, k);
    cur.tgt.lerp(goal.tgt, k);
    cur.fov += (goal.fov - cur.fov) * k;
    cur.roll += (goal.roll - cur.roll) * k;
    cur.veilL += (goal.veilL - cur.veilL) * k;
    cur.veilR += (goal.veilR - cur.veilR) * k;
    cur.orb += (goal.orb - cur.orb) * k;
    turn += (turnGoal - turn) * (1 - Math.exp(-dt * 4));

    if (!opts.reduced) pointerS.lerp(pointer, 1 - Math.exp(-dt * 3));
    const ct = opts.reduced ? 0 : time;
    core.rotation.set(Math.sin(ct * 0.4) * 0.35 + turn * 0.55, Math.sin(ct * 0.3) * 0.5 + turn * 1.2, ct * 0.3 + turn * 0.6);
    airMat.uniforms.uTime.value = time;
    orb.scale.setScalar(Math.max(cur.orb, 0.001));
    orb.visible = cur.orb > 0.01;
    uTime.value = opts.reduced ? 0 : time;
    SCENE_TIME.value = uTime.value;
    floorMat.uniforms.uT.value = uTime.value;

    tmp.copy(cur.pos).sub(cur.tgt);
    const dist = tmp.length();
    tmp.applyAxisAngle(up, -pointerS.x * 0.035);
    tmp.y += -pointerS.y * 0.03 * dist;
    camera.position.copy(cur.tgt).add(tmp);
    look.lookAt(camera.position, cur.tgt, up);
    camera.quaternion.setFromRotationMatrix(look);
    camera.rotateZ(cur.roll);
    // hold the 16:9 framing on squarer desktop screens: widen the vertical view instead of cropping the sides
    const asp = w / h;
    const fovNow = asp < 16 / 9 && asp > 1.15 ? (2 * Math.atan(Math.tan((cur.fov * Math.PI) / 360) * (16 / 9 / asp)) * 180) / Math.PI : cur.fov;
    if (Math.abs(camera.fov - fovNow) > 1e-3) {
      camera.fov = fovNow;
      camera.updateProjectionMatrix();
    }
    if (!visible && !first) return;
    if (first) captureBallEnv();
    renderer.setRenderTarget(sceneRT);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(gradeScene, quadCam);
    if (first) {
      first = false;
      const hidden: THREE.Object3D[] = [];
      scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
      renderer.compile(scene, camera);
      hidden.forEach((o) => (o.visible = false));
      opts.onFirstFrame?.();
    }
    adapt(dt);
  }

  // perf probe, only with ?perf in the URL
  if (typeof location !== "undefined" && location.search.includes("perf")) {
    (window as unknown as Record<string, unknown>).__ixPerf = { scene, renderer, floor, ice, spire, twigMesh, plumes, wall, dunes, terrace, ball, orb, sky, sceneRT, gradeScene, quadCam, camera, setDpr: (v: number) => { dprCap = v; renderer.setPixelRatio(v); resize(); } };
  }
  resize();
  return {
    renderer,
    lerpPose,
    setGoal,
    frame,
    resize,
    veil: () => [cur.veilL, cur.veilR] as const,
    /** Scroll position in screen heights; the core follows it, forward and back. */
    setTurn(v: number) {
      turnGoal = v;
    },
    setPointer(x: number, y: number) {
      pointer.set(x, y);
    },
    dispose() {
      renderer.dispose();
      sceneRT.dispose();
      gradeMat.dispose();
      pmrem.dispose();
      env.dispose();
      plumeTex.dispose();
      grain.dispose();
      shadowTex.dispose();
      blurA.dispose();
      blurB.dispose();
      floor.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      iceCheap.dispose();
      blurMat.dispose();
    },
  };
}
