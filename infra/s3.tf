resource "aws_s3_bucket" "sandbox" {
  bucket        = "aws-local-sandbox-bucket"
  force_destroy = true

  tags = {
    Project = "aws-local-sandbox"
    Managed = "terraform"
  }
}
