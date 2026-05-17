resource "aws_cognito_user_pool" "sandbox" {
  name = "aws-local-sandbox-user-pool"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 2048
    }
  }

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }

  lifecycle {
    ignore_changes = [
      device_configuration,
      user_pool_add_ons,
    ]
  }
}

resource "aws_cognito_user_pool_client" "sandbox" {
  name         = "aws-local-sandbox-user-pool-client"
  user_pool_id = aws_cognito_user_pool.sandbox.id

  generate_secret = false
}
