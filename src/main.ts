import { CameraBob } from './render/CameraBob';
import { aimPoint, AIM_RANGE, SpellBuffer, spellRange, AimHold, aimShape, holeLift } from './combat/Aim';
import { AimPreview } from './render/AimPreview';
import { SPELLS } from './combat/Spells';
import { BAR, barActs, barKey, chargeMove, LmbGesture, SpellBar } from './combat/SpellBar';
import { LiftGlow } from './render/LiftGlow';
import { MindBeam } from './render/MindBeam';
import { Box3, Color, DirectionalLight, FogExp2, Frustum, HemisphereLight, Matrix4, type Object3D, PerspectiveCamera, Scene, Sphere, Vector3 } from 'three';
import { HarvestLedger, harvestOf } from './world/Harvest';
import { Ejecta } from './render/Ejecta';
import { Billow } from './render/Billow';
import { StepClock, surfaceOf } from './audio/Steps';
import { LAYER_COUNT } from './render/Ground';
import { AutoQuality, nextMode, pickMode, QUALITY_KEY, settingsFor, type QualityLevel, type QualityMode } from './core/Quality';
import { WorkerFracturer } from './world/FractureObject';
import { Bubbles } from './world/Portal';
import { LightBudget } from './render/LightBudget';
import { loadModel, loadModelOrWarn, ModelRig, yawToRotation } from './models/ModelRig';
import { MODELS } from './data/models';
import { Audio } from './audio/Audio';
import { babbleVoice, renderBabble } from './audio/Babble';
import { DIALOGUE } from './data/dialogue';
import type { DialogueNode } from './game/Dialogue';
import { Rig } from './characters/Rig';
import { ROSTER } from './characters/roster';
import { CombatSystem } from './combat/CombatSystem';
import { Game } from './core/Game';
import { Input } from './core/Input';
import { CLOUD_LEVEL, DISTRICT_AIR, GALAXY, LAYOUT, leanDistrict, REALM_SKY, REALMS, VALE, ZONE_LIGHT } from './data/world';
import { kingdomNight, kingdomSkyColors } from './world/Kingdom';
import { Inventory } from './items/Inventory';
import { riverAt, WORLD } from './world/Terrain';
import { ITEMS } from './items/Items';
import { CONTROLLER, createControllerState, haltController, startDash, stepController } from './player/CharacterController';
import { MushroomRise, RISE, type Shroom } from './player/MushroomRise';
import { Party } from './player/Party';
import { ThirdPersonCamera } from './player/ThirdPersonCamera';
import { Atmosphere } from './render/Atmosphere';
import { CombatFx } from './render/CombatFx';
import { GROUND_UNIFORMS } from './render/GroundMaterial';
import { PALETTE } from './render/palette';
import { LOOKS, Renderer } from './render/Renderer';
import { CARRIAGE } from './world/Carriage';
import { SKIES, Sky } from './render/Sky';
import { faceMoon } from './render/MoonFace';
import { SkyEvents } from './render/SkyEvents';
import { Weather } from './render/Weather';
import { InkSplat } from './ui/InkSplat';
import { Hud } from './ui/Hud';
import { Minimap } from './ui/Minimap';
import { Companion } from './world/Companion';
import { Npc } from './world/NPCs';
import { Terrain } from './world/Terrain';
import { World } from './world/World';
import { Adventures } from './game/Adventures';
import { Ending } from './game/Ending';
import { Events, type HeroId, type Zone } from './game/Events';
import { MAX_LEVEL, Progress, xpFor, xpForKill, xpForQuest } from './game/Progress';
import { Titles } from './game/Hype';
import { questNode } from './data/quests';
import { Save, type SaveV1 } from './game/Save';
import { Story } from './game/Story';
import { WorldState } from './game/WorldState';
import { glowSprite } from './render/Glow';
import { Glints } from './render/LeanFx';
import { Ambience } from './audio/Ambience';
import { WINDOWS } from './render/Materials';
import { Concert } from './world/Concert';
import { HEAD_LIT } from './world/StoneHead';
import { CHESTS, CHEST_RESPAWN, type ChestDef } from './data/chests';
import { ENEMY_DEFS } from './data/enemies';
import { rollDrops, type Pickup } from './combat/Loot';
import { levelSpot } from './world/LevelSpot';
import { modelLandmark } from './world/ModelLandmark';
import { type NpcDef } from './world/NPCs';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game();
/** The game's event bus: what happens is announced here (for the NPC minds, the world state and the save). */
const events = new Events();
const renderer = new Renderer(canvas);
const debugAt = new URLSearchParams(location.search).has('at');
const input = new Input(canvas, debugAt);
const audio = new Audio();
/** Sample rate of the NPCs' babble: a voice's band, cheap to render (audio/Babble). */
const BABBLE_RATE = 16000;
const babbled = new Map<string, Float32Array>();
/**
 * An NPC says `text` in its own babble (no recording of the line): the playtest of 2026-11-14 asked for unique voices.
 * The last few renders are kept (a hub line is said again and again).
 */
function babble(npcId: string, text: string, gain = 1): void {
  // (Not heard, not made: synthesis costs a few milliseconds, too dear for a far bark or before audio is on.)
  if (!audio.canSpeak(gain)) return;
  const key = `${npcId}|${text}`;
  let samples = babbled.get(key);
  if (!samples) {
    samples = renderBabble(text, babbleVoice(npcId, DIALOGUE[npcId]?.persona.tone), BABBLE_RATE);
    if (babbled.size > 24) babbled.delete(babbled.keys().next().value!);
    babbled.set(key, samples);
  }
  audio.babble(samples, BABBLE_RATE, gain, 'npc');
}
/** A dialogue line opens: its recording if it has one, else the speaker's babble. */
const sayLine = (npcId: string) => (node: DialogueNode): void => {
  if (node.voice) adventures.onLine(node);
  else babble(npcId, node.line);
};
const hud = new Hud(document.getElementById('hud')!);
const inkSplat = new InkSplat(document.getElementById('hud')!);
const inventory = new Inventory();
inventory.shards = 40;
inventory.add('moon-dew', 2);
inventory.equip(inventory.add('hunters-bow'), 'archer', 'bow');
const scene = new Scene();
const islandFog = { color: new Color(PALETTE.fog), density: 0.0062 };
const fog = new FogExp2(PALETTE.fog, islandFog.density);
scene.fog = fog;
const bubbles = new Bubbles();
scene.add(bubbles.group);
/** The fight's pooled effects (blade ribbons, swing crescents, sparks, flashes, shocks, dust, telegraphs, the cast rune). */
// (Twelve ground warnings: a snowstorm lays four, a cup volley three, and two mobs and a boss may wind up at once.)
const combatFx = new CombatFx({ telegraphs: 12 });
scene.add(combatFx.group);
/** Keys 1-7 pick, right click casts (the user's calls of 2026-11-16); a cast while mid-swing waits up to 0.6 s. */
const spellBar = new SpellBar();
const spellBuffer = new SpellBuffer();
/** Hold right click to aim, let go to cast (playtest 2026-11-17), and what the held spell will do, drawn. */
const aimHold = new AimHold();
let aimPreview: AimPreview | null = null;
/** Wheel notches moving a held black hole up or down. */
let holeWheel = 0;
const lmb = new LmbGesture();
/** How far the spell being cast may land (Earthsplitter's leap is shorter): combat's aim clamps to it. */
let castRange = AIM_RANGE;
/** What Telekinesis would lift glows under the crosshair. */
const liftGlow = new LiftGlow();
scene.add(liftGlow.group);
/** Meshy models spells are made of (the Stone Wall's stone), loaded once on first ask. */
const spellModels = new Map<string, Object3D | null>();
function spellModel(id: string): Object3D | null {
  if (!spellModels.has(id)) {
    spellModels.set(id, null);
    void loadModelOrWarn(id, MODELS[id]?.label).then((g) => { if (g) spellModels.set(id, g.scene); });
  }
  return spellModels.get(id) ?? null;
}
spellModel('stone-wall');
// (The spiky rocks of Earthsplitter and Stone Wall: the sea pinnacle's rock spire, until the reel's own is made.)
spellModel('pinnacle');
// (Wren's ice, until the reel's own crystal is made; Sir Aldric's thrown boulders and pillars.)
spellModel('spiky-rock');
spellModel('ice-crystal');
spellModel('purple-crystal');
spellModel('boulder');
const mindBeam = new MindBeam();
scene.add(mindBeam.group);
const handAt = new Vector3();
/** Clods of earth thrown out of fresh craters (Ejecta). */
const ejecta = new Ejecta((x, z, y) => world.heightAt(x, z, y));
/** Wren's mushroom rise (hold Space): the mushrooms, their colliders, their models. */
const shroomRise = new MushroomRise();
shroomRise.onAdd = (f) => world.add(f);
shroomRise.onRemove = (f) => world.remove(f);
const shroomMeshes = new Map<Shroom, Object3D>();
let shroomBox: Vector3 | null = null;
spellModel('giant-mushroom');
/** Grows Wren's mushrooms while Space is held (before the step: she stands on what grew). */
function growShrooms(dt: number): void {
  const p = controller.pos;
  const can = party.active.id === 'archer' && input.locked && !combat.busy && (controller.mode === 'ground' || controller.mode === 'air');
  // (The ground under the mushrooms: the terrain, not her own caps.)
  shroomRise.update(dt, can && input.isDown('Space'), p, (x, z) => area.ground.heightAt(x, z));
  const src = spellModel('giant-mushroom');
  if (src && !shroomBox) shroomBox = new Box3().setFromObject(src).getSize(new Vector3());
  for (const sh of shroomRise.shrooms) {
    let m = shroomMeshes.get(sh);
    if (!m && src && shroomBox) { m = src.clone(true); m.name = 'wren-mushroom'; scene.add(m); shroomMeshes.set(sh, m); }
    if (!m || !shroomBox) continue;
    const k = Math.max(0.001, shroomRise.scale(sh));
    const wide = (RISE.r * 2.3) / Math.max(0.01, shroomBox.x, shroomBox.z);
    m.scale.set(wide * (0.6 + 0.4 * k), (sh.height * k) / Math.max(0.01, shroomBox.y), wide * (0.6 + 0.4 * k));
    m.position.set(sh.x, sh.ground, sh.z);
  }
  for (const [sh, m] of shroomMeshes) if (!shroomRise.shrooms.includes(sh)) { m.removeFromParent(); shroomMeshes.delete(sh); }
}
/** A cap that grew past her feet lifts her onto it (after the step). */
function standOnShrooms(): void {
  const p = controller.pos, v = controller.vel;
  for (const sh of shroomRise.shrooms) {
    const top = sh.collider.top;
    if (Math.hypot(p.x - sh.x, p.z - sh.z) > RISE.r || p.y >= top || p.y < top - 1.6) continue;
    p.y = top;
    if (v.y < 0) v.y = 0;
    if (controller.mode === 'air' && v.y <= 0) controller.mode = 'ground';
  }
}
scene.add(ejecta.group);
/** Billowing dust and smoke that lingers (collapses, blasts). */
const billow = new Billow(260);
const stepClock = new StepClock();
scene.add(billow.mesh);
const fogTarget = new Color();
let portalCooldown = 0;

