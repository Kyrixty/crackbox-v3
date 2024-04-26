export interface DrawPathOptions {
  color?: string;
  lineWidth?: number;
  lineJoin?: "bevel" | "miter" | "round";
  lineCap?: "butt" | "round" | "square";
}

const defaults: Required<DrawPathOptions> = {
  color: "black",
  lineWidth: 2,
  lineJoin: "round",
  lineCap: "round",
};

export type Point = number[];

export interface PathData {
  path: Point[];
  canvasSize: number;
  opts: DrawPathOptions;
}

export const drawPath = (ctx: CanvasRenderingContext2D, pathData: PathData) => {
  const path = pathData.path;
  const { color, lineCap, lineJoin, lineWidth } = {
    ...defaults,
    ...pathData.opts,
  };
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = lineJoin;
  ctx.lineCap = lineCap;
  ctx.beginPath();
  const [x, y] = path[0];
  ctx.moveTo(x, y);
  for (let i = 1; i < path.length; i++) {
    const [x, y] = path[i];
    ctx.lineTo(x, y);
  }
  ctx.stroke();
};

export const drawPaths = (ctx: CanvasRenderingContext2D, paths: PathData[]) => {
  if (paths && paths.length) {
    for (let i = 0; i < paths.length; i++) {
      drawPath(ctx, paths[i]);
    }
  }
};

export function drawDataURIOnCanvas(
  strDataURI: string,
  canvas: CanvasRenderingContext2D,
  callback?: () => void,
) {
  "use strict";
  var img = new window.Image();
  img.addEventListener("load", function () {
    canvas.drawImage(img, 0, 0);
    callback?.();
  });
  img.setAttribute("src", strDataURI);
}
