import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ClientService } from '../../services/client.service';
import { MatSnackBar } from '@angular/material/snack-bar';
 
@Component({
  selector: 'app-client-form',
  templateUrl: './client-form.component.html',
  styleUrls: ['./client-form.component.scss']
})
export class ClientFormComponent implements OnInit {
  clientForm!: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private clientService: ClientService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.clientForm = this.fb.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      alternatePhone: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['Client', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.clientForm.invalid) return;

    const [firstName, ...rest] =
      this.clientForm.value.fullName.trim().split(' ');
    const lastName = rest.join(' ') || ' ';

    const payload = {
      firstName,
      lastName,
      email: this.clientForm.value.email,
      password: this.clientForm.value.password,
      phoneNumber: this.clientForm.value.phone,
      alternatePhoneNumber: this.clientForm.value.alternatePhone,
      role: this.clientForm.value.role
    };

    this.loading = true;

    this.clientService.addClient(payload).subscribe({
      next: () => {
        this.loading = false;
        this.snackBar.open('✅ Client created successfully', 'OK', {
          duration: 3000
        });
        this.router.navigate(['/clients']);
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        this.snackBar.open('❌ Failed to create client', 'OK', {
          duration: 3000
        });
      }
    });
  }
}
