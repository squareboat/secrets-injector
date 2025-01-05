import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  async getHello() {
    return JSON.stringify(process.env.DEVELOPER_NAME);
  }
}
