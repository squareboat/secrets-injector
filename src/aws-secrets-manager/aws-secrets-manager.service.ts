import { Inject, Injectable, Logger } from '@nestjs/common';

import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

import {
  AWS_SECRETS_MANAGER_MODULE_OPTIONS,
  DEFAULT_TIMEOUT_MS,
} from './contstants';
import { AWSSecretsManagerModuleOptions } from './aws-secrets-manager.interface';

@Injectable()
export class AWSSecretsService {
  private readonly logger = new Logger(AWSSecretsService.name);

  constructor(
    @Inject(AWS_SECRETS_MANAGER_MODULE_OPTIONS)
    private readonly options: AWSSecretsManagerModuleOptions,
  ) {}

  /**
   * Fetches every secret in `secretsSource` and copies its keys into
   * `process.env` (existing variables with the same name are overwritten).
   * With `isSetToEnv: true` the module calls this once at startup and waits
   * for it. Errors are logged, not thrown. Resolves to `true` when the
   * variables were set.
   */
  async setAllSecrectToEnv(): Promise<boolean> {
    try {
      const ids = this.secretIds();
      this.logger.log(
        `Loading ${ids.length} secret(s) from AWS Secrets Manager (id: ${JSON.stringify(ids)})`,
      );

      const secrets = await this.getAllSecrects<Record<string, unknown>>();

      if (!secrets) {
        this.logger.warn('No secrets were set to env');
        return false;
      }

      Object.keys(secrets).forEach((key) => {
        process.env[key] = String(secrets[key]);
      });

      this.logger.log(
        `All secrets from aws secrets manager(id: ${JSON.stringify(ids)}) are set to env`,
      );

      if (this.options.isDebug) {
        this.logger.log(JSON.stringify(secrets, null, 2));
      }
      return true;
    } catch (err: any) {
      this.logger.error(err.message);
      return false;
    }
  }

  /**
   * Fetches every secret in `secretsSource` and merges their JSON key/value
   * pairs (later secrets win). Returns `undefined` and logs the error if any
   * secret cannot be fetched or parsed.
   */
  async getAllSecrects<T>(): Promise<T | undefined> {
    try {
      const secretsIds = this.secretIds();

      if (!secretsIds.length) {
        this.logger.log('Secrets source is empty');
      }

      const secrets = await Promise.all(
        secretsIds.map(
          async (secretId) =>
            JSON.parse(await this.fetch(secretId)) as Record<string, unknown>,
        ),
      );

      return Object.assign({}, ...secrets) as T;
    } catch (e: any) {
      this.logger.error(`Unable to fetch secrets(${e.message})`);
    }
  }

  /**
   * Fetches one secret by name or ARN and returns its parsed JSON value.
   * Returns `undefined` and logs the error if it cannot be fetched or parsed.
   */
  async getSecretsByID<T>(secretId: string): Promise<T | undefined> {
    try {
      return JSON.parse(await this.fetch(secretId)) as T;
    } catch (e: any) {
      this.logger.error(`Unable to fetch secrets(${e.message})`);
    }
  }

  private secretIds(): string[] {
    const source = this.options.secretsSource;
    const ids = typeof source === 'string' ? [source] : [...(source ?? [])];
    return ids.filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    );
  }

  /** GetSecretValue with a deadline. */
  private async fetch(secretId: string): Promise<string> {
    const timeout = this.options.timeout ?? DEFAULT_TIMEOUT_MS;
    const abortSignal = timeout > 0 ? AbortSignal.timeout(timeout) : undefined;
    let secretString: string | undefined;
    try {
      const secret = await this.options.secretsManager.send(
        new GetSecretValueCommand({ SecretId: secretId }),
        { abortSignal },
      );
      secretString = secret.SecretString;
    } catch (e: any) {
      if (abortSignal?.aborted) {
        throw new Error(
          `secret ${secretId}: no answer from AWS Secrets Manager within ${timeout} ms`,
        );
      }
      throw new Error(`secret ${secretId}: ${e?.message ?? e}`);
    }
    return secretString as string;
  }
}
