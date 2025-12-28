import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environment/environment';
import { AuthService, User } from 'src/app/auth/auth.service';

interface ClientDocument {
  id: number;
  fileName: string;
  documentType: string;
  uploadedAt: string;
}

@Component({
  selector: 'app-client-documents',
  templateUrl: './client-documents.component.html',
  styleUrls: ['./client-documents.component.scss']
})
export class ClientDocumentsComponent implements OnInit {

  /* ===============================
     LOGGED-IN CLIENT INFO
     =============================== */
  clientId!: string;        // GUID
  clientName = '';

  private api = environment.apiBaseUrl; // https://iconfilers.club/IconFilers/api

  /* ===============================
     DOCUMENT STATE
     =============================== */
  documentTypes: string[] = [];
  documentType = '';

  selectedFiles: File[] = [];
  isDragOver = false;
  uploading = false;

  documents: ClientDocument[] = [];
  filteredDocuments: ClientDocument[] = [];
  search = '';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /* ===============================
     AUTH HEADER (Bearer Token)
     =============================== */
  private authOptions(removeContentType = false) {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    // DO NOT set Content-Type for FormData
    if (removeContentType) {
      headers = headers.delete('Content-Type');
    }

    return { headers };
  }

  /* ===============================
     INIT
     =============================== */
  ngOnInit(): void {
    const user: User | null = this.authService.getUser();

    console.log('[ClientDocuments] user:', user);

    if (!user || !user.id) {
      console.error('[ClientDocuments] Client ID missing');
      return;
    }

    // ✅ user.id is GUID (string)
    this.clientId = String(user.id);
    this.clientName = [user.firstName, user.lastName].filter(Boolean).join(' ');

    this.loadDocumentTypes();
    this.loadDocuments();
  }

  /* ===============================
     LOAD DOCUMENT TYPES
     =============================== */
  private loadDocumentTypes(): void {
    const url = `${this.api}/WorkFlow/GetTypes`;

    this.http.get<{ type: string }[]>(url, this.authOptions()).subscribe({
      next: res => {
        this.documentTypes = (res || []).map(x => x.type);
      },
      error: err => console.error('[ClientDocuments] Load types error', err)
    });
  }

  /* ===============================
     LOAD CLIENT DOCUMENTS
     =============================== */
  loadDocuments(): void {
    if (!this.clientId) return;

    const url = `${this.api}/clients/${this.clientId}/documents`;

    this.http.get<ClientDocument[]>(url, this.authOptions()).subscribe({
      next: docs => {
        this.documents = docs || [];
        this.applyFilter();
      },
      error: err => {
        console.error('[ClientDocuments] Load documents error', err);
        this.documents = this.filteredDocuments = [];
      }
    });
  }

  /* ===============================
     SEARCH
     =============================== */
  applyFilter(): void {
    const term = (this.search || '').toLowerCase();

    this.filteredDocuments = !term
      ? this.documents
      : this.documents.filter(d =>
          d.fileName.toLowerCase().includes(term) ||
          d.documentType.toLowerCase().includes(term)
        );
  }

  /* ===============================
     FILE HANDLING
     =============================== */
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    this.selectedFiles = [...this.selectedFiles, ...files];
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(e: DragEvent) {
    e.preventDefault();
    this.isDragOver = false;
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragOver = false;

    if (e.dataTransfer?.files?.length) {
      this.selectedFiles = [
        ...this.selectedFiles,
        ...Array.from(e.dataTransfer.files)
      ];
    }
  }

  clearSelected() {
    this.selectedFiles = [];
  }

  removeSelected(i: number) {
    this.selectedFiles.splice(i, 1);
    this.selectedFiles = [...this.selectedFiles];
  }

  /* ===============================
     UPLOAD DOCUMENTS (POST)
     =============================== */
upload(): void {
  if (this.uploading) return;

  if (!this.clientId || !this.documentType || !this.selectedFiles.length) {
    return;
  }

  this.uploading = true;

  const formData = new FormData();

  // ✅ files
  this.selectedFiles.forEach(file => {
    formData.append('files', file, file.name);
  });

  // ✅ required fields
  formData.append('documentType', this.documentType);

  // 🔥 IMPORTANT: SEND clientId IN BODY
  formData.append('clientId', this.clientId);

  const url = `${this.api}/clients/${this.clientId}/documents`;

  this.http.post(url, formData, this.authOptions(true)).subscribe({
    next: () => {
      this.uploading = false;
      this.selectedFiles = [];
      this.documentType = '';
      this.loadDocuments();
    },
    error: err => {
      this.uploading = false;
      console.error('[ClientDocuments] upload ERROR', err);
    }
  });
}


  /* ===============================
     DOWNLOAD
     =============================== */
  download(doc: ClientDocument): void {
    const url = `${this.api}/clients/${this.clientId}/documents/${doc.id}`;

    this.http.get(url, {
      responseType: 'blob',
      ...this.authOptions()
    }).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = doc.fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  /* ===============================
     DELETE
     =============================== */
  delete(doc: ClientDocument): void {
    if (!confirm(`Delete "${doc.fileName}"?`)) return;

    const url = `${this.api}/clients/${this.clientId}/documents/${doc.id}`;

    this.http.delete(url, this.authOptions()).subscribe({
      next: () => this.loadDocuments(),
      error: err => console.error('[ClientDocuments] Delete error', err)
    });
  }
}