const camera = new PerspectiveCamera(65, renderer.aspect, 0.3, 600);
const moon = new DirectionalLight(PALETTE.moon, 1.5);
const fill = new DirectionalLight(0x8fa5f0, 0.75);
fill.position.set(70, 60, 110);
const sky = new Sky();
// The island's moon is the laughing face, as a crescent (shot-013029); until its model loads, the cratered disc.
const moonFace = faceMoon('moon-laugh', Sky.moonRadius, { crescent: 0.72, glow: 0.7 });
void moonFace.ready.then((ok) => { if (ok) sky.attachMoonModel(moonFace.group, moonFace.tint); });
const skyEvents = new SkyEvents();
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -80;
moon.shadow.camera.right = 80;
moon.shadow.camera.top = 80;
moon.shadow.camera.bottom = -80;
moon.shadow.camera.near = 20;
moon.shadow.camera.far = 420;
moon.shadow.bias = -0.0005;
moon.shadow.normalBias = 0.5;
moon.shadow.radius = 3;
const hemi = new HemisphereLight(PALETTE.cobalt, PALETTE.abyss, 0.7);
scene.add(moon, moon.target, fill, fill.target, hemi, sky.group, skyEvents.group);
// The place's light (ZONE_LIGHT), blended toward each frame.
const light = { hemi: 0.7, moon: 1.5, fill: 0.75, cameraFill: 0 };
const lightSky = new Color(PALETTE.cobalt), lightGround = new Color(PALETTE.abyss), lightFill = new Color(0x8fa5f0);
const lightTo = new Color();
const fillFixed = new Vector3(), fillCam = new Vector3(), fillAim = new Vector3();
/** On the carriage's bench, facing where it goes. */
const benchAt = new Vector3();
function pinToCarriage(): void {
  CARRIAGE.bench(benchAt);
  controller.pos.x = benchAt.x; controller.pos.y = benchAt.y; controller.pos.z = benchAt.z;
  controller.vel.x = controller.vel.y = controller.vel.z = 0;
  controller.mode = 'ground';
  controller.yaw = CARRIAGE.heading;
}
/** The hero's height last frame, for the climb clip's pace. */
let lastClimbY = 0;

const terrain = new Terrain();
scene.add(terrain.group);
const minimap = new Minimap(document.getElementById('hud')!, terrain);
const area = new World(terrain);
scene.add(area.group);
const world = area.heights;
if (debugAt) (window as unknown as { __dbg: unknown }).__dbg = { h: (x: number, z: number) => world.heightAt(x, z), river: (x: number, z: number) => riverAt(x, z), rigs: () => rigs, combat: () => combat, npcs: () => area.npcs, audio, gl: () => renderer.gl, renderer, world: () => area, camera, terrain, sky, atmosphere: () => atmosphere, weather: () => weather };
const atmosphere = new Atmosphere((x, z) => world.heightAt(x, z), new Vector3(LAYOUT.spawn.x, 0, LAYOUT.spawn.z));
scene.add(atmosphere.group);
const weather = new Weather(LAYOUT.rainZone, LAYOUT.snowZones);
scene.add(weather.group);
const playerPos = new Vector3();
/** Where the hero was at the start of the last fixed step, and where they are drawn (between it and now). */
const prevPos = new Vector3();
const drawPos = new Vector3();
const interactAt = new Vector3();
let interactIn = 0;

// --- player ---
// `?at=x,z` starts the party at a world position (used to check landmarks and bosses quickly).
const atParam = new URLSearchParams(location.search).get('at')?.split(',').map(Number);
/** Where the hero last stood well clear of an edge, how far below it counts as lost, and the height of the void. */
const safeStand = new Vector3();
const FALL_RECOVER = 24;
const ABYSS_LINE = WORLD.abyssY + 10;
let safeClock = 0;

const SPAWN = atParam && atParam.length === 2 && atParam.every((n) => Number.isFinite(n)) ? new Vector3(atParam[0], 0, atParam[1]) : new Vector3(LAYOUT.spawn.x, 0, LAYOUT.spawn.z);
SPAWN.y = world.heightAt(SPAWN.x, SPAWN.z);
const controller = createControllerState(SPAWN);
safeStand.copy(SPAWN);
const party = new Party(ROSTER);
const rigs = ROSTER.map((def) => new Rig(def));
for (const r of rigs) {
  r.root.visible = r.trailObject.visible = false;
  scene.add(r.root, r.trailObject);
}
let landedAt = -10;
/** Camera roll while slowed by a puddle of lean. */
let tilt = 0;
let wasAirborne = false;
/** What the body was doing last step (flight, a swim, a climb, a mushroom bounce, the carriage's reins): each is announced once, on entry. */
let lastMode = controller.mode;
let wasBouncing = false;
let wasDriving = false;
rigs[party.activeIndex].root.visible = rigs[party.activeIndex].trailObject.visible = true;
const tpc = new ThirdPersonCamera(camera, world);
/** What the people of a building say when it comes down on them. */
const COLLAPSE_YELLS = ['MY HOUSE!', 'Oi! I live there!', 'Who pays for that?!', 'That was load-bearing!', 'Not again...', 'I just swept in there!', 'Rude!', 'You owe me a roof.'];
// Things breaking (Breakables): a crack and a crumble by size and distance, dust where it breaks, a shake when a building comes down.
{
  const near = (x: number, z: number) => Math.max(0, 1 - Math.hypot(x - controller.pos.x, z - controller.pos.z) / 70);
  const harvested = new HarvestLedger();
  area.breakables.onRebuild = (b) => harvested.reset(b);
  area.breakables.onBreak = (b, x, y, z, n) => {
    audio.crumble(Math.min(1, b.target.size / 40) * Math.min(1, n / 4), near(x, z));
    combatFx.dust(new Vector3(x, y, z), 1 + Math.min(2.5, n * 0.4));
    // Sir Aldric's blows knock wood, planks and stone loose (Harvest): a few pieces at his feet.
    if (ROSTER[party.activeIndex].id === 'knight' && Math.hypot(x - controller.pos.x, z - controller.pos.z) < 7) {
      const h = harvestOf(b.target.material, !!b.target.tree, b.target.size, n, !!b.target.brief);
      if (h && h.itemId !== 'stone') audio.chop();
      if (h && harvested.take(b, performance.now() / 1000)) combat.loot.spawn([{ kind: 'item', itemId: h.itemId, count: h.count }], new Vector3(x, Math.max(y, controller.pos.y + 0.6), z));
    }
  };
  area.breakables.onCollapse = (b) => {
    const k = near(b.x, b.z);
    audio.crumble(Math.min(1, b.target.size / 25), k);
    tpc.shake(Math.min(1, b.target.size / 30) * k);
    // A cloud rising from the base all round, as wide as the thing.
    const base = b.target.object.getWorldPosition(new Vector3()).y;
    // A big cloud of dust and plaster rolling out from the base and up, hanging in the air for many seconds.
    const sz = b.target.size;
    // (Trees, plants and little things only shed their own pieces: dust clouds come from buildings and stone.)
    if (!b.target.tree && !b.target.brief && sz >= 3) billow.cloud(new Vector3(b.x, base + 0.3, b.z), Math.min(14, b.r * 0.9), 0x949cb6, { puffs: Math.round(Math.min(90, 14 + sz * 2.2)), life: Math.min(14, 6 + sz * 0.15), rise: 1 + Math.min(3, sz * 0.06), spread: 1.4 + Math.min(4, sz * 0.08) });
    combatFx.dust(new Vector3(b.x, base + 0.5, b.z), Math.min(5, 1.2 + sz * 0.1));
    // The people of the place yell at you and run out (it stands again within a minute: Breakables.REBUILD_S.quick).
    if (b.target.size < 3) return;
    for (const n of area.npcs) {
      if (n.hidden || Math.hypot(n.pos.x - b.x, n.pos.z - b.z) > b.r + 4) continue;
      n.bubble(COLLAPSE_YELLS[Math.floor(Math.random() * COLLAPSE_YELLS.length)], 3);
      n.flee({ x: b.x, z: b.z }, b.r);
    }
  };
  // Rubble landing: dust where it hits, a thud by its size. A wall giving way: a crack and dust off it.
  area.breakables.onLand = (x, y, z, size) => {
    combatFx.dust(new Vector3(x, y, z), 0.4 + size * 1.6);
    if (size > 0.25) audio.crumble(Math.min(0.5, size * 0.4), near(x, z) * 0.7);
  };
  area.breakables.onFail = (x, y, z, size) => {
    if (Math.random() < 0.35) combatFx.dust(new Vector3(x, y, z), 0.5 + size);
  };
  // Rebuilds wait until the spot is out of the camera's view.
  const frustum = new Frustum(), m4 = new Matrix4(), sphere = new Sphere();
  area.breakables.inView = (x, z, r) => {
    m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(m4);
    return frustum.intersectsSphere(sphere.set(new Vector3(x, area.heights.heightAt(x, z) + r * 0.5, z), r));
  };
  // Buildings are cut into their pieces off the main thread, ahead of time as the hero comes near.
  try {
    area.breakables.fracturer = new WorkerFracturer(new Worker(new URL('./world/FractureWorker.ts', import.meta.url), { type: 'module' }));
  } catch { /* (no workers: cut on the spot) */ }
}
const camParam = new URLSearchParams(location.search).get('cam')?.split(',').map(Number).filter((n) => Number.isFinite(n));
// `?face=x,z` (debug) aims the camera from the spawn toward a world point.
const faceParam = new URLSearchParams(location.search).get('face')?.split(',').map(Number);
if (faceParam && faceParam.length === 2 && faceParam.every((n) => Number.isFinite(n))) tpc.yaw = Math.atan2(-(faceParam[0] - SPAWN.x), -(faceParam[1] - SPAWN.z));
tpc.snapTo(new Vector3(SPAWN.x, SPAWN.y + 1.4, SPAWN.z));
hud.setParty(ROSTER, party.activeIndex);
const companions: Companion[] = [];
let talking: Npc | null = null;

/** Who lies at 0 HP: not switchable, and their portrait says so. */
function fallen(): boolean[] {
  return ROSTER.map((d) => (combat.hp.get(d.id) ?? d.maxHp) <= 0);
}

function switchTo(i: number): boolean {
  const down = fallen();
  const swap = party.switchTo(i, (j) => !down[j]);
  if (!swap) {
    if (down[i] && i !== party.activeIndex) hud.announce(`${ROSTER[i].name} is down`);
    return false;
  }
  rigs[swap.from].root.visible = rigs[swap.from].trailObject.visible = false;
  rigs[swap.to].root.visible = rigs[swap.to].trailObject.visible = true;
  hud.setParty(ROSTER, swap.to, down, progress.level);
  combat.onSwitch();
  audio.click();
  events.emit({ kind: 'hero', hero: ROSTER[swap.to].id as HeroId });
  return true;
}

