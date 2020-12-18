import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

interface User {
  user_id: string;
  password: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  userCredential: User;
  constructor(private http: HttpClient) {}

  async login(data: User) {
    try {
      let result = await this.http
        .post<{}>('/api/login', data, { observe: 'response' })
        .toPromise();
      if (result['status'] === 200) {
        this.userCredential = {
          user_id: result.body['user_id'],
          password: result.body['password'],
        };
      }
      console.log(this.userCredential);
      return result;
    } catch (error) {
      console.log(error);
      return error;
    }
  }
}
