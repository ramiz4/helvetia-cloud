#!/bin/bash

# Script to demonstrate logging functionality
# This script makes various API requests and shows the logging output

echo "========================================"
echo "Logging Demonstration"
echo "========================================"
echo ""

echo "1. Testing /health endpoint (should log request and response)"
curl -s -H "X-Request-ID: demo-health-check" http://localhost:3001/health | jq .
echo ""

echo "2. Testing with custom request ID"
curl -s -H "X-Request-ID: my-custom-request-id-12345" http://localhost:3001/health | jq .
echo ""

echo "3. Testing non-existent endpoint (should log 404 error)"
curl -s http://localhost:3001/non-existent-route | jq .
echo ""

echo "4. Testing protected endpoint without auth (should log 401 error)"
curl -s http://localhost:3001/services | jq .
echo ""

echo "========================================"
echo "Check your terminal for log output!"
echo "Each request should show:"
echo "  - Request log with reqId, method, URL, IP"
echo "  - Response log with reqId, statusCode, responseTime"
echo "========================================"
