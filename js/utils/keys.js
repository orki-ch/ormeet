// Kurzer Zufalls-Key für Zugangs- und Freigabe-Links
export function neuerKey() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 16)
}
