export function initials(nombre: string, apellido: string) {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

export function firstName(nombre?: string | null) {
  return nombre?.trim().split(/\s+/)[0] || "Usuario";
}
