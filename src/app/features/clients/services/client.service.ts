import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environment/environment';
import { AuthService } from 'src/app/auth/auth.service';
import { Client } from 'src/app/core/models/client.model';

@Injectable({ providedIn: 'root' })
export class ClientService {

  private baseUrl = `${environment.apiBaseUrl}/Clients`;

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  /* ==================== GET ALL ==================== */
  getClients(): Observable<Client[]> {
    return this.http.get<any[]>(this.baseUrl, {
      headers: this.auth.getAuthHeaders()
    }).pipe(
      map(items => (items || []).map(i => this.normalize(i)))
    );
  }
addClient(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber: string;
  alternatePhoneNumber?: string;
  role: string;
}) {
  return this.http.post(
    `${this.baseUrl}/signup`,
    payload,
    { headers: this.auth.getAuthHeaders() }
  );
}



getClientDetails(id: string) {
  return this.http.get<any>(
    `${environment.apiBaseUrl}/Clients/${id}/details`,
    { headers: this.auth.getAuthHeaders() }
  );
}


  /* ==================== GET BY ID ==================== */
  getClient(id: string | number): Observable<Client> {
    return this.http.get<any>(`${this.baseUrl}/${id}`, {
      headers: this.auth.getAuthHeaders()
    }).pipe(
      map(i => this.normalize(i))
    );
  }

  /* ==================== CREATE ==================== */
  createClient(payload: any): Observable<any> {
    return this.http.post(
      this.baseUrl,
      payload,
      { headers: this.auth.getAuthHeaders() }
    );
  }

  /* ==================== UPDATE (Swagger PATCH) ==================== */
updateClient(
  id: string | number,
  payload: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    status?: string;
    assignedUserId?: string; // 👈 ADD THIS
  }
): Observable<any> {
  return this.http.patch(
    `${this.baseUrl}/${id}`,
    payload,
    { headers: this.auth.getAuthHeaders() }
  );
}


  /* ==================== DELETE ==================== */
  deleteClient(id: string | number): Observable<any> {
    return this.http.delete(
      `${this.baseUrl}/${id}`,
      { headers: this.auth.getAuthHeaders() }
    );
  }

  /* ==================== PAGED ==================== */
  getClientsPaged(
    page = 1,
    pageSize = 25,
    search = ''
  ): Observable<{ items: Client[]; total: number }> {

    let params = new HttpParams()
      .set('page', String(page))
      .set('pageSize', String(pageSize));

    if (search) params = params.set('search', search);

    return this.http.get<{ items: any[]; total: number }>(
      `${this.baseUrl}/paged`,
      {
        headers: this.auth.getAuthHeaders(),
        params
      }
    ).pipe(
      map(r => ({
        items: (r.items || []).map(i => this.normalize(i)),
        total: r.total ?? 0
      }))
    );
  }




getUsers() {
  return this.http.get<any[]>(
    `${environment.apiBaseUrl}/Users/ByRoleIdName`,
    {
      headers: this.auth.getAuthHeaders(),
      params: { role: 'User' }
    }
  );
}



  /* ==================== NORMALIZER ==================== */
  private normalize(i: any): Client {
    i = i || {};

    const first = (i.firstName ?? '').toString().trim();
    const last = (i.lastName ?? '').toString().trim();
    const name =
      (i.name ?? `${first} ${last}`).toString().trim() ||
      i.email ||
      '';

  return {
  id: i.id ?? i.clientId ?? i._id ?? '',
  name,
  email: i.email ?? null,
  contact: i.contact ?? null,
  contact2: i.contact2 ?? null,
  phone: i.phone ?? i.contact ?? null,
  status: i.status ?? null,
  team: i.teamName ?? i.team ?? null,
  role: i.role ?? null,
  address: '',
  assignedUserId: i.assignedUserId ?? null,
  assignedUserName: i.assignedUserName ?? null
} as any;

  }
}
