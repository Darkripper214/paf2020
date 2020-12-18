import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { CameraService } from '../camera.service';
import { HttpService } from '../http.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css'],
})
export class MainComponent implements OnInit {
  imagePath = '/assets/cactus.png';
  form: FormGroup;
  constructor(
    private auth: AuthService,
    private cameraSvc: CameraService,
    private fb: FormBuilder,
    private http: HttpService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      title: ['', Validators.required],
      comments: ['', Validators.required],
      image: ['', Validators.required],
    });

    if (this.cameraSvc.hasImage()) {
      const img = this.cameraSvc.getImage();
      this.imagePath = img.imageAsDataUrl;
      this.form.get('image').patchValue(this.cameraSvc.getImage());
    }
  }

  clear() {
    this.imagePath = '/assets/cactus.png';
    this.form.patchValue({
      title: '',
      comments: '',
      image: '',
    });
  }

  async onSubmit() {
    let payload = { ...this.form.value, ...this.auth.userCredential };
    let outcome = await this.http.submitShare(payload);
    if (outcome['status'] === 401) {
      alert(outcome['error']['error']);
      this.router.navigate(['/']);
    } else if (outcome['status'] === 200) {
      alert('Successful!');
      this.clear();
      alert(JSON.stringify(outcome, null, 2));
    } else {
      alert('Something went wrong with persistence layer');
      console.log(outcome);
    }
  }
}
