resource "aws_secretsmanager_secret" "sample" {
  name        = "aws-local-sandbox/sample-secret"
  description = "Sample secret for local Secrets Manager verification."

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
    Purpose = "secrets-manager-verification"
  }
}

resource "aws_secretsmanager_secret_version" "sample" {
  secret_id = aws_secretsmanager_secret.sample.id
  secret_string = jsonencode({
    username = "sandbox-user"
    password = "sandbox-password"
    endpoint = "https://example.local"
  })
}

resource "aws_ssm_parameter" "sample_config" {
  name        = "/aws-local-sandbox/sample/config"
  description = "Sample plain-text configuration parameter for local Parameter Store verification."
  type        = "String"
  value       = "sandbox-config-value"

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
    Purpose = "parameter-store-verification"
  }
}

resource "aws_ssm_parameter" "sample_secure" {
  name        = "/aws-local-sandbox/sample/secure-token"
  description = "Sample SecureString parameter for local Parameter Store verification."
  type        = "SecureString"
  value       = "sandbox-secure-token"

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
    Purpose = "parameter-store-verification"
  }
}
