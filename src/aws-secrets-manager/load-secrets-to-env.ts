import { LoadSecretsToEnvOptions } from './aws-secrets-manager.interface';
import { AWSSecretsService } from './aws-secrets-manager.service';

/**
 * Fetches the secrets in `secretsSource` and copies their keys into
 * `process.env`, without Nest. Call it in `main.ts` before `AppModule` is
 * loaded so that every module, `ConfigModule.forRoot()` validation and
 * `registerAs()` factories see the variables. Errors are logged, not thrown;
 * resolves to `true` when the variables were set.
 */
export function loadSecretsToEnv(
  options: LoadSecretsToEnvOptions,
): Promise<boolean> {
  return new AWSSecretsService(options).setAllSecrectToEnv();
}
