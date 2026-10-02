# AWS deployment guide

## Infrastructure plan
- EC2: host the Flask app behind Nginx or Docker.
- RDS: MySQL managed database.
- S3: store uploaded assets or static reports.
- CloudWatch: monitor application logs and container metrics.
- SNS: alert on deployment failures or high CPU thresholds.

## Suggested commands
```bash
# Install Docker on EC2
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# Build and run the app
sudo docker compose up -d --build
```

## Security notes
- Use IAM roles instead of long-lived credentials.
- Store secrets in AWS Systems Manager Parameter Store or Secrets Manager.
- Restrict security groups to the required ports only.
