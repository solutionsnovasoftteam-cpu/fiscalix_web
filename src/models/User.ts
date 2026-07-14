import type { UserRole } from "@/lib/roles";

export interface FiscalixUser {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  rol: UserRole;
  telefono?: string | null;
  estado?: string | null;
}
