export interface FiscalixUser {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono?: string | null;
  estado?: string | null;
}
