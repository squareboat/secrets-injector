import { DynamicModule, Global, Module } from '@nestjs/common';
import {
  AWSSecretsManagerModuleAsyncOptions,
  AWSSecretsManagerModuleOptions,
} from './aws-secrets-manager.interface';
import {
  createAWSSecretsManagerAsyncProviders,
  createAWSSecretsManagerProviders,
} from './aws-secrets-manager.provider';

import { AWSSecretsService } from './aws-secrets-manager.service';

@Global()
@Module({})
export class AWSSecretsManagerModule {
  static forRoot(options: AWSSecretsManagerModuleOptions): DynamicModule {
    return {
      module: AWSSecretsManagerModule,
      providers: createAWSSecretsManagerProviders(options),
      exports: [AWSSecretsService],
    };
  }

  static forRootAsync(
    options: AWSSecretsManagerModuleAsyncOptions,
  ): DynamicModule {
    return {
      module: AWSSecretsManagerModule,
      imports: options.imports || [],
      providers: createAWSSecretsManagerAsyncProviders(options),
      exports: [AWSSecretsService],
    };
  }
}
