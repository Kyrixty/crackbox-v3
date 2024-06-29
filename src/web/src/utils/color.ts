export const getColorRepresentation = (pct: number) => {
  return `rgb(${(100 - pct) *2.56}, ${pct *2.56},0)`;
}