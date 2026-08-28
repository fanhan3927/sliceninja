/**
 * 游戏画布：仅承载 <canvas> 元素。
 * 尺寸由父级 16:9 容器决定；引擎通过 ResizeObserver 自适应背板与坐标映射。
 * touch-action:none + preventDefault（引擎内）保证移动端滑切时页面不滚动。
 */
interface GameCanvasProps {
  canvasRef: (el: HTMLCanvasElement | null) => void;
  onPointerDown: () => void;
}

export default function GameCanvas({ canvasRef, onPointerDown }: GameCanvasProps) {
  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      className="block h-full w-full select-none"
      style={{ touchAction: 'none', cursor: 'crosshair' }}
    />
  );
}
