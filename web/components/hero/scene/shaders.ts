/** GLSL for the hero scene. Colours are authored directly in sRGB (raw ShaderMaterials, no tone mapping). */

const NOISE = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

const FOG = /* glsl */ `
uniform vec3 uFog;
uniform vec2 uFogRange;
vec3 applyFog(vec3 col, vec3 w) {
  float d = length(cameraPosition - w);
  return mix(col, uFog, smoothstep(uFogRange.x, uFogRange.y, d));
}
`;

export const coilVert = /* glsl */ `
varying vec3 vObj;
varying vec3 vObjN;
varying vec3 vN;
varying vec3 vW;
void main() {
  vObj = position;
  vObjN = normal;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const coilFrag = /* glsl */ `
uniform float uTime;
uniform float uHeat;
uniform float uRin;
uniform float uRout;
uniform float uHalfW;
varying vec3 vObj;
varying vec3 vObjN;
varying vec3 vN;
varying vec3 vW;
${NOISE}
${FOG}
vec3 ramp(float t) {
  vec3 c0 = vec3(0.07, 0.04, 0.04);
  vec3 c1 = vec3(0.42, 0.06, 0.02);
  vec3 c2 = vec3(0.91, 0.35, 0.05);
  vec3 c3 = vec3(1.0, 0.62, 0.28);
  vec3 c4 = vec3(1.0, 0.92, 0.76);
  t = clamp(t, 0.0, 1.0);
  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.55) return mix(c1, c2, (t - 0.25) / 0.3);
  if (t < 0.82) return mix(c2, c3, (t - 0.55) / 0.27);
  return mix(c3, c4, (t - 0.82) / 0.18);
}
void main() {
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 v = normalize(cameraPosition - vW);
  float r = length(vObj.xz);
  float th = atan(vObj.z, vObj.x);
  float heat;
  float u = (r - uRin) / (uRout - uRin);
  if (abs(vObjN.y) > 0.5) {
    // End face: a spiral of wraps with cooler seams between them
    float s = fract(u * 30.0 + th / 6.28318);
    float seam = smoothstep(0.0, 0.22, s) * smoothstep(1.0, 0.78, s);
    // fade the wraps to their average where they get finer than a pixel (moiré on small screens)
    seam = mix(seam, 0.62, smoothstep(0.25, 0.7, fwidth(u * 30.0)));
    float flick = noise(vec2(th * 3.0 + uTime * 0.15, u * 22.0 - uTime * 0.4));
    float hot = noise(vec2(th * 1.2 - uTime * 0.05, u * 4.0));
    heat = (0.34 + 0.22 * sin(u * 3.14159) + 0.2 * flick + 0.22 * hot) * mix(0.18, 1.0, seam);
    heat *= mix(0.45, 1.0, smoothstep(1.0, 0.82, u));
  } else {
    // Outer and inner wrap surfaces: rolling streaks, hotter mid-width
    float y = vObj.y / uHalfW;
    float streak = noise(vec2(th * 42.0, y * 1.5));
    float band = noise(vec2(th * 3.0 + uTime * 0.12, y * 2.5 - uTime * 0.2));
    heat = (0.26 + 0.24 * (1.0 - y * y) + 0.26 * band) * (0.75 + 0.25 * streak);
    heat *= u < 0.5 ? 1.15 : 1.0;
  }
  heat *= uHeat;
  vec3 L = normalize(vec3(-0.45, 0.85, 0.55));
  float diff = max(dot(n, L), 0.0);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 steel = vec3(0.11, 0.13, 0.17) * (0.35 + 0.9 * diff) + vec3(0.55, 0.62, 0.74) * fres * 0.22;
  vec3 glow = ramp(heat * 1.08) * (0.4 + 0.95 * heat);
  vec3 col = steel * (1.0 - 0.5 * uHeat) + glow + vec3(1.0, 0.45, 0.16) * fres * 0.28 * uHeat;
  gl_FragColor = vec4(applyFog(col, vW), 1.0);
}
`;

export const basicVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vW;
varying vec3 vN;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const floorFrag = /* glsl */ `
uniform vec3 uCoil;
uniform float uHeat;
uniform float uScan;
uniform float uTime;
uniform sampler2D uText;
uniform vec4 uTextRect; // x0, z0, width, depth
varying vec2 vUv;
varying vec3 vW;
${FOG}
float gridLine(float x, float w) {
  float d = abs(fract(x - 0.5) - 0.5);
  float fw = fwidth(x);
  return 1.0 - smoothstep(w, w + fw * 1.2, d);
}
void main() {
  vec2 p = vW.xz;
  vec3 col = vec3(0.035, 0.05, 0.078);
  float dc = length(cameraPosition.xz - p);
  // Ledger rules: a 1 m grid with fainter quarter lines along the travel axis
  float g = max(gridLine(p.x, 0.012), gridLine(p.y, 0.012));
  float q = gridLine(p.y * 4.0, 0.02) * 0.35;
  col += vec3(0.2, 0.25, 0.33) * max(g, q) * 0.38 * smoothstep(uFogRange.y * 0.75, uFogRange.x * 0.45, dc);
  // The border: a dashed painted line with a soft cold glow
  float bx = abs(p.x);
  float dash = step(0.38, fract(p.y * 1.4));
  float line = 1.0 - smoothstep(0.02, 0.035 + fwidth(p.x), bx);
  col += vec3(0.86, 0.89, 0.93) * line * mix(0.18, 1.0, dash) * (0.55 + 0.7 * uScan);
  col += vec3(0.45, 0.55, 0.7) * exp(-bx * bx * 30.0) * (0.05 + 0.18 * uScan);
  // Molten pool of light under the coil
  vec2 d = p - uCoil.xz;
  col += vec3(1.0, 0.36, 0.07) * exp(-dot(d, d) * 0.75) * 0.5 * uHeat;
  col += vec3(1.0, 0.5, 0.15) * exp(-dot(d, d) * 5.0) * 0.25 * uHeat;
  // Lettering
  vec2 tuv = vec2((p.x - uTextRect.x) / uTextRect.z, 1.0 - (p.y - uTextRect.y) / uTextRect.w);
  if (tuv.x > 0.0 && tuv.x < 1.0 && tuv.y > 0.0 && tuv.y < 1.0) {
    col += vec3(0.75, 0.79, 0.86) * texture2D(uText, tuv).a * 0.2;
  }
  gl_FragColor = vec4(applyFog(col, vW), 1.0);
}
`;

export const curtainFrag = /* glsl */ `
uniform float uTime;
uniform float uScan;
varying vec2 vUv;
varying vec3 vW;
void main() {
  float y = vUv.y;
  float lines = smoothstep(0.86, 1.0, fract(vW.z * 5.0));
  float sweep = exp(-pow((y - fract(uTime * 0.22)) * 10.0, 2.0));
  float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  float a = (0.05 + lines * 0.12 + sweep * 0.16) * pow(1.0 - y, 1.4) * edge;
  a *= 0.6 + uScan * 2.6;
  gl_FragColor = vec4(vec3(0.72, 0.8, 0.92) * a, 1.0);
}
`;

export const cardFrag = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
uniform float uSweep;
uniform float uWarm;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.5) discard;
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  float lit = 0.86 + 0.14 * max(dot(n, normalize(vec3(-0.3, 0.6, 0.8))), 0.0);
  float sweep = smoothstep(0.09, 0.0, abs(vUv.x * 0.8 + vUv.y * 0.35 - uSweep)) * 0.22;
  vec3 col = t.rgb * lit + sweep;
  col += vec3(1.0, 0.45, 0.15) * 0.10 * uWarm * (1.0 - vUv.y);
  if (!gl_FrontFacing) col = vec3(0.86, 0.84, 0.79) * lit;
  gl_FragColor = vec4(col, uOpacity);
}
`;