Npc.sound = { voice: (url, gain, channel) => audio.voice(url, gain, channel), slurp: (gain) => audio.slurp(gain), babble };
// (Rig.sound.slurp is Sir Aldric's own cup of lean: the hero's sip is a feat.)
Rig.sound = { slurp: (gain) => { audio.slurp(gain); events.emit({ kind: 'feat', what: 'sip' }); }, rustle: () => audio.rustle(), munch: () => audio.munch() };
const lightBudget = new LightBudget(scene, 6);
// Quality (core/Quality): Auto / High / Low from the pause screen, ?quality= in the URL, kept in localStorage.
let qualityMode: QualityMode = pickMode(location.search, (() => { try { return localStorage.getItem(QUALITY_KEY); } catch { return null; } })());
const autoQuality = new AutoQuality();
let qualityLevel: QualityLevel | null = null;
/** Quality settings for parts made after the first applyQuality (the fight): set once they exist. */
let onQualityLate: ((q: ReturnType<typeof settingsFor>) => void) | null = null;
function applyQuality(): void {
  const level: QualityLevel = qualityMode === 'auto' ? autoQuality.level : qualityMode;
  hud.setQuality(qualityMode, level);
  if (level === qualityLevel) return;
  qualityLevel = level;
  const q = settingsFor(level);
  renderer.setMaxRatio(q.maxRatio);
  lightBudget.setLimit(q.lights);
  area.breakables.sim.maxActive = q.debris;
  area.breakables.variants = q.variants;
  area.breakables.blockScale = q.blocks;
  onQualityLate?.(q);
}
hud.setOnQuality(() => {
  qualityMode = nextMode(qualityMode);
  try { localStorage.setItem(QUALITY_KEY, qualityMode); } catch { /* private window: this session only */ }
  applyQuality();
});
applyQuality();
lightBudget.collect(scene);

const progress = new Progress();
const save = new Save(localStorage);
const bosses: Record<string, { slainAt: number }> = {};
/** How many of each shop listing are left. A key is `npc:item`. Empty means a full shelf of five. */
const shopLeft = new Map<string, number>();
let shopClock = 0;
/** Play time, for chest respawn. */
let playTime = 0;
const openedAt = new Map<string, number>();
let freshStart = false;
const cameraBob = new CameraBob();
const combat = new CombatSystem({
  scene, world, sky, hud, camera, game, audio, inventory, controller, party, spawn: SPAWN, events, fx: combatFx,
  onForceSwitch: (i) => { party.update(Party.cooldown); switchTo(i); },
  onShake: (a) => tpc.shake(a),
  onKick: (dir, amount) => tpc.kick(dir, amount),
  onPunch: (delta, seconds) => tpc.punchFov(delta, seconds),
  onPulse: (strength) => renderer.pulse(strength),
  weaponTips: (guard, tip) => rigs[party.activeIndex].weaponTips(guard, tip),
  fist: (out) => rigs[party.activeIndex].fistAt(out),
  takeBuilding: (x, z) => area.breakables.takeWhole(x, z),
  onTrip: (strength, seconds) => renderer.trip(strength, seconds),
  onInk: () => inkSplat.splash(),
  breakAt: (x, y, z, radius, kind) => area.breakables.damageAt(x, y, z, radius, kind),
  tear: (x, z, radius, count) => area.breakables.tear(x, z, radius, count),
  dig: (x, z, r, depth, scorch) => {
    if (depth > 0 && area.craters.crater(x, z, r, depth)) ejecta.spawn(x, world.heightAt(x, z), z, r, depth);
    if (scorch) area.craters.scorch(x, z, r * 1.1, scorch);
  },
  // Spells land where the crosshair meets the ground (at most 25 m off; Aim.ts).
  aim: () => spellAim(castRange).at,
  debris: () => [area.breakables.sim, ejecta.sim],
  // A house, a stall, a tree or a rock under the crosshair that Orlan can tear up whole (not a castle, not a flower).
  building: (x, z) => {
    let best: { x: number; y: number; z: number; r: number } | null = null, bd = Infinity;
    for (const b of area.breakables.near(x, z, 8)) {
      if (b.state !== 'intact' || b.target.brief || b.target.size < 1 || b.target.size >= 12) continue;
      const d = Math.hypot(b.x - x, b.z - z) - b.r;
      if (d < 1.5 && d < bd) { bd = d; best = { x: b.x, y: b.target.object.getWorldPosition(new Vector3()).y, z: b.z, r: b.r }; }
    }
    return best;
  },
  lights: { flash: (at, c, i, d, s) => lightBudget.flash(at, c, i, d, s), hold: (c, i, d) => lightBudget.hold(c, i, d) },
  smoke: (at, r, color, life) => billow.cloud(at, r, color, { life, puffs: Math.round(8 + r * 5), rise: 1.6 + r * 0.4, spread: 0.6 + r * 0.25, size: 0.5 + r * 0.3 }),
  sprout: (ids) => area.sprout(ids),
  model: (id) => spellModel(id),
  solid: (x, z, r, top) => {
    const f = { kind: 'cyl' as const, x, z, r, top };
    world.add(f);
    return () => world.remove(f);
  },
  onKill: (kind) => {
    adventures.quests.kill(kind);
    const foe = ENEMY_DEFS[kind as keyof typeof ENEMY_DEFS];
    if (foe?.boss) bosses[kind] = { slainAt: Date.now() };
    if (foe) gainXp(xpForKill(foe, progress.level));
    // (Always: a boss's time of death and the quest kill counts are saved at the level cap too.)
    save.markDirty();
  },
  muzzle: () => rigs[party.activeIndex].muzzle(new Vector3()),
  // The companions are fought too: the mobs go for the nearest of them and the hero, every blow lands on whoever is in it.
  allies: () => companions,
  // A wipe also ends the frog's dream (otherwise its clock would run on, and block the portals, back on the island).
  // (Everyone stands again after a wipe: the portraits lose their `down`.)
  onWipe: () => { adventures.riding = null; wasLocked = false; if (adventures.dreamLeft > 0) adventures.wake(); hud.setParty(ROSTER, party.activeIndex, fallen(), progress.level); },
  // A roll along the stick, or a backstep: the controller carries it (an impulse alone was eaten by the ground drag).
  onDodge: () => startDash(controller, tpc.moveToWorld(input.moveAxis())),
});
onQualityLate = (q) => { combat.caster.fires.cap = q.fires; };
onQualityLate(settingsFor(qualityLevel ?? 'high'));

/** Moves the hero (portals, doors, the frog's dream): everything that was chasing stays behind. */
function teleport(x: number, y: number, z: number, yaw: number, name?: string): void {
  hud.curtain();
  safeStand.set(x, y, z);
  adventures.riding = null;
  controller.pos = { x, y: y + 0.05, z };
  controller.vel = { x: 0, y: 0, z: 0 };
  controller.mode = 'ground';
  controller.yaw = yaw;
  tpc.yaw = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
  wasLocked = false;
  for (const c of companions) c.teleport(x, z, world.heightAt(x, z, y));
  combat.resetAggro();
  if (name) hud.announce(name);
  audio.cast();
  portalCooldown = 1.5;
}
combat.loot.onAbsorbed = (rarity) => audio.absorb(rarity);
const adventures = new Adventures({
  controller, world: area, hud, audio, inventory, teleport, events, activeRig: () => rigs[party.activeIndex], debuffs: () => combat.debuffs,
  trip: (strength, seconds) => renderer.trip(strength, seconds),
  fight: { spawnBoss: (kind, x, z, yaw) => combat.spawnBoss(kind, x, z, yaw), despawn: (e) => combat.despawn(e) },
});
area.hooks.events = events;
area.hooks.soundWanted = () => adventures.quests.stage('sound') === 'active';
area.hooks.foundSound = () => adventures.foundSound();
area.hooks.teleport = teleport;
area.hooks.trip = (strength, seconds) => renderer.trip(strength, seconds);
area.hooks.shoot = (from, s) => combat.hostileShot(from, s);
area.hooks.hurt = (atk, poison) => combat.hazard(atk, poison);
area.hooks.mire = (seconds) => combat.mire(seconds);
// Shootable things in the world (sky eyes, the eye pool), and the prize for shooting every sky eye.
combat.targets.push(...area.shotTargets);
area.hooks.reward = (what, line) => {
  // The Moon Throne Hall (CastleHall.ts, ThroneKeeper): Sir Bonesworth keeps the throne and the crown.
  if (what === 'keeper') { audio.clatter(); hud.announce(`Sir Bonesworth: ${line}`, { seconds: 3.2 }); return; }
  if (what === 'crown') {
    // He throws the crown onto your head: gold rains, the moon laughs.
    audio.clatter();
    audio.jackpot();
    const at = new Vector3(controller.pos.x, controller.pos.y + 2.2, controller.pos.z);
    for (const col of [0xffc23a, 0xffe08a, 0xfff4d0]) combatFx.sparks(at, new Vector3(0, 1, 0), 26, col, 6, 1.2);
    hud.announce(`Sir Bonesworth: ${line}`, { seconds: 3.6 });
    return;
  }
  if (what === 'throne') {
    // The throne: a whoopee cushion that launches its king into the air; then it heals the party.
    audio.fart();
    // (Thrown like a mushroom bounce: without `bouncing` the short-hop cut ate the launch, jump not being held.)
    controller.vel.y = 14;
    controller.mode = 'air';
    controller.modeTime = 0;
    controller.bouncing = true;
    combat.healActive(1e6);
    renderer.trip(0.4, 4);
    combatFx.dust(new Vector3(controller.pos.x, controller.pos.y, controller.pos.z), 2.5);
    hud.announce(line ? `Sir Bonesworth: ${line}` : 'The castle knows its king tonight', { seconds: 3.4 });
    return;
  }
  if (what !== 'eyes') return;
  events.emit({ kind: 'feat', what: 'skyeye' });
  combat.loot.spawn([{ kind: 'shards', amount: 60 }, { kind: 'item', itemId: 'moon-dew', count: 2 }], new Vector3(controller.pos.x, controller.pos.y + 1, controller.pos.z));
  hud.announce('The sky blinks first · 60 coins');
  audio.loot(4);
};
area.hooks.board = (boat) => { adventures.riding = boat; audio.footstep(); hud.announce('Aboard · F talk · SPACE jump off'); };
adventures.openRowers = () => {
  const node = adventures.talk('rowers');
  if (node) { events.emit({ kind: 'talk', npc: 'rowers' }); openPanel(() => hud.dialogue({ name: 'The Rowers', title: 'Two Knights and a Boat' }, node, sayLine('rowers'))); }
};

