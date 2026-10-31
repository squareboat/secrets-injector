import { Provider } from '@nestjs/common';

import {
  AWSSecretsManagerModuleOptions,
  AWSSecretsManagerModuleAsyncOptions,
  AWSSecretsManagerModuleOptionsFactory,
} from './aws-secrets-manager.interface';
import { AWSSecretsService } from './aws-secrets-manager.service';
import { AWS_SECRETS_MANAGER_MODULE_OPTIONS } from './contstants';

/**
 * AWSSecretsService is created by an async factory so that Nest waits for the
 * secrets to be in process.env before it creates anything that injects the
 * service, and before NestFactory.create() / createApplicationContext() resolves.
 */
const secretsServiceProvider: Provider = {
  provide: AWSSecretsService,
  useFactory: async (options: AWSSecretsManagerModuleOptions) => {
    const service = new AWSSecretsService(options);
    if (options.secretsSource && options.isSetToEnv) {
      await service.setAllSecrectToEnv();
    }
    return service;
  },
  inject: [AWS_SECRETS_MANAGER_MODULE_OPTIONS],
};

export function createAWSSecretsManagerProviders(
  options: AWSSecretsManagerModuleOptions,
): Provider[] {
  return [
    secretsServiceProvider,
    {
      provide: AWS_SECRETS_MANAGER_MODULE_OPTIONS,
      useValue: options,
    },
  ];
}

export function createAWSSecretsManagerAsyncProviders(
  options: AWSSecretsManagerModuleAsyncOptions,
): Provider[] {
  const providers: Provider[] = [secretsServiceProvider];

  if (options.useFactory) {
    providers.push({
      provide: AWS_SECRETS_MANAGER_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject || [],
    });
    return providers;
  }

  const factory = options.useClass || options.useExisting;
  if (!factory) {
    throw new Error(
      'AWSSecretsManagerModule.forRootAsync() needs useFactory, useClass or useExisting',
    );
  }

  providers.push({
    provide: AWS_SECRETS_MANAGER_MODULE_OPTIONS,
    useFactory: async (optionsFactory: AWSSecretsManagerModuleOptionsFactory) =>
      await optionsFactory.createAWSSecrectsManagerModuleOptions(),
    inject: [factory],
  });
  if (options.useClass) {
    providers.push({ provide: options.useClass, useClass: options.useClass });
  }

  return providers;
}
