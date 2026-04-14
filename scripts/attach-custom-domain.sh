#!/usr/bin/env bash
# DEV-183 — Attach klondikepro.app to CloudFront and create Route 53 alias records.
# Run this AFTER the ACM certificate has reached ISSUED status.
#
# Usage: ./scripts/attach-custom-domain.sh

set -euo pipefail

CERT_ARN="arn:aws:acm:us-east-1:586917956128:certificate/b5abd093-ae3e-4fc5-8891-847d2c814d59"
DIST_ID="EYJ274675TH6R"
CLOUDFRONT_DOMAIN="d2fbehwb6bp7kq.cloudfront.net"
ZONE_ID="Z08537813EDG8L4FXAQCR"

# ── 1. Verify cert is issued ─────────────────────────────────────────────────
echo "Checking ACM certificate status..."
STATUS=$(aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" \
  --region us-east-1 \
  --query 'Certificate.Status' --output text)

if [[ "$STATUS" != "ISSUED" ]]; then
  echo "ERROR: Certificate status is '$STATUS' — must be ISSUED before proceeding."
  echo "Update Hostinger nameservers to the Route 53 NS records and wait for DNS propagation."
  exit 1
fi
echo "Certificate is ISSUED. Proceeding..."

# ── 2. Get current CloudFront distribution config ────────────────────────────
echo "Fetching current CloudFront config..."
aws cloudfront get-distribution-config --id "$DIST_ID" \
  --output json > /tmp/cf-config.json

ETAG=$(jq -r '.ETag' /tmp/cf-config.json)
jq '.DistributionConfig' /tmp/cf-config.json > /tmp/cf-dist-config.json

# ── 3. Patch: add alternate domains + ACM certificate ─────────────────────────
echo "Patching config with klondikepro.app alternate domains..."
jq \
  --arg cert "$CERT_ARN" \
  '
    .Aliases = {"Quantity": 2, "Items": ["klondikepro.app", "www.klondikepro.app"]} |
    .ViewerCertificate = {
      "ACMCertificateArn": $cert,
      "SSLSupportMethod": "sni-only",
      "MinimumProtocolVersion": "TLSv1.2_2021",
      "CertificateSource": "acm"
    }
  ' /tmp/cf-dist-config.json > /tmp/cf-dist-config-patched.json

# ── 4. Apply update ──────────────────────────────────────────────────────────
echo "Updating CloudFront distribution..."
aws cloudfront update-distribution \
  --id "$DIST_ID" \
  --if-match "$ETAG" \
  --distribution-config "file:///tmp/cf-dist-config-patched.json" \
  --query 'Distribution.Status' --output text

echo "CloudFront update submitted. Waiting for deployment (~3-5 min)..."
aws cloudfront wait distribution-deployed --id "$DIST_ID"
echo "CloudFront deployed."

# ── 5. Create Route 53 A alias records (apex + www) ──────────────────────────
echo "Creating Route 53 alias records..."
aws route53 change-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --change-batch "{
    \"Comment\": \"Alias klondikepro.app + www to CloudFront\",
    \"Changes\": [
      {
        \"Action\": \"UPSERT\",
        \"ResourceRecordSet\": {
          \"Name\": \"klondikepro.app.\",
          \"Type\": \"A\",
          \"AliasTarget\": {
            \"HostedZoneId\": \"Z2FDTNDATAQYW2\",
            \"DNSName\": \"${CLOUDFRONT_DOMAIN}.\",
            \"EvaluateTargetHealth\": false
          }
        }
      },
      {
        \"Action\": \"UPSERT\",
        \"ResourceRecordSet\": {
          \"Name\": \"www.klondikepro.app.\",
          \"Type\": \"A\",
          \"AliasTarget\": {
            \"HostedZoneId\": \"Z2FDTNDATAQYW2\",
            \"DNSName\": \"${CLOUDFRONT_DOMAIN}.\",
            \"EvaluateTargetHealth\": false
          }
        }
      }
    ]
  }" \
  --query 'ChangeInfo.Status' --output text

echo ""
echo "Done. klondikepro.app and www.klondikepro.app now resolve to CloudFront."
echo "Test with: curl -I https://klondikepro.app/actuator/health"
