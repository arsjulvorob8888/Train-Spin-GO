/** US QWERTY code for the same physical key on EN and RU (ЙЦУКЕН). */
const CHAR_CODE: Record<string, string> = {
  q: "KeyQ", й: "KeyQ",
  w: "KeyW", ц: "KeyW",
  e: "KeyE", у: "KeyE",
  r: "KeyR", к: "KeyR",
  t: "KeyT", е: "KeyT",
  y: "KeyY", н: "KeyY",
  u: "KeyU", г: "KeyU",
  i: "KeyI", ш: "KeyI",
  o: "KeyO", щ: "KeyO",
  p: "KeyP", з: "KeyP",
  a: "KeyA", ф: "KeyA",
  s: "KeyS", ы: "KeyS",
  d: "KeyD", в: "KeyD",
  f: "KeyF", а: "KeyF",
  g: "KeyG", п: "KeyG",
  h: "KeyH", р: "KeyH",
  j: "KeyJ", о: "KeyJ",
  k: "KeyK", л: "KeyK",
  l: "KeyL", д: "KeyL",
  z: "KeyZ", я: "KeyZ",
  x: "KeyX", ч: "KeyX",
  c: "KeyC", с: "KeyC",
  v: "KeyV", м: "KeyV",
  b: "KeyB", и: "KeyB",
  n: "KeyN", т: "KeyN",
  m: "KeyM", ь: "KeyM",
};

/** Layout-independent key id. Letter keys follow the physical key, not the typed character. */
export function hotCode(event: KeyboardEvent): string {
  const fromChar = CHAR_CODE[event.key.toLowerCase()];
  if (fromChar) return fromChar;
  return event.code || "";
}
