import { RULES, WEAPONS, ARMORS } from '../data.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.images = new Map();
    this.camera = { x: RULES.stageWidth / 2, y: RULES.stageHeight / 2, zoom: 1 };
    this.shake = 0;
    this.lastSize = { width: 0, height: 0 };
  }

  loadImage(url) {
    if (!this.images.has(url)) {
      const image = new Image();
      image.src = url;
      this.images.set(url, image);
    }
    return this.images.get(url);
  }

  preload(characters) {
    for (const character of characters) {
      if (character.systemOnly) continue;
      for (const animation of Object.values(character.sprite.animations)) {
        if (animation.available === false) continue;
        for (const frame of animation.frames || []) this.loadImage(character.assetBase + frame);
        if (animation.sheet?.image) this.loadImage(character.assetBase + animation.sheet.image);
      }
      for (const animation of Object.values(character.sprite.leftAnimations || {})) {
        if (animation.available === false) continue;
        for (const frame of animation.frames || []) this.loadImage(character.assetBase + frame);
        if (animation.sheet?.image) this.loadImage(character.assetBase + animation.sheet.image);
      }
    }
    const held = new Set(characters.map((character) => character.weaponId));
    for (const id of held) if (WEAPONS[id]) this.loadImage(WEAPONS[id].image);
    const equipped = new Set(characters.flatMap((character) => character.equippedArmorIds || []));
    for (const id of equipped) if (ARMORS[id]) this.loadImage(ARMORS[id].image);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * dpr); const height = Math.round(rect.height * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
    }
    this.lastSize = { width, height };
  }

  updateCamera(match, dt) {
    const active = match.fighters.filter((f) => f.alive);
    const a = active[0] || match.player; const b = active[1] || a;
    const centerX = (a.x + b.x) / 2;
    const spread = Math.abs(a.x - b.x);
    const aspect = this.canvas.width / Math.max(this.canvas.height, 1);
    const wantedVisibleWidth = clamp(spread + 420, 1050, 1680);
    const baseWidth = Math.min(RULES.stageWidth + 140, Math.max(1160, 900 * aspect));
    const targetZoom = clamp(baseWidth / wantedVisibleWidth, 0.82, 1.23);
    const easing = 1 - Math.exp(-dt * 3.8);
    this.camera.zoom += (targetZoom - this.camera.zoom) * easing;
    const visibleWidth = baseWidth / this.camera.zoom;
    const minX = visibleWidth / 2 - 45;
    const maxX = RULES.stageWidth - visibleWidth / 2 + 45;
    this.camera.x += (clamp(centerX, Math.min(minX, maxX), Math.max(minX, maxX)) - this.camera.x) * easing;
    this.camera.y += (530 - this.camera.y) * easing;
    this.shake = Math.max(0, this.shake - dt * 18);
  }

  getTransform() {
    const { width, height } = this.lastSize;
    const aspect = width / Math.max(height, 1);
    const baseWidth = Math.min(RULES.stageWidth + 140, Math.max(1160, 900 * aspect));
    const scale = width / baseWidth * this.camera.zoom;
    return { scale, centerX: width / 2 - this.camera.x * scale, centerY: height / 2 - this.camera.y * scale };
  }

  draw(match, dt) {
    this.resize();
    if (!this.canvas.width || !this.canvas.height) return;
    this.updateCamera(match, dt);
    const ctx = this.ctx; const { width, height } = this.lastSize;
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#102a4e'); bg.addColorStop(0.65, '#366996'); bg.addColorStop(1, '#9bbdd1');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    const t = this.getTransform();
    const shakeX = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    ctx.save(); ctx.translate(t.centerX + shakeX, t.centerY + shakeY); ctx.scale(t.scale, t.scale);
    this.drawBackdrop(ctx);
    this.drawPlatforms(ctx, match.stage);
    for (const projectile of match.projectiles) this.drawProjectile(ctx, projectile);
    for (const fighter of match.fighters) this.drawFighter(ctx, fighter, match.elapsed);
    for (const effect of match.effects) this.drawEffect(ctx, effect);
    ctx.restore();
  }

  drawBackdrop(ctx) {
    // All background shapes are non-interactive 2D placeholders, not 3D geometry.
    ctx.fillStyle = 'rgba(230,247,255,.13)';
    for (let i = 0; i < 8; i++) {
      const x = i * 270 - 70;
      ctx.beginPath(); ctx.arc(x, 625 - (i % 3) * 40, 118 + (i % 2) * 26, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle = 'rgba(249,225,194,.14)';
    for (let i = 0; i < 7; i++) {
      ctx.beginPath(); ctx.ellipse(i * 300 - 90, 430, 70, 130, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(9,29,59,.27)';
    ctx.fillRect(0, 820, RULES.stageWidth, 80);
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.font = 'bold 20px system-ui'; ctx.fillText('↓ 場外', 753, 847);
  }

  drawPlatforms(ctx, stage) {
    for (const platform of stage.platforms) {
      const x = platform.currentX ?? platform.x;
      ctx.fillStyle = platform.type === 'solid' ? '#253c5f' : '#294968';
      ctx.beginPath(); ctx.roundRect(x, platform.y, platform.width, platform.height, 8); ctx.fill();
      ctx.fillStyle = platform.type === 'moving' ? '#e9ab81' : '#8ed3d3';
      ctx.beginPath(); ctx.roundRect(x, platform.y, platform.width, 9, 5); ctx.fill();
      if (platform.type === 'solid') {
        ctx.fillStyle = 'rgba(7,22,42,.22)';
        for (let mark = x + 23; mark < x + platform.width - 20; mark += 52) ctx.fillRect(mark, platform.y + 20, 20, 4);
      }
    }
  }

  drawFighter(ctx, f, elapsed) {
    if (!f.alive && f.deathPoseLeft <= 0) {
      if (f.stocks > 0) {
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 27px system-ui';
        ctx.fillText(`${Math.ceil(f.respawnLeft)}秒後に復活`, f.x, 625);
      }
      return;
    }
    if (f.invulnerable > 0 && Math.floor(elapsed * 9) % 2) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(8,25,44,.32)';
    ctx.beginPath(); ctx.ellipse(f.x, f.y + 3, 54, 11, 0, 0, Math.PI * 2); ctx.fill();
    if (f.character.systemOnly) {
      const color = f.id === 'player' ? '#7be1f0' : '#ff9b77';
      ctx.save(); ctx.translate(f.x, f.y);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#15304b';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.roundRect(-27, -112, 54, 112, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#17334f';
      ctx.beginPath();
      ctx.moveTo(f.facing * 24, -81); ctx.lineTo(f.facing * 4, -91); ctx.lineTo(f.facing * 4, -71);
      ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
      if (!f.alive) return;
      ctx.textAlign = 'center'; ctx.font = 'bold 21px system-ui';
      ctx.lineWidth = 5; ctx.strokeStyle = '#14314a';
      ctx.strokeText(f.id === 'player' ? 'あなた' : 'CPU', f.x, f.y - 134);
      ctx.fillStyle = '#fff'; ctx.fillText(f.id === 'player' ? 'あなた' : 'CPU', f.x, f.y - 134);
      return;
    }
    const sprite = f.character.sprite;
    const baseAnimation = sprite.animations[f.pose] || sprite.animations.idle;
    const leftAnimation = f.facing < 0 ? sprite.leftAnimations?.[f.pose] : null;
    const animation = leftAnimation || baseAnimation;
    const count = animation.frames?.length || animation.sheet?.indices?.length || 1;
    const index = animation.loop === false ? Math.min(count - 1, Math.floor(f.poseTime * animation.fps)) : Math.floor(f.poseTime * animation.fps) % count;
    // A planned animation must never trigger requests for PNGs that have not been supplied.
    const pending = animation.available === false;
    const file = pending ? sprite.fallback : animation.frames?.[index] || animation.sheet?.image;
    const frameKey = pending ? 'placeholder' : animation.sheet ? `frame_${String(animation.sheet.indices[index]).padStart(2, '0')}` : file;
    const img = this.loadImage(f.character.assetBase + file);
    ctx.save(); ctx.translate(f.x, f.y);
    if (f.facing < 0 && !leftAnimation) ctx.scale(-1, 1);
    const wobble = f.character.status === 'placeholder' && f.pose === 'run' ? Math.sin(f.poseTime * 18) * 3 : 0;
    this.drawArmor(ctx, f, 'back', frameKey);
    const destination = [-sprite.width * sprite.origin.x, -sprite.height * sprite.origin.y + wobble, sprite.width, sprite.height];
    if (img.complete && img.naturalWidth && animation.sheet && !pending) {
      const sheet = animation.sheet;
      const cell = sheet.indices[index];
      ctx.drawImage(img, (cell % sheet.columns) * sheet.frameWidth, Math.floor(cell / sheet.columns) * sheet.frameHeight, sheet.frameWidth, sheet.frameHeight, ...destination);
    } else {
      const fallback = this.loadImage('assets/characters/training_dummy/placeholder.svg');
      const actual = img.complete && img.naturalWidth ? img : fallback;
      if (actual.complete && actual.naturalWidth) ctx.drawImage(actual, ...destination);
      else { ctx.fillStyle = '#e9f4fa'; ctx.fillRect(-30, -110, 60, 110); }
    }
    if (f.pendingThrow && f.heldWeapon) {
      const weapon = WEAPONS[f.heldWeapon];
      const anchor = this.resolveAnchors(f, frameKey).hand || { x: 42, y: -94 };
      const heldImage = weapon && this.loadImage(weapon.image);
      if (heldImage?.complete && heldImage.naturalWidth) ctx.drawImage(heldImage, anchor.x - 21, anchor.y - 21, 42, 42);
    }
    this.drawArmor(ctx, f, 'front', frameKey);
    ctx.restore(); ctx.globalAlpha = 1;
    if (!f.alive) return;
    ctx.font = 'bold 21px system-ui'; ctx.textAlign = 'center';
    ctx.lineWidth = 5; ctx.strokeStyle = '#14314a'; ctx.strokeText(f.id === 'player' ? 'あなた' : 'CPU', f.x, f.y - 190);
    ctx.fillStyle = f.id === 'player' ? '#fff' : '#ffdca8'; ctx.fillText(f.id === 'player' ? 'あなた' : 'CPU', f.x, f.y - 190);
  }

  resolveAnchors(fighter, frame) {
    const sprite = fighter.character.sprite;
    return { ...(sprite.anchors?.default || {}), ...(sprite.anchors?.[fighter.pose]?.default || {}), ...(sprite.anchors?.[fighter.pose]?.[frame] || {}) };
  }

  drawArmor(ctx, fighter, layer, frame) {
    const anchors = this.resolveAnchors(fighter, frame);
    for (const id of fighter.character.equippedArmorIds || []) {
      const armor = ARMORS[id];
      if (!armor || armor.layer !== layer) continue;
      const point = anchors[armor.anchor];
      if (!point) continue;
      const image = this.loadImage(armor.image);
      if (image.complete && image.naturalWidth) ctx.drawImage(image, point.x - armor.width / 2, point.y - armor.height / 2, armor.width, armor.height);
    }
  }

  drawProjectile(ctx, projectile) {
    const weapon = WEAPONS[projectile.weaponId];
    const img = this.loadImage(weapon.image);
    ctx.save(); ctx.translate(projectile.x, projectile.y); ctx.rotate(projectile.rotation);
    const size = weapon.displaySize || 50;
    if (img.complete && img.naturalWidth) ctx.drawImage(img, -size / 2, -size / 2, size, size);
    else { ctx.fillStyle = '#f9cd76'; ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  drawEffect(ctx, effect) {
    const progress = 1 - effect.time / effect.maxTime;
    ctx.strokeStyle = effect.kind === 'skill' ? `rgba(255,88,78,${1 - progress})` : `rgba(255,225,147,${1 - progress})`;
    ctx.lineWidth = 9 - progress * 7;
    ctx.beginPath(); ctx.arc(effect.x, effect.y, 12 + progress * 75, 0, Math.PI * 2); ctx.stroke();
  }
}
