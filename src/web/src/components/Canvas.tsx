import { forwardRef } from "react";

type CanvasProps = {
  size: number;
  styles?: React.CSSProperties;
  onMouseDown?: React.MouseEventHandler;
  onMouseMove?: React.MouseEventHandler;
  onMouseUp?: React.MouseEventHandler;
  onMouseOut: React.MouseEventHandler;
  onTouchStart?: React.TouchEventHandler;
  onTouchMove?: React.TouchEventHandler;
  onTouchEnd?: React.TouchEventHandler;
};

export const Canvas = forwardRef<HTMLCanvasElement, CanvasProps>(
  ({ size, styles, onMouseDown, onMouseMove, onMouseUp, onMouseOut, onTouchStart, onTouchEnd, onTouchMove }, ref) => {
    return (
      <canvas
        height={size}
        width={size}
        style={styles}
        ref={ref}
        onMouseDown={(evt) => onMouseDown && onMouseDown(evt)}
        onMouseMove={(evt) => onMouseMove && onMouseMove(evt)}
        onMouseUp={(evt) => onMouseUp && onMouseUp(evt)}
        onMouseOut={(evt) => onMouseOut && onMouseOut(evt)}
        onTouchStart={(evt) => onTouchStart && onTouchStart(evt)}
        onTouchMove={(evt) => onTouchMove && onTouchMove(evt)}
        onTouchEnd={(evt) => onTouchEnd && onTouchEnd(evt)}
      />
    );
  }
);