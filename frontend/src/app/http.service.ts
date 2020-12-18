import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class HttpService {
  constructor(private http: HttpClient) {}

  async submitShare(payload) {
    let { title, comments, user_id, password } = payload;
    let data = new FormData();
    data.set(`name`, 'imageFile');
    data.set('imageFile', payload.image['imageData']);
    data.set('title', title);
    data.set('comments', comments);
    data.set('user_id', user_id);
    data.set('password', password);
    try {
      let result = await this.http
        .post<{}>('/api/post', data, { observe: 'response' })
        .toPromise();
      return result;
    } catch (error) {
      return error;
    }
  }
}
