# rds-postgres-data-access

Verification tool for the Floci-backed PostgreSQL RDS demo database.

The tool:

1. Describes the demo RDS cluster through the local Floci endpoint.
2. Applies `sql/create_sample_table.sql`.
3. Inserts one sample row.
4. Reads recent rows from the sample table.
5. Prints a JSON result.

Install:

```sh
make verify-rds-install
```

Run:

```sh
make verify-rds-run
```

Defaults:

- Cluster identifier: `aws-local-sandbox-aurora-postgres-demo`
- Database: `sandbox`
- User: `sandbox`
- Password: `Sandbox123`
- Host/port: RDS API `Endpoint` and `Port`

Environment overrides:

```sh
export RDS_CLUSTER_IDENTIFIER=aws-local-sandbox-aurora-postgres-demo
export RDS_DB_NAME=sandbox
export RDS_DB_USER=sandbox
export RDS_DB_PASSWORD=Sandbox123
export RDS_DB_HOST=localhost
export RDS_DB_PORT=7001
```
