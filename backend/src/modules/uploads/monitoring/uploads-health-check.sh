#!/bin/bash

# Uploads Health Check Script
# This script monitors the health of the uploads module and generates alerts

set -euo pipefail

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
LOG_FILE="${LOG_FILE:-/var/log/uploads-health-check.log}"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"
MAX_FILE_SIZE=5242880  # 5MB in bytes
STORAGE_PATH="${STORAGE_PATH:-/storage/uploads}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Alert function
send_alert() {
    local message="$1"
    local severity="${2:-warning}"
    
    log "ALERT [$severity]: $message"
    
    if [[ -n "$ALERT_WEBHOOK" ]]; then
        curl -s -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"[$severity] Uploads Health Check: $message\"}" || true
    fi
}

# Check 1: Backend Service Health
check_backend_health() {
    log "Checking backend service health..."
    
    if curl -sf "$BACKEND_URL/health" > /dev/null 2>&1; then
        log "Backend service: ${GREEN}OK${NC}"
        return 0
    else
        send_alert "Backend service is not responding" "critical"
        log "Backend service: ${RED}FAILED${NC}"
        return 1
    fi
}

# Check 2: Upload Endpoint Availability
check_upload_endpoint() {
    log "Checking upload endpoint availability..."
    
    # Create a small test file
    local test_file="/tmp/test-upload-$(date +%s).txt"
    echo "Health check test file" > "$test_file"
    
    if curl -sf -X POST "$BACKEND_URL/uploads/avatar" \
        -F "file=@$test_file" \
        -H "Authorization: Bearer $TEST_TOKEN" \
        > /dev/null 2>&1; then
        log "Upload endpoint: ${GREEN}OK${NC}"
        rm -f "$test_file"
        return 0
    else
        send_alert "Upload endpoint is not working" "critical"
        log "Upload endpoint: ${RED}FAILED${NC}"
        rm -f "$test_file"
        return 1
    fi
}

# Check 3: Virus Scan Service
check_virus_scan() {
    log "Checking virus scan service..."
    
    if command -v clamscan > /dev/null 2>&1; then
        if clamscan --version > /dev/null 2>&1; then
            log "Virus scan service: ${GREEN}OK${NC}"
            return 0
        else
            send_alert "Virus scan service is not working" "warning"
            log "Virus scan service: ${RED}FAILED${NC}"
            return 1
        fi
    else
        send_alert "ClamAV is not installed" "warning"
        log "Virus scan service: ${RED}NOT INSTALLED${NC}"
        return 1
    fi
}

# Check 4: Storage Availability
check_storage() {
    log "Checking storage availability..."
    
    if [[ -d "$STORAGE_PATH" ]]; then
        if df "$STORAGE_PATH" > /dev/null 2>&1; then
            local usage=$(df "$STORAGE_PATH" | awk 'NR==2 {print $5}' | sed 's/%//')
            
            if [[ $usage -lt 80 ]]; then
                log "Storage: ${GREEN}OK (${usage}% used)${NC}"
                return 0
            elif [[ $usage -lt 90 ]]; then
                send_alert "Storage usage is high: ${usage}%" "warning"
                log "Storage: ${YELLOW}WARNING (${usage}% used)${NC}"
                return 1
            else
                send_alert "Storage usage is critical: ${usage}%" "critical"
                log "Storage: ${RED}CRITICAL (${usage}% used)${NC}"
                return 1
            fi
        else
            send_alert "Storage filesystem is not accessible" "critical"
            log "Storage: ${RED}FAILED${NC}"
            return 1
        fi
    else
        send_alert "Storage directory does not exist: $STORAGE_PATH" "critical"
        log "Storage: ${RED}NOT FOUND${NC}"
        return 1
    fi
}

# Check 5: S3 Connectivity (if configured)
check_s3_connectivity() {
    log "Checking S3 connectivity..."
    
    if command -v aws > /dev/null 2>&1; then
        if aws s3 ls > /dev/null 2>&1; then
            log "S3 connectivity: ${GREEN}OK${NC}"
            return 0
        else
            send_alert "S3 connectivity is failing" "warning"
            log "S3 connectivity: ${RED}FAILED${NC}"
            return 1
        fi
    else
        log "S3 connectivity: ${YELLOW}AWS CLI not installed (may be using local storage)${NC}"
        return 0
    fi
}

