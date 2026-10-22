// Tiles have no instance. Only actual moving instances belong in the exclusion
// set; a missing player spawn must never exclude the room's tile artwork.
export function drawRoomItems(cx, items, images, keep = () => true, moving = new Set()) {
  for (const item of items) {
    if (!keep(item) || (item.inst && moving.has(item.inst))) continue;
    cx.drawImage(images.get(item.atlas), item.sx, item.sy, item.w, item.h,
      item.dx, item.dy, item.w, item.h);
  }
}
