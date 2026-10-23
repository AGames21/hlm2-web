// Son story encounters. objBoss (1837) is an inert room marker: every slot
// in the executable's event table at 0x1987640 is null. It is not an enemy.
// Colombian create 0x6627d0, step 0x6629f0, bullet collision 0x661f60.
export const COLOMBIAN = {
  enter: { x: 480, y: 464 }, // GUESS: direct-room spawn below decoded trigger.
  trigger: { left: 456, right: 496, y: 432 },
  standX: 480, tolerance: 1, standY: 232, walkX: 1, walkY: 2,
  legs: 0.15, imageSpeed: 0.1, wait: 220, firstPages: 7, secondPages: 8,
  bodySpeed: 1.5, bodyImageSpeed: 0.25,
  spr: { idle: 'sprColombianBoss', chair: 'sprColombianBossChair', dead: 'sprColombianBossDead' },
};

export const SON_BOSS_WHO = { objColombianBoss: 'objSon' };


// GUESS: LSD animation speed and post-dialogue pause. Its marker has no AI;
// the original Son/controller events could not be decompiled in this session.
export const LSD = { imageSpeed: 0.1, hold: 60, enter: { x: 284, y: 372 }, release: { x: 32, y: 24 } }; // GUESS: couch clearance.

export function sonBossDefinitions(room, G) {
  const son = room.insts.find(i => G.objects.get(i.obj)?.name === 'objSonTakeLSD');
  return {
    objColombianBoss: { k: COLOMBIAN, make: () => ({ sprite: COLOMBIAN.spr.idle, imageSpeed: COLOMBIAN.imageSpeed, wait: COLOMBIAN.wait }) },
    ...(room.name === 'rmLSDIntro' ? {
      objBoss: { k: { enter: LSD.enter, spr: { actor: G.sprites.get(G.objects.get(son?.obj)?.sprite)?.name } },
        make: () => ({ sprite: G.sprites.get(G.objects.get(son?.obj)?.sprite)?.name, actor: son, x: son?.x ?? LSD.enter.x, y: son?.y ?? LSD.enter.y, wait: LSD.hold, imageSpeed: LSD.imageSpeed }) },
    } : {}),
  };
}

// All dialogue pages contain string IDs only; conversation() reads the WAD.
export function stepSonBoss(b, c) {
  const { player: p } = c;
  if (p.dead) return;
  if (b.kind === 'objBoss') {
    p.locked = true; p.sceneHidden = true;
    if (!b.started) { b.started = true; c.say(c.pages, () => { b.state = 1; }); return; }
    if (!b.state) return;
    b.frame = Math.min(b.frame + LSD.imageSpeed, c.frames(b.sprite) - 1);
    if (b.frame < c.frames(b.sprite) - 1 || --b.wait > 0) return;
    // GUESS: hand control back beside the couch rather than reproducing the
    // unported drug effects, sink interaction and NPC transformations.
    c.place(b.x + LSD.release.x, b.y + LSD.release.y);
    p.locked = false; p.sceneHidden = false; c.remove(b);
    return;
  }
  const K = COLOMBIAN;
  b.frame = (b.frame + K.imageSpeed) % c.frames(b.sprite);
  if (b.state === 0) {
    if (p.x < K.trigger.left || p.x > K.trigger.right || p.y >= K.trigger.y) return;
    p.locked = true; b.state = 1;
  }
  if (b.state === 1) {
    p.x += Math.sign(K.standX - p.x) * Math.min(K.walkX, Math.abs(K.standX - p.x));
    if (p.y > K.standY) p.y = Math.max(K.standY, p.y - K.walkY);
    p.dir = p.aim = -Math.PI / 2; p.frame += K.legs;
    if (Math.abs(p.x - K.standX) > K.tolerance || p.y > K.standY) return;
    b.state = 2;
    c.say(c.pages.slice(0, K.firstPages), () => { b.state = 3; }); return;
  }
  if (b.state === 3 && --b.wait <= 0) {
    b.state = 4;
    c.say(c.pages.slice(K.firstPages, K.secondPages), () => { b.state = 5; b.wait = K.wait; }); return;
  }
  if (b.state === 5 && --b.wait <= 0) {
    b.state = 6;
    c.say(c.pages.slice(K.secondPages), () => { b.state = 8; p.locked = false; });
  }
  // GUESS: the player delivers the final shot/swing. The original collision
  // accepts bullets after state 2; the henchmen's scripted firing is unported.
  if (b.state === 8 && c.melee(b)) hitSonBoss(b, c);
}

export function hitSonBoss(b, c) {
  if (b.kind !== 'objColombianBoss' || b.state < 2) return false;
  // Keep the conversation controller alive until its final page has closed.
  if (b.state !== 8) return true;
  c.die(b, COLOMBIAN.spr.dead, COLOMBIAN.bodySpeed, 0);
  c.player.locked = false;
  return true;
}
