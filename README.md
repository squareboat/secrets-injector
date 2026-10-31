# Secrets-Injector

**Secrets-Injector** is a NestJS module that reads secrets from AWS Secrets Manager and, if you want, copies them into `process.env` while your application starts. You keep sensitive configuration in Secrets Manager instead of `.env` files, and read it with `process.env` or `@nestjs/config`.

<p align="center">
  <a href="http://nestjs.com"><img alt="Logo" src="https://github.com/user-attachments/assets/77c83c57-bb0a-4e47-98cc-ef39caec13a2" width="400" /></a>
</p>

<p align="center">
  A <a href="https://github.com/nestjs/nest" target="_blank">Nest</a> module wrapper for <a href="https://aws.amazon.com/secrets-manager/" target="_blank">AWS Secrets Manager</a>
</p>

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Read secrets with AWSSecretsService](#read-secrets-with-awssecretsservice)
  - [Set process env variables from AWS Secrets Manager](#set-process-env-variables-from-aws-secrets-manager)
  - [When are the variables available?](#when-are-the-variables-available)
  - [Load secrets before the app is created](#load-secrets-before-the-app-is-created)
  - [Async configuration](#async-configuration)
- [Options](#options)
- [Secret format](#secret-format)
- [Errors and timeouts](#errors-and-timeouts)
- [Local development and tests](#local-development-and-tests)
- [Upgrading from 1.x](#upgrading-from-1x)
- [Contributing](#contributing)
- [Stay in Touch](#stay-in-touch)
- [License](#license)

## Features

- Read JSON secrets from AWS Secrets Manager by name or ARN.
- Copy the key/value pairs of one or more secrets into `process.env`: in `main.ts` before the app is created (`loadSecretsToEnv()`), or while Nest creates the app (`isSetToEnv`).
- `forRoot()` and `forRootAsync()` (`useFactory`, `useClass`, `useExisting`), global module.
- Uses the AWS SDK v3 client you pass in, so region, credentials and endpoint are yours to configure. Every call has a deadline (10 s by default), so an unreachable endpoint cannot block startup.

## Requirements

- NestJS 10, 11 or 12 (`@nestjs/common`)
- `@aws-sdk/client-secrets-manager` v3
- Node.js 20.19+, 22.12+ or 24+. NestJS 12 is published as ES modules only; this package is CommonJS and loads it with `require()`, which works without flags from Node 20.19 and 22.12.

The AWS SDK is a peer dependency, so you choose its version. AWS SDK v3 releases published after the first week of January 2027 require Node 22 or newer (current releases already print a warning on Node 20). On Node 20, pin `@aws-sdk/client-secrets-manager` to a release from before then, or move to Node 22.

## Installation

```bash
npm i secrets-injector @aws-sdk/client-secrets-manager
```

The repository also has a sample app in [`samples/quick-start-secrets-to-env`](https://github.com/Anubhavjain786/secrets-injector/tree/main/samples/quick-start-secrets-to-env) (NestJS 12; its Nest CLI needs Node 22.22+ or 24.15+):

```bash
git clone https://github.com/Anubhavjain786/secrets-injector.git
cd secrets-injector
npm install # also builds dist
cd samples/quick-start-secrets-to-env
npm install
AWS_REGION=ap-south-1 SECRET_ID=test/sm npm run start:dev
```

## Quick start

Import `AWSSecretsManagerModule` into the root `AppModule` and configure it with `forRoot()`. It takes an [`AWSSecretsManagerModuleOptions`](#options) object. The module is global: `AWSSecretsService` can be injected anywhere.

```typescript
import { Module } from '@nestjs/common';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import {
  AWSSecretsManagerModule,
  AWSSecretsManagerModuleOptions,
} from 'secrets-injector';

import { AppService } from './app.service';
import { AppController } from './app.controller';
import { AWSDBCredentialsService } from './aws-secrets.service';

const AWSSecretsManagerProps: AWSSecretsManagerModuleOptions = {
  secretsManager: new SecretsManagerClient({
    region: 'ap-south-1',
  }),
};

@Module({
  imports: [AWSSecretsManagerModule.forRoot(AWSSecretsManagerProps)],
  controllers: [AppController],
  providers: [AppService, AWSDBCredentialsService],
})
export class AppModule {}
```

The client uses the normal AWS SDK credential chain (environment variables, shared config, IAM role, ...). It needs `secretsmanager:GetSecretValue` on the secrets you read (and `kms:Decrypt` if they use a customer managed KMS key).

## Usage

### Read secrets with AWSSecretsService

`getSecretsByID()` fetches one secret by name or ARN and returns its parsed JSON value:

```typescript
import { Injectable } from '@nestjs/common';
import { AWSSecretsService } from 'secrets-injector';

interface DBCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

@Injectable()
export class AWSDBCredentialsService {
  constructor(private readonly secretsRetrieverService: AWSSecretsService) {}

  async getDBCredentials(): Promise<DBCredentials | undefined> {
    // 'db-credentials' is the secret name (or ARN)
    return this.secretsRetrieverService.getSecretsByID<DBCredentials>(
      'db-credentials',
    );
  }
}
```

`getAllSecrects()` fetches every secret in `secretsSource` and returns their keys merged into one object (later secrets win). Both return `undefined` if a secret cannot be fetched or parsed (see [Errors and timeouts](#errors-and-timeouts)).

### Set process env variables from AWS Secrets Manager

With `isSetToEnv: true` and a `secretsSource`, the module fetches the secrets once while Nest creates the app and copies every key into `process.env`:

```typescript
import { Module } from '@nestjs/common';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import {
  AWSSecretsManagerModule,
  AWSSecretsManagerModuleOptions,
} from 'secrets-injector';

import { AppService } from './app.service';
import { AppController } from './app.controller';

const AWSSecretsManagerProps: AWSSecretsManagerModuleOptions = {
  secretsManager: new SecretsManagerClient({
    region: 'ap-south-1',
  }),
  isSetToEnv: true, // copy the secrets into process.env
  secretsSource: 'test/sm', // or a list of names/ARNs: ['db/prod/config', 'app/prod/config']
};

@Module({
  imports: [AWSSecretsManagerModule.forRoot(AWSSecretsManagerProps)],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

Existing environment variables with the same name are overwritten.

### When are the variables available?

With `isSetToEnv` the secrets are loaded while Nest creates the providers. Nest creates the providers of all modules at the same time, and only the ones that inject `AWSSecretsService` wait for the secrets. So the variables are available:

- in `process.env` once `await NestFactory.create(AppModule)` (or `createApplicationContext()`) has resolved: in `main.ts` after that line, in request handlers, in `onModuleInit()` and later;
- in providers and async factories that inject `AWSSecretsService`, through `process.env` or `ConfigService.get('DB_HOST')` (example below).

They are **not** available, or not up to date, in these cases:

- code that reads `process.env` when a file is loaded, in the arguments of `SomeModule.forRoot({ ... })`, or in a provider that does not inject `AWSSecretsService`;
- `registerAs()` / `ConfigModule.forRoot({ load })` factories: they run while the secrets are still loading, so `config.get('database.host')` stays `undefined`, also after `create()`;
- `ConfigModule.forRoot({ validate })` or `validationSchema`: validation runs when the module is imported, so required keys fail. A key that already had a value at that point (from `.env`, the shell or a schema default) keeps that old value in `ConfigService.get()`, even though `process.env` has the secret.

For those cases, [load the secrets in `main.ts`](#load-secrets-before-the-app-is-created) instead.

Example of an async factory that waits for the secrets. `AWSSecretsService` is only injected to make Nest create the provider after the secrets are loaded. The same works for other modules' async factories, for example `TypeOrmModule.forRootAsync({ inject: [ConfigService, AWSSecretsService], ... })`.

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AWSSecretsService } from 'secrets-injector';

export const DB_OPTIONS = 'DB_OPTIONS';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DB_OPTIONS,
      inject: [ConfigService, AWSSecretsService],
      useFactory: (config: ConfigService) => ({
        host: config.get<string>('DB_HOST'),
        password: config.get<string>('DB_PASSWORD'),
      }),
    },
  ],
  exports: [DB_OPTIONS],
})
export class DatabaseConfigModule {}
```

### Load secrets before the app is created

`loadSecretsToEnv()` fetches the secrets and writes them to `process.env` without Nest. Call it in `main.ts` and load `AppModule` only afterwards, so that every module, `ConfigModule` validation and `registerAs()` factories see the variables. Do not import `AppModule` at the top of `main.ts`: imports run before the rest of the file, so the module files (and `ConfigModule.forRoot()`) would run before the secrets are there.

```typescript
import { NestFactory } from '@nestjs/core';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { loadSecretsToEnv } from 'secrets-injector';

async function bootstrap() {
  const loaded = await loadSecretsToEnv({
    secretsManager: new SecretsManagerClient({
      region: process.env.AWS_REGION,
    }),
    secretsSource: process.env.AWS_SECRET_ID ?? 'app/prod/config',
  });
  if (!loaded) {
    process.exit(1); // or start without the secrets
  }

  // load the application only now
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

It takes the same `secretsManager`, `secretsSource`, `isDebug` and `timeout` options as the module, logs errors instead of throwing, and resolves to `true` when the variables were set. You can still import `AWSSecretsManagerModule` (without `isSetToEnv`) to use `AWSSecretsService` in the app.

## Async configuration

Use `forRootAsync()` when the options depend on other providers, for example `ConfigService`. `imports` lists the **modules** whose providers you need; `inject` lists the providers passed to `useFactory`. If `ConfigModule` is global (`isGlobal: true`) you can leave out `imports`.

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { AWSSecretsManagerModule } from 'secrets-injector';

import { AppService } from './app.service';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AWSSecretsManagerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secretsManager: new SecretsManagerClient({
          region: configService.get('AWS_REGION'),
        }),
        isSetToEnv: true,
        secretsSource: [configService.get('AWS_SECRET_ID')],
        isDebug: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

The factory can be async. Instead of `useFactory` you can pass a class that implements `AWSSecretsManagerModuleOptionsFactory`, with `useClass` (the module creates it) or `useExisting` (an existing provider from one of the `imports`):

```typescript
import { Injectable, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import {
  AWSSecretsManagerModule,
  AWSSecretsManagerModuleOptions,
  AWSSecretsManagerModuleOptionsFactory,
} from 'secrets-injector';

@Injectable()
export class SecretsConfig implements AWSSecretsManagerModuleOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  createAWSSecrectsManagerModuleOptions(): AWSSecretsManagerModuleOptions {
    return {
      secretsManager: new SecretsManagerClient({
        region: this.config.get('AWS_REGION'),
      }),
      isSetToEnv: true,
      secretsSource: this.config.get('AWS_SECRET_ID'),
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot(),
    AWSSecretsManagerModule.forRootAsync({
      imports: [ConfigModule],
      useClass: SecretsConfig,
    }),
  ],
})
export class AppModule {}
```

## Options

The options of `AWSSecretsManagerModule` are the `AWSSecretsManagerModuleOptions` interface:

```typescript
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export interface AWSSecretsManagerModuleOptions {
  secretsManager: SecretsManagerClient;
  isSetToEnv?: boolean;
  secretsSource?: string | ReadonlyArray<string | undefined>;
  isDebug?: boolean;
  timeout?: number;
}
```

| Option           | Description                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `secretsManager` | A `SecretsManagerClient` from `@aws-sdk/client-secrets-manager`. Required.                                                                                          |
| `isSetToEnv`     | Copy the secrets in `secretsSource` into `process.env` at startup. Default `false`.                                                                                 |
| `secretsSource`  | Secret name or ARN, or a list of them. Empty and `undefined` entries are skipped. Used by `isSetToEnv` and `getAllSecrects()`.                                      |
| `isDebug`        | Log the loaded secrets **including their values** after they are set to env. Do not enable in production.                                                           |
| `timeout`        | Maximum time in ms for each Secrets Manager call made by this package, SDK retries included. Default `10000`; `0` turns it off (only your client's timeouts apply). |

The package root exports `AWSSecretsManagerModule`, `AWSSecretsService`, `loadSecretsToEnv`, the options token `AWS_SECRETS_MANAGER_MODULE_OPTIONS` and these types:

```typescript
import {
  AWSSecretsManagerModuleOptions,
  AWSSecretsManagerModuleAsyncOptions,
  AWSSecretsManagerModuleOptionsFactory,
  LoadSecretsToEnvOptions,
  SecretsSource,
} from 'secrets-injector';
```

## Secret format

Each secret must be stored as a JSON object in `SecretString` (the "Key/value" type in the AWS console), for example `{"DB_HOST": "db.internal", "DB_PORT": 5432}`. With several secrets the keys are merged in order and later secrets win. `process.env` only holds strings, so `5432` becomes `"5432"` and `true` becomes `"true"`. Plain-text and binary secrets are rejected with an error that names the secret but never contains its value.

## Errors and timeouts

Before fetching, the module logs `Loading N secret(s) from AWS Secrets Manager (id: [...])` (ids only). It does not throw when Secrets Manager cannot be reached, a secret is missing, or a secret is not a JSON object: it logs `Unable to fetch secrets(secret <id>: ...)` through the Nest logger, `getSecretsByID()` / `getAllSecrects()` return `undefined`, `loadSecretsToEnv()` resolves to `false`, and with `isSetToEnv` the application starts without the variables. If one secret in `secretsSource` fails, none of them is set. Check for required variables yourself if the app cannot run without them.

The AWS SDK has no connection or request timeout by default. If the endpoint accepts the connection but never answers, or the connection never completes (for example a private subnet without a NAT gateway or a Secrets Manager VPC endpoint), a call would wait forever and the app would never start. This package therefore gives every call a deadline, `timeout` (default 10 s, SDK retries included). When it passes, the call is aborted and handled like any other error: `Unable to fetch secrets(secret <id>: no answer from AWS Secrets Manager within 10000 ms)`. Secrets are fetched in parallel, so startup waits at most about `timeout`. Error messages never contain secret values; only `isDebug` logs them.

## Local development and tests

Point the client at a local Secrets Manager such as [LocalStack](https://www.localstack.cloud/) or [moto](https://github.com/getmoto/moto) with the `endpoint` option, or set `AWS_ENDPOINT_URL_SECRETS_MANAGER`:

```typescript
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export const secretsManager = new SecretsManagerClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});
```

## Upgrading from 1.x

- NestJS 7, 8 and 9 are no longer supported; use NestJS 10, 11 or 12. `reflect-metadata` is now a peer dependency (every Nest app has it).
- Node.js 20.19+, 22.12+ or 24+ is required.
- `isSetToEnv` is now awaited: `NestFactory.create()` resolves after the secrets are in `process.env`, and providers that inject `AWSSecretsService` are created after them. In 1.x the secrets were fetched in the background and usually arrived after the app had started. Startup now waits for Secrets Manager, at most about `timeout` (10 s by default).
- Each Secrets Manager call made by the package has a 10 s deadline (`timeout`). Set `timeout: 0` to rely only on your client's own timeouts.
- `new AWSSecretsService(options)` no longer starts loading the secrets in its constructor. If you create the service yourself, call `await service.setAllSecrectToEnv()` or use `loadSecretsToEnv(options)`.
- `getSecretsByID()` and `getAllSecrects()` are typed `Promise<T | undefined>`, because they return `undefined` on errors. With `strictNullChecks` you may need to handle `undefined`.
- Error messages name the secret (`secret <id>: ...`) and no longer include the parser message, which quoted part of a plain-text secret value.
- `forRootAsync()` exports only `AWSSecretsService`, like `forRoot()` (it used to export its internal providers too), supports `useExisting`, and throws if none of `useFactory`, `useClass` or `useExisting` is given.
- The files in `dist/` have the same names as in 1.x, so deep imports such as `secrets-injector/dist/contstants` keep working. The options token is now also exported from the package root as `AWS_SECRETS_MANAGER_MODULE_OPTIONS`; prefer that.

## Contributing

New features and bugfixes are always welcome! In order to contribute to this project, follow a few easy steps:

<!-- <p align="center"> -->
<!--   <a href="https://paypal.me/Anubhavjain786" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a> -->
<!-- </p> -->

1. [Fork](https://help.github.com/en/github/getting-started-with-github/fork-a-repo) this repository and clone it on your machine
2. Open the local repository with [Visual Studio Code](https://code.visualstudio.com/) with the remote development feature enabled (install the [Remote Development extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack))
3. Create a branch (e.g., `my-awesome-feature`) and make your changes.
4. Run the following commands to ensure the code is formatted and passes lint checks:

```bash
npm run lint
npm run format
npm run check-types
npm run build
```

5. Push your changes and open a [pull request](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/about-pull-requests)

## Stay in touch

- Author - [Anubhav Jain](mailto:anubhavj660@gmail.com)
- Github - [Anubhavjain786](https://github.com/Anubhavjain786)
- Twitter - [@anubhavjain660](https://x.com/anubhavjain660)

## License

`secrets-injector` is MIT licensed. See [LICENSE](LICENSE).
