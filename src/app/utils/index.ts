// Omits the given key from an object
export function omit(key: string, obj: Record<string, unknown>) {
  const _obj = { ...obj };
  delete _obj[key];
  return _obj;
}
