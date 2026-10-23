import * as THREE from "three";
import { RATIO } from "../data";
import { T, easeOut, lerp, seg, smooth } from "../timeline";
import * as S from "./shaders";
import { CARD_H, CARD_W, STAMP_AT, drawCard, drawFloorText, drawGlow, drawStamp, stampPoints } from "./textures";

export const STAGE = "#0a0f18";

export interface HeroScene {
  /** Render one frame for scroll progress p (0..1) and pointer offset (-1..1). */
  frame(p: number, px: number, py: number, dt: number): void;
  resize(w: number, h: number): void;
  /** Redraw canvas textures once web fonts have loaded */
  refreshText(): void;
  dispose(): void;
}

const R_OUT = 1;
const R_IN = 0.36;
const HALF_W = 0.55;
const PALLET = 0.14;
const CARD_WORLD_W = 2.2;
const CARD_WORLD_H = (CARD_WORLD_W * CARD_H) / CARD_W;
const STAMP_WORLD = ((STAMP_AT.r * 2) / CARD_W) * CARD_WORLD_W * (256 / 232);
const TILT = (-8 * Math.PI) / 180;

/** Camera keyframes along the story: [progress, position, look-at] */
const CAM: [number, [number, number, number], [number, number, number]][] = [
  [0.0, [-5.6, 2.0, 9.6], [-2.3, 1.25, 0]],
  [0.2, [-3.4, 2.1, 9.4], [-0.6, 1.2, 0]],
  [0.42, [-0.2, 2.4, 9.0], [1.2, 1.45, 0]],
  [0.6, [2.6, 3.0, 7.0], [1.3, 2.1, 0.6]],
  [0.78, [2.4, 2.95, 6.6], [1.25, 2.15, 0.6]],
  [1.0, [4.4, 3.6, 8.9], [1.2, 1.8, 0.3]],
];

