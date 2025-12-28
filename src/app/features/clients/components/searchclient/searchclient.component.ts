import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ClientService } from '../../services/client.service';
import { Client } from 'src/app/core/models/client.model';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-searchclient',
  templateUrl: './searchclient.component.html',
  styleUrls: ['./searchclient.component.scss']
})
export class SearchclientComponent implements OnInit, OnDestroy {

  @ViewChild('clientDetailsDialog') clientDetailsDialog!: TemplateRef<any>;

  searchForm = this.fb.group({
    searchText: ['', Validators.required],
    status: ['all']
  });

  isLoading = false;
  errorMessage = '';

  allClients: Client[] = [];
  clients: Client[] = [];

  selectedClientDetails: any = null;
  dialogRef?: MatDialogRef<any>;

  displayedColumns = [
    'name', 'email', 'phone', 'status', 'team', 'createdAt', 'actions'
  ];

  private sub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private clientService: ClientService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.sub = this.clientService.getClients().subscribe(res => {
      this.allClients = res || [];
      this.applyFilter();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onSearch(): void {
    this.applyFilter();
  }

  clear(): void {
    this.searchForm.reset({ searchText: '', status: 'all' });
    this.applyFilter();
  }

private applyFilter(): void {
  const text = (this.searchForm.value.searchText || '').toLowerCase().trim();
  const status = this.searchForm.value.status || 'all';

  this.clients = this.allClients.filter(c => {
    const matchesText =
      !text ||
      (c.name && c.name.toLowerCase().includes(text)) ||
      (c.email && c.email.toLowerCase().includes(text)) ||
      (c.phone && String(c.phone).toLowerCase().includes(text)) ||
      (c.id && String(c.id).toLowerCase().includes(text));

    const matchesStatus =
      status === 'all' ||
      !c.status ||
      c.status.toLowerCase() === status.toLowerCase();

    return matchesText && matchesStatus;
  });
}


  /* 🔥 VIEW CLIENT DETAILS */
  viewClient(c: Client): void {
    this.isLoading = true;

    this.clientService.getClientDetails(c.id as string).subscribe({
      next: (res) => {
        this.selectedClientDetails = res;
        this.isLoading = false;

        this.dialogRef = this.dialog.open(this.clientDetailsDialog, {
          width: '900px',
          maxHeight: '85vh',
          disableClose: false
        });
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Failed to load client details';
      }
    });
  }

  closeDialog(): void {
    this.dialogRef?.close();
  }
}
