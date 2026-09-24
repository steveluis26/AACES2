// La librería qrcode no trae tipos; declaramos lo que usamos.
declare module 'qrcode' {
  export function toDataURL(text: string, options?: Record<string, unknown>): Promise<string>
  export function toCanvas(canvas: HTMLCanvasElement | null, text: string, options?: Record<string, unknown>, cb?: (err: Error | null) => void): void
}