// --- panels ---
function openPanel(fn: () => void): void {
  input.unlock();
  input.uiOpen = true;
  haltController(controller);
  fn();
  hud.setLocked(false);
}
function closePanel(): void {
  hud.close();
  talking = null;
  input.uiOpen = false;
  // (Escape does not count as a user gesture: the lock may be refused, and the click-to-resume prompt shows.)
  canvas.requestPointerLock()?.catch?.(() => {});
}
hud.bind({
  onBuy: (itemId, price) => {
    const who = talking?.def.id ?? 'shop';
    const key = `${who}:${itemId}`;
    const left = shopLeft.get(key) ?? 5;
    if (left <= 0) { hud.announce('Sold out'); return false; }
    if (!inventory.spend(price)) return false;
    shopLeft.set(key, left - 1);
    inventory.add(itemId);
    events.emit({ kind: 'trade', what: 'buy', item: itemId });
    audio.coins(3);
    hud.announce(`${ITEMS[itemId].name} acquired`);
    return true;
  },
  onSell: (uid, count) => { const item = inventory.entries.find((x) => x.uid === uid)?.itemId; const gain = inventory.sell(uid, count); if (gain > 0) audio.coins(2); if (gain > 0 && item) events.emit({ kind: 'trade', what: 'sell', item }); },
  onHire: (npc) => { const r = hireNpc(npc); return r === 'none' ? 'poor' : r; },
  onEquip: (uid) => {
    const me = party.active;
    const ok = inventory.equip(uid, me.id, me.weapon);
    if (ok) { weaponGlows(); audio.click(); const e = inventory.entries.find((x) => x.uid === uid)!; hud.announce(`${me.name} wields ${ITEMS[e.itemId].name}`); events.emit({ kind: 'trade', what: 'equip', item: e.itemId }); }
    return ok;
  },
  onCharm: (uid) => {
    const me = party.active;
    if (inventory.charmOf(me.id)?.uid === uid) inventory.unequipCharm(me.id);
    else if (inventory.equipCharm(uid, me.id)) { const e = inventory.entries.find((x) => x.uid === uid)!; hud.announce(`${me.name} wears ${ITEMS[e.itemId].name}`); }
    audio.click();
  },
  onUse: (uid) => {
    const e = inventory.entries.find((x) => x.uid === uid);
    if (!e) return false;
    const d = ITEMS[e.itemId];
    if (d.kind !== 'consumable') return false;
    if (d.heal) combat.healActive(d.heal);
    if (d.frenzy) combat.applyFrenzy(d.frenzy);
    inventory.remove(e.itemId, 1);
    return true;
  },
  onDrop: (uid) => {
    const e = inventory.entries.find((x) => x.uid === uid);
    if (!e || e.equippedBy || ITEMS[e.itemId].kind === 'key') return;
    inventory.remove(e.itemId, 1);
    combat.loot.spawn([{ kind: 'item', itemId: e.itemId, count: 1 }], new Vector3(controller.pos.x, controller.pos.y + 1, controller.pos.z));
  },
  onClose: () => closePanel(),
}, inventory);

function hireNpc(def: NpcDef, free = false): 'ok' | 'full' | 'poor' | 'none' {
  if (!def.hire) return 'none';
  if (companions.length >= 3 || companions.some((c) => c.def.id === def.id)) return 'full';
  if (!free && !inventory.spend(def.hire.cost)) return 'poor';
  const post = area.npcs.find((n) => n.def.id === def.id);
  if (post) post.hidden = true;
  let slot = 0;
  while (companions.some((c) => c.slot === slot)) slot++;
  const c = new Companion(def, new Vector3(controller.pos.x, controller.pos.y, controller.pos.z), (x, z, y) => world.heightAt(x, z, y), slot);
  companions.push(c);
  scene.add(c.rig.root, c.rig.trailObject);
  hud.setCompanions(companions.map((x) => x.def.name));
  if (!free) { audio.fanfare(); hud.announce(`${def.name} joins you`); events.emit({ kind: 'trade', what: 'hire', item: def.id }); }
  return 'ok';
}

const worldState = new WorldState(events);
const story = new Story({
  quests: adventures.quests,
  state: worldState,
  events,
  wallet: adventures.wallet,
  dw: adventures.dw,
  trade: () => {},
  hire: (id) => { const npc = area.npcs.find((n) => n.def.id === id); return npc ? hireNpc(npc.def) : 'none'; },
  dismiss: (id) => { const c = companions.find((x) => x.def.id === id); if (!c) return false; dismiss(c); return true; },
  isHireable: (id) => !!area.npcs.find((n) => n.def.id === id)?.def.hire,
  isFollowing: (id) => companions.some((c) => c.def.id === id),
  hasShop: (id) => !!area.npcs.find((n) => n.def.id === id)?.def.shop,
  follow: (id) => {
    const npc = area.npcs.find((n) => n.def.id === id);
    if (!npc || id !== 'bride') return;
    // (Asked at the after-party: everyone goes home first, she walks from her own sand.)
    concert.disperse();
    // There and held there: the second leg is the same spot, so she stops at the shore.
    npc.walk([[npc.pos.x, npc.pos.z], [BRIDE_SHORE.x, BRIDE_SHORE.z], [BRIDE_SHORE.x + 0.01, BRIDE_SHORE.z]], 1.6);
    hud.announce('The Pale Bride walks to where the sand ends');
  },
  npcsNear: (x, z, r) => area.npcs
    .filter((n) => !n.hidden && Math.hypot(n.pos.x - x, n.pos.z - z) < r)
    .map((n) => ({ id: n.def.id, bubble: (text: string) => {
      n.bubble(text);
      // A bark is babbled too, fainter the farther off it is said.
      const d = Math.hypot(n.pos.x - controller.pos.x, n.pos.z - controller.pos.z);
      if (d < 22) babble(n.def.id, text, 0.75 * (1 - d / 22));
    } })),
  playerAt: () => ({ x: controller.pos.x, z: controller.pos.z }),
  hireCost: (id) => area.npcs.find((n) => n.def.id === id)?.def.hire?.cost,
  companions: () => companions.length,
});
adventures.story = story;
/** Where the first open quest points, in this zone (main first, as the journal sorts): the minimap's tick. */
function objective(): { x: number; z: number } | null {
  const z = placeZone();
  return adventures.quests.journal().find((j) => !j.done && j.marker?.zone === z)?.marker ?? null;
}

function placeZone(): Zone {
  const hit = REALMS.find((r) => Math.hypot(controller.pos.x - r.x, controller.pos.z - r.z) < r.radius);
  return (hit?.id ?? 'island') as Zone;
}
const openedChests = new Set<string>();
const chestProps = new Map<string, Object3D>();
function snapshot(): SaveV1 {
  const hp: Record<string, number> = {};
  for (const [id, n] of combat.hp) hp[id] = n;
  return {
    v: 1, t: Date.now(), zone: placeZone(),
    pos: { x: controller.pos.x, y: controller.pos.y, z: controller.pos.z }, yaw: controller.yaw,
    hero: party.active.id, hp, inventory: inventory.snapshot(),
    quests: adventures.quests.snapshot(), slain: adventures.quests.slain(),
    flags: worldState.snapshot().flags, state: worldState.snapshot(), progress: { xp: progress.xp, level: progress.level },
    bosses: { ...bosses }, chests: [...openedChests], companions: companions.map((c) => c.def.id), newGamePlus,
    titles: titles.snapshot(),
    titleProgress: titles.progress(),
  };
}
let newGamePlus = false;
/** Silly titles earned (game/Hype.ts): restored from the save. */
let titles = new Titles();
/** Experience for the party: the pop over the bar, and a level's moment when it crosses one. */
function gainXp(n: number): void {
  if (progress.level >= MAX_LEVEL || !(n > 0)) return;
  hud.xpPop(n);
  if (progress.add(n) > 0) {
    combat.level = progress.level;
    hud.setParty(ROSTER, party.activeIndex, fallen(), progress.level);
    hud.announce(`Level ${progress.level}`);
    // The level's moment: a fanfare, a gold ring and a shower of sparks round the hero, the hype man shouting it.
    audio.levelUp();
    hud.hype(`LEVEL UP!`, 6);
    const at = new Vector3(controller.pos.x, controller.pos.y + 0.2, controller.pos.z);
    combatFx.shock(at, 0xffc23a, 9);
    combatFx.sparks(at.clone().setY(at.y + 1), new Vector3(0, 1, 0), 40, 0xffd870, 8, 1.4);
    renderer.pulse(0.45);
    events.emit({ kind: 'feat', what: 'levelup', level: progress.level });
  }
  showXp();
  save.markDirty();
}
/** The experience bar: how far into this level. */
function showXp(): void { hud.setXp(progress.level >= MAX_LEVEL ? 1 : progress.xp / xpFor(progress.level)); }
/** What each hero wields shows in the hand: the blade takes the item's colour. */
function weaponGlows(): void {
  ROSTER.forEach((c, i) => {
    const e = inventory.equipped(c.id);
    rigs[i].setWeaponGlow(e ? ITEMS[e.itemId].color ?? null : null);
  });
}

function applySave(s: SaveV1): void {
  inventory.restore(s.inventory);
  weaponGlows();
  adventures.quests.restore(s.quests);
  adventures.quests.restoreSlain(s.slain);
  if (s.state && typeof s.state === 'object') worldState.restore(s.state as Parameters<WorldState['restore']>[0]);
  progress.xp = s.progress.xp;
  progress.level = s.progress.level;
  titles = new Titles(s.titles ?? [], s.titleProgress ?? {});
  showXp();
  openedChests.clear();
  for (const id of s.chests) openedChests.add(id);
  for (const [id, n] of Object.entries(s.hp)) combat.hp.set(id, n);
  newGamePlus = s.newGamePlus;
  combat.level = progress.level;
  if (newGamePlus) combat.beginPlus();
  for (const k of Object.keys(bosses)) delete bosses[k];
  Object.assign(bosses, s.bosses);
  for (const e of combat.enemies) {
    const rec = bosses[e.def.kind];
    if (!rec) continue;
    const elapsed = (Date.now() - rec.slainAt) / 1000;
    if (elapsed < e.def.respawn) { e.hp = 0; e.brain.kill(); e.deadFor = elapsed; }
  }
  for (const [id, obj] of chestProps) obj.visible = !openedChests.has(id);
  for (const id of s.companions) { const npc = area.npcs.find((n) => n.def.id === id); if (npc) hireNpc(npc.def, true); }
  teleport(s.pos.x, s.pos.y, s.pos.z, s.yaw);
}
let resumed = false;

