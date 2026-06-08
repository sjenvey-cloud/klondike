#!/usr/bin/env bash
#
# activate-apns.sh — one-shot APNs activation (DEV-311).
#
# Prompts for the APNs parameters, then runs the 4 deploy steps in order:
#   1. update the SERVICE stack  (decouple from the pinned task-def ARN)
#   2. update the ECS stack       (inject APNs env + secret + IAM read access)
#   3. force a new ECS deployment (roll the new task-def revision)
#   4. tail the logs              (confirm "APNs NotificationService initialised")
#
# Safe to re-run. Prerequisite: the Secrets Manager secret /klondike/apns/key
# (JSON key `keyP8`) already exists in eu-north-1.
#
set -euo pipefail

REGION="eu-north-1"
CLUSTER="klondike-cluster"
SERVICE="klondike-api-service"
LOG_GROUP="/ecs/klondike-api"
ECS_DESC="Klondike ECS Fargate cluster and task definition"
SVC_DESC="Klondike ALB and ECS Fargate service"

# Run from the repo root so the template paths resolve.
cd "$(dirname "$0")/.."

echo "── APNs activation ───────────────────────────────────────────"
echo "Account: $(aws sts get-caller-identity --query Account --output text 2>/dev/null)  Region: $REGION"
echo

# ── Prompts ───────────────────────────────────────────────────────
read -r -p "APNs Key ID (10 chars, from the AuthKey_XXXXXXXXXX.p8 filename): " APNS_KEY_ID
read -r -p "Apple Team ID (10 chars): " APNS_TEAM_ID
read -r -p "Secret ARN (…:secret:/klondike/apns/key-XXXXXX, no :keyP8 suffix): " APNS_SECRET_ARN
read -r -p "Production APNs host? false = Xcode dev build / sandbox [false/true] (default false): " APNS_PROD
APNS_PROD="${APNS_PROD:-false}"

