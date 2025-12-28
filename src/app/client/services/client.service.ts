import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environment/environment';
import { AuthService } from 'src/app/auth/auth.service';

@Injectable({ providedIn: 'root' })
export class ClientService {
  updateProfile(userId: string, payload: any) {
  const url = `${environment.apiBaseUrl}/Client/UpdateProfile/${userId}`;
  return this.http.put(url, payload); // <-- MUST RETURN this
}

  // environment.apiBaseUrl should be: https://localhost:7255/api
  private apiBase = environment.apiBaseUrl.replace(/\/+$/, '');

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  private authOptions() {
    const token = this.auth.getToken();
    return token
      ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      : {};
  }

  // ✅ Correct URLs: /api/Dashboard/GetVerifiedDocumentsCount etc.

  getVerifiedDocumentsCount() {
    return this.http.get<any>(
      `${this.apiBase}/Dashboard/GetVerifiedDocumentsCount`,
      this.authOptions()
    );
  }

  getPendingDocumentsCount() {
    return this.http.get<any>(
      `${this.apiBase}/Dashboard/GetPendingDocumentsCount`,
      this.authOptions()
    );
  }

  getRejectedDocumentsCount() {
    return this.http.get<any>(
      `${this.apiBase}/Dashboard/GetRejectedDocumentsCount`,
      this.authOptions()
    );
  }
}
