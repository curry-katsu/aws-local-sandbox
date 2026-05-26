resource "aws_dynamodb_table" "sandbox" {
  name         = "aws-local-sandbox-table"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }
}

resource "aws_dynamodb_table" "index_ttl_verification" {
  name         = "aws-local-sandbox-index-ttl-table"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "lsi_sk"
    type = "S"
  }

  attribute {
    name = "gsi_pk"
    type = "S"
  }

  attribute {
    name = "gsi_sk"
    type = "S"
  }

  attribute {
    name = "sparse_gsi_pk"
    type = "S"
  }

  attribute {
    name = "sparse_gsi_sk"
    type = "S"
  }

  local_secondary_index {
    name            = "lsi-by-lsi-sk"
    range_key       = "lsi_sk"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "gsi-by-gsi-pk-sk"
    hash_key        = "gsi_pk"
    range_key       = "gsi_sk"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "gsi-sparse-by-status"
    hash_key        = "sparse_gsi_pk"
    range_key       = "sparse_gsi_sk"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl_epoch"
    enabled        = true
  }

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
    Purpose = "dynamodb-index-ttl-verification"
  }
}
