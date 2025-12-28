import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  TemplateRef
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { ClientService } from './services/client.service';
import { Client } from 'src/app/core/models/client.model';
import { ClientSelectionService } from './services/client-selection.service';

import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-clients',
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss']
})
export class ClientsComponent implements OnInit, OnDestroy {

  /* ---------------- ViewChild ---------------- */
  @ViewChild('documentDialog') documentDialog!: TemplateRef<any>;
  @ViewChild('editClientDialog') editClientDialog!: TemplateRef<any>;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  /* ---------------- Dialog refs ---------------- */
  private documentDialogRef?: MatDialogRef<any>;
  private editDialogRef?: MatDialogRef<any>;

  /* ---------------- Form ---------------- */
  editForm!: FormGroup;
  editingClientId?: string | number;

  /* ---------------- Data ---------------- */
  selectedClient: Client | null = null;
  private allClients: Client[] = [];
  private filteredClients: Client[] = [];

  dataSource = new MatTableDataSource<Client>([]);
  cols: string[] = ['name', 'email', 'phone', 'status', 'team', 'documents', 'actions'];
users: any[] = [];

  searchTerm = '';
  loading = false;
  hasError = false;

  /* ---------------- Pagination ---------------- */
  pageIndex = 0;
  pageSize = 25;
  pageSizeOptions = [10, 25, 50];
  totalItems = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private clientService: ClientService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private clientSelectionService: ClientSelectionService,
    private fb: FormBuilder
  ) {}

  /* ---------------- Lifecycle ---------------- */
  ngOnInit(): void {
    this.editForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      address: [''],
      status: [''],
      assignedUserId: ['']
    });

    this.loadClients();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ---------------- Load Clients ---------------- */
  loadClients(): void {
    this.loading = true;
    this.hasError = false;

    this.clientService.getClients()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list: Client[]) => {
          this.allClients = (list || []).map(c => ({
            ...c,
            phone: c.phone ?? c.contact ?? null
          }));
          this.filteredClients = [...this.allClients];
          this.totalItems = this.filteredClients.length;
          this.pageIndex = 0;
          this.updatePagedData();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.hasError = true;
          this.snackBar.open('❌ Failed to load clients', 'OK', { duration: 3000 });
        }
      });
  }

  private updatePagedData(): void {
    const start = this.pageIndex * this.pageSize;
    const end = start + this.pageSize;
    this.dataSource.data = this.filteredClients.slice(start, end);
    this.totalItems = this.filteredClients.length;
  }

  onPageChanged(e: PageEvent): void {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.updatePagedData();
  }

  applyFilter(): void {
    const term = (this.searchTerm || '').toLowerCase();
    this.filteredClients = this.allClients.filter(c =>
      `${c.name} ${c.email} ${c.phone} ${c.status} ${c.team}`
        .toLowerCase()
        .includes(term)
    );
    this.pageIndex = 0;
    this.updatePagedData();
  }

  /* ---------------- Row selection ---------------- */
  selectClient(row: Client): void {
    if (!row?.id) return;
    this.selectedClient = row;
    this.clientSelectionService.setClientId(String(row.id));
  }




loadUsers(): void {
  this.clientService.getUsers()
    .subscribe({
      next: (res) => {
        console.log('Users API response:', res); // 👈 DEBUG
        this.users = res || [];
      },
      error: (err) => {
        console.error('Users API error:', err);
        this.snackBar.open('❌ Failed to load users', 'OK', { duration: 3000 });
      }
    });
}


  /* ---------------- Edit Dialog ---------------- */
 openEditDialog(client: Client): void {
  this.editingClientId = client.id;

  this.editForm.patchValue({
    name: client.name,
    email: client.email,
    phone: client.phone ?? client.contact ?? '',
    address: client.address ?? '',
    status: client.status ?? ''
  });

  this.loadUsers(); // 👈 THIS IS THE KEY LINE

  this.editDialogRef = this.dialog.open(this.editClientDialog, {
    width: '580px',
    disableClose: true
  });
}



  closeEditDialog(): void {
    this.editDialogRef?.close();
    this.editDialogRef = undefined;
  }

updateClient(): void {
  if (!this.editingClientId || this.editForm.invalid) return;

  this.loading = true;

  const formValue = this.editForm.value;

  const payload = {
    name: formValue.name,
    email: formValue.email,
    phone: formValue.phone,
    address: formValue.address,
    status: formValue.status,
    assignedTo: this.editForm.value.assignedUserId// 👈 backend field
  };

  this.clientService.updateClient(this.editingClientId, payload)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.snackBar.open('✅ Client updated', 'OK', { duration: 3000 });
        this.loading = false;
        this.closeEditDialog();
        this.loadClients();
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('❌ Update failed', 'OK', { duration: 3000 });
      }
    });
}


  /* ---------------- Documents ---------------- */
  openDocumentDialog(client: Client): void {
    this.selectedClient = client;
    this.documentDialogRef = this.dialog.open(this.documentDialog, {
      width: '420px',
      disableClose: true,
      data: { clientName: client.name || client.email }
    });
  }

  closeDialog(): void {
    this.documentDialogRef?.close();
    this.documentDialogRef = undefined;
  }

  goToDocuments(): void {
    if (!this.selectedClient?.id) return;
    this.closeDialog();
    this.router.navigate(['/admin/documents'], {
      queryParams: { clientId: this.selectedClient.id }
    });
  }

  /* ---------------- Delete ---------------- */
  delete(id?: string | number): void {
    if (!id || !confirm('Delete this client?')) return;

    this.clientService.deleteClient(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.snackBar.open('✅ Client deleted', 'OK', { duration: 3000 });
        this.loadClients();
      });
  }

  goToNewClient(): void {
    this.router.navigate(['/clients/new']);
  }
}
