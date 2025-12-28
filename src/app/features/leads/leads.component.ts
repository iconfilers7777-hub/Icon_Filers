import { SelectionModel } from '@angular/cdk/collections';
import { HttpClient, HttpRequest } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { environment } from '../../../../src/environment/environment';
import { Subject, debounceTime, forkJoin, of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, map } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { LeadService } from './services/lead.service';
import { MatPaginator } from '@angular/material/paginator';
import { ViewChild, AfterViewInit } from '@angular/core';
import { AuthService } from 'src/app/auth/auth.service';



export interface Lead {
  id?: string;
  name: string;
  email: string;
  phone1: string;
  phone2?: string;
  status: string;
  team: string;
}

interface AssignUser {
  id: string;
  name: string;
}

@Component({
  selector: 'app-leads',
  templateUrl: './leads.component.html',
  styleUrls: ['./leads.component.scss']
})
export class LeadsComponent implements OnInit, AfterViewInit  {
  @ViewChild(MatPaginator) paginator!: MatPaginator;


  displayedColumns: string[] = [
    'select', 'name', 'email', 'phone1', 'phone2', 'status', 'team', 'actions'
  ];
assignUsers: { id: string; name: string }[] = [];
selectedBulkUserId: string = '';

  teams: string[] = ['All Teams'];
  dataSource = new MatTableDataSource<Lead>([]);
  selection = new SelectionModel<Lead>(true, []);

  // Only Hunters and fighters (plus All Teams for filter)
  statuses: string[] = ['All Statuses'];

  searchSubject = new Subject<string>();
  loading = false;

  // total count shown in UI
  total = 0;

  // selected team for bulk assignment (must be Hunters or fighters)
  selectedBulkTeam = '';

  filterValues = {
    search: '',
    team: 'All Teams',
    status: 'All Statuses'
  };

  // header alias map used by the mapping logic (for XLSX parsing)
  private headerAliases: Record<string, string[]> = {
    name: ['name', 'full name', 'client name', 'lead name', 'customer', 'contact person'],
    email: ['email', 'email address', 'e-mail', 'mail'],
    contact: ['phone', 'phone1', 'contact', 'mobile', 'phone number', 'contact no', 'mobile no'],
    contact2: ['phone2', 'secondary phone', 'alt phone', 'alternate phone', 'contact2'],
    status: ['status', 'lead status', 'state'],
    team: ['team', 'group', 'assigned team', 'role']
  };

  // regexes for inference
  private emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private phoneRegex = /^[+()0-9\-\s]{6,20}$/;

  private teamToAssignedTo: Record<string, string> = {
    Hunters: '',   // <-- put the GUID for Hunters assignee here, if required
    fighters: ''   // <-- put the GUID for fighters assignee here, if required
  };

  // Optional: which user is performing the assignment (assignedBy). Fill if required by API.
  private defaultAssignedBy: string | null = null; // e.g. '3fa85f64-5717-4562-b3fc-2c963f66afa6'

  constructor(private http: HttpClient, private snackBar: MatSnackBar, private leadService: LeadService, private authService: AuthService) { }
  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  ngOnInit(): void {
    this.loadLeads();
    this.loadStatuses();
      this.loadAssignUsers(); // ✅ ADD THIS LINE
    // Debounce search
    this.searchSubject.pipe(debounceTime(400)).subscribe((term) => {
      this.filterValues.search = term;
      this.serverSearch(term);
    });

    // Local filter predicate
    this.dataSource.filterPredicate = (data: Lead, filter: string): boolean => {
      const f = JSON.parse(filter);
      const text = (
        (data.name || '') + ' ' + (data.email || '') + ' ' +
        (data.phone1 || '') + ' ' + (data.phone2 || '') +
        ' ' + (data.team || '') + ' ' + (data.status || '')
      ).toLowerCase();

      const teamMatch = f.team !== 'All Teams' ? data.team === f.team : true;
      const statusMatch = f.status !== 'All Statuses' ? data.status === f.status : true;
      return text.includes((f.search || '').toLowerCase()) && teamMatch && statusMatch;
    };

  }



loadAssignUsers(): void {
  const url = `${environment.apiBaseUrl}/Users/ByRoleIdName?role=User`;

  this.http.get<{ id: string; name: string }[]>(url, {
    headers: this.authService.getAuthHeaders()   // ✅ Bearer token here
  }).subscribe({
    next: (res) => {
      this.assignUsers = res || [];
    },
    error: (err) => {
      console.error('Failed to load users', err);
      this.showBanner('❌ Failed to load users for assignment', true);
    }
  });
}







