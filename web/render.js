// Tiles have no instance. Only actual moving instances belong in the exclusion
// set; a missing player spawn must never exclude the room's tile artwork.
export function drawRoomItems(cx, items, images, keep = () => true, moving = new Set()) {
  for (const item of items) {
    if (!keep(item) || (item.inst && moving.has(item.inst))) continue;
    if (item.angle === undefined) {
      cx.drawImage(images.get(item.atlas), item.sx, item.sy, item.w, item.h,
        item.dx, item.dy, item.w, item.h);
      continue;
    }
    // GameMaker rotates counterclockwise about the origin, after scaling.
    cx.save();
    cx.translate(item.x, item.y);
    cx.rotate(-item.angle * Math.PI / 180);
    cx.scale(item.xs, item.ys);
    cx.drawImage(images.get(item.atlas), item.sx, item.sy, item.w, item.h, -item.ox, -item.oy, item.w, item.h);
    cx.restore();
  }
}