function chestReady(id: string): boolean {
  const at = openedAt.get(id);
  if (at === undefined) return true;
  if (playTime - at < CHEST_RESPAWN) return false;
  openedAt.delete(id);
  openedChests.delete(id);
  const prop = chestProps.get(id);
  if (prop) prop.visible = true;
  return true;
}
/** Opens a chest where its prop stands (`at`: levelSpot may have moved it up to 4 m off the table's spot). */
function openChest(c: ChestDef, at: { x: number; y: number; z: number }): void {
  if (!chestReady(c.id)) return;
  openedChests.add(c.id);
  openedAt.set(c.id, playTime);
  const { x, y, z } = at;
  // Its moment: the creak, the lid, the coins; a gold burst and a little shake.
  audio.chest();
  combatFx.sparks(new Vector3(x, y + 0.8, z), new Vector3(0, 1, 0), 34, 0xffc23a, 7, 1.2);
  combatFx.flash(new Vector3(x, y + 0.8, z), 0xffd870, 2.2);
  tpc.shake(0.25);
  if (c.kind === 'mimic') {
    combat.wake('bucket', x, z);
    hud.announce('The hoard stands up');
  } else {
    combat.loot.spawn(rollDrops(c.table.map((d) => ({ itemId: d.itemId, chance: d.chance })), c.shards), new Vector3(x, y + 0.6, z));
    hud.announce(c.kind === 'cache' ? 'A cache' : 'A hoard');
  }
  chestProps.get(c.id)!.visible = false;
  events.emit({ kind: 'feat', what: 'chest' });
  save.write(snapshot());
}
for (const c of CHESTS) {
  const id = c.kind === 'cache' ? 'barrel' : 'coin-block';
  // On level ground all under it (it sat on a post's top on the Vale castle's shelf), moved up to 4 m to find it.
  const spot = levelSpot((x, z) => world.heightAt(x, z), c.x, c.z, c.kind === 'cache' ? 0.5 : 0.8, 4);
  const placed = modelLandmark(id, spot.x, spot.z, spot.y, { yaw: 0.4 });
  area.adopt(c.zone === 'island' ? null : c.zone, placed.object);
  chestProps.set(c.id, placed.object);
  area.heights.add(...placed.footprints);
  area.interactables.push({
    pos: placed.root.position, range: 2.6, zone: c.zone === 'island' ? null : c.zone,
    label: () => chestReady(c.id) ? (c.kind === 'cache' ? 'Open the cache' : 'Open the hoard') : null,
    act: () => openChest(c, spot),
  });
}
const hoardGlints = new Glints(16, 8);
scene.add(hoardGlints.group);
for (const c of CHESTS) if (c.kind === 'hoard') hoardGlints.add(chestProps.get(c.id)!.position, new Vector3(0, 0.8, 0), 0.45);

// The Drowned Bell, in the lane behind the Fish King's throne: there only while he is asking for it.
const BELL_AT = new Vector3(-1000, -46.6, -92);
const bellProp = modelLandmark('hanging-lantern', BELL_AT.x, BELL_AT.z, BELL_AT.y - 0.6, { collider: 'none' });
const bellGlow = glowSprite(0x37f5ff, 3.2, 0.7, false);
bellGlow.position.y = 0.6;
bellProp.root.add(bellGlow);
area.adopt('sunken', bellProp.object);
bellProp.object.visible = false;
const bellWanted = () => adventures.quests.stage('bell') === 'active' && !inventory.has('drowned-bell');
area.interactables.push({
  pos: BELL_AT, range: 3, zone: 'sunken',
  label: () => (bellWanted() ? 'Take the Drowned Bell' : null),
  act: () => {
    inventory.add('drowned-bell', 1);
    events.emit({ kind: 'loot', item: 'drowned-bell', rarity: 4 });
    hud.announce('The Drowned Bell');
  },
});
// The Pale Bride's walk ends here: she hears the bells once the bell is out of the lane.
const BRIDE_SHORE = { x: 56, z: 68 };
function storyProps(): void {
  bellProp.object.visible = bellWanted();
  if (adventures.quests.stage('bride') !== 'walking') return;
  const bride = area.npcs.find((n) => n.def.id === 'bride');
  if (bride && Math.hypot(bride.pos.x - BRIDE_SHORE.x, bride.pos.z - BRIDE_SHORE.z) < 1.5) adventures.quests.step('bride', 'done', adventures.wallet);
}

const ambience = new Ambience(audio);
const concert = new Concert({
  area, camera, fx: combatFx,
  enemies: () => combat.enemies as unknown as ReadonlyArray<{ object: { visible: boolean }; brain: { p: { aggroRange: number } }; pos: { x: number; z: number } }>,
  place: (x, y, z) => teleport(x, y, z, -Math.PI / 2),
  heightAt: (x, z, y) => world.heightAt(x, z, y),
});
const awakenFrom = new Vector3();
/** Where the camera ends its ride: before the Stone Head's face. */
const AWAKEN_CAM = new Vector3(LAYOUT.head.x, 16, LAYOUT.head.z + 34);
let awakenStarted = false;
/** While the ending lights the sky: 0..1 aurora on top of the place's own. */
let endingAurora = 0;

const ending = new Ending({
  events,
  play: (id) => audio.score.play(id as 'ending'),
  awaken: (_t, look) => {
    if (!awakenStarted) { awakenStarted = true; awakenFrom.copy(camera.position); }
    camera.position.lerpVectors(awakenFrom, AWAKEN_CAM, look.dolly);
    camera.lookAt(HEAD_EYES.x, HEAD_EYES.y, HEAD_EYES.z);
    HEAD_LIT.value = look.eyes;
    WINDOWS.value = look.windows;
    moonFace.setCrescent(look.crescent, look.warm);
    endingAurora = look.aurora;
  },
  concert: () => concert.start(),
  concertTick: (t, dt) => concert.tick(t, dt),
  bubble: (text) => area.npcs.find((n) => n.def.id === 'cup-gnome')?.bubble(text),
  titleCard: (artist, title, seconds) => hud.announce(`${artist} · ${title}`, { seconds, priority: 1 }),
  credits: (lines, button, onContinue) => hud.credits(lines, button, onContinue),
  leftParty: () => Math.hypot(controller.pos.x - GALAXY.x, controller.pos.z - GALAXY.z) > GALAXY.radius,
  disperse: () => concert.disperse(),
  onPlus: () => { newGamePlus = true; combat.beginPlus(); hud.announce('New Game+'); if (resumed) save.write(snapshot()); },
});
function startNewGame(): void {
  save.clear();
  freshStart = true;
  hud.setPress('CLICK TO ENTER THE FOG');
  hud.setSavePresent(false);
}
hud.setOnNewGame(startNewGame);
hud.setSavePresent(save.has());
// (Never before the player has entered: the zone event at startup would overwrite the save with a blank game.)
// Swung at within reach, an NPC steps back.
events.on('feat', (e) => { if (e.what === 'attack') for (const n of area.npcs) if (!n.def.invisible) n.startle(controller.pos); });
// Bystanders react (models/Emotes.ts): a cheer or a dance at a kill near them, the YMCA for a boss, a shrug when the
// party falls, a cheer for a level.
const bystanders = (at: { x: number; z: number }, r: number) => area.npcs.filter((n) => !n.hidden && Math.hypot(n.pos.x - at.x, n.pos.z - at.z) < r);
events.on('kill', (e) => { for (const n of bystanders(e.at, e.boss ? 80 : 18)) n.react(e.boss ? 'boss' : 'kill'); });
events.on('wipe', () => { for (const n of bystanders(controller.pos, 30)) n.react('wipe'); });
events.on('feat', (e) => { if (e.what === 'levelup') for (const n of bystanders(controller.pos, 30)) n.react('levelup'); });
// A quest finished: the fanfare and a shout (the banner is Story's).
events.on('quest', (e) => { if (questNode(e.id)?.stages[e.stage]?.terminal) { audio.fanfare(); hud.hype('Quest complete!', 4); gainXp(xpForQuest(progress.level)); } });
// Silly titles (game/Hype.ts): a toast and a kazoo.
events.onAny((e) => {
  const t = titles.on(e);
  if (!t) return;
  hud.titleEarned(t.title, t.quip);
  audio.tada();
  save.markDirty();
});
events.on('zone', () => { if (resumed) save.write(snapshot()); });
events.on('quest', () => { if (resumed) save.write(snapshot()); });

window.addEventListener('keydown', (e) => {
  // (Held keys repeat: a held digit would pick choice after choice, a held I would flicker the bag.)
  if (e.repeat) return;
  if (e.code === 'KeyN' && !input.locked) { startNewGame(); return; }
  const digit = /^Digit([1-9])$/.exec(e.code);
  if (digit && hud.pickChoice(Number(digit[1]))) return;
  if (e.code === 'KeyJ' && hud.panel === 'none') { openPanel(() => hud.journal(adventures.quests.journal())); return; }
  if (e.code === 'KeyI') {
    if (hud.panel === 'inventory') closePanel();
    else if (hud.panel === 'none') openPanel(() => hud.inventoryPanel());
  } else if (e.code === 'Escape' && hud.panel !== 'none') closePanel();
});
const unlockAudio = () => audio.unlock();
window.addEventListener('mousedown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
// The title screen's music (the intro sample, then the loop) from the moment the game opens until play begins.
// Most browsers keep sound off until the first click or key press: that first press only starts the music, and the
// next click enters the game.
let titleMusic = !debugAt && audio.hasMusic('title-intro', 'title-loop');
if (titleMusic) {
  audio.unlock();
  audio.title(true);
  if (audio.suspended) { input.hold = true; hud.setPress('CLICK TO BEGIN'); }
}
// (A save always shows on the title: the block above runs only when licensed title music ships.)
if (!input.hold && !debugAt && save.has()) hud.setPress('CLICK TO CONTINUE · N NEW GAME');

// Title cinematic: a slow dolly up the causeway toward the head while the pointer is not locked.
const HEAD_EYES = new Vector3(LAYOUT.head.x, terrain.heightAt(LAYOUT.head.x, LAYOUT.head.z) - 3 + LAYOUT.head.height * 0.69, LAYOUT.head.z);
let cinematicT = 0;
let wasLocked = false;
/** The realm pause: a slow circle of the hero (radians per second), and the camera rig's pitch and distance for it. */
const ORBIT = { rate: 0.12, pitch: 0.22, distance: 6 };
/** The gameplay camera's pitch and distance while the orbit borrows the rig; put back on relock (its yaw stays where the orbit left it: no pop). */
let orbitFrom: { pitch: number; distance: number } | null = null;
function endOrbit(): void {
  if (!orbitFrom) return;
  tpc.pitch = orbitFrom.pitch;
  tpc.distance = orbitFrom.distance;
  orbitFrom = null;
}

window.addEventListener('resize', () => {
  renderer.resize(window.innerWidth, window.innerHeight);
  camera.aspect = renderer.aspect;
  camera.updateProjectionMatrix();
});

const HARVEST = new Set(['wood', 'plank', 'stone']);

/** An item on the ground becomes the hero's: it flies in, chimes by rarity (a jackpot for the rare ones), is announced. */
function takeItem(pickup: Pickup): void {
  if (pickup.drop.kind !== 'item') return;
  const def = ITEMS[pickup.drop.itemId];
  combat.loot.take(pickup);
  const n = Math.max(1, pickup.drop.count);
  inventory.add(def.id, n);
  if (def.rarity >= 3) { audio.jackpot(); hud.hype(def.rarity >= 4 ? 'JACKPOT' : 'Ooh, shiny', def.rarity + 1); renderer.pulse(0.35); } else audio.loot(def.rarity);
  // (The harvest counts up: "Wood ×3 · 17 in the bag".)
  hud.announce(n > 1 || HARVEST.has(def.id) ? `${def.name} ×${n} · ${inventory.count(def.id)} in the bag` : `${def.name}`);
  events.emit({ kind: 'loot', item: def.id, rarity: def.rarity });
}

/** What F would do right now: loot first, then talk; last, a companion you walked up to goes home. */
function interactTarget(): { kind: 'loot'; take: () => void; label: string } | { kind: 'use'; act: () => void; label: string } | { kind: 'talk'; npc: Npc; label: string } | { kind: 'dismiss'; companion: Companion; label: string } | null {
  const p = interactAt.set(controller.pos.x, controller.pos.y, controller.pos.z);
  const pickup = combat.loot.nearest(p, 2.8);
  if (pickup && pickup.drop.kind === 'item') {
    const def = ITEMS[pickup.drop.itemId];
    return { kind: 'loot', label: `Take ${def.name}`, take: () => takeItem(pickup) };
  }
  const zone = REALMS.find((r) => Math.hypot(p.x - r.x, p.z - r.z) < r.radius)?.id ?? null;
  const use = adventures.interact(zone);
  if (use) return { kind: 'use', label: use.label, act: use.act };
  let best: Npc | null = null;
  let bd = Infinity;
  for (const n of area.npcs) {
    if (n.hidden) continue;
    const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z);
    if (d < n.talkRange && d < bd && Math.abs(n.pos.y - p.y) < 6) { bd = d; best = n; }
  }
  if (best) return { kind: 'talk', npc: best, label: `Talk to ${best.def.name}` };
  // A companion waiting at your side (you stood still by it, walked up to it and face it; no enemy on its mind): send it home.
  let comp: Companion | null = null;
  let cd = Infinity;
  for (const c of companions) {
    const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
    if (d < cd && c.beside) { cd = d; comp = c; }
  }
  if (comp) return { kind: 'dismiss', companion: comp, label: `Send ${comp.def.name} home` };
  return null;
}