export const stampFrag = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float a = texture2D(uMap, vUv).a * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(0.122, 0.478, 0.302), a * 0.92);
}
`;

export const particleVert = /* glsl */ `
attribute vec4 aSeed;
attribute vec2 aTarget;
uniform float uTime;
uniform vec3 uCoil;
uniform float uKeep;
uniform float uCondense;
uniform float uSettle;
uniform mat4 uCard;
uniform vec3 uStamp; // card-local centre x, y and size
uniform float uScale;
varying float vAlpha;
varying float vC;
varying float vLife;
void main() {
  float speed = 0.045 + 0.05 * aSeed.x;
  float life = fract(uTime * speed + aSeed.y);
  float ang = aSeed.z * 6.28318 + uTime * 0.25 * (aSeed.w - 0.5);
  float rad = 0.45 + life * (1.0 + aSeed.w * 1.6);
  vec3 cloud = uCoil + vec3(
    cos(ang) * rad * 0.9 + life * life * 1.4,
    0.2 + life * 3.6 + sin(uTime * 0.8 + aSeed.x * 12.0) * 0.12,
    sin(ang) * rad * 0.75
  );
  vec4 tl = vec4(uStamp.xy + aTarget * uStamp.z, 0.012, 1.0);
  vec3 target = (uCard * tl).xyz;
  float c = smoothstep(0.0, 1.0, clamp(uCondense * 1.5 - aSeed.x * 0.5, 0.0, 1.0));
  vec3 pos = mix(cloud, target, c);
  pos.y += sin(c * 3.14159) * (0.4 + aSeed.y * 0.6);
  pos.x += sin(c * 3.14159) * (aSeed.z - 0.5) * 0.8;

  float fadeLife = smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.55, life);
  float kept = step(aSeed.w, uKeep);
  // Particles dropped at the border dissolve; at condense time all of them return as ink
  float shown = mix(kept * fadeLife, 1.0, c);
  vAlpha = shown * mix(1.0, 0.25, uSettle * c);
  vC = c;
  vLife = life;
  vec4 mv = viewMatrix * vec4(pos, 1.0);
  float size = mix(1.4 + life * 4.0, 0.55, c) * (0.6 + aSeed.x * 0.8);
  gl_PointSize = uScale * size / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const particleFrag = /* glsl */ `
varying float vAlpha;
varying float vC;
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float cloud = smoothstep(0.5, 0.0, d);
  float soft = mix(cloud * cloud, smoothstep(0.5, 0.35, d), vC);
  vec3 smoke = mix(vec3(1.0, 0.55, 0.25), vec3(0.58, 0.64, 0.74), smoothstep(0.0, 0.3, vLife));
  // bright verified green in flight, stamp-ink green once it lands on the paper
  vec3 ink = mix(vec3(0.3, 0.76, 0.54), vec3(0.12, 0.48, 0.3), smoothstep(0.85, 1.0, vC));
  vec3 col = mix(smoke, ink, vC);
  float a = vAlpha * soft * mix(0.26, 0.95, vC);
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}
`;
