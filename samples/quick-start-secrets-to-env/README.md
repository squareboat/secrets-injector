# secrets-injector quick start sample

A NestJS 12 app that loads one AWS Secrets Manager secret into `process.env` at startup
and returns `process.env.DEVELOPER_NAME` from `GET /`.

1. Create a key/value secret, for example `test/sm` with `{"DEVELOPER_NAME": "Anubhav"}`.
2. Build the package in the repository root, then install and start the sample:

```bash
# in the repository root
npm install
npm run build

# in samples/quick-start-secrets-to-env
npm install
AWS_REGION=ap-south-1 SECRET_ID=test/sm npm run start:dev
curl http://localhost:3000/
```

AWS credentials come from the AWS SDK default chain (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`,
`AWS_PROFILE`, an IAM role, ...). To use LocalStack or moto instead of AWS, also set
`AWS_ENDPOINT_URL_SECRETS_MANAGER=http://localhost:4566`.

| Variable     | Default      | Description                           |
| ------------ | ------------ | ------------------------------------- |
| `AWS_REGION` | `ap-south-1` | Region of the secret                  |
| `SECRET_ID`  | `test/sm`    | Secret name or ARN                    |
| `PORT`       | `3000`       | HTTP port                             |
| `NODE_ENV`   |              | `development` logs the secret values (`isDebug`) |
