import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { Team } from '../../../core/models/team.model'; // ✅ Use your existing model

@Injectable({ providedIn: 'root' })
export class TeamService {
  addTeam(team: Team) {
    throw new Error('Method not implemented.');
  }
  updateTeam(team: Team) {
    throw new Error('Method not implemented.');
  }
  private baseUrl = 'https://localhost:7255/api/ManageTeams';
  private teams$ = new BehaviorSubject<Team[]>([]);

  constructor(private http: HttpClient) {}

  /**
   * ✅ Return teams as observable for components
   */
  getTeams(): Observable<Team[]> {
    return this.teams$.asObservable();
  }

  /**
   * ✅ Load teams from API
   */
 loadTeams(): void {
  this.http.get<any[]>(this.baseUrl).subscribe({
    next: (data) => {
      const mapped: Team[] = data.map((t) => ({
        ...t,
        name: t.teamName || t.name // API returns "teamName"
      }));
      this.teams$.next(mapped);
    },
    error: (err) => console.error('Failed to load teams:', err)
  });
}


  /**
   * ✅ Get single team
   */
  getTeam(name: string): Observable<Team> {
    return this.http.get<Team>(`${this.baseUrl}/${name}`);
  }

  /**
   * ✅ Create team
   */
  createTeam(name: string, managerId: string): Observable<any> {
    const body = { teamName: name, managerId };
    return this.http.post(`${this.baseUrl}/create`, body);
  }

  /**
   * ✅ Rename team
   */
  renameTeam(oldName: string, newName: string): Observable<any> {
    const body = { oldTeamName: oldName, newTeamName: newName };
    return this.http.post(`${this.baseUrl}/rename`, body);
  }

  /**
   * ✅ Delete team
   */
  deleteTeam(name: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${name}`);
  }

  /**
   * ✅ Refresh list manually after CRUD operations
   */
  refreshTeams(): void {
    this.http.get<any[]>(this.baseUrl).subscribe({
      next: (data) => {
        const mapped: Team[] = data.map((t) => ({
          ...t,
          name: t.teamName || t.name,
        }));
        this.teams$.next(mapped);
      },
      error: (err) => console.error('Failed to refresh teams:', err),
    });
  }
}
