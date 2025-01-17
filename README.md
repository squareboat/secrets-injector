# Secrets-Injector

**Secrets-Injector** is an npm package that simplifies the process of fetching environment variables from AWS Secrets Manager and injecting them into `process.env` during the build process of a NestJS application. It helps you securely manage and use sensitive configuration data in your application, without having to manually manage environment files.

<p align="center">
  <a href="http://nestjs.com"><img alt="Logo" src="https://github.com/user-attachments/assets/77c83c57-bb0a-4e47-98cc-ef39caec13a2" width="400" /></a>
</p>

<p align="center">
  A <a href="https://github.com/nestjs/nest" target="_blank">Nest</a> module wrapper for <a href="https://aws.amazon.com/secrets-manager/" target="_blank">aws secrets manager</a> 
</p>

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Create the Secrets Manager Service](#create-the-secrets-manager-service)
  - [Set process env variables from AWS Secrets Manager](#set-process-env-variables-from-aws-secrets-manager)
  - [Async Configuration](#async-configuration)
- [Options](#options)
- [Contributing](#contributing)
- [Stay in Touch](#stay-in-touch)
- [License](#license)

## Features

- Fetch environment variables from AWS Secrets Manager.
- Inject the secrets directly into `process.env` during the build process.
- Seamlessly integrate with NestJS applications.
- Simple, secure, and easy to configure.

## Installation

To install `secrets-injector`, use the following command:

```bash
npm i secrets-injector @aws-sdk/client-secrets-manager
```

If you're having trouble configuring `secrets-injector`, you can clone the repository and run a `sample` app:

```bash
git clone https://github.com/Anubhavjain786/secrets-injector.git
cd secrets-injector/samples/quick-start
npm install
npm run start:dev
```

## Quick start

To get started, import `AWSSecretsManagerModule` into the root `AppModule` and use the `forRoot()` method to configure it. This method accepts the object as [AWSSecretsManagerModuleOptions](https://github.com/Anubhavjain786/secrets-injector#options), you can also checkout [samples](https://github.com/Anubhavjain786/secrets-injector/tree/main/samples)

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
  imports: [
    AWSSecretsManagerModule.forRoot(AWSSecretsManagerProps),
    AWSDBCredentialsService,
  ],
  controllers: [AppController],
  providers: [AppService, AWSDBCredentialsService],
})
export class AppModule {}
```

### Create the Secrets Manager Service

Now we have `getSecretsByID` method on `AWSSecretsService` from we can retrive aws secrets using name or ARN

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

  async getDBCredentials(): Promise<DBCredentials> {
    return await this.secretsRetrieverService.getSecretsByID<DBCredentials>(
      'db-credentials',
    ); // where db-credentials is the secret id
  }
}
```

### Set process env variables from aws secrets manager

We also can able to set value on process on starting, which allows us to retrive secrets using `process.env` or `@nest/config` module

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
  isSetToEnv: true, // set all secrets to env variables which will be available in process.env or @nest/config module
  secretsSource: 'test/sm', // OR array or secrets name or ARN  [ "db/prod/config" ,"app/prod/config"],
};

@Module({
  imports: [AWSSecretsManagerModule.forRoot(AWSSecretsManagerProps)],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

Afterward, Aws secrets from provided `secretsSource` can be access via `process.env` for `@nestjs/config` module

## Async configuration

> **Caveats**: because the way Nest works, you can't inject dependencies exported from the root module itself (using `exports`). If you use `forRootAsync()` and need to inject a service, that service must be either imported using the `imports` options or exported from a [global module](https://docs.nestjs.com/modules#global-modules).
> Maybe you need to asynchronously pass your module options, for example when you need a configuration service. In such case, use the `forRootAsync()` method, returning an options object from the `useFactory` method:

```typescript
import { Module } from '@nestjs/common';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { AWSSecretsManagerModule } from 'secrets-injector';

import { AppService } from './app.service';
import { AppController } from './app.controller';

import { ConfigModule, ConfigService } from '@nestjs/config';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AWSSecretsManagerModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        secretsManager: new SecretsManagerClient({
          region: configService.get('AWS_REGION'),
        }),
        isSetToEnv: true, // set all secrets to env variables which will be available in process.env or @nest/config module
        secretsSource: [
          configService.get('AWS_SECRET_ID'), // name or array of secret names
        ],
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

The factory might be async, can inject dependencies with `inject` option and import other modules using the `imports` option.

### Options

Configuration options parameter for `AWSSecretsManagerModule` is defined as `AWSSecretsManagerModuleOptions` interface

```typescript
export interface AWSSecretsManagerModuleOptions {
  secretsManager: SecretsManagerClient;
  isSetToEnv?: boolean;
  secretsArn?: string | string[];
  isDebug?: boolean;
}
```

which is available for import from `secrets-injector` module

```typescript
import { AWSSecretsManagerModuleOptions } from 'secrets-injector';
```

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
npm run build
```

5. Push your changes and open a [pull request](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/about-pull-requests)

## Stay in touch

- Author - [Anubhav Jain](mailto::anubhavj660@gmail.com)
- Github - [Anubhavjain786](https://github.com/Anubhavjain786)
- Twitter - [@anubhavjain660](https://x.com/anubhavjain660)

## License

`secrets-injector` is is MIT licensed. See [Licensed](LICENSE).
