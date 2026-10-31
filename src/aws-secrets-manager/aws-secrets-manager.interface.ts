import { ModuleMetadata, Type } from '@nestjs/common';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export interface AWSSecretsManagerModuleOptions {
  /** The AWS SDK v3 Secrets Manager client used for every request. */
  secretsManager: SecretsManagerClient;
  /**
   * Copy the key/value pairs of every secret in `secretsSource` into
   * `process.env` while the module initialises.
   */
  isSetToEnv?: boolean;
  /** Name or ARN of a secret, or a list of them (later secrets win on duplicate keys). */
  secretsSource?: string | string[];
  /** Log the loaded secrets, values included. Do not enable in production. */
  isDebug?: boolean;
}

export interface AWSSecretsManagerModuleOptionsFactory {
  createAWSSecrectsManagerModuleOptions():
    Promise<AWSSecretsManagerModuleOptions> | AWSSecretsManagerModuleOptions;
}

export interface AWSSecretsManagerModuleAsyncOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  useFactory?: (
    ...args: any[]
  ) => Promise<AWSSecretsManagerModuleOptions> | AWSSecretsManagerModuleOptions;
  inject?: any[];
  useClass?: Type<AWSSecretsManagerModuleOptionsFactory>;
  useExisting?: Type<AWSSecretsManagerModuleOptionsFactory>;
}
