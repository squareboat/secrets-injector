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
  /**
   * Name or ARN of a secret, or a list of them (later secrets win on
   * duplicate keys). Empty and `undefined` entries are skipped.
   */
  secretsSource?: SecretsSource;
  /** Log the loaded secrets, values included. Do not enable in production. */
  isDebug?: boolean;
  /**
   * Maximum time in ms for each Secrets Manager call made by this package,
   * SDK retries included. Default 10000; 0 turns it off. The SDK itself has
   * no timeout by default, so an endpoint that never answers (for example a
   * private subnet without a NAT gateway or VPC endpoint) would block startup.
   */
  timeout?: number;
}

/** A secret name or ARN, or a list of them. */
export type SecretsSource = string | ReadonlyArray<string | undefined>;

export interface LoadSecretsToEnvOptions {
  /** The AWS SDK v3 Secrets Manager client used for every request. */
  secretsManager: SecretsManagerClient;
  /** Name or ARN of a secret, or a list of them (later secrets win). */
  secretsSource: SecretsSource;
  /** Log the loaded secrets, values included. Do not enable in production. */
  isDebug?: boolean;
  /** Maximum time in ms for each Secrets Manager call. Default 10000; 0 turns it off. */
  timeout?: number;
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
