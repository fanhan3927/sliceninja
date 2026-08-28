/**
 * 指针输入：统一 pointer 事件（鼠标 / 触摸 / 笔），
 * 坐标由 engine 提供的 toLogical 映射到 1280×720 逻辑空间。
 * preventDefault + canvas touch-action:none 保证移动端滑切时页面不滚动。
 */
export interface PointerPos {
  x: number;
  y: number;
}

export interface InputHandlers {
  onDown(pos: PointerPos, tMs: number): void;
  onMove(pos: PointerPos, tMs: number): void;
  onUp(): void;
}

export function attachInput(
  canvas: HTMLCanvasElement,
  toLogical: (clientX: number, clientY: number) => PointerPos,
  handlers: InputHandlers,
): () => void {
  let activePointerId = -1;

  const down = (e: PointerEvent): void => {
    if (activePointerId !== -1) return; // 单刀模式：忽略后续手指
    activePointerId = e.pointerId;
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* 某些环境不支持捕获，忽略 */
    }
    const p = toLogical(e.clientX, e.clientY);
    handlers.onDown(p, performance.now());
  };

  const move = (e: PointerEvent): void => {
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();
    const p = toLogical(e.clientX, e.clientY);
    handlers.onMove(p, performance.now());
  };

  const up = (e: PointerEvent): void => {
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();
    activePointerId = -1;
    handlers.onUp();
  };

  canvas.addEventListener('pointerdown', down, { passive: false });
  canvas.addEventListener('pointermove', move, { passive: false });
  canvas.addEventListener('pointerup', up, { passive: false });
  canvas.addEventListener('pointercancel', up, { passive: false });
  const blockMenu = (e: Event): void => e.preventDefault();
  canvas.addEventListener('contextmenu', blockMenu);

  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
    canvas.removeEventListener('contextmenu', blockMenu);
  };
}
