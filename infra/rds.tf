resource "aws_rds_cluster" "aurora_postgres_demo" {
  cluster_identifier  = "aws-local-sandbox-aurora-postgres-demo"
  engine              = "postgres"
  engine_version      = "17.7"
  database_name       = "sandbox"
  master_username     = "sandbox"
  master_password     = "Sandbox123"
  skip_final_snapshot = true

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }

  lifecycle {
    ignore_changes = [engine_mode]
  }
}
