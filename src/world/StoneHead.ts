/**
 * The giant stone head's living eyes: glowing red irises whose pupils follow the hero when near, and a deep voice
 * that now and then asks what you are doing here.
 */
import { CircleGeometry, Group, Mesh, MeshBasicMaterial, Vector3, type Sprite } from 'three';
import { VOICES, voiceUrl } from '../data/voices';
import { glowSprite } from '../render/Glow';
import { PALETTE } from '../render/palette';
import type { Landmark } from './Landmarks';
import { Npc } from './NPCs';
import { SpeechBubble } from './SpeechBubble';

/** giant-head.glb at LAYOUT.head, measured by ray picks: pupil centres on the face plane, and the mouth. */
const EYES = [new Vector3(-1.3, 20.14, -143.15), new Vector3(1.62, 20.1, -143.15)];
const MOUTH = new Vector3(-0.07, 14.4, -141.9);
const LINES = ['head-doing-here', 'head-blocking'];
/** It notices you within this range, and speaks within the nearer one. */
const SEE = 60;
const HEAR = 45;

export function stoneHeadEyes(): Landmark {
  const group = new Group();
  const eyes = EYES.map((at) => {
    const eye = new Group();
    eye.position.copy(at);
    const iris = new Mesh(new CircleGeometry(0.5, 24), new MeshBasicMaterial({ color: PALETTE.blood, toneMapped: false }));
    const pupil = new Mesh(new CircleGeometry(0.19, 16), new MeshBasicMaterial({ color: 0x14020a }));
    pupil.position.z = 0.02;
    const glow = glowSprite(PALETTE.blood, 3.2, 0.5, true);
    eye.add(iris, pupil, glow);
    group.add(eye);
    return { eye, pupil, glow: glow as Sprite };
  });
  // (The bubble sets its own height each frame: give it the mouth's, and only place x and z.)
  const bubble = new SpeechBubble(MOUTH.y - 1.4);
  bubble.sprite.position.set(MOUTH.x, MOUTH.y - 1.4, MOUTH.z + 1.2);
  bubble.sprite.scale.multiplyScalar(3.4);
  group.add(bubble.sprite);
  let wait = 6;
  let t = 0;
  let flare = 0;
  const look = new Vector3();
  return {
    object: group, footprints: [],
    update: (dt, player) => {
      t += dt;
      bubble.update(dt);
      const d = Math.hypot(player.x - EYES[0].x, player.z - EYES[0].z);
      const near = Math.max(0, 1 - d / SEE);
      flare = Math.max(0, flare - dt * 0.8);
      for (const e of eyes) {
        // The pupil slides toward the hero across the iris (within it), and the whole eye turns a little.
        look.copy(player).sub(e.eye.position);
        look.y += 1.5;
        const yaw = Math.atan2(look.x, look.z);
        const pitch = Math.atan2(look.y, Math.hypot(look.x, look.z));
        const k = near > 0 ? 1 : 0;
        e.pupil.position.x += (Math.max(-0.2, Math.min(0.2, Math.sin(yaw) * 0.32)) * k - e.pupil.position.x) * Math.min(1, dt * 4);
        e.pupil.position.y += (Math.max(-0.2, Math.min(0.2, Math.sin(pitch) * 0.32)) * k - e.pupil.position.y) * Math.min(1, dt * 4);
        e.eye.rotation.y += (yaw * 0.25 * k - e.eye.rotation.y) * Math.min(1, dt * 3);
        e.glow.material.opacity = 0.25 + near * 0.45 + flare * 0.3 + Math.sin(t * 2.2) * 0.04;
        e.glow.scale.setScalar(3.2 + near * 1.6 + flare * 1.5);
      }
      // Now and then, when you are close: one of its lines, the eyes flaring as it speaks.
      wait -= dt;
      if (wait <= 0 && d < HEAR) {
        const id = LINES[Math.floor(Math.random() * LINES.length)];
        bubble.say(VOICES[id].text, 3);
        void Npc.sound?.voice(voiceUrl(id), Math.max(0.35, 1 - d / HEAR), 'head');
        flare = 1;
        wait = 14 + Math.random() * 12;
      }
    },
  };
}
