#!/usr/bin/env bash
#
# activate-apns.sh — APNs activation (DEV-311), OUT-OF-BAND.
#
# The CloudFormation ecs.yml is drifted from the running task definition (which is
# managed by hand — rev 6+). So this does NOT deploy CloudFormation. Instead it:
#   1. adds /klondike/apns/* to the SecretsManagerAccess inline policy on the
#      execution role (idempotent)
#   2. registers a NEW task-def revision = exact clone of the running one + the
#      APNS_* env vars + the APNS_KEY_P8 secret (idempotent — strips any prior APNS_*)
#   3. points the service at the new revision and waits for it to stabilise
#   4. tails the logs to confirm initialisation
#
# Re-runnable. Reversible: roll back by pointing the service at the prior revision
# (printed at the end). Prereq: the /klondike/apns/key secret (JSON key `keyP8`)
# already exists in eu-north-1.
#
set -euo pipefail

REGION="eu-north-1"
CLUSTER="klondike-cluster"
SERVICE="klondike-api-service"
TASK_FAMILY="klondike-api"
EXEC_ROLE="klondike-ecs-execution-role"
POLICY_NAME="SecretsManagerAccess"
LOG_GROUP="/ecs/klondike-api"

command -v jq >/dev/null 2>&1 || { echo "✋ jq is required (brew install jq)."; exit 1; }
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

echo "── APNs activation (out-of-band) ─────────────────────────────"
echo "Account: $ACCOUNT  Region: $REGION"
echo

# ── Prompts ───────────────────────────────────────────────────────
read -r -p "APNs Key ID (10 chars, from the AuthKey_XXXXXXXXXX.p8 filename): " APNS_KEY_ID
read -r -p "Apple Team ID (10 chars): " APNS_TEAM_ID
read -r -p "Secret ARN (…:secret:/klondike/apns/key-XXXXXX, no :keyP8 suffix): " APNS_SECRET_ARN
read -r -p "Production APNs host? false = Xcode dev build / sandbox [false/true] (default false): " APNS_PROD
APNS_PROD="${APNS_PROD:-false}"