/** Sends a companion home: off the scene, back at their post (the hire hid it), hireable again. `fell`: beaten to 0 HP. */
function dismiss(c: Companion, fell = false): void {
  companions.splice(companions.indexOf(c), 1);
  scene.remove(c.rig.root, c.rig.trailObject);
  const post = area.npcs.find((n) => n.def.id === c.def.id);
  if (post) post.hidden = false;
  hud.setCompanions(companions.map((x) => x.def.name));
  hud.unhire(c.def.id);
  audio.click();
  hud.announce(fell ? `${c.def.name} went home` : `${c.def.name} goes home`);
  events.emit({ kind: 'trade', what: 'dismiss', item: c.def.id });
}

/** F: take the loot, use the door or boat (or put the sack down), talk to whoever is near, or send a companion home. */
function pressF(): void {
  const t = interactTarget();
  if (t?.kind === 'loot') t.take();
  else if (t?.kind === 'use') t.act();
  else if (t?.kind === 'talk') {
    talking = t.npc;
    audio.talk();
    events.emit({ kind: 'talk', npc: t.npc.def.id });
    // A conversation with choices (quests) when the NPC has one; otherwise its ordinary lines.
    const node = adventures.talk(t.npc.def.id);
    if (node) openPanel(() => hud.dialogue(t.npc.def, node, sayLine(t.npc.def.id)));
    else { t.npc.speak(); openPanel(() => hud.talk(t.npc.def)); }
  } else if (t?.kind === 'dismiss') dismiss(t.companion);
}

