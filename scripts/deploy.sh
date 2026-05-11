#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Klondike deployment script
#
# Usage:
#   ./scripts/deploy.sh api        # Deploy API to ECS (rolling update)
#   ./scripts/deploy.sh frontend   # Build React and push to S3/CloudFront
#   ./scripts/deploy.sh all        # Deploy both
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - Docker running (for api deploys)
#   - Node/npm installed (for frontend deploys)
# =============================================================================

set -euo pipefail

# ---------- Config -----------------------------------------------------------
AWS_REGION="eu-north-1"
AWS_ACCOUNT="586917956128"
ECR_REPO="klondike-api"
ECR_REGISTRY="${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ECS_CLUSTER="klondike-cluster"
ECS_SERVICE="klondike-api-service"
S3_BUCKET="klondike-web-${AWS_ACCOUNT}"
CLOUDFRONT_DIST_ID="E3CJ51YJAZELVD"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---------- Colours ----------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ---------- Deploy API -------------------------------------------------------
deploy_api() {
  info "=== Deploying API to ECS ==="

  # 1. Build image
  IMAGE_TAG=$(git -C "$REPO_ROOT" rev-parse --short HEAD)
  FULL_IMAGE="${ECR_REGISTRY}/${ECR_REPO}"

  info "Building Docker image (tag: ${IMAGE_TAG}) for linux/amd64..."
  # --platform linux/amd64 : build for Fargate (x86-64) regardless of build host
  # --provenance=false      : skip BuildKit attestation manifests; ECS platform
  #                           filtering rejects manifest-list images that lack an
  #                           amd64 descriptor (happens with attestations on ARM Macs)
  docker build \
    --platform linux/amd64 \
    --provenance=false \
    -t "${FULL_IMAGE}:${IMAGE_TAG}" \
    -t "${FULL_IMAGE}:latest" \
    "${REPO_ROOT}"

  # 2. Push to ECR
  info "Logging in to ECR..."
  aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$ECR_REGISTRY"

  info "Pushing image to ECR..."
  docker push "${FULL_IMAGE}:${IMAGE_TAG}"
  docker push "${FULL_IMAGE}:latest"
  success "Image pushed: ${FULL_IMAGE}:${IMAGE_TAG}"

  # 3. Force ECS rolling deploy
  info "Triggering ECS rolling deployment..."
  aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service "$ECS_SERVICE" \
    --force-new-deployment \
    --region "$AWS_REGION" \
    --output text \
    --query 'service.serviceName' > /dev/null

  # 4. Wait for stability
  info "Waiting for service to stabilise (this may take 2-3 minutes)..."
  aws ecs wait services-stable \
    --cluster "$ECS_CLUSTER" \
    --services "$ECS_SERVICE" \
    --region "$AWS_REGION"

  # 5. Print status
  RUNNING=$(aws ecs describe-services \
    --cluster "$ECS_CLUSTER" \
    --services "$ECS_SERVICE" \
    --region "$AWS_REGION" \
    --query 'services[0].runningCount' \
    --output text)
  success "API deployed — ${RUNNING} task(s) running"
  info "API endpoint: http://klondike-alb-1358735018.eu-north-1.elb.amazonaws.com"
}

# ---------- Deploy Frontend --------------------------------------------------
deploy_frontend() {
  info "=== Deploying Frontend to S3/CloudFront ==="

  FRONTEND_ROOT="${REPO_ROOT}/frontend"

  # 1. Build React app
  info "Installing dependencies..."
  (cd "$FRONTEND_ROOT" && npm ci --silent)

  info "Building React app..."
  (cd "$FRONTEND_ROOT" && npm run build)
  success "React build complete"

  # 2. Sync to S3
  info "Uploading assets to S3..."
  # Long cache for hashed assets
  aws s3 sync "${FRONTEND_ROOT}/dist/" "s3://${S3_BUCKET}/" \
    --delete \
    --cache-control "max-age=31536000,immutable" \
    --exclude "index.html" \
    --region "$AWS_REGION"

  # No cache for index.html (entry point)
  aws s3 cp "${FRONTEND_ROOT}/dist/index.html" "s3://${S3_BUCKET}/" \
    --cache-control "no-cache,no-store,must-revalidate" \
    --region "$AWS_REGION"

  success "Files uploaded to s3://${S3_BUCKET}/"

  # 3. Invalidate CloudFront cache
  info "Invalidating CloudFront cache..."
  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DIST_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

  info "Waiting for invalidation ${INVALIDATION_ID} to complete..."
  aws cloudfront wait invalidation-completed \
    --distribution-id "$CLOUDFRONT_DIST_ID" \
    --id "$INVALIDATION_ID"

  success "CloudFront cache cleared"
  success "Frontend live at: https://dbk2b6k1kyjsy.cloudfront.net"
}

# ---------- Entrypoint -------------------------------------------------------
TARGET="${1:-all}"

case "$TARGET" in
  api)      deploy_api ;;
  frontend) deploy_frontend ;;
  all)      deploy_api && deploy_frontend ;;
  *)
    echo "Usage: $0 [api|frontend|all]"
    exit 1
    ;;
esac

success "=== Deployment complete ==="
