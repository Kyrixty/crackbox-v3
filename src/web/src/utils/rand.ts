type n = number;
export function randomIntFromInterval(min: n, max: n) { // min and max included 
  return Math.floor(Math.random() * (max - min + 1) + min)
}