const focus = new Vector3();
/** Where the camera looks on the ground (Tab's "in front"), and the locked-on target's middle. */
const lookAhead = new Vector3();
const lockAt = new Vector3();
game
  .add({
    update(dt) {
      prevPos.set(controller.pos.x, controller.pos.y, controller.pos.z);
      const { dx, dy } = input.takeMouseDelta();
      if (input.locked) tpc.rotate(dx, dy);
      party.update(dt);
      // F1-F3 switch hero; 1-7 pick a slot on the bar; right click casts it at the crosshair, left click is the weapon.
      if (input.locked) for (let i = 0; i < ROSTER.length; i++) if (input.justPressed(`F${i + 1}`)) switchTo(i);
      if (input.locked) for (let k = 1; k <= 7; k++) {
        // (Shift+1-7: the second page, the reel moves.)
        if (input.justPressed(`Digit${k}`)) spellBar.select(party.active.id, barKey(`Digit${k}`, input.isDown('ShiftLeft') || input.isDown('ShiftRight'))!);
      }
      if (input.locked && input.justPressed('KeyF')) pressF();
      if (input.locked && input.justPressed('KeyE')) pressF();
      // Tab: lock on to the nearest enemy in front of the camera, or let go.
      if (input.locked && input.justPressed('Tab')) combat.toggleLock(tpc.forward(lookAhead));
      const hero = party.active.id;
      const picked = spellBar.selected(hero);
      const slot = BAR[hero][picked];
      combat.barSlot = picked;
      // Right click: a cast (Telekinesis is held instead; so is Sir Aldric's slam while a mob hangs from his fist).
      const holding = combat.carry.hand !== null;
      const mind = input.locked && input.mouseDown(2) && (!!slot.hold || holding);
      // Hold right click to aim (the preview shows what it will do); let go to cast, Esc to cancel.
      if (!slot.hold && !holding) {
        const held = aimHold.update(input.locked && input.mouseDown(2), !input.locked || input.justPressed('Escape'), picked);
        if (held.release) spellBuffer.push(held.slot);
      } else aimHold.update(input.locked && input.mouseDown(2), true, picked);
      showAim(hero, picked, dt);
      const buffered = spellBuffer.peek(dt);
      // The aim reaches as far as the spell about to be cast (a buffered one), else the picked one: Earthsplitter's
      // leap range must not stick to every aim after it (Telekinesis' grab, the other heroes).
      const { cast: act, aim: aimAct } = barActs(hero, buffered, picked);
      castRange = aimAct?.kind === 'spell' ? spellRange(SPELLS[hero][aimAct.slot].id) : AIM_RANGE;
      const castsBefore = combat.spellsCast;
      const swing = lmb.update(dt, input.locked && input.mouseDown(0));
      combat.update(dt, {
        attack: swing.attack,
        heavyHeld: swing.heavyHeld,
        heavyRelease: swing.heavyRelease,
        skill: act?.kind === 'skill',
        spell: act?.kind === 'spell' ? act.slot : null,
        burst: act?.kind === 'burst',
        mind,
        dodge: input.locked && input.justPressed('KeyR'),
        grab: input.locked && input.justPressed('KeyG'),
      });
      if (combat.spellsCast !== castsBefore) spellBuffer.done();
      liftGlow.update(dt, input.locked && !!slot.hold && !combat.carry.mind ? combat.carry.glowTarget(dt) : null);
      // Telekinesis held: the beam from his hand to the hold.
      const held = combat.carry.holding();
      const cs = controller;
      mindBeam.update(dt, held ? { from: handAt.set(cs.pos.x + Math.cos(cs.yaw) * 0.5, cs.pos.y + 1.55, cs.pos.z + Math.sin(cs.yaw) * 0.5), to: held.to, r: held.r } : null);
      // (Winding up a heavy he stands; Wren walks slowly with her bow drawn: chargeMove.)
      const chargeK = chargeMove(party.active.id, combat.charging > 0);
      const move = input.locked && !combat.busy && chargeK > 0 ? tpc.moveToWorld(input.moveAxis()) : { x: 0, z: 0 };
      const space = input.locked && input.justPressed('Space');
      adventures.update(dt);
      worldState.setShards(inventory.shards);
      worldState.setLevel(progress.level);
      worldState.setCompanions(companions.length);
      story.update(dt);
      storyProps();
      playTime += dt;
      shopClock += dt;
      if (shopClock >= 600) { shopClock = 0; shopLeft.clear(); }
      hoardGlints.update(dt);
      if (resumed) save.tick(dt, snapshot);
      if (input.locked) { audio.score.zone(placeZone()); ambience.zone(placeZone(), dt); }
      controller.speedScale = (combat.webbed > 0 ? 0 : combat.slowed > 0 ? 0.6 : combat.mired > 0 ? 0.55 : 1) * combat.carry.carrySlow * chargeK;
      if (adventures.riding) { if (space) adventures.leaveBoat(); }
      // Driving the carriage: W/S and A/D take the reins, Space climbs down.
      else if (CARRIAGE.driving) {
        if (space) { CARRIAGE.driving = false; CARRIAGE.speed = 0; controller.vel.y = 5; controller.mode = 'air'; }
        else CARRIAGE.drive(input.locked ? (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0) : 0, input.locked ? (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0) : 0, dt);
        if (CARRIAGE.driving) pinToCarriage();
      }
      // In a giant's fist: no moving until thrown.
      else if (combat.held) { /* the combat system carries the hero */ }
      else {
      growShrooms(dt);
      stepController(controller, {
        move,
        sprint: input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
        jump: space && !combat.busy,
        jumpHeld: input.isDown('Space'),
        // Space again in the air takes off; hold Space to climb, C to dive, X to let go (Ctrl+W would close the tab).
        fly: space,
        ascend: input.isDown('Space'),
        descend: input.isDown('KeyC'),
        stopFly: input.locked && input.justPressed('KeyX'),
        hold: combat.busy || combat.charging > 0,
      }, world, dt);
      standOnShrooms();
      }
      // Bodies on foot stand their ground (CombatSystem.blockHero), after the step so no frame shows the hero inside one.
      if (!adventures.riding && !CARRIAGE.driving) combat.blockHero();
      // Off the edge of the world: nothing stops you walking off a cliff; the fog sets you back where you last stood.
      if (input.locked && !CARRIAGE.driving) {
        const p = controller.pos;
        const under = area.ground.heightAt(p.x, p.z);
        safeClock -= dt;
        if (controller.mode === 'ground' && safeClock <= 0 && under > ABYSS_LINE) {
          safeClock = 0.4;
          const lip = [[3, 0], [-3, 0], [0, 3], [0, -3]].some(([dx, dz]) => area.ground.heightAt(p.x + dx, p.z + dz) < p.y - 3.5);
          if (!lip && Math.abs(p.y - world.heightAt(p.x, p.z, p.y + 1)) < 0.4) safeStand.set(p.x, p.y, p.z);
        }
        if (p.y < safeStand.y - FALL_RECOVER && under < p.y + 1) {
          teleport(safeStand.x, safeStand.y, safeStand.z, controller.yaw);
          combat.loseShare(0.08);
          hud.announce('The fog sets you back on solid ground', { seconds: 2.2 });
        }
      }
      // Feats of movement, once per entry: a take-off, a swim, a climb, a mushroom bounce, taking the carriage's reins.
      if (controller.mode !== lastMode) { if (controller.mode === 'fly' || controller.mode === 'swim' || controller.mode === 'climb') events.emit({ kind: 'feat', what: controller.mode }); lastMode = controller.mode; }
      if (!!controller.bouncing !== wasBouncing) { if (controller.bouncing) events.emit({ kind: 'feat', what: 'bounce' }); wasBouncing = !!controller.bouncing; }
      if (CARRIAGE.driving !== wasDriving) { if (CARRIAGE.driving) events.emit({ kind: 'feat', what: 'carriage' }); wasDriving = CARRIAGE.driving; }
      // Portals: step into one to cross between the island and the realms.
      portalCooldown -= dt;
      if (portalCooldown <= 0) {
        for (const l of area.portals) {
          if (Math.hypot(controller.pos.x - l.at.x, controller.pos.z - l.at.z) > l.radius || Math.abs(controller.pos.y - l.at.y) > l.height) continue;
          // No portal works inside the frog's dream (there are none there) — nor out of it.
          if (adventures.dreamLeft > 0) break;
          teleport(l.to.x, world.heightAt(l.to.x, l.to.z), l.to.z, l.to.yaw, l.name);
          tpc.yaw = l.to.cameraYaw;
          break;
        }
      }
      // Fallen out of the world: back on the island's spawn, or, out of a realm, back in the middle of that realm.
      const fallRealm = REALMS.find((r) => Math.hypot(controller.pos.x - r.x, controller.pos.z - r.z) < r.radius);
      if (controller.pos.y < (fallRealm ? fallRealm.y - 30 : -70)) {
        const to = fallRealm ? { x: fallRealm.x, z: fallRealm.z, y: world.heightAt(fallRealm.x, fallRealm.z, fallRealm.y + 60) } : SPAWN;
        teleport(to.x, to.y, to.z, controller.yaw);
        controller.flung = 0;
      }
      playerPos.set(controller.pos.x, controller.pos.y, controller.pos.z);
      const targets = companions.length ? combat.enemies.map((e) => ({ id: e.id, pos: e.pos, alive: e.alive, aggro: e.aggro })) : [];
      for (const c of companions) {
        const strike = c.update(dt, playerPos, controller.yaw, targets);
        if (strike !== null) { combat.companionStrike(strike, c.def.hire!.atk); audio.swing(false); }
      }
      // Beaten down to 0 HP by the mobs, a companion leaves the fight and goes home.
      for (let i = companions.length - 1; i >= 0; i--) if (companions[i].down) dismiss(companions[i], true);
      hud.setStamina(controller.stamina, CONTROLLER.maxStamina);
      // The F prompt, ten times a second (pressing F looks again at once).
      interactIn -= dt;
      // Walked onto: a landed item is taken without F (the full pass of 2026-11-15: no F per bone).
      if (input.locked && hud.panel === 'none' && !combat.isDown && !adventures.riding && !CARRIAGE.driving) {
        for (const p of combat.loot.touching(interactAt.set(controller.pos.x, controller.pos.y, controller.pos.z))) takeItem(p);
      }
      if (interactIn <= 0) { interactIn = 0.1; const t = interactTarget(); hud.setInteract(t ? t.label : null); }
      input.endStep();
    },
    render(alpha, dt) {
      // In a boat the river carries you even while a conversation pauses the game.
      adventures.pinToBoat();
      if (CARRIAGE.driving) pinToCarriage();
      const rig = rigs[party.activeIndex];
      // Drawn between the last two fixed steps (smooth on 120/144 Hz screens); a jump of metres is a teleport.
      drawPos.set(controller.pos.x, controller.pos.y, controller.pos.z);
      if (!adventures.riding && !CARRIAGE.driving && !game.paused && drawPos.distanceToSquared(prevPos) < 16) drawPos.lerpVectors(prevPos, drawPos, Math.min(1, alpha));
      rig.root.position.copy(drawPos);
      rig.root.rotation.y = yawToRotation(controller.yaw);
      // On the ground the body tips with the slope and leans into turns (SlopeLean); flying, swimming, climbing, in a
      // boat or on the carriage's bench it eases upright.
      if (controller.mode === 'ground' && !adventures.riding && !CARRIAGE.driving) {
        const e = 0.6, y = drawPos.y + 0.5;
        const gx = (world.heightAt(drawPos.x + e, drawPos.z, y) - world.heightAt(drawPos.x - e, drawPos.z, y)) / (2 * e);
        const gz = (world.heightAt(drawPos.x, drawPos.z + e, y) - world.heightAt(drawPos.x, drawPos.z - e, y)) / (2 * e);
        // (A step or a wall edge under one sample is not a slope: past 45° it is ignored.)
        if (Math.hypot(gx, gz) < 1) rig.slope(gx, gz, controller.yaw, Math.hypot(controller.vel.x, controller.vel.z), dt);
        else rig.slope(0, 0, controller.yaw, Math.hypot(controller.vel.x, controller.vel.z), dt);
      } else rig.slope(null, 0, controller.yaw, 0, dt);
      const airborne = controller.mode === 'air' || controller.mode === 'fly';
      if (wasAirborne && !airborne) landedAt = performance.now() / 1000;
      wasAirborne = airborne;
      // Hit-stop freezes the bodies on the blow (the hero's and the enemies'); the world's effects keep real time.
      const animDt = game.hitStop > 0 ? 0 : dt;
      rig.animate({
        mode: controller.mode,
        speed: Math.hypot(controller.vel.x, controller.vel.z),
        attack: combat.attackProgress,
        attackKind: combat.attackKind,
        spellId: combat.castSpellId,
        attackDuration: combat.attackDuration,
        charging: combat.charging > 0,
        landed: performance.now() / 1000 - landedAt,
        burst: combat.burstState,
        climbRate: controller.mode === 'climb' && dt > 0 ? (controller.pos.y - lastClimbY) / dt + Math.hypot(controller.vel.x, controller.vel.z) * 0.5 * Math.sign(controller.pos.y - lastClimbY || 1) : 0,
        hurt: combat.hurtState,
        dodge: combat.dodgeState,
        dead: combat.dead,
        holding: combat.carry.hand ? Math.min(1, combat.carry.hand.t / 0.2) : 0,
      }, animDt);
      // Each foot on its own ground across a slope or a step (FootIK).
      rig.plantFeet((x, z, y) => world.heightAt(x, z, y), animDt);
      lastClimbY = controller.pos.y;
      // Benched party members are hidden: no need to animate them (companions animate in the fixed step, which hit-stop pauses).
      combat.render(animDt);
      lightBudget.update(playerPos, dt);
      ejecta.update(dt);
      billow.update(dt);
      // Footsteps: a recorded take for the ground under the foot (grass, stone, snow), one per stride.
      {
        const sp = Math.hypot(controller.vel.x, controller.vel.z);
        if (stepClock.update(dt, sp, controller.mode === 'ground')) {
          const { x, z, y } = controller.pos;
          const f = terrain.field;
          const ix = Math.round((x - f.s.x0) / f.s.cell), iz = Math.round((z - f.s.z0) / f.s.cell);
          const inside = ix >= 0 && iz >= 0 && ix <= f.n && iz <= f.n;
          const o = inside ? f.indexOf(ix, iz) * LAYER_COUNT : 0;
          const built = world.heightAt(x, z, y + 0.3) > terrain.heightAt(x, z) + 0.15;
          audio.footstep(surfaceOf(inside ? f.layers.subarray(o, o + LAYER_COUNT) : null, built), Math.min(1, 0.5 + sp * 0.08));
        }
      }
      if (qualityMode === 'auto' && autoQuality.level === 'high' && autoQuality.update(dt, renderer.frameTime, renderer.atMinRatio) === 'low') {
        applyQuality();
        hud.announce('Quality lowered for a smoother frame rate (ESC to change)');
      }
      focus.set(drawPos.x, drawPos.y + 1.4, drawPos.z);
      if (!input.locked && hud.panel === 'none') {
        if (REALMS.some((r) => Math.hypot(drawPos.x - r.x, drawPos.z - r.z) < r.radius)) {
          // Inside a realm the island (and the causeway the dolly rides) is hidden: circle the hero slowly instead, on
          // the camera's own spring arm, so a room's walls pull it in rather than let it through them (the indoor
          // realms are smaller than the circle). It takes over from where the camera was and eases out to 6 m.
          if (!orbitFrom) orbitFrom = { pitch: tpc.pitch, distance: tpc.distance };
          const ease = Math.min(1, dt * 2);
          tpc.pitch += (ORBIT.pitch - tpc.pitch) * ease;
          tpc.yaw += ORBIT.rate * dt;
          // The arm's own look-ahead samples its length at half-metre steps, so as it eases out a thin solid (a cell of
          // the tavern's hearth wall) can slip between two of them and the floor clamp pops the camera onto it: march
          // the orbit line finely first and let the rig out only as far as it is clear (in at once, out eased).
          const cp = Math.cos(tpc.pitch), sp = Math.sin(tpc.pitch);
          const ox = Math.sin(tpc.yaw) * cp, oz = Math.cos(tpc.yaw) * cp;
          let clear = ORBIT.distance;
          for (let r = 0.3; r <= ORBIT.distance; r += 0.1) {
            const y = focus.y + sp * r;
            if (y < world.heightAt(focus.x + ox * r, focus.z + oz * r, y) + 0.5) { clear = Math.max(0.6, r - 0.4); break; }
          }
          tpc.distance = Math.min(clear, tpc.distance + (ORBIT.distance - tpc.distance) * ease);
          tpc.update(focus, dt);
        } else {
          endOrbit();
          cinematicT += dt;
          const u = (Math.sin(cinematicT * 0.045) + 1) / 2;
          camera.position.set(Math.sin(cinematicT * 0.1) * 2.5, 8.5 + u * 6, 150 - u * 95);
          camera.lookAt(HEAD_EYES.x, HEAD_EYES.y * 0.55, HEAD_EYES.z);
        }
        wasLocked = false;
      } else {
        if (!wasLocked) { endOrbit(); tpc.snapTo(focus); wasLocked = true; }
        // Locked on: the camera eases round to keep the hero and the target in frame (not during the plaza concert).
        if (ending.phase !== 'concert' && ending.phase !== 'awaken') tpc.update(focus, dt, combat.lockPoint(lockAt));
        // A gentle bob with each step on the ground (CameraBob).
        camera.position.y += cameraBob.step(dt, controller.mode === 'ground' && !combat.busy ? Math.hypot(controller.vel.x, controller.vel.z) : 0);
        // `?cam=x,y,z` (debug) pins the camera at a world position looking at the `face` point.
        if (camParam) { camera.position.set(camParam[0], camParam[1], camParam[2]); const fx = faceParam ? faceParam[0] : SPAWN.x; const fz = faceParam ? faceParam[1] : SPAWN.z; camera.lookAt(fx, world.heightAt(fx, fz) + 1.2, fz); }
        // Sizzlin' Slowness: the world leans a little and sways while the lean has hold of you.
        tilt += ((combat.slowed > 0 ? 0.07 + Math.sin(performance.now() / 700) * 0.025 : 0) - tilt) * Math.min(1, dt * 3);
        if (Math.abs(tilt) > 1e-4) camera.rotateZ(tilt);
      }
      playerPos.set(controller.pos.x, controller.pos.y, controller.pos.z);
      // The ground's level of detail follows the camera; its splat shader's clock runs with the frame.
      terrain.update(camera.position);
      GROUND_UNIFORMS.uTime.value += dt;
      audio.setListener(camera.position.x, camera.position.y, camera.position.z, tpc.yaw);
      ending.update(dt);
      sky.update(dt, camera.position);
      moonFace.update(dt);
      // (Strong over the church; full over the Dragon's Vale, where the reel's aurora hangs.)
      const inVale = Math.hypot(playerPos.x - VALE.x, playerPos.z - VALE.z) < VALE.radius;
      const auroraNear = inVale ? 1 : Math.max(0, 1 - Math.hypot(playerPos.x - area.auroraCentre.x, playerPos.z - area.auroraCentre.z) / 90);
      const kingNear = Math.max(0, Math.min(1, 1 - (Math.hypot(playerPos.x - 57, playerPos.z + 129) - 50) / 70));
      skyEvents.update(dt, camera.position, Math.max(auroraNear, endingAurora), kingNear);
      area.update(dt, camera.position, playerPos, talking);
      atmosphere.update(dt, playerPos, camera.position);
      // Realm fog and the sunken city's bubbles.
      const realm = REALMS.find((r) => Math.hypot(playerPos.x - r.x, playerPos.z - r.z) < r.radius);
      // The kingdom's quarters are moonlit night (the @returndark reels); its plaza and cups stay vaporwave.
      const district = realm?.id === 'galaxy' ? leanDistrict(playerPos.x, playerPos.z) : null;
      const air = district ? DISTRICT_AIR[district] : null;
      fogTarget.set(air ? air.fog : realm ? realm.fog.color : islandFog.color);
      // The frog's dream: the fog drifts through every hue.
      if (realm?.cycle) fogTarget.setHSL((performance.now() / 1000 * 0.035) % 1, 0.7, 0.24);
      fog.color.lerp(fogTarget, Math.min(1, dt * 3));
      fog.density += ((air ? air.density : realm ? realm.fog.density : islandFog.density) - fog.density) * Math.min(1, dt * 3);
      kingdomNight.value += ((air?.night ?? 0) - kingdomNight.value) * Math.min(1, dt * 1.5);
      bubbles.group.visible = !!realm?.underwater;
      atmosphere.group.visible = !realm?.indoors;
      // Each world has its own grade (bloom, saturation, lift); the renderer blends toward it.
      renderer.setLook(LOOKS[air?.look ?? realm?.id ?? 'island'] ?? LOOKS.island);
      // (Right after a teleport the new sky is there at once: Sky.setPreset.)
      sky.setPreset(SKIES[realm?.id ?? 'island'] ?? SKIES.island);
      // A realm with a sky of its own (the kingdom, the frog's dream) hides the island's moon, stars and aurora; under
      // the lake the island dome shows only the lake's murk (SKIES.sunken) and none of the sky's apparitions show.
      sky.group.visible = !realm?.ownSky;
      skyEvents.group.visible = !realm?.ownSky && !realm?.underwater;
      // Its water and polished floors reflect the place's own sky (the kingdom's darkens with its night; the island's
      // is its dome's), the cloud sea lies at the place's own level in the place's own air (none under the lake or
      // indoors), and the map shows the place.
      const zone = (realm?.id ?? 'island') as Zone;
      const realmSky = zone === 'galaxy' ? kingdomSkyColors(kingdomNight.value) : REALM_SKY[zone] ?? null;
      sky.setReflection(realmSky);
      area.clouds.setLevel(CLOUD_LEVEL[zone]);
      area.clouds.setAir(realmSky?.horizon ?? null);
      minimap.setZone(realm ?? null, world);
      bubbles.update(dt, camera.position);
      if (weather.update(dt, playerPos, world.ceilingAt(playerPos.x, playerPos.z, playerPos.y) < playerPos.y + 40) > 0) sky.flash = 1;
      const zl = ZONE_LIGHT[district ? 'lean' : realm?.id ?? 'island'] ?? ZONE_LIGHT.island;
      const lk = Math.min(1, dt * 2);
      light.hemi += (zl.hemi - light.hemi) * lk;
      light.moon += (zl.moon - light.moon) * lk;
      light.fill += (zl.fill - light.fill) * lk;
      light.cameraFill += (zl.cameraFill - light.cameraFill) * lk;
      hemi.color.copy(lightSky.lerp(lightTo.set(zl.sky), lk));
      hemi.groundColor.copy(lightGround.lerp(lightTo.set(zl.ground), lk));
      fill.color.copy(lightFill.lerp(lightTo.set(zl.fillColor), lk));
      hemi.intensity = light.hemi + sky.flash * 2.2;
      moon.intensity = light.moon + sky.flash * 1.5;
      moon.position.copy(playerPos).addScaledVector(sky.moonDir, 240);
      moon.target.position.copy(playerPos);
      fill.intensity = light.fill;
      // The fill from the south-east, or swung round to shine from just above the camera along its view.
      fillFixed.set(playerPos.x + 70, playerPos.y + 60, playerPos.z + 110);
      camera.getWorldDirection(fillAim);
      fillCam.copy(camera.position).addScaledVector(fillAim, -40);
      fillCam.y = camera.position.y + 18;
      fill.position.lerpVectors(fillFixed, fillCam, light.cameraFill);
      fill.target.position.copy(playerPos);
      hud.setLocked(input.locked);
      if (input.hold && !audio.suspended) {
        input.hold = false;
        const hasSave = save.has() && !freshStart;
        hud.setPress(hasSave ? 'CLICK TO CONTINUE · N NEW GAME' : 'CLICK TO ENTER THE FOG');
        hud.setSavePresent(hasSave);
      }
      if (titleMusic && input.locked) { audio.title(false); titleMusic = false; }
      if (input.locked && !resumed && !debugAt) {
        resumed = true;
        if (!freshStart) { const stored = save.load(); if (stored) applySave(stored); }
      }
      game.paused = !input.locked;
      minimap.draw(controller.pos.x, controller.pos.z, tpc.yaw, combat.enemies.map((e) => ({ x: e.pos.x, z: e.pos.z, alive: e.alive, aggro: e.aggro, boss: !!e.def.boss })), inventory.reveals(), area.npcs.map((n) => ({ x: n.pos.x, z: n.pos.z })), objective());
      // The fight's effects run on real time (they keep moving through a hit-stop), after the camera has moved.
      combatFx.update(dt, camera);
      renderer.render(scene, camera);
    },
  });
