import { Inject, Injectable, Logger } from '@nestjs/common';

import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

import { AWS_SECRETS_MANAGER_MODULE_OPTIONS } from './contstants';
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
   * for it. Errors are logged, not thrown.
   */
  async setAllSecrectToEnv() {
    try {
      const secrets = await this.getAllSecrects<Record<string, unknown>>();

      if (!secrets) {
        this.logger.warn('There is no secrets to set in env');
        return;
      }

      Object.keys(secrets).forEach((key) => {
        process.env[key] = String(secrets[key]);
      });

      this.logger.log(
        `All secrets from aws secrets manager(id: ${JSON.stringify(
          this.options.secretsSource,
        )}) are set to env`,
      );

      if (this.options.isDebug) {
        this.logger.log(JSON.stringify(secrets, null, 2));
      }
    } catch (err: any) {
      this.logger.error(err.message);
    }
  }

  /**
   * Fetches every secret in `secretsSource` and merges their JSON key/value
   * pairs (later secrets win). Returns `undefined` and logs the error if any
   * secret cannot be fetched or parsed.
   */
  async getAllSecrects<T>(): Promise<T | undefined> {
    try {
      const source = this.options.secretsSource;
      const secretsIds = (Array.isArray(source) ? source : [source]).filter(
        (id): id is string => Boolean(id),
      );

      if (!secretsIds.length) {
        this.logger.log('Secrets source is empty');
      }

      const secrets = await Promise.all(
        secretsIds.map((secretId) =>
          this.options.secretsManager.send(
            new GetSecretValueCommand({ SecretId: secretId }),
          ),
        ),
      );

      const response = secrets.reduce(
        (acc, secret) => ({ ...acc, ...JSON.parse(secret.SecretString!) }),
        {},
      );

      return response as T;
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
      const command = new GetSecretValueCommand({
        SecretId: secretId,
      });

      const secret = await this.options.secretsManager.send(command);

      return JSON.parse(secret.SecretString!) as T;
    } catch (e: any) {
      this.logger.error(`Unable to fetch secrets(${e.message})`);
    }
  }
}
