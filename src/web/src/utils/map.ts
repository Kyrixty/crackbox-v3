type M = Map<any, any>;

export const mapToJSON = (m: M) => JSON.stringify(Object.fromEntries(m));
export const mapToObj = (m: M) => Object.fromEntries(m);
