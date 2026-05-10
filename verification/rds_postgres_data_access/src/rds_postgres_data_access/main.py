from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from sqlalchemy.exc import SQLAlchemyError

DEFAULT_ENDPOINT_URL = "http://localhost:4566"
DEFAULT_REGION = "us-east-1"
DEFAULT_CLUSTER_IDENTIFIER = "aws-local-sandbox-aurora-postgres-demo"
DEFAULT_DB_NAME = "sandbox"
DEFAULT_DB_USER = "sandbox"
DEFAULT_DB_PASSWORD = "Sandbox123"
DEFAULT_DDL_PATH = Path(__file__).resolve().parents[2] / "sql" / "create_sample_table.sql"


@dataclass(frozen=True)
class Settings:
    aws_endpoint_url: str
    aws_region: str
    access_key_id: str
    secret_access_key: str
    cluster_identifier: str
    db_name: str
    db_user: str
    db_password: str
    db_host: str | None
    db_port: int | None
    ddl_path: Path


def utc_now() -> datetime:
    return datetime.now(UTC)


def isoformat(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def env_int(name: str) -> int | None:
    raw_value = os.getenv(name)
    if not raw_value:
        return None

    try:
        value = int(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer: {raw_value}") from exc

    if value <= 0:
        raise ValueError(f"{name} must be greater than zero: {raw_value}")

    return value


def load_settings() -> Settings:
    return Settings(
        aws_endpoint_url=os.getenv("AWS_ENDPOINT_URL", DEFAULT_ENDPOINT_URL).rstrip("/"),
        aws_region=os.getenv("AWS_DEFAULT_REGION", DEFAULT_REGION),
        access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "test"),
        secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "test"),
        cluster_identifier=os.getenv("RDS_CLUSTER_IDENTIFIER", DEFAULT_CLUSTER_IDENTIFIER),
        db_name=os.getenv("RDS_DB_NAME", DEFAULT_DB_NAME),
        db_user=os.getenv("RDS_DB_USER", DEFAULT_DB_USER),
        db_password=os.getenv("RDS_DB_PASSWORD", DEFAULT_DB_PASSWORD),
        db_host=os.getenv("RDS_DB_HOST"),
        db_port=env_int("RDS_DB_PORT"),
        ddl_path=Path(os.getenv("RDS_DDL_PATH", str(DEFAULT_DDL_PATH))),
    )


def boto3_client(service_name: str, settings: Settings) -> Any:
    return boto3.client(
        service_name,
        endpoint_url=settings.aws_endpoint_url,
        region_name=settings.aws_region,
        aws_access_key_id=settings.access_key_id,
        aws_secret_access_key=settings.secret_access_key,
        config=Config(retries={"max_attempts": 3, "mode": "standard"}),
    )


def describe_cluster(settings: Settings) -> dict[str, Any]:
    rds = boto3_client("rds", settings)
    response = rds.describe_db_clusters(DBClusterIdentifier=settings.cluster_identifier)
    clusters = response.get("DBClusters", [])
    if not clusters:
        raise RuntimeError(f"RDS cluster not found: {settings.cluster_identifier}")
    return clusters[0]


def connection_info(settings: Settings, cluster: dict[str, Any]) -> dict[str, Any]:
    return {
        "host": settings.db_host or cluster["Endpoint"],
        "port": settings.db_port or int(cluster["Port"]),
        "dbname": settings.db_name,
        "user": settings.db_user,
        "password": settings.db_password,
    }


def sqlalchemy_url(conninfo: dict[str, Any]) -> URL:
    return URL.create(
        drivername="postgresql+psycopg",
        username=conninfo["user"],
        password=conninfo["password"],
        host=conninfo["host"],
        port=conninfo["port"],
        database=conninfo["dbname"],
    )


def load_ddl(settings: Settings) -> str:
    return settings.ddl_path.read_text(encoding="utf-8")


def run() -> dict[str, Any]:
    settings = load_settings()
    started_at = utc_now()
    sample_id = str(uuid.uuid4())

    try:
        cluster = describe_cluster(settings)
        conninfo = connection_info(settings, cluster)
        ddl = load_ddl(settings)
        engine = create_engine(sqlalchemy_url(conninfo), pool_pre_ping=True)

        with engine.begin() as connection:
            server_version = connection.execute(
                text("select current_setting('server_version') as server_version")
            ).scalar_one()

            connection.exec_driver_sql(ddl)

            inserted = (
                connection.execute(
                    text(
                        """
                        insert into sandbox_messages (source, message, metadata)
                        values (:source, :message, cast(:metadata as jsonb))
                        returning id, source, message, metadata, created_at
                        """
                    ),
                    {
                        "source": "rds-postgres-data-access",
                        "message": "hello from Floci RDS PostgreSQL verification",
                        "metadata": json.dumps(
                            {"sample_id": sample_id, "cluster": settings.cluster_identifier}
                        ),
                    },
                )
                .mappings()
                .one()
            )

            recent_rows = (
                connection.execute(
                    text(
                        """
                        select id, source, message, metadata, created_at
                        from sandbox_messages
                        order by created_at desc
                        limit 5
                        """
                    )
                )
                .mappings()
                .all()
            )

        finished_at = utc_now()
        return {
            "status": "success",
            "started_at": isoformat(started_at),
            "finished_at": isoformat(finished_at),
            "cluster": {
                "identifier": cluster.get("DBClusterIdentifier"),
                "engine": cluster.get("Engine"),
                "engine_version": cluster.get("EngineVersion"),
                "writer_endpoint": cluster.get("Endpoint"),
                "reader_endpoint": cluster.get("ReaderEndpoint"),
                "port": cluster.get("Port"),
            },
            "connection": {
                "host": conninfo["host"],
                "port": conninfo["port"],
                "dbname": conninfo["dbname"],
                "user": conninfo["user"],
            },
            "server_version": server_version,
            "applied_ddl_path": str(settings.ddl_path),
            "inserted": dict(inserted),
            "recent_rows": [dict(row) for row in recent_rows],
        }
    except (BotoCoreError, ClientError, OSError, SQLAlchemyError, KeyError, ValueError) as exc:
        finished_at = utc_now()
        return {
            "status": "failed",
            "started_at": isoformat(started_at),
            "finished_at": isoformat(finished_at),
            "error": str(exc),
        }


def json_default(value: Any) -> str:
    if isinstance(value, datetime):
        return isoformat(value)
    return str(value)


def main() -> None:
    result = run()
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True, default=json_default))
    if result["status"] != "success":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
