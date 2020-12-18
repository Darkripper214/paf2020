import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  errorMessage = '';
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      user_id: ['', Validators.required],
      password: ['', Validators.required],
    });
  }

  async onSubmit() {
    let result = await this.auth.login(this.form.value);
    // Navigate to View 2 only when code is 200
    if (result['status'] === 200) {
      this.router.navigate(['/main']);
    } else {
      // Set error message
      this.errorMessage = result['statusText'];
    }
  }
}
