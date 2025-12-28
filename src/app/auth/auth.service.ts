import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  lastName: any;
  firstName: any;
  id: string;
  name: string;
  email: string;
  role: string;   
}

interface LoginResponse {
  user: User;
  token: string;
  // add other fields returned by your API if any
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
   private baseUrl = 'https://iconfilers.club/IconFilers';

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.baseUrl}/api/Auth/login`,
      { email, password }
    );
  }

  // ✅ ADD THIS METHOD
  getMe(): Observable<User> {
    const headers = this.getAuthHeaders();
    return this.http.get<User>(
      `${this.baseUrl}/api/Auth/me`,
       { headers: this.getAuthHeaders() }
    );
  }

  getToken(): string | null {
    return sessionStorage.getItem('token');
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    let headers = new HttpHeaders().set('Content-Type', 'application/json');

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  getRole(): string | null {
    return sessionStorage.getItem('role');
  }

  getUser(): User | null {
    const raw = sessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  }

  getUserName(): string {
    const user = this.getUser();
    return user ? user.firstName : '';
  }

  logout() {
    sessionStorage.clear();
  }
}