export function createHeroScene(canvas: HTMLCanvasElement, opts: { particles: number; dpr: number }): HeroScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(opts.dpr);
  renderer.setClearColor(STAGE, 1);

  const scene = new THREE.Scene();
  const fog = new THREE.Color(STAGE);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  const disposables: { dispose(): void }[] = [];
  const track = <X extends { dispose(): void }>(x: X) => (disposables.push(x), x);

  const time = { value: 0 };
  const fogRange = { value: new THREE.Vector2(9, 22) };
  const heat = { value: 0 };
  const scan = { value: 0 };
  const coilPos = { value: new THREE.Vector3(-3, R_OUT + PALLET, 0) };

  // ---------------------------------------------------------------- floor
  const floorText = track(new THREE.CanvasTexture(drawFloorText()));
  const floorMat = track(
    new THREE.ShaderMaterial({
      vertexShader: S.basicVert,
      fragmentShader: S.floorFrag,
      uniforms: {
        uCoil: coilPos,
        uHeat: heat,
        uScan: scan,
        uTime: time,
        uFog: { value: fog },
        uFogRange: fogRange,
        uText: { value: floorText },
        uTextRect: { value: new THREE.Vector4(-5, 1.35, 10, 1.25) },
      },
    }),
  );
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(80, 80)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // ---------------------------------------------------------------- border scan curtain
  const curtain = new THREE.Mesh(
    track(new THREE.PlaneGeometry(14, 4.2)),
    track(
      new THREE.ShaderMaterial({
        vertexShader: S.basicVert,
        fragmentShader: S.curtainFrag,
        uniforms: { uTime: time, uScan: scan },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    ),
  );
  curtain.rotation.y = Math.PI / 2;
  curtain.position.set(0, 2.1, -1);
  scene.add(curtain);

  // ---------------------------------------------------------------- coil on its pallet
  const coilMat = track(
    new THREE.ShaderMaterial({
      vertexShader: S.coilVert,
      fragmentShader: S.coilFrag,
      side: THREE.DoubleSide,
      uniforms: { uTime: time, uHeat: heat, uRin: { value: R_IN }, uRout: { value: R_OUT }, uHalfW: { value: HALF_W }, uFog: { value: fog }, uFogRange: fogRange },
    }),
  );
  const coil = new THREE.Group();
  const outer = new THREE.Mesh(track(new THREE.CylinderGeometry(R_OUT, R_OUT, HALF_W * 2, 128, 1, true)), coilMat);
  const inner = new THREE.Mesh(track(new THREE.CylinderGeometry(R_IN, R_IN, HALF_W * 2, 64, 1, true)), coilMat);
  const capGeo = track(new THREE.RingGeometry(R_IN, R_OUT, 128, 1));
  // RingGeometry lies in XY; rotate it so its normal is the cylinder axis (Y) like the walls' object space
  capGeo.rotateX(-Math.PI / 2);
  const capTop = new THREE.Mesh(capGeo, coilMat);
  capTop.position.y = HALF_W;
  const capBottom = new THREE.Mesh(capGeo, coilMat);
  capBottom.position.y = -HALF_W;
  capBottom.rotation.x = Math.PI;
  coil.add(outer, inner, capTop, capBottom);
  coil.rotation.x = Math.PI / 2; // eye faces the camera
  const coilRig = new THREE.Group();
  coilRig.add(coil);
  coil.position.y = R_OUT + PALLET;

  const palletMat = track(new THREE.MeshBasicMaterial({ color: "#121a26" }));
  const pallet = new THREE.Mesh(track(new THREE.BoxGeometry(1.7, PALLET, 1.5)), palletMat);
  pallet.position.y = PALLET / 2;
  const chock = track(new THREE.BoxGeometry(0.22, 0.28, 1.3));
  const chockL = new THREE.Mesh(chock, palletMat);
  chockL.position.set(-0.62, PALLET + 0.12, 0);
  const chockR = chockL.clone();
  chockR.position.x = 0.62;
  coilRig.add(pallet, chockL, chockR);

  const glowTex = track(new THREE.CanvasTexture(drawGlow()));
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const glowMat = track(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(6, 6, 1);
  glow.position.set(0, R_OUT + PALLET, -0.8);
  coilRig.add(glow);
  scene.add(coilRig);

  // ---------------------------------------------------------------- passport card + stamp
  const cardTex = track(new THREE.CanvasTexture(drawCard()));
  cardTex.anisotropy = 4;
  const cardUniforms = { uMap: { value: cardTex }, uOpacity: { value: 0 }, uSweep: { value: -1 }, uWarm: { value: 1 } };
  const card = new THREE.Mesh(
    track(new THREE.PlaneGeometry(CARD_WORLD_W, CARD_WORLD_H)),
    track(new THREE.ShaderMaterial({ vertexShader: S.basicVert, fragmentShader: S.cardFrag, uniforms: cardUniforms, transparent: true, side: THREE.DoubleSide })),
  );
  const stampCanvas = drawStamp();
  const stampTex = track(new THREE.CanvasTexture(stampCanvas));
  const stampUniforms = { uMap: { value: stampTex }, uOpacity: { value: 0 } };
  const stamp = new THREE.Mesh(
    track(new THREE.PlaneGeometry(STAMP_WORLD, STAMP_WORLD)),
    track(new THREE.ShaderMaterial({ vertexShader: S.basicVert, fragmentShader: S.stampFrag, uniforms: stampUniforms, transparent: true, depthWrite: false })),
  );
  const stampCenter = new THREE.Vector2((STAMP_AT.x / CARD_W - 0.5) * CARD_WORLD_W, (0.5 - STAMP_AT.y / CARD_H) * CARD_WORLD_H);
  stamp.position.set(stampCenter.x, stampCenter.y, 0.006);
  stamp.rotation.z = TILT;
  stamp.renderOrder = 2;
  card.add(stamp);
  card.renderOrder = 1;
  scene.add(card);

  // ---------------------------------------------------------------- CO₂ particles
  const n = opts.particles;
  const seeds = new Float32Array(n * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  const pts = stampPoints(n, stampCanvas);
  const cos = Math.cos(TILT);
  const sin = Math.sin(TILT);
  for (let i = 0; i < n; i++) {
    const x = pts[i * 2];
    const y = pts[i * 2 + 1];
    pts[i * 2] = x * cos - y * sin;
    pts[i * 2 + 1] = x * sin + y * cos;
  }
  const pGeo = track(new THREE.BufferGeometry());
  pGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  pGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
  pGeo.setAttribute("aTarget", new THREE.BufferAttribute(pts, 2));
  const pUniforms = {
    uTime: time,
    uCoil: coilPos,
    uKeep: { value: 1 },
    uCondense: { value: 0 },
    uSettle: { value: 0 },
    uCard: { value: new THREE.Matrix4() },
    uStamp: { value: new THREE.Vector3(stampCenter.x, stampCenter.y, STAMP_WORLD) },
    uScale: { value: 1 },
  };
  const particles = new THREE.Points(
    pGeo,
    track(new THREE.ShaderMaterial({ vertexShader: S.particleVert, fragmentShader: S.particleFrag, uniforms: pUniforms, transparent: true, depthWrite: false })),
  );
  particles.frustumCulled = false;
  particles.renderOrder = 3;
  scene.add(particles);

  // ---------------------------------------------------------------- camera path
  const camPos = new THREE.CatmullRomCurve3(CAM.map(([, p]) => new THREE.Vector3(...p)));
  const camLook = new THREE.CatmullRomCurve3(CAM.map(([, , l]) => new THREE.Vector3(...l)));
  const along = (p: number) => {
    let i = 0;
    while (i < CAM.length - 2 && p > CAM[i + 1][0]) i++;
    return (i + seg(p, CAM[i][0], CAM[i + 1][0])) / (CAM.length - 1);
  };
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const lookSmooth = new THREE.Vector3();
  const pointer = new THREE.Vector2();
  let size = { w: 1, h: 1 };
  let started = 0;

  const cardFrom = new THREE.Vector3();
  const cardTo = new THREE.Vector3(1.25, 2.45, 0.85);
  const qFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const qUp = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, -0.2, 0.0));

  function frame(p: number, px: number, py: number, dt: number) {
    time.value += dt;
    started += dt;
    const t = time.value;
    const intro = smooth(Math.min(started / 2.6, 1));

    // Coil travels across the border; it ignites over the intro
    const travel = smooth(seg(p, T.coilFrom, T.coilTo));
    const cx = lerp(-3.0, 1.25, travel);
    coilRig.position.x = cx;
    coilPos.value.set(cx, R_OUT + PALLET, 0);
    heat.value = intro * (1 - 0.06 * seg(p, 0.62, 0.95)) * (0.96 + 0.04 * Math.sin(t * 2.3));
    glowMat.opacity = 0.5 * heat.value;
    scan.value = Math.exp(-cx * cx * 1.1) + 0.12 * intro;

    // Default-value emissions dissolve at the border, leaving the verified share
    pUniforms.uKeep.value = lerp(1, RATIO, smooth(seg(p, T.keepFrom, T.keepTo)));
    pUniforms.uCondense.value = seg(p, T.condenseFrom, T.condenseTo);
    pUniforms.uSettle.value = seg(p, T.stampFrom, T.stampTo + 0.05);

    // The card rises out of the coil and turns to face us
    const rise = easeOut(seg(p, T.cardFrom, T.cardTo));
    cardFrom.set(cx, R_OUT + PALLET + 0.2, 0);
    card.position.lerpVectors(cardFrom, cardTo, rise);
    card.position.y += Math.sin(t * 0.8) * 0.025 * rise;
    card.quaternion.slerpQuaternions(qFlat, qUp, rise);
    card.rotateZ(Math.sin(t * 0.5) * 0.008);
    card.scale.setScalar(lerp(0.12, 1, rise));
    cardUniforms.uOpacity.value = smooth(seg(p, T.cardFrom, T.cardFrom + 0.04));
    card.visible = cardUniforms.uOpacity.value > 0.001;
    cardUniforms.uSweep.value = lerp(-0.4, 1.6, seg(p, T.stampTo, T.stampTo + 0.12));
    cardUniforms.uWarm.value = heat.value;
    card.updateMatrixWorld();
    pUniforms.uCard.value.copy(card.matrixWorld);

    // Stamp drops in once the particles have condensed: 1.25 → 1 then settles
    const drop = seg(p, T.stampFrom, T.stampTo);
    stampUniforms.uOpacity.value = smooth(Math.min(drop * 1.6, 1));
    const s = drop < 0.7 ? lerp(1.25, 0.98, easeOut(drop / 0.7)) : lerp(0.98, 1, (drop - 0.7) / 0.3);
    stamp.scale.setScalar(s);

    // Camera along the path, pulled back on narrow screens, with a little pointer parallax
    const u = along(p);
    camPos.getPoint(u, pos);
    camLook.getPoint(u, look);
    const aspect = size.w / size.h;
    const back = aspect < 1.1 ? Math.min(1.0 / aspect, 1.45) : 1;
    const dolly = back * lerp(1.35, 1, intro);
    pos.sub(look).multiplyScalar(dolly).add(look);
    fogRange.value.set(9 * dolly, 22 * dolly);
    pointer.x += (px - pointer.x) * Math.min(dt * 3, 1);
    pointer.y += (py - pointer.y) * Math.min(dt * 3, 1);
    pos.x += pointer.x * 0.35 + Math.sin(t * 0.13) * 0.12;
    pos.y += -pointer.y * 0.18 + Math.sin(t * 0.17) * 0.05;
    if (lookSmooth.lengthSq() === 0) lookSmooth.copy(look);
    lookSmooth.lerp(look, Math.min(dt * 8, 1));
    camera.position.copy(pos);
    camera.lookAt(lookSmooth);

    pUniforms.uScale.value = size.h * opts.dpr * 0.055;
    renderer.render(scene, camera);
  }

  function resize(w: number, h: number) {
    size = { w, h };
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Frame the subject off-centre: right of the copy on wide screens, above it on tall ones
    if (w / h >= 1.1) camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.16, w, h);
    camera.fov = w / h < 1 ? 50 : 36;
    camera.updateProjectionMatrix();
  }

  function refreshText() {
    const c = drawCard();
    cardTex.image = c;
    cardTex.needsUpdate = true;
    floorText.image = drawFloorText();
    floorText.needsUpdate = true;
    // The particle targets were sampled from the first stamp draw; the overlay just gets crisper glyphs.
    stampTex.image = drawStamp();
    stampTex.needsUpdate = true;
  }

  function dispose() {
    disposables.forEach((d) => d.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { frame, resize, refreshText, dispose };
}
