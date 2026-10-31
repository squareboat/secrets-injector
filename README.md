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
  - [Async configuration](#async-configuration)
- [Options](#options)
- [Secret format](#secret-format)
- [Errors](#errors)
- [Local development and tests](#local-development-and-tests)
- [Upgrading from 1.x](#upgrading-from-1x)
- [Contributing](#contributing)
- [Stay in Touch](#stay-in-touch)
- [License](#license)

## Features

- Read JSON secrets from AWS Secrets Manager by name or ARN.
- Copy the key/value pairs of one or more secrets into `process.env` at application startup. Nest waits for this before it finishes creating the application.
- `forRoot()` and `forRootAsync()` (`useFactory`, `useClass`, `useExisting`), global module.
- Uses the AWS SDK v3 client you pass in, so region, credentials and endpoint are yours to configure.

## Requirements

- NestJS 10, 11 or 12 (`@nestjs/common`)
- `@aws-sdk/client-secrets-manager` v3
- Node.js 20.19+, 22.12+ or 24+. NestJS 12 is published as ES modules only; this package is CommonJS and loads it with `require()`, which works without flags from Node 20.19 and 22.12.

## Installation

```bash
npm i secrets-injector @aws-sdk/client-secrets-manager
```

The repository also has a sample app in [`samples/quick-start-secrets-to-env`](https://github.com/Anubhavjain786/secrets-injector/tree/main/samples/quick-start-secrets-to-env) (NestJS 12; its Nest CLI needs Node 22.22+ or 24.15+):

```bash
git clone https://github.com/Anubhavjain786/secrets-injector.git
cd secrets-injector
npm install && npm run build
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

`getAllSecrects()` fetches every secret in `secretsSource` and returns their keys merged into one object (later secrets win). Both return `undefined` if a secret cannot be fetched or parsed (see [Errors](#errors)).

### Set process env variables from AWS Secrets Manager

With `isSetToEnv: true` and a `secretsSource`, the module fetches the secrets once at startup and copies every key into `process.env`:

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

The secrets are loaded while Nest creates the providers, not at build time and not when your modules are imported. They are in `process.env`:

- once `await NestFactory.create(AppModule)` (or `createApplicationContext()`) has resolved, so in `main.ts` after that line and in every request handler;
- in any provider that injects `AWSSecretsService`: Nest creates it only after the secrets are loaded;
- in `ConfigService.get()` from `@nestjs/config`, because it reads `process.env` when it is called.

They are **not** there yet for code that runs before the providers are created, for example a value read from `process.env` at the top of a file or inside `SomeModule.forRoot({ ... })`, or `ConfigModule.forRoot()` validation (`validate` / `validationSchema`), which checks the environment when the module is imported. For other modules that read the environment in an async factory, add `AWSSecretsService` to `inject` so they wait for the secrets:

```typescript
TypeOrmModule.forRootAsync({
  inject: [ConfigService, AWSSecretsService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    host: config.get('DB_HOST'),
    password: config.get('DB_PASSWORD'),
  }),
});
```

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
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import {
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

// in AppModule imports:
AWSSecretsManagerModule.forRootAsync({
  imports: [ConfigModule],
  useClass: SecretsConfig,
});
```

## Options

The options of `AWSSecretsManagerModule` are the `AWSSecretsManagerModuleOptions` interface:

```typescript
export interface AWSSecretsManagerModuleOptions {
  secretsManager: SecretsManagerClient;
  isSetToEnv?: boolean;
  secretsSource?: string | string[];
  isDebug?: boolean;
}
```

| Option           | Description                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `secretsManager` | A `SecretsManagerClient` from `@aws-sdk/client-secrets-manager`. Required.                                |
| `isSetToEnv`     | Copy the secrets in `secretsSource` into `process.env` at startup. Default `false`.                       |
| `secretsSource`  | Secret name or ARN, or a list of them. Used by `isSetToEnv` and `getAllSecrects()`.                       |
| `isDebug`        | Log the loaded secrets **including their values** after they are set to env. Do not enable in production. |

All interfaces are exported from the package root:

```typescript
import {
  AWSSecretsManagerModuleOptions,
  AWSSecretsManagerModuleAsyncOptions,
  AWSSecretsManagerModuleOptionsFactory,
} from 'secrets-injector';
```

## Secret format

Each secret must be stored as a JSON object in `SecretString` (the "Key/value" type in the AWS console), for example `{"DB_HOST": "db.internal", "DB_PORT": 5432}`. With several secrets the keys are merged in order and later secrets win. `process.env` only holds strings, so `5432` becomes `"5432"` and `true` becomes `"true"`. Plain-text and binary secrets are not supported.

## Errors

The module does not throw when Secrets Manager cannot be reached or a secret is missing or not JSON. It logs `Unable to fetch secrets(...)` through the Nest logger, `getSecretsByID()` / `getAllSecrects()` return `undefined`, and with `isSetToEnv` the application starts without the variables. If one secret in `secretsSource` fails, none of them is set. Check for required variables yourself if the app cannot run without them.

## Local development and tests

Point the client at a local Secrets Manager such as [LocalStack](https://www.localstack.cloud/) or [moto](https://github.com/getmoto/moto) with the `endpoint` option, or set `AWS_ENDPOINT_URL_SECRETS_MANAGER`:

```typescript
new SecretsManagerClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});
```

## Upgrading from 1.x

- NestJS 7, 8 and 9 are no longer supported; use NestJS 10, 11 or 12. `reflect-metadata` is now a peer dependency (every Nest app has it).
- Node.js 20.19+, 22.12+ or 24+ is required.
- `isSetToEnv` is now awaited: `NestFactory.create()` resolves after the secrets are in `process.env`, and providers that inject `AWSSecretsService` are created after them. In 1.x the secrets were fetched in the background and usually arrived after the app had started.
- `getSecretsByID()` and `getAllSecrects()` are typed `Promise<T | undefined>`, because they return `undefined` on errors. With `strictNullChecks` you may need to handle `undefined`.
- `forRootAsync()` exports only `AWSSecretsService`, like `forRoot()` (it used to export its internal providers too), supports `useExisting`, and throws if none of `useFactory`, `useClass` or `useExisting` is given.

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
