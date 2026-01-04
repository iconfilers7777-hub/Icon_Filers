import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environment/environment';
import { AuthService } from 'src/app/auth/auth.service';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';

interface ClientDocument {
  id: number;
  fileName: string;
  documentType: string;
  uploadedAt: string; // ISO date string
}


@Component({
  selector: 'app-team-documents-upload',
  templateUrl: './team-documents-upload.component.html',
  styleUrls: ['./team-documents-upload.component.scss'],
})
export class TeamDocumentsUploadComponent implements OnInit, OnChanges {
 // Admin can type or pass this in – GUID as string
   @Input() clientId: string = '';
   @Input() clientName?: string;
 
   private api = environment.apiBaseUrl; 
 
   documentTypes: string[] = [];
   documentType = '';
 
   selectedFiles: File[] = [];
   isDragOver = false;
   uploading = false;
 
   documents: ClientDocument[] = [];
   filteredDocuments: ClientDocument[] = [];
   displayedColumns = ['fileName', 'documentType', 'uploadedAt', 'actions'];
   search = '';
 
   constructor(private http: HttpClient,  private authService: AuthService,  private router: Router,  private route: ActivatedRoute,) {
     console.log('[DocumentsComponent] constructor, default clientId =', this.clientId);
   }
 private authOptions(removeContentType: boolean = false) {
   const token = this.authService.getToken();
   let headers = new HttpHeaders();
 
   if (token) {
     headers = headers.set('Authorization', `Bearer ${token}`);
   }
 
   // When sending FormData → remove Content-Type
   if (removeContentType) {
     headers = headers.delete('Content-Type');
   }
 
   return { headers };
 }
ngOnInit(): void {
  this.route.queryParamMap.subscribe(params => {
    this.clientId = params.get('clientId') || '';
    console.log('Client ID (query):', this.clientId);

    if (this.clientId) {
      this.loadDocumentTypes();
      this.loadDocuments();
    }
  });
}
 
   ngOnChanges(changes: SimpleChanges): void {
     if (changes['clientId']) {
       console.log('[DocumentsComponent] clientId changed to:', this.clientId);
       this.loadDocuments();
     }
   }
 
   /* ---------- Load document types ---------- */
   private loadDocumentTypes(): void {
     const url = `${this.api}/WorkFlow/GetTypes`;
     console.log('[DocumentsComponent] loadDocumentTypes → GET', url);
 
     this.http.get<{ type: string }[]>(url).subscribe({
       next: (res) => {
         this.documentTypes = (res || []).map((x) => x.type);
         console.log('[DocumentsComponent] documentTypes =', this.documentTypes);
       },
       error: (err) => {
         console.error('[DocumentsComponent] loadDocumentTypes ERROR', err);
         this.documentTypes = ['All Documents (ZIP File)'];
       },
     });
   }
 
   /* ---------- Load existing docs ---------- */
 loadDocuments(): void {
   if (!this.clientId) {
     this.filteredDocuments = this.documents = [];
     return;
   }
 
   const url = `${this.api}/clients/${this.clientId}/documents`;
   console.log('[DocumentsComponent] loadDocuments → GET', url);
 
   this.http.get<ClientDocument[]>(url, this.authOptions()).subscribe({
     next: (docs) => {
       this.documents = docs || [];
       this.applyFilter();
     },
     error: (err) => {
       console.error('[DocumentsComponent] loadDocuments ERROR', err);
       this.documents = this.filteredDocuments = [];
     },
   });
 }
 
 
   /* ---------- Search ---------- */
   applyFilter(): void {
     const term = (this.search || '').toLowerCase();
     if (!term) {
       this.filteredDocuments = this.documents;
       return;
     }
     this.filteredDocuments = this.documents.filter(
       (d) =>
         d.fileName.toLowerCase().includes(term) ||
         d.documentType.toLowerCase().includes(term)
     );
   }
 
   /* ---------- File Input + Drag/Drop ---------- */
   onFilesSelected(event: Event): void {
     const target = event.target as HTMLInputElement;
     const list = target.files ? Array.from(target.files) : [];
     if (list.length) this.selectedFiles = [...this.selectedFiles, ...list];
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
       const list = Array.from(e.dataTransfer.files);
       this.selectedFiles = [...this.selectedFiles, ...list];
     }
   }
 
   clearSelected() {
     this.selectedFiles = [];
   }
 
   removeSelected(i: number) {
     this.selectedFiles.splice(i, 1);
     this.selectedFiles = [...this.selectedFiles];
   }
 
   /* ---------- Upload ---------- */
 upload(): void {
   console.log('[DocumentsComponent] upload()', {
     clientId: this.clientId,
     documentType: this.documentType,
     files: this.selectedFiles.length,
   });
 
   if (!this.clientId) {
     alert('Please enter/select a Client ID (GUID).');
     return;
   }
   if (!this.selectedFiles.length) {
     alert('Please select at least one file.');
     return;
   }
   if (!this.documentType) {
     alert('Please choose a document type.');
     return;
   }
 
   const formData = new FormData();
   this.selectedFiles.forEach(file => formData.append('files', file, file.name));
   formData.append('documentType', this.documentType);
   formData.append('clientId', this.clientId);
 
   const url = `${this.api}/clients/${this.clientId}/documents`;
   console.log('[DocumentsComponent] POST', url);
 
   this.uploading = true;
 
   this.http.post(url, formData, this.authOptions(true)).subscribe({
     next: () => {
       this.uploading = false;
       this.selectedFiles = [];
       this.documentType = '';
       this.loadDocuments();
     },
     error: (err) => {
       this.uploading = false;
       console.error('[DocumentsComponent] upload ERROR', err);
     },
   });
 }
 
 
   /* ---------- Download ---------- */
   download(doc: ClientDocument): void {
     const url = `${this.api}/clients/${this.clientId}/documents/${doc.id}`;
     this.http.get(url, { responseType: 'blob' }).subscribe({
       next: (blob) => {
         const downloadUrl = window.URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = downloadUrl;
         a.download = doc.fileName;
         a.click();
         URL.revokeObjectURL(downloadUrl);
       },
     });
   }
 
   /* ---------- Delete ---------- */
   delete(doc: ClientDocument): void {
     if (!confirm(`Delete document "${doc.fileName}"?`)) return;
 
     const url = `${this.api}/clients/${this.clientId}/documents/${doc.id}`;
 
     this.http.delete(url).subscribe({
       next: () => this.loadDocuments(),
       error: (err) => console.error('[DocumentsComponent] delete ERROR', err),
     });
   }
 }
 