  loadLeads(stopLoaderAfterLoad: boolean = true): void {
    this.loading = true;

    this.leadService.getLeads().subscribe({
      next: (res) => {
        const items = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
        const totalFromRes =
          typeof (res as any)?.total === 'number'
            ? (res as any).total
            : (Array.isArray(res) ? res.length : (items?.length ?? 0));

        this.total = totalFromRes ?? (items?.length ?? 0);

        this.dataSource.data = (items ?? []).map((item: any) => ({
          id: item.id ?? item.clientId ?? undefined,
          name: item.name ?? '',
          email: item.email ?? '',
          phone1: item.contact ?? item.phone ?? '',
          phone2: item.contact2 ?? item.phone2 ?? '',
          status: item.status ?? 'N/A',
          team: item.team ?? 'UNASSIGNED',
        }));

        console.log(
          '📌 TABLE DATA FETCHED FROM API:',
          JSON.stringify(this.dataSource.data, null, 2)
        );

        this.applyFilter();
        if (stopLoaderAfterLoad) this.loading = false;
        this.showBanner('✅ Latest leads loaded successfully!');
      },
      error: (err) => {
        this.loading = false;
        console.error('Failed to load leads', err);
        this.showBanner('❌ Failed to load leads', true);
      },
    });
  }


  /** Server-side search */
  serverSearch(query: string): void {
    const trimmed = query?.trim() || '';
    if (!trimmed) {
      this.loadLeads();
      return;
    }

    this.loading = true;
    const body = { searchText: trimmed };

    const req = new HttpRequest(
      'GET',
      `${environment.apiBaseUrl}/Clients/SearchByLetters`,
      body,
      { responseType: 'json' }
    );

    this.http.request<any>(req).subscribe({
      next: (event: any) => {
        if (!event || !event.body) return;
        const res = event.body;
        const items = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
        this.total = typeof res?.total === 'number' ? res.total : (Array.isArray(res) ? res.length : items.length);

        if (!items || items.length === 0) {
          this.dataSource.data = [];
          this.loading = false;
          this.showBanner('⚠️ No matching leads found');
          return;
        }

        this.dataSource.data = (items ?? []).map((item: any) => ({
          id: item.id ?? item.clientId ?? undefined,
          name: item.name || '',
          email: item.email || '',
          phone1: item.contact || item.phone || '',
          phone2: item.contact2 || item.phone2 || '',
          status: item.status || 'N/A',
          team: item.team || 'UNASSIGNED'
        }));

        this.loading = false;
        this.showBanner(`🔍 Showing ${this.dataSource.data.length} search result${this.dataSource.data.length > 1 ? 's' : ''}`);
      },
      error: (err) => {
        this.loading = false;
        console.error('❌ Search failed:', err);
        this.showBanner('❌ Search failed', true);
      }
    });
  }

  applyFilter(): void {
    this.dataSource.filter = JSON.stringify(this.filterValues);
    this.selection.clear();
  }

  loadStatuses(): void {
    this.leadService.getStatuses().subscribe({
      next: (res) => (this.statuses = ['All Statuses', ...res]),
      error: (err) => console.error('Failed to load statuses', err),
    });
  }


  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (!allowed.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      this.showBanner('❌ Unsupported file type', true);
      input.value = '';
      return;
    }

    this.loading = true;
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data as string, { type: 'binary' });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const raw: any[][] = XLSX.utils.sheet_to_json<any>(worksheet, {
          header: 1,
          defval: null
        });

        if (!raw || raw.length === 0) {
          this.loading = false;
          this.showBanner('⚠️ Empty spreadsheet', true);
          input.value = '';
          return;
        }

        const headerRow: any[] = raw[0].map((h: any) =>
          h === null ? '' : String(h).trim()
        );
        const rows: any[][] = raw
          .slice(1)
          .filter(
            (r) =>
              r && r.some((c: any) => c !== null && String(c).trim() !== '')
          );

        if (!rows.length) {
          this.loading = false;
          this.showBanner('⚠️ No data rows found', true);
          input.value = '';
          return;
        }

        const mapping = this.buildHeaderMapping(headerRow, rows);
        const previewData: Lead[] = rows.map((r) =>
          this.mapRowToLead(r, headerRow, mapping)
        );

        console.log('Detected column mapping:', mapping);
        console.log('Preview sample:', previewData.slice(0, 5));

        // Show preview in table
        this.dataSource.data = previewData;
        this.total = previewData.length;
        this.applyFilter();

        // 🔥 Real upload – just send the file to /Clients/upload-excel via service
        this.leadService.uploadExcel(file).subscribe({
          next: (resp) => {
            console.log('Upload full response:', resp);

            if (resp.status === 204) {
              this.showBanner('Upload completed successfully');
            } else if (resp.status >= 200 && resp.status < 300) {
              this.showBanner('Upload succeeded');
            } else {
              this.showBanner('Upload returned an unexpected status', true);
            }
            // ✅ STOP LOADER
            this.loading = false;
            // ✅ Reload latest leads from server
            this.refreshTableData();
          },
          error: (err) => {
            console.error('Upload error:', err);
            this.showBanner('❌ Upload failed (network/server error)', true);
            // ✅ STOP LOADER ON ERROR
            this.loading = false;
          }
        });
      } catch (err) {
        console.error('Parse error', err);
        this.showBanner('❌ Failed to parse file', true);
        this.loading = false;
      } finally {
        input.value = '';
      }
    };
    reader.readAsBinaryString(file);
  }

  
