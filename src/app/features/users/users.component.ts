import { Component, OnInit, TemplateRef, ViewChild, AfterViewInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { environment } from '../../../environment/environment';
import { AuthService } from 'src/app/auth/auth.service';

export interface User {
  id?: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  deskNumber?: string | null;
  whatsAppNumber?: string | null;
  role: string;
  reportsTo?: string | null;
  teamName?: string | null;
  targetAmount?: number | null;
  discountAmount?: number | null;
  createdAt?: string | null;
}

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit, AfterViewInit {
  @ViewChild('addUserDialog') addUserDialog!: TemplateRef<any>;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  displayedColumns: string[] = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'deskNumber',
    'whatsAppNumber',
    'role',
    'teamName',
    'actions'
  ];

  dataSource = new MatTableDataSource<User>([]);
  userForm!: FormGroup;
  loading = false;

  // pagination (client-side here)
  totalUsers = 0;
  pageIndex = 0;
  pageSize = 25;
  pageSizeOptions = [10, 25, 50, 100];

  // better: base URL for Users
  private usersBaseUrl = `${environment.apiBaseUrl}/Users`;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.userForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      password: ['', Validators.required],
      deskNumber: [''],
      whatsAppNumber: [''],
      role: ['', Validators.required],
      reportsTo: [''],
      teamName: [''],
      targetAmount: [0],
      discountAmount: [0]
    });

    this.loadUsers();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  /** 🔹 Load Users (API returns a plain array User[]) */
  loadUsers(): void {
    this.loading = true;

    this.http.get<User[]>(
      `${this.usersBaseUrl}/GetUserByRole`,
      {
        headers: this.authService.getAuthHeaders(),
        params: {
          role: 'User'    // only team members
        }
      }
    ).subscribe({
      next: (users) => {
        this.dataSource.data = users ?? [];
        this.totalUsers = this.dataSource.data.length;

        console.log('Loaded users:', this.dataSource.data);
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load users', err);
        this.loading = false;
        this.showBanner('❌ Failed to load users', true);
      }
    });
  }

  /** 🔹 MatPaginator event (client-side pagination only) */
  onPageChanged(event: PageEvent): void {
    // with MatTableDataSource + this.dataSource.paginator,
    // Angular Material handles client-side pagination automatically.
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  /** 🔹 Open Add User Dialog */
  openAddUserDialog(): void {
    this.dialog.open(this.addUserDialog, {
      width: '520px',
      height: 'fit-content',
      disableClose: true,
      panelClass: 'custom-user-dialog'
    });
  }

  /** 🔹 Create User */
  createUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.loading = true;

    const payload = {
      firstName: this.userForm.value.firstName,
      lastName: this.userForm.value.lastName,
      email: this.userForm.value.email,
      password: this.userForm.value.password,
      phone: this.userForm.value.phone || '',
      deskNumber: this.userForm.value.deskNumber || '',
      whatsAppNumber: this.userForm.value.whatsAppNumber || '',
      role: this.userForm.value.role,
      reportsTo: this.userForm.value.reportsTo || null,
      teamName: this.userForm.value.teamName || 'Default',
      targetAmount: Number(this.userForm.value.targetAmount) || 0,
      discountAmount: Number(this.userForm.value.discountAmount) || 0
    };

    console.log('📤 Sending payload (JSON):', payload);

    this.http.post(
      `${this.usersBaseUrl}/Create`,   // ✅ fixed URL
      payload,
      {
        headers: this.authService.getAuthHeaders(), // include token, content-type json
        observe: 'response'
      }
    ).subscribe({
      next: (resp) => {
        this.dialog.closeAll();
        this.userForm.reset();

        // reload list after create
        this.loadUsers();

        this.loading = false;
        this.showBanner('✅ User created successfully!');
        console.log('✅ Create response status:', resp.status, resp);
      },
      error: (err) => {
        this.loading = false;
        console.error('❌ Error creating user:', err);

        const status = err.status ?? 'no-status';
        const body = err.error ?? JSON.stringify(err);
        console.warn(`HTTP ${status} — response body:`, body);

        if (err.error?.errors) {
          const messages = Object.entries(err.error.errors)
            .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
            .join('\n');
          this.showBanner(`❌ Validation errors:\n${messages}`, true);
        } else if (err.error?.title) {
          this.showBanner(`❌ ${err.error.title}`, true);
        } else {
          this.showBanner(`❌ Unknown error (HTTP ${status})`, true);
        }
      }
    });
  }

  /** 🔹 Snackbar Banner Utility */
  private showBanner(message: string, isError = false): void {
    this.snackBar.open(message, 'OK', {
      duration: 3000,
      panelClass: isError ? ['banner-error'] : ['banner-success'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }
}