game.start();

declare global {
  interface Window {
    __ginseng: {
      scene: Scene; camera: PerspectiveCamera; terrain: Terrain; world: World['heights']; area: World; sky: Sky; controller: typeof controller;
      party: Party<(typeof ROSTER)[number]>; tpc: ThirdPersonCamera; input: Input; game: Game; renderer: Renderer; combat: CombatSystem;
      /** The fight's pooled effects (live counts: `fx.live`). */
      fx: CombatFx;
      inventory: Inventory; hud: Hud; companions: Companion[]; audio: Audio;
      /** The drawn ground alone, no colliders: what the audits must measure from. */
      groundOnly(x: number, z: number): number;
      /** The save, for the headless reload check. */
      loadSave(): boolean; snapshot(): SaveV1;
      /** Quests and side adventures; F and its current target (headless checks press F without pointer lock). */
      adventures: Adventures; pressF: () => void; interactTarget: typeof interactTarget;
      /** The party's bodies (bones, held props), in roster order. */
      rigs: typeof rigs;
      /** The event bus: what happened (kills, hurts, zones, talks, loot, trades, quests, feats). */
      events: Events;
      ending: Ending; save: Save; progress: Progress;
      /** The realms (id, centre, radius): the audits measure only what stands in the zone the hero is in. */
      realms: typeof REALMS;
      /** Headless play checks: the game's own move (portals, doors and the dream use it), the carriage, the world state, the story. */
      teleport: typeof teleport; carriage: typeof CARRIAGE; worldState: WorldState; story: Story;
      /** The model loader, for the headless character lineup (scripts/perf/anim/lineup.mjs). */
      models: { load: typeof loadModel; ModelRig: typeof ModelRig; MODELS: typeof MODELS };
    };
  }
}
window.__ginseng = { models: { load: loadModel, ModelRig, MODELS }, groundOnly: (x: number, z: number) => area.ground.heightAt(x, z), loadSave: () => { const s = save.load(); if (s) applySave(s); return !!s; }, snapshot, scene, camera, terrain, world, area, sky, controller, party, tpc, input, game, renderer, combat, fx: combatFx, inventory, hud, companions, audio, adventures, pressF, interactTarget, rigs, events, ending, save, progress, realms: REALMS, teleport, carriage: CARRIAGE, worldState, story };

/** Where the crosshair meets the ground, at most AIM_RANGE metres off (`far`: it was clamped to that edge). */
function spellAim(range = AIM_RANGE): { at: Vector3; far: boolean } {
  const dir = camera.getWorldDirection(new Vector3());
  const p = aimPoint(camera.position, dir, (x, z, y) => world.heightAt(x, z, y));
  const dx = p.x - controller.pos.x, dz = p.z - controller.pos.z, d = Math.hypot(dx, dz);
  let far = false;
  if (d > range) { far = true; p.x = controller.pos.x + (dx / d) * range; p.z = controller.pos.z + (dz / d) * range; p.y = world.heightAt(p.x, p.z, controller.pos.y + 3); }
  return { at: new Vector3(p.x, p.y, p.z), far: far || d > range - 0.5 };
}

/** Draws what the spell held on right click will do (AimPreview), or hides it. */
function showAim(hero: string, picked: number, dt: number): void {
  if (!aimPreview) { aimPreview = new AimPreview((x, z, y) => world.heightAt(x, z, y)); scene.add(aimPreview.group); }
  const wheel = input.takeWheel();
  // Something held (a mob in his fist, a building or a mob in Orlan's mind): the arc it will fly to the crosshair.
  const toss = combat.carry.throwPreview();
  if (toss) {
    aimPreview.show({ shape: { kind: 'arc', arc: toss.arc, radius: toss.r }, from: toss.from, to: toss.to, dir: { x: 0, z: 1 }, color: 0x9a7aff, far: false }, dt);
    return;
  }
  const act = BAR[hero][picked]?.action;
  if (!aimHold.aiming || act?.kind !== 'spell') { aimPreview.hide(); holeWheel = 0; return; }
  const s = SPELLS[hero][act.slot];
  const { at, far } = spellAim(spellRange(s.id));
  const c = controller;
  const dx = at.x - c.pos.x, dz = at.z - c.pos.z, l = Math.hypot(dx, dz) || 1;
  const dir = { x: dx / l, z: dz / l };
  const hand = new Vector3(c.pos.x + Math.cos(c.yaw) * 0.6, c.pos.y + 1.5, c.pos.z + Math.sin(c.yaw) * 0.6);
  const shape = aimShape(s.id, s.radius);
  // Lanes, cones and tornado paths start at his feet (the fire tornado 2.5 m ahead); shots from his hand.
  const from = shape.kind === 'arc' ? hand
    : s.id === 'fire-tornado' ? new Vector3(c.pos.x + dir.x * 2.5, c.pos.y, c.pos.z + dir.z * 2.5)
    : s.id === 'storm-tornado' ? at.clone() : new Vector3(c.pos.x, c.pos.y, c.pos.z);
  let lift: number | undefined;
  if (s.id === 'black-hole') {
    // Aimed at a building it opens inside it; the wheel takes it up into the sky or down into the ground.
    holeWheel -= wheel;
    const onBuilding = world.heightAt(at.x, at.z, at.y + 1) - area.ground.heightAt(at.x, at.z) > 1.5;
    lift = holeLift(holeWheel, onBuilding);
    combat.caster.holeLift = lift;
  }
  const gale = s.id === 'gale-shot' || s.id === 'wrecking-charge';
  aimPreview.show({ shape, from, to: at, dir: gale ? { x: Math.cos(c.yaw), z: Math.sin(c.yaw) } : dir, color: s.color, far, lift, yaw: c.yaw }, dt);
}

