export interface Client {
  address: string;
  id?: number | string;
  name?: string;
  email?: string | null;
  contact?: string | null;   // API 'contact'
  contact2?: string | null;  // API 'contact2'
  status?: string | null;

  // keep legacy fields optional (if other parts expect them)
  phone?: string | null;
  team?: string | null;
  role?: string | null;
}
