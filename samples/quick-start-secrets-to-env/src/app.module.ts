import { Module } from '@nestjs/common';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

import { AppService } from './app.service';
import { AppController } from './app.controller';

// the sample uses the package built in the repository root (npm run build there first);
// in your app: import { ... } from 'secrets-injector';
import {
  AWSSecretsManagerModule,
  AWSSecretsManagerModuleOptions,
} from '../../../dist';

const AWSSecretsManagerProps: AWSSecretsManagerModuleOptions = {
  // credentials come from the AWS SDK default chain (env vars, ~/.aws, IAM role)
  secretsManager: new SecretsManagerClient({
    region: process.env.AWS_REGION || 'ap-south-1',
  }),
  isDebug: process.env.NODE_ENV === 'development', // logs secret values: never in production
  isSetToEnv: true, // set all secrets to env variables which will be available in process.env or @nestjs/config
  secretsSource: process.env.SECRET_ID || 'test/sm', // OR a list of secret names or ARNs: ['db/prod/config', 'app/prod/config']
};

@Module({
  imports: [AWSSecretsManagerModule.forRoot(AWSSecretsManagerProps)],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