# ── Validation ────────────────────────────────────────────────────
[[ "$APNS_KEY_ID"  =~ ^[A-Za-z0-9]{10}$ ]] || { echo "✋ Key ID should be 10 alphanumeric chars."; exit 1; }
[[ "$APNS_TEAM_ID" =~ ^[A-Za-z0-9]{10}$ ]] || { echo "✋ Team ID should be 10 alphanumeric chars."; exit 1; }
[[ "$APNS_SECRET_ARN" == arn:aws:secretsmanager:${REGION}:*:secret:/klondike/apns/* ]] \
  || { echo "✋ ARN must be a Secrets Manager ARN under /klondike/apns/ in $REGION."; exit 1; }
[[ "$APNS_SECRET_ARN" != *":keyP8::" ]] || { echo "✋ Drop the ':keyP8::' suffix — pass the bare secret ARN."; exit 1; }
[[ "$APNS_PROD" == "true" || "$APNS_PROD" == "false" ]] || { echo "✋ Production must be true or false."; exit 1; }

# ── Confirm ───────────────────────────────────────────────────────
cat <<SUMMARY

About to (no CloudFormation):
  • grant $EXEC_ROLE read access to /klondike/apns/*
  • register a new $TASK_FAMILY revision = current + APNs
  • redeploy $SERVICE onto it

  Key ID     : $APNS_KEY_ID
  Team ID    : $APNS_TEAM_ID
  Secret ARN : $APNS_SECRET_ARN
  Production : $APNS_PROD  (host: $([[ "$APNS_PROD" == true ]] && echo production || echo sandbox))

SUMMARY
read -r -p "Proceed with these PRODUCTION changes? (yes/no): " GO
[[ "$GO" == "yes" ]] || { echo "Aborted."; exit 0; }

# ── Step 1 — IAM: grant the execution role read on the APNs secret ─
echo
echo "▶ Step 1/4 — execution-role secret access…"
APNS_RES="arn:aws:secretsmanager:${REGION}:${ACCOUNT}:secret:/klondike/apns/*"
DOC=$(aws iam get-role-policy --role-name "$EXEC_ROLE" --policy-name "$POLICY_NAME" --query PolicyDocument --output json)
if echo "$DOC" | grep -q "secret:/klondike/apns/"; then
  echo "  ✓ already granted"
else
  echo "$DOC" | jq --arg r "$APNS_RES" '
    .Statement |= map(
      if (((.Action | if type=="array" then . else [.] end)) | index("secretsmanager:GetSecretValue"))
      then .Resource = (((.Resource | if type=="array" then . else [.] end) + [$r]) | unique)
      else . end)' > /tmp/klondike-secrets-policy.json
  aws iam put-role-policy --role-name "$EXEC_ROLE" --policy-name "$POLICY_NAME" \
    --policy-document file:///tmp/klondike-secrets-policy.json
  rm -f /tmp/klondike-secrets-policy.json
  echo "  ✓ added $APNS_RES"
fi

# ── Step 2 — register a new task-def revision (clone + APNs) ───────
echo
echo "▶ Step 2/4 — registering new task definition…"
TD=$(aws ecs describe-task-definition --task-definition "$TASK_FAMILY" --region "$REGION" --query taskDefinition --output json)
PREV_TD_ARN=$(echo "$TD" | jq -r .taskDefinitionArn)
echo "  cloning: $PREV_TD_ARN"

echo "$TD" | jq \
  --arg kid "$APNS_KEY_ID" --arg tid "$APNS_TEAM_ID" --arg prod "$APNS_PROD" --arg arn "$APNS_SECRET_ARN" '
  del(.taskDefinitionArn,.revision,.status,.requiresAttributes,.compatibilities,.registeredAt,.registeredBy,.deregisteredAt)
  | .containerDefinitions[0].environment = (
      [ .containerDefinitions[0].environment[] | select(.name | startswith("APNS_") | not) ]
      + [ {name:"APNS_KEY_ID",value:$kid},
          {name:"APNS_TEAM_ID",value:$tid},
          {name:"APNS_PRODUCTION",value:$prod},
          {name:"APNS_BUNDLE_ID",value:"com.klondikepro.app"} ] )
  | .containerDefinitions[0].secrets = (
      [ (.containerDefinitions[0].secrets // [])[] | select(.name != "APNS_KEY_P8") ]
      + [ {name:"APNS_KEY_P8",valueFrom:($arn + ":keyP8::")} ] )
  ' > /tmp/klondike-newtaskdef.json

NEW_TD_ARN=$(aws ecs register-task-definition --region "$REGION" \
  --cli-input-json file:///tmp/klondike-newtaskdef.json \
  --query "taskDefinition.taskDefinitionArn" --output text)
rm -f /tmp/klondike-newtaskdef.json
echo "  ✓ registered: $NEW_TD_ARN"

# ── Step 3 — deploy the new revision ──────────────────────────────
echo
echo "▶ Step 3/4 — deploying onto $SERVICE…"
aws ecs update-service --region "$REGION" \
  --cluster "$CLUSTER" --service "$SERVICE" \
  --task-definition "$NEW_TD_ARN" --force-new-deployment \
  --query 'service.{status:status,taskDef:taskDefinition}' --output table
echo "  waiting for the service to stabilise (a few minutes)…"
aws ecs wait services-stable --region "$REGION" --cluster "$CLUSTER" --services "$SERVICE"
echo "  ✓ service stable on the new revision"

# ── Step 4 — confirm in the logs ──────────────────────────────────
echo
echo "▶ Step 4/4 — recent APNs log lines:"
sleep 5
aws logs tail "$LOG_GROUP" --region "$REGION" --since 10m --format short 2>/dev/null \
  | grep -i "apns" | tail -5 \
  || echo "  (none yet — run: aws logs tail $LOG_GROUP --region $REGION --follow | grep -i apns)"

cat <<DONE

Done. Expected success line:
  APNs NotificationService initialised (development host, topic com.klondikepro.app)

Rollback (if needed):
  aws ecs update-service --region $REGION --cluster $CLUSTER --service $SERVICE \\
    --task-definition $PREV_TD_ARN --force-new-deployment
DONE
