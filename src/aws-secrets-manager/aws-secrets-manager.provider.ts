import { Provider, Type } from '@nestjs/common';

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
  if (options.useClass) {
    const useClass =
      options.useClass as Type<AWSSecretsManagerModuleOptionsFactory>;
    providers.push(
      ...[
        {
          provide: AWS_SECRETS_MANAGER_MODULE_OPTIONS,
          useFactory: async (
            optionsFactory: AWSSecretsManagerModuleOptionsFactory,
          ) => await optionsFactory.createAWSSecrectsManagerModuleOptions(),
          inject: [useClass],
        },
        {
          provide: useClass,
          useClass,
        },
      ],
    );
  }

  if (options.useFactory) {
    providers.push({
      provide: AWS_SECRETS_MANAGER_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject || [],
    });
  }

  return providers;
}