# Check 6: Recent Upload Success Rate
check_upload_success_rate() {
    log "Checking upload success rate..."
    
    # Check last hour of logs
    local one_hour_ago=$(date -d '1 hour ago' '+%Y-%m-%d %H:' 2>/dev/null || date -v-1H '+%Y-%m-%d %H:')
    local total_uploads=0
    local failed_uploads=0
    
    if [[ -f "/var/log/nginx/access.log" ]]; then
        total_uploads=$(grep "$one_hour_ago.*POST.*uploads" /var/log/nginx/access.log | wc -l)
        failed_uploads=$(grep "$one_hour_ago.*POST.*uploads.*[45][0-9][0-9]" /var/log/nginx/access.log | wc -l)
    fi
    
    if [[ $total_uploads -gt 0 ]]; then
        local success_rate=$(( (total_uploads - failed_uploads) * 100 / total_uploads ))
        
        if [[ $success_rate -ge 95 ]]; then
            log "Upload success rate: ${GREEN}OK (${success_rate}%)${NC}"
            return 0
        elif [[ $success_rate -ge 90 ]]; then
            send_alert "Upload success rate is low: ${success_rate}%" "warning"
            log "Upload success rate: ${YELLOW}WARNING (${success_rate}%)${NC}"
            return 1
        else
            send_alert "Upload success rate is critical: ${success_rate}%" "critical"
            log "Upload success rate: ${RED}CRITICAL (${success_rate}%)${NC}"
            return 1
        fi
    else
        log "Upload success rate: ${YELLOW}NO DATA (no uploads in last hour)${NC}"
        return 0
    fi
}

# Check 7: Memory Usage
check_memory_usage() {
    log "Checking memory usage..."
    
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [[ $memory_usage -lt 80 ]]; then
        log "Memory usage: ${GREEN}OK (${memory_usage}%)${NC}"
        return 0
    elif [[ $memory_usage -lt 90 ]]; then
        send_alert "Memory usage is high: ${memory_usage}%" "warning"
        log "Memory usage: ${YELLOW}WARNING (${memory_usage}%)${NC}"
        return 1
    else
        send_alert "Memory usage is critical: ${memory_usage}%" "critical"
        log "Memory usage: ${RED}CRITICAL (${memory_usage}%)${NC}"
        return 1
    fi
}

# Check 8: Disk I/O Performance
check_disk_io() {
    log "Checking disk I/O performance..."
    
    # Simple disk I/O test
    local test_file="$STORAGE_PATH/.io-test-$(date +%s)"
    local start_time=$(date +%s.%N)
    
    if dd if=/dev/zero of="$test_file" bs=1M count=10 2>/dev/null; then
        local end_time=$(date +%s.%N)
        local duration=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "1")
        
        rm -f "$test_file"
        
        # If it takes more than 5 seconds to write 10MB, there might be an issue
        if (( $(echo "$duration < 5" | bc -l 2>/dev/null || echo "1") )); then
            log "Disk I/O: ${GREEN}OK (${duration}s for 10MB)${NC}"
            return 0
        else
            send_alert "Disk I/O is slow: ${duration}s for 10MB" "warning"
            log "Disk I/O: ${YELLOW}SLOW (${duration}s for 10MB)${NC}"
            return 1
        fi
    else
        send_alert "Disk I/O test failed" "critical"
        log "Disk I/O: ${RED}FAILED${NC}"
        return 1
    fi
}

# Main execution
main() {
    log "Starting uploads health check..."
    
    local failed_checks=0
    local total_checks=0
    
    # Run all checks
    checks=(
        "check_backend_health"
        "check_upload_endpoint"
        "check_virus_scan"
        "check_storage"
        "check_s3_connectivity"
        "check_upload_success_rate"
        "check_memory_usage"
        "check_disk_io"
    )
    
    for check in "${checks[@]}"; do
        ((total_checks++))
        if ! $check; then
            ((failed_checks++))
        fi
        sleep 1  # Small delay between checks
    done
    
    # Summary
    log "Health check completed: $((total_checks - failed_checks))/$total_checks checks passed"
    
    if [[ $failed_checks -eq 0 ]]; then
        log "Overall status: ${GREEN}ALL CHECKS PASSED${NC}"
        exit 0
    elif [[ $failed_checks -le 2 ]]; then
        log "Overall status: ${YELLOW}SOME CHECKS FAILED${NC}"
        exit 1
    else
        log "Overall status: ${RED}MULTIPLE CHECKS FAILED${NC}"
        exit 2
    fi
}

# Trap for cleanup
trap 'log "Health check interrupted"' INT TERM

# Run main function
main "$@"