# ── Light validation ──────────────────────────────────────────────
[[ "$APNS_KEY_ID"  =~ ^[A-Za-z0-9]{10}$ ]] || { echo "✋ Key ID should be 10 alphanumeric chars."; exit 1; }
[[ "$APNS_TEAM_ID" =~ ^[A-Za-z0-9]{10}$ ]] || { echo "✋ Team ID should be 10 alphanumeric chars."; exit 1; }
[[ "$APNS_SECRET_ARN" == arn:aws:secretsmanager:${REGION}:*:secret:/klondike/apns/* ]] \
  || { echo "✋ ARN must be a Secrets Manager ARN under /klondike/apns/ in $REGION."; exit 1; }
[[ "$APNS_SECRET_ARN" != *":keyP8::" ]] || { echo "✋ Drop the ':keyP8::' suffix — pass the bare secret ARN."; exit 1; }
[[ "$APNS_PROD" == "true" || "$APNS_PROD" == "false" ]] || { echo "✋ Production must be true or false."; exit 1; }

# ── Discover stack names ──────────────────────────────────────────
echo
echo "Discovering stack names…"
ECS_STACK=$(aws cloudformation describe-stacks --region "$REGION" \
  --query "Stacks[?Description=='${ECS_DESC}'].StackName" --output text)
SVC_STACK=$(aws cloudformation describe-stacks --region "$REGION" \
  --query "Stacks[?Description=='${SVC_DESC}'].StackName" --output text)
[[ -n "$ECS_STACK" && "$ECS_STACK" != "None" ]] || { echo "✋ Could not find the ECS stack by description."; exit 1; }
[[ -n "$SVC_STACK" && "$SVC_STACK" != "None" ]] || { echo "✋ Could not find the service stack by description."; exit 1; }

# ── Confirm ───────────────────────────────────────────────────────
cat <<SUMMARY

About to deploy:
  Service stack : $SVC_STACK   (decouple task-def reference)
  ECS stack     : $ECS_STACK   (APNs env + secret + IAM read access)
  Key ID        : $APNS_KEY_ID
  Team ID       : $APNS_TEAM_ID
  Secret ARN    : $APNS_SECRET_ARN
  Production    : $APNS_PROD   (host: $([[ "$APNS_PROD" == true ]] && echo production || echo sandbox))

SUMMARY
read -r -p "Proceed with these PRODUCTION changes? (yes/no): " GO
[[ "$GO" == "yes" ]] || { echo "Aborted."; exit 0; }

# ── Step 1 — service stack (decouple) ─────────────────────────────
echo
echo "▶ Step 1/4 — updating service stack ($SVC_STACK)…"
if aws cloudformation update-stack --region "$REGION" --stack-name "$SVC_STACK" \
      --template-body file://infra/alb-service.yml \
      --capabilities CAPABILITY_NAMED_IAM \
      --parameters \
        ParameterKey=EnvironmentName,UsePreviousValue=true \
        ParameterKey=DesiredCount,UsePreviousValue=true 2>/tmp/cfn-svc.err; then
  aws cloudformation wait stack-update-complete --region "$REGION" --stack-name "$SVC_STACK"
  echo "  ✓ service stack updated"
else
  grep -q "No updates are to be performed" /tmp/cfn-svc.err \
    && echo "  ✓ already decoupled (no update needed)" \
    || { echo "  ✗ service stack update failed:"; cat /tmp/cfn-svc.err; exit 1; }
fi

# ── Step 2 — ECS stack (APNs) ─────────────────────────────────────
echo
echo "▶ Step 2/4 — updating ECS stack ($ECS_STACK) with APNs config…"
if aws cloudformation update-stack --region "$REGION" --stack-name "$ECS_STACK" \
      --template-body file://infra/ecs.yml \
      --capabilities CAPABILITY_NAMED_IAM \
      --parameters \
        ParameterKey=EnvironmentName,UsePreviousValue=true \
        ParameterKey=ECRImageURI,UsePreviousValue=true \
        ParameterKey=DBUsername,UsePreviousValue=true \
        ParameterKey=DBPassword,UsePreviousValue=true \
        ParameterKey=ApnsKeyId,ParameterValue="$APNS_KEY_ID" \
        ParameterKey=ApnsTeamId,ParameterValue="$APNS_TEAM_ID" \
        ParameterKey=ApnsProduction,ParameterValue="$APNS_PROD" \
        ParameterKey=ApnsKeyP8SecretArn,ParameterValue="$APNS_SECRET_ARN" 2>/tmp/cfn-ecs.err; then
  aws cloudformation wait stack-update-complete --region "$REGION" --stack-name "$ECS_STACK"
  echo "  ✓ ECS stack updated — new task-def revision created"
else
  grep -q "No updates are to be performed" /tmp/cfn-ecs.err \
    && echo "  ✓ task def already current (no update needed)" \
    || { echo "  ✗ ECS stack update failed:"; cat /tmp/cfn-ecs.err; exit 1; }
fi

# ── Step 3 — roll the new revision ────────────────────────────────
echo
echo "▶ Step 3/4 — rolling the new revision onto $SERVICE…"
aws ecs update-service --region "$REGION" \
  --cluster "$CLUSTER" --service "$SERVICE" --force-new-deployment \
  --query 'service.deployments[0].{status:status,desired:desiredCount}' --output table

echo "  waiting for the service to stabilise (this can take a few minutes)…"
aws ecs wait services-stable --region "$REGION" --cluster "$CLUSTER" --services "$SERVICE"
echo "  ✓ service stable on the new task definition"

# ── Step 4 — confirm in the logs ──────────────────────────────────
echo
echo "▶ Step 4/4 — recent APNs log lines:"
sleep 5
aws logs tail "$LOG_GROUP" --region "$REGION" --since 10m --format short 2>/dev/null \
  | grep -i "apns" | tail -5 \
  || echo "  (no APNs lines yet — run: aws logs tail $LOG_GROUP --region $REGION --follow | grep -i apns)"

echo
echo "Done. Expected success line:"
echo "  APNs NotificationService initialised (development host, topic com.klondikepro.app)"
