import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TeamClient {
  id: number;
  clientId: string;
    clientName: string;
  clientEmail: string;
  clientPhone: string;
  assignedTo: string;
  assignedBy: string;
  assignedAt: string;
  status: 'Active' | 'Inactive';
  notes?: string;


}

@Injectable({
  providedIn: 'root'
})
export class TeamsService {

  private baseUrl = 'https://iconfilers.club/IconFilers';

  constructor(private http: HttpClient) {}

  /** Get clients assigned to logged-in user */
  getAssignedClients(userId: string): Observable<TeamClient[]> {
    return this.http.get<TeamClient[]>(
      `${this.baseUrl}/api/ClientAssignment/assigned/${userId}`
    );
  }

updateClientStatus(
  clientId: string,
  status: 'Active' | 'Inactive'
) {
  return this.http.patch(
    `https://iconfilers.club/IconFilers/api/Clients/${clientId}`,
    { status }
  );
}


}
