import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TeamsService, TeamClient } from '../teams.service';
import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-clients',
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss']
})
export class ClientsComponent implements OnInit {

  teamClients: TeamClient[] = [];
  filteredClients: TeamClient[] = [];
  pagedClients: TeamClient[] = [];

  loading = false;

  // pagination
  currentPage = 1;
  pageSize = 8;
  totalPages = 0;

  // search
  searchTerm = '';

  // modal
  showStatusModal = false;
  selectedClient: TeamClient | null = null;
  selectedStatus: 'Active' | 'Inactive' = 'Active';

  constructor(
    private teamsService: TeamsService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const user = this.authService.getUser();
    if (user?.id) {
      this.loadAssignedClients(user.id);
    }
  }

  loadAssignedClients(userId: string) {
    this.loading = true;

    this.teamsService.getAssignedClients(userId).subscribe({
      next: (data) => {
        this.teamClients = data || [];
        this.filteredClients = [...this.teamClients];
        this.updatePagination();
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }

  /* ================= SEARCH ================= */

  applySearch() {
    const term = this.searchTerm.toLowerCase().trim();

    if (!term) {
      this.filteredClients = [...this.teamClients];
    } else {
      this.filteredClients = this.teamClients.filter(c =>
        (c.clientId || '').toLowerCase().includes(term) ||
        (c.clientName || '').toLowerCase().includes(term) ||
        (c.clientEmail || '').toLowerCase().includes(term) ||
        (c.clientPhone || '').toLowerCase().includes(term) ||
        (c.status || '').toLowerCase().includes(term) ||
        (c.notes || '').toLowerCase().includes(term)
      );
    }

    this.currentPage = 1;
    this.updatePagination();
  }

  /* ================= PAGINATION ================= */

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredClients.length / this.pageSize);
    this.setPage(this.currentPage);
  }

  setPage(page: number) {
    this.currentPage = page;
    const start = (page - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.pagedClients = this.filteredClients.slice(start, end);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.setPage(this.currentPage + 1);
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.setPage(this.currentPage - 1);
    }
  }

  /* ================= ACTIONS ================= */

  openDocuments(clientId: string) {
    this.router.navigate(['/teams/documents'], {
      queryParams: { clientId }
    });
  }

  openStatusModal(client: TeamClient) {
    this.selectedClient = client;
    this.selectedStatus = client.status;
    this.showStatusModal = true;
  }

  closeStatusModal() {
    this.showStatusModal = false;
    this.selectedClient = null;
  }

  saveStatus() {
    if (!this.selectedClient) return;

    this.teamsService
      .updateClientStatus(this.selectedClient.clientId, this.selectedStatus)
      .subscribe({
        next: () => {
          this.selectedClient!.status = this.selectedStatus;
          this.applySearch(); // refresh pagination + search
          this.closeStatusModal();
        },
        error: err => console.error('Status update failed', err)
      });
  }
}