assignSelectedTeam(): void {

  if (!this.selection.hasValue()) {
    this.showBanner('⚠️ No rows selected to assign', true);
    return;
  }

  if (!this.selectedBulkUserId) {
    this.showBanner('⚠️ Please select a user', true);
    return;
  }

  const url = `${environment.apiBaseUrl}/ClientAssignment/add-bulk`;

  // 🔹 build BULK DATA ARRAY
  const data = this.selection.selected.map(row => ({
    name: row.name,
    contact: row.phone1,
    contact2: row.phone2 ?? '',
    email: row.email,
    status: row.status ?? 'Assigned',
    assignedTo: this.selectedBulkUserId,
    assignedBy: this.defaultAssignedBy
      ?? this.authService.getUser()?.id
      ?? null
  }));

  // 🔹 Swagger-required WRAPPER
  const payload = {
    assignedTo: this.selectedBulkUserId,
    data
  };

  console.log('➡️ FINAL BULK PAYLOAD:', JSON.stringify(payload, null, 2));

  this.loading = true;

  this.http.post(url, payload, {
    headers: this.authService.getAuthHeaders()
  }).subscribe({
    next: () => {
      this.showBanner(`✅ ${data.length} leads assigned successfully`);
      this.selection.clear();
      this.loadLeads();
      this.loading = false;
    },
    error: (err) => {
      console.error('❌ Bulk assign failed', err);
      this.showBanner('❌ Bulk assign failed', true);
      this.loading = false;
    }
  });
}




  // mapping helpers (unchanged)
  private buildHeaderMapping(headers: any[], sampleRows: any[][]): Record<string, number | null> {
    const mapping: Record<string, number | null> = {
      name: null,
      email: null,
      contact: null,
      contact2: null,
      status: null,
      team: null
    };

    const normalized = headers.map(h => this.normalizeHeader(h || ''));

    // 1) Try header alias match
    for (let c = 0; c < normalized.length; c++) {
      const h = normalized[c];
      if (!h) continue;
      for (const target of Object.keys(this.headerAliases)) {
        for (const alias of this.headerAliases[target]) {
          if (h.includes(alias)) {
            if (mapping[target] === null) mapping[target] = c;
          }
        }
      }
    }

    // 2) For unmapped targets, try inference by sampling column values
    for (const target of Object.keys(mapping)) {
      if (mapping[target] !== null) continue;
      let bestCol: number | null = null;

      for (let c = 0; c < headers.length; c++) {
        // skip columns already claimed
        if (Object.values(mapping).includes(c)) continue;

        const samples: string[] = [];
        for (let r = 0; r < Math.min(10, sampleRows.length); r++) {
          const v = sampleRows[r][c];
          if (v !== null && v !== undefined && String(v).trim() !== '') samples.push(String(v).trim());
        }
        if (samples.length === 0) continue;

        if (target === 'email') {
          const matchCount = samples.filter(s => this.emailRegex.test(s)).length;
          if (matchCount / samples.length >= 0.6) bestCol = c;
        } else if (target === 'contact' || target === 'contact2') {
          const matchCount = samples.filter(s => this.phoneRegex.test(s)).length;
          if (matchCount / samples.length >= 0.6) {
            bestCol = c;
          }
        } else if (target === 'name') {
          const nonEmailNonPhone = samples.filter(s => !this.emailRegex.test(s) && !this.phoneRegex.test(s));
          if (nonEmailNonPhone.length / samples.length >= 0.6) bestCol = c;
        } else if (target === 'status' || target === 'team') {
          const nonEmpty = samples.filter(s => s && s.length > 0).length;
          if (nonEmpty / samples.length >= 0.6) bestCol = c;
        }

        if (bestCol !== null) break;
      }

      if (bestCol !== null) mapping[target] = bestCol;
    }

    // 3) Final fallback: assign remaining targets to available columns in order
    const unassignedTargets = Object.keys(mapping).filter(t => mapping[t] === null);
    const availableCols = headers.map((_, i) => i).filter(i => !Object.values(mapping).includes(i));
    for (let i = 0; i < unassignedTargets.length && i < availableCols.length; i++) {
      mapping[unassignedTargets[i]] = availableCols[i];
    }
    return mapping;
  }

  private normalizeHeader(h: string): string {
    if (!h) return '';
    return h
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private mapRowToLead(row: any[], headerRow: any[], mapping: Record<string, number | null>): Lead {
    const read = (col: number | null) => (col === null ? null : (row[col] ?? null));
    const name = read(mapping['name']) ?? '';
    const email = read(mapping['email']) ?? '';
    const contact = read(mapping['contact']) ?? '';
    const contact2 = read(mapping['contact2']) ?? '';
    const status = read(mapping['status']) ?? 'N/A';
    const team = read(mapping['team']) ?? 'UNASSIGNED';
    return {
      name: String(name ?? '').trim(),
      email: String(email ?? '').trim(),
      phone1: String(contact ?? '').trim(),
      phone2: String(contact2 ?? '').trim(),
      status: String(status ?? '').trim(),
      team: String(team ?? '').trim()
    };
  }

  private mapRowToUploadObject(row: any[], headerRow: any[], mapping: Record<string, number | null>) {
    const read = (col: number | null) => (col === null ? null : (row[col] ?? null));
    const name = read(mapping['name']) ?? '';
    const email = read(mapping['email']) ?? '';
    const contact = read(mapping['contact']) ?? '';
    const contact2 = read(mapping['contact2']) ?? '';
    const status = read(mapping['status']) ?? 'N/A';
    const team = read(mapping['team']) ?? 'UNASSIGNED';

    return {
      name: String(name ?? '').trim(),
      email: String(email ?? '').trim(),
      contact: String(contact ?? '').trim(),
      contact2: String(contact2 ?? '').trim(),
      status: String(status ?? '').trim(),
      team: String(team ?? '').trim()
    };
  }

  // Selection helpers and UI actions unchanged
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.filteredData.length;
    return numRows > 0 && numSelected === numRows;
  }

  masterToggle() {
    this.isAllSelected()
      ? this.selection.clear()
      : this.dataSource.filteredData.forEach(row => this.selection.select(row));
  }

  checkboxLabel(row?: Lead): string {
    if (!row) return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.name}`;
  }

  edit(row: Lead) {
    console.log('Edit', row);
    this.showBanner(`✏️ Edit ${row.name}`);
  }

  assign(row: Lead) {
    console.log('Assign', row);
    this.showBanner(`👤 Assigned ${row.name}`);
  }

  remove(row: Lead) {
    console.log('Delete', row);
    this.showBanner(`🗑️ Removed ${row.name}`);
  }

  private showBanner(message: string, isError: boolean = false): void {
    this.snackBar.open(message, 'OK', {
      duration: 3500,
      panelClass: isError ? ['banner-error'] : ['banner-success'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }


private refreshTableData(): void {
  this.loading = true;

  this.leadService.getLeads().subscribe({
    next: (res) => {
      const items = Array.isArray(res)
        ? res
        : (res?.items ?? res?.data ?? []);

      this.total = typeof res?.total === 'number'
        ? res.total
        : items.length;

      // 🔁 RECREATE datasource (important)
      this.dataSource = new MatTableDataSource<Lead>(
        items.map((item: any) => ({
          id: item.id ?? item.clientId ?? undefined,
          name: item.name ?? '',
          email: item.email ?? '',
          phone1: item.contact ?? item.phone ?? '',
          phone2: item.contact2 ?? item.phone2 ?? '',
          status: item.status ?? 'N/A',
          team: item.team ?? 'UNASSIGNED'
        }))
      );

      // ✅ rebind paginator + filter
      this.dataSource.paginator = this.paginator;
      this.dataSource.filterPredicate = this.dataSource.filterPredicate;

      this.applyFilter();
      this.selection.clear();
      this.loading = false;
    },
    error: () => {
      this.loading = false;
      this.showBanner('❌ Failed to refresh table', true);
    }
  });
}


}
