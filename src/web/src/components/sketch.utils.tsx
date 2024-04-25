import { DrawPathOptions, PathData } from "@utils/draw";
import React from "react";

export const getPosition = (
  evt: React.MouseEvent<HTMLCanvasElement, MouseEvent> | React.TouchEvent<HTMLCanvasElement>,
  canvasRef: HTMLCanvasElement
): [number, number] => {
  const rect = canvasRef?.getBoundingClientRect();
  if (evt.type === "mousedown" || evt.type === "mousemove") {
    const { clientX, clientY } = evt as React.MouseEvent<HTMLCanvasElement, MouseEvent>;
    const x = Math.round(clientX - rect.left);
    const y = Math.round(clientY - rect.top);
    return [x, y];
  } else if (evt.type === "touchstart" || evt.type === "touchmove") {
    evt = evt as React.TouchEvent<HTMLCanvasElement>;
    const loc = evt.touches[0];
    if (rect) {
      const x = Math.round(loc.clientX);
      const y = Math.round(loc.clientY - rect.top);
      return [x, y];
    }
  }
  throw new Error("Unsupported event provided");
};

export const downloadPng = (canvas: HTMLCanvasElement) => {
  if (document && canvas) {
    canvas.toBlob(async (blob) => {
      if (blob) {
        const content = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.style.display = "none";
        anchor.download = "sketch.png";
        anchor.href = content;
        document.body.appendChild(anchor);
        anchor.click();
        window.URL.revokeObjectURL(content);
        document.body.removeChild(anchor);
      }
    });
  }
};

export const getDataURL = (canvas: HTMLCanvasElement) => {
  if (canvas) {
    return canvas.toDataURL();
  }
  throw new Error("No canvas supplied")
}

export const downloadJson = (paths: PathData[], canvasStyle: React.CSSProperties) => {
  const data = JSON.stringify({ paths, canvasStyle });
  const content = `data:text/plan;charset=utf-8,${encodeURIComponent(data)}`;
  const anchor = document.createElement("a");
  anchor.style.display = "none";
  anchor.download = "paths.json";
  anchor.href = content;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(content);
  document.body.removeChild(anchor);
};