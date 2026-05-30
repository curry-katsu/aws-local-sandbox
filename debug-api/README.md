# debug-api

Local-only diagnostics API for the sandbox GUI.

The service currently reads Floci container logs through the Docker Engine API and exposes
Lambda-shaped log endpoints to the GUI:

```sh
GET /debug/lambda/functions/<function-name>/logs?tail=200
GET /debug/lambda/functions/<function-name>/logs?tail=200&requestId=<request-id>
```

This is intentionally isolated from Vue components. If Floci later exposes stable
CloudWatch Logs APIs, replace the provider behind this API or `gui/src/aws/lambdaLogs.ts`
without changing the Lambda console UI.

The service mounts `/var/run/docker.sock` and must remain local-development only.
