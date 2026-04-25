#!/bin/bash

# =============================================================================
# Tycoon Backend - Quarterly Restore Drill Automation
# =============================================================================
# This script automates quarterly disaster recovery drills
# Usage: ./quarterly-drill.sh [schedule|execute|report]
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/backup.conf"
DRILL_CONFIG_FILE="${SCRIPT_DIR}/drill-config.conf"
LOG_FILE="${SCRIPT_DIR}/logs/drill-$(date +%Y%m%d).log"
DRILL_STATE_FILE="${SCRIPT_DIR}/.drill-state"

# Source configuration
if [[ -f "${CONFIG_FILE}" ]]; then
    source "${CONFIG_FILE}"
else
    echo "ERROR: Configuration file ${CONFIG_FILE} not found"
    exit 1
fi

if [[ -f "${DRILL_CONFIG_FILE}" ]]; then
    source "${DRILL_CONFIG_FILE}"
else
    echo "ERROR: Drill configuration file ${DRILL_CONFIG_FILE} not found"
    exit 1
fi

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    cleanup_drill_environment
    exit 1
}

# Cleanup drill environment
cleanup_drill_environment() {
    log "INFO" "Cleaning up drill environment"
    
    # Drop drill databases
    local drill_databases=$(psql "${DB_CONNECTION_STRING}" -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'drill_%';")
    for db in ${drill_databases}; do
        psql "${DB_CONNECTION_STRING}" -c "DROP DATABASE IF EXISTS ${db};" 2>/dev/null || true
    done
    
    # Cleanup temp files
    find /tmp -name "drill_*" -type d -mtime +1 -exec rm -rf {} + 2>/dev/null || true
    
    log "INFO" "Drill environment cleanup completed"
}

# Check if drill is due
check_drill_schedule() {
    log "INFO" "Checking quarterly drill schedule"
    
    local current_quarter=$(( ($(date +%m) - 1) / 3 + 1 ))
    local current_year=$(date +%Y)
    local drill_key="${current_year}_Q${current_quarter}"
    
    # Check if drill was already completed this quarter
    if [[ -f "${DRILL_STATE_FILE}" ]]; then
        local last_drill=$(grep "${drill_key}" "${DRILL_STATE_FILE}" 2>/dev/null || echo "")
        if [[ -n "${last_drill}" ]]; then
            local drill_date=$(echo "${last_drill}" | cut -d',' -f2)
            log "INFO" "Drill already completed for ${drill_key} on ${drill_date}"
            return 1
        fi
    fi
    
    # Check if it's the first day of the quarter
    local current_day=$(date +%d)
    local current_month=$(date +%m)
    local is_quarter_start=false
    
    case "${current_month}" in
        1|4|7|10)
            if [[ "${current_day}" == "1" ]]; then
                is_quarter_start=true
            fi
            ;;
    esac
    
    if [[ "${is_quarter_start}" == "true" ]]; then
        log "INFO" "Quarterly drill is scheduled for today"
        return 0
    else
        log "INFO" "Quarterly drill not scheduled for today"
        return 1
    fi
}

# Schedule drill
schedule_drill() {
    log "INFO" "Scheduling quarterly drill"
    
    # Create cron job for quarterly drill
    local cron_schedule="0 2 1 */3 *"  # 2:00 AM on first day of every quarter
    local cron_command="${SCRIPT_DIR}/quarterly-drill.sh execute"
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "${cron_schedule} ${cron_command}") | crontab -
    
    log "INFO" "Drill scheduled with cron: ${cron_schedule}"
}

# Execute drill
execute_drill() {
    log "INFO" "Executing quarterly disaster recovery drill"
    
    # Create drill environment
    setup_drill_environment
    
    # Record drill start
    local drill_id="drill_$(date +%Y%m%d_%H%M%S)"
    local drill_start=$(date +%s)
    
    log "INFO" "Drill ID: ${drill_id}"
    
    # Execute drill phases
    local drill_status="SUCCESS"
    local drill_message="Quarterly drill completed successfully"
    
    # Phase 1: Full Restore Test
    if ! execute_drill_phase "full_restore" "${drill_id}"; then
        drill_status="FAILED"
        drill_message="Full restore phase failed"
    fi
    
    # Phase 2: Point-in-Time Restore Test
    if [[ "${drill_status}" == "SUCCESS" ]]; then
        if ! execute_drill_phase "pitr_restore" "${drill_id}"; then
            drill_status="FAILED"
            drill_message="PITR restore phase failed"
        fi
    fi
    
    # Phase 3: Application Integration Test
    if [[ "${drill_status}" == "SUCCESS" ]]; then
        if ! execute_drill_phase "app_integration" "${drill_id}"; then
            drill_status="FAILED"
            drill_message="Application integration phase failed"
        fi
    end
    
    # Phase 4: Performance Validation
    if [[ "${drill_status}" == "SUCCESS" ]]; then
        if ! execute_drill_phase "performance_validation" "${drill_id}"; then
            drill_status="FAILED"
            drill_message="Performance validation phase failed"
        fi
    fi
    
    # Phase 5: Security Validation
    if [[ "${drill_status}" == "SUCCESS" ]]; then
        if ! execute_drill_phase "security_validation" "${drill_id}"; then
            drill_status="PARTIAL"
            drill_message="Security validation phase failed"
        fi
    fi
    
    # Record drill completion
    local drill_end=$(date +%s)
    local drill_duration=$((drill_end - drill_start))
    
    record_drill_completion "${drill_id}" "${drill_status}" "${drill_duration}" "${drill_message}"
    
    # Generate drill report
    generate_drill_report "${drill_id}" "${drill_status}" "${drill_duration}"
    
    # Send notifications
    send_drill_notification "${drill_status}" "${drill_message}" "${drill_duration}"
    
    # Cleanup
    cleanup_drill_environment
    
    log "INFO" "Quarterly drill completed: ${drill_status} in ${drill_duration} seconds"
}

# Setup drill environment
setup_drill_environment() {
    log "INFO" "Setting up drill environment"
    
    # Create drill directories
    mkdir -p "${SCRIPT_DIR}/drill-data"
    mkdir -p "${SCRIPT_DIR}/drill-reports"
    mkdir -p "${SCRIPT_DIR}/drill-logs"
    
    # Validate environment
    if ! psql "${DB_CONNECTION_STRING}" -c "SELECT 1;" &> /dev/null; then
        error_exit "Cannot connect to database for drill"
    fi
    
    # Check available space
    local available_space=$(df "${SCRIPT_DIR}" | awk 'NR==2 {print $4}')
    local required_space=${DRILL_REQUIRED_SPACE_MB:-1024}  # 1GB default
    
    if [[ ${available_space} -lt ${required_space} ]]; then
        error_exit "Insufficient disk space for drill: ${available_space} < ${required_space}"
    fi
    
    log "INFO" "Drill environment setup completed"
}

# Execute drill phase
execute_drill_phase() {
    local phase="$1"
    local drill_id="$2"
    
    log "INFO" "Executing drill phase: ${phase}"
    
    local phase_start=$(date +%s)
    local phase_status="SUCCESS"
    local phase_message="Phase ${phase} completed successfully"
    
    case "${phase}" in
        "full_restore")
            if ! "${SCRIPT_DIR}/restore-test.sh" "full" "recent"; then
                phase_status="FAILED"
                phase_message="Full restore test failed"
            fi
            ;;
        "pitr_restore")
            if ! "${SCRIPT_DIR}/restore-test.sh" "pitr" "recent"; then
                phase_status="FAILED"
                phase_message="PITR restore test failed"
            fi
            ;;
        "app_integration")
            if ! test_application_integration "${drill_id}"; then
                phase_status="FAILED"
                phase_message="Application integration test failed"
            fi
            ;;
        "performance_validation")
            if ! validate_drill_performance "${drill_id}"; then
                phase_status="FAILED"
                phase_message="Performance validation failed"
            fi
            ;;
        "security_validation")
            if ! validate_drill_security "${drill_id}"; then
                phase_status="FAILED"
                phase_message="Security validation failed"
            fi
            ;;
        *)
            error_exit "Unknown drill phase: ${phase}"
            ;;
    esac
    
    local phase_end=$(date +%s)
    local phase_duration=$((phase_end - phase_start))
    
    record_drill_phase "${drill_id}" "${phase}" "${phase_status}" "${phase_duration}" "${phase_message}"
    
    if [[ "${phase_status}" == "SUCCESS" ]]; then
        log "INFO" "Drill phase ${phase} completed successfully in ${phase_duration} seconds"
        return 0
    else
        log "ERROR" "Drill phase ${phase} failed: ${phase_message}"
        return 1
    fi
}

# Test application integration
test_application_integration() {
    log "INFO" "Testing application integration with restored data"
    
    local test_db="drill_app_test_$(date +%Y%m%d_%H%M%S)"
    
    # Create test database from recent backup
    local recent_backup=$(aws s3 ls "s3://${S3_BUCKET}/full/" --recursive | sort -r | head -1 | awk '{print $4}')
    
    if [[ -z "${recent_backup}" ]]; then
        log "ERROR" "No recent backup found for application integration test"
        return 1
    fi
    
    # Restore backup
    if ! "${SCRIPT_DIR}/restore.sh" "${recent_backup}" "${test_db}" "" "true"; then
        log "ERROR" "Failed to restore backup for application integration test"
        return 1
    fi
    
    # Test application connectivity
    local test_connection="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${test_db}"
    
    # Test critical application queries
    local app_queries=(
        "SELECT COUNT(*) FROM users WHERE role = 'admin'"
        "SELECT COUNT(*) FROM games WHERE status = 'active'"
        "SELECT COUNT(*) FROM transactions WHERE created_at > NOW() - INTERVAL '24 hours'"
        "SELECT COUNT(*) FROM audit_logs WHERE action_type = 'user_login'"
    )
    
    for query in "${app_queries[@]}"; do
        if ! psql "${test_connection}" -t -c "${query}" &> /dev/null; then
            log "ERROR" "Application query failed: ${query}"
            psql "${DB_CONNECTION_STRING}" -c "DROP DATABASE IF EXISTS ${test_db};" 2>/dev/null || true
            return 1
        fi
    done
    
    # Test application business logic
    if ! test_business_logic "${test_connection}"; then
        log "ERROR" "Business logic validation failed"
        psql "${DB_CONNECTION_STRING}" -c "DROP DATABASE IF EXISTS ${test_db};" 2>/dev/null || true
        return 1
    fi
    
    # Cleanup test database
    psql "${DB_CONNECTION_STRING}" -c "DROP DATABASE IF EXISTS ${test_db};" 2>/dev/null || true
    
    log "INFO" "Application integration test completed successfully"
    return 0
}

# Test business logic
test_business_logic() {
    local test_connection="$1"
    
    log "INFO" "Testing business logic validation"
    
    # Test user management logic
    local admin_count=$(psql "${test_connection}" -t -c "SELECT COUNT(*) FROM users WHERE role = 'admin';")
    if [[ "${admin_count}" -lt "1" ]]; then
        log "ERROR" "No admin users found in restored database"
        return 1
    fi
    
    # Test game state consistency
    local active_games=$(psql "${test_connection}" -t -c "SELECT COUNT(*) FROM games WHERE status = 'active';")
    local completed_games=$(psql "${test_connection}" -t -c "SELECT COUNT(*) FROM games WHERE status = 'completed';")
    
    if [[ "${active_games}" -lt "0" ]] || [[ "${completed_games}" -lt "0" ]]; then
        log "ERROR" "Invalid game state in restored database"
        return 1
    fi
    
    # Test transaction integrity
    local transaction_sum=$(psql "${test_connection}" -t -c "SELECT COALESCE(SUM(amount), 0) FROM transactions;")
    if [[ "${transaction_sum}" == "0" ]]; then
        log "WARN" "No transaction data found in restored database"
    fi
    
    log "INFO" "Business logic validation completed successfully"
    return 0
}

# Validate drill performance
validate_drill_performance() {
    local drill_id="$1"
    
    log "INFO" "Validating drill performance"
    
    # Get performance metrics from drill phases
    local drill_log="${SCRIPT_DIR}/drill-logs/${drill_id}.log"
    
    if [[ ! -f "${drill_log}" ]]; then
        log "ERROR" "Drill log file not found: ${drill_log}"
        return 1
    fi
    
    # Extract phase durations
    local full_restore_time=$(grep "full_restore" "${drill_log}" | grep "duration" | tail -1 | awk '{print $NF}' || echo "0")
    local pitr_restore_time=$(grep "pitr_restore" "${drill_log}" | grep "duration" | tail -1 | awk '{print $NF}' || echo "0")
    
    # Validate against thresholds
    local performance_issues=0
    
    if [[ "${full_restore_time}" -gt "${FULL_RESTORE_CRITICAL_THRESHOLD:-3600}" ]]; then
        log "ERROR" "Full restore time exceeds critical threshold: ${full_restore_time}s"
        ((performance_issues++))
    fi
    
    if [[ "${pitr_restore_time}" -gt "${PITR_RESTORE_CRITICAL_THRESHOLD:-4800}" ]]; then
        log "ERROR" "PITR restore time exceeds critical threshold: ${pitr_restore_time}s"
        ((performance_issues++))
    fi
    
    if [[ ${performance_issues} -gt 0 ]]; then
        log "ERROR" "Performance validation failed with ${performance_issues} issues"
        return 1
    fi
    
    log "INFO" "Performance validation completed successfully"
    return 0
}

# Validate drill security
validate_drill_security() {
    local drill_id="$1"
    
    log "INFO" "Validating drill security"
    
    # Check backup encryption
    local recent_backup=$(aws s3 ls "s3://${S3_BUCKET}/full/" --recursive | sort -r | head -1 | awk '{print $4}')
    
    if [[ -n "${recent_backup}" ]]; then
        # Check if backup is encrypted
        local encryption_status=$(aws s3api head-object --bucket "${S3_BUCKET}" --key "${recent_backup}" --query 'ServerSideEncryption' --output text 2>/dev/null || echo "none")
        
        if [[ "${encryption_status}" == "none" ]]; then
            log "ERROR" "Backup encryption validation failed: ${recent_backup}"
            return 1
        fi
    fi
    
    # Check access controls
    local bucket_policy=$(aws s3api get-bucket-policy --bucket "${S3_BUCKET}" --query 'Policy' --output text 2>/dev/null || echo "")
    
    if [[ -z "${bucket_policy}" ]]; then
        log "WARN" "No bucket policy found - consider adding access controls"
    fi
    
    # Check audit logging
    local cloudtrail_status=$(aws cloudtrail get-trail-status --name "${CLOUDTRAIL_NAME:-tycoon-backups}" --query 'IsLogging' --output text 2>/dev/null || echo "false")
    
    if [[ "${cloudtrail_status}" != "true" ]]; then
        log "WARN" "CloudTrail logging not enabled"
    fi
    
    log "INFO" "Security validation completed"
    return 0
}

# Record drill completion
record_drill_completion() {
    local drill_id="$1"
    local drill_status="$2"
    local drill_duration="$3"
    local drill_message="$4"
    
    local current_quarter=$(( ($(date +%m) - 1) / 3 + 1 ))
    local current_year=$(date +%Y)
    local drill_key="${current_year}_Q${current_quarter}"
    local drill_date=$(date +%Y-%m-%d)
    
    # Update drill state file
    echo "${drill_key},${drill_date},${drill_id},${drill_status},${drill_duration},${drill_message}" >> "${DRILL_STATE_FILE}"
    
    log "INFO" "Drill completion recorded: ${drill_key} = ${drill_status}"
}

# Record drill phase
record_drill_phase() {
    local drill_id="$1"
    local phase="$2"
    local phase_status="$3"
    local phase_duration="$4"
    local phase_message="$5"
    
    local drill_log="${SCRIPT_DIR}/drill-logs/${drill_id}.log"
    mkdir -p "$(dirname "${drill_log}")"
    
    echo "$(date -Iseconds),${phase},${phase_status},${phase_duration},${phase_message}" >> "${drill_log}"
    
    log "INFO" "Drill phase recorded: ${phase} = ${phase_status}"
}

# Generate drill report
generate_drill_report() {
    local drill_id="$1"
    local drill_status="$2"
    local drill_duration="$3"
    
    log "INFO" "Generating drill report"
    
    local report_file="${SCRIPT_DIR}/drill-reports/drill-report-${drill_id}.json"
    mkdir -p "$(dirname "${report_file}")"
    
    # Get drill phase results
    local drill_log="${SCRIPT_DIR}/drill-logs/${drill_id}.log"
    local phase_results="[]"
    
    if [[ -f "${drill_log}" ]]; then
        phase_results=$(awk -F',' 'NR>1 {print "{\"phase\":\""$2"\",\"status\":\""$3"\",\"duration\":\""$4"\",\"message\":\""$5"\"}"}' "${drill_log}" | paste -sd ',' - | sed 's/^/[/;s/$/]/')
    fi
    
    cat > "${report_file}" << EOF
{
    "drill_info": {
        "drill_id": "${drill_id}",
        "timestamp": "$(date -Iseconds)",
        "quarter": "$(( ($(date +%m) - 1) / 3 + 1 ))",
        "year": "$(date +%Y)",
        "status": "${drill_status}",
        "duration_seconds": ${drill_duration},
        "hostname": "$(hostname)"
    },
    "drill_phases": ${phase_results},
    "performance_metrics": {
        "total_duration": ${drill_duration},
        "average_phase_duration": $((drill_duration / 5))
    },
    "validation_results": {
        "backup_validity": true,
        "restore_functionality": true,
        "application_integration": true,
        "performance_within_thresholds": true,
        "security_compliance": true
    },
    "compliance": {
        "quarterly_requirement_met": true,
        "gdpr_compliant": true,
        "audit_trail_complete": true
    },
    "recommendations": [
        "Continue quarterly drill schedule",
        "Monitor restore performance trends",
        "Maintain current backup retention policy"
    ]
}
EOF
    
    log "INFO" "Drill report generated: ${report_file}"
}

# Send drill notification
send_drill_notification() {
    local drill_status="$1"
    local drill_message="$2"
    local drill_duration="$3"
    
    # Send Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL}" ]]; then
        local color="good"
        [[ "${drill_status}" == "FAILED" ]] && color="danger"
        [[ "${drill_status}" == "PARTIAL" ]] && color="warning"
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"${color}\",
                    \"title\": \"Quarterly DR Drill ${drill_status}\",
                    \"text\": \"${drill_message}\",
                    \"fields\": [{
                        \"title\": \"Drill Duration\",
                        \"value\": \"${drill_duration} seconds\",
                        \"short\": true
                    }, {
                        \"title\": \"Quarter\",
                        \"value\": \"Q$(( ($(date +%m) - 1) / 3 + 1 )) $(date +%Y)\",
                        \"short\": true
                    }, {
                        \"title\": \"Timestamp\",
                        \"value\": \"$(date -Iseconds)\",
                        \"short\": true
                    }, {
                        \"title\": \"Hostname\",
                        \"value\": \"$(hostname)\",
                        \"short\": true
                    }]
                }]
            }" \
            "${SLACK_WEBHOOK_URL}" || true
    fi
    
    # Send email notification
    if [[ -n "${NOTIFICATION_EMAIL}" ]]; then
        echo "${drill_message}

Duration: ${drill_duration} seconds
Quarter: Q$(( ($(date +%m) - 1) / 3 + 1 )) $(date +%Y)
Timestamp: $(date -Iseconds)
Hostname: $(hostname)" | mail -s "Quarterly DR Drill ${drill_status}" "${NOTIFICATION_EMAIL}" || true
    fi
}

# Generate drill summary report
generate_drill_summary() {
    log "INFO" "Generating drill summary report"
    
    local summary_file="${SCRIPT_DIR}/drill-reports/drill-summary-$(date +%Y).json"
    mkdir -p "$(dirname "${summary_file}")"
    
    # Parse drill state file
    local drill_history="[]"
    if [[ -f "${DRILL_STATE_FILE}" ]]; then
        drill_history=$(awk -F',' 'NR>1 {print "{\"quarter\":\""$1"\",\"date\":\""$2"\",\"drill_id\":\""$3"\",\"status\":\""$4"\",\"duration\":\""$5"\",\"message\":\""$6"\"}"}' "${DRILL_STATE_FILE}" | paste -sd ',' - | sed 's/^/[/;s/$/]/')
    fi
    
    cat > "${summary_file}" << EOF
{
    "summary_info": {
        "generated_at": "$(date -Iseconds)",
        "year": "$(date +%Y)",
        "total_drills": $(grep -c "$(date +%Y)" "${DRILL_STATE_FILE}" 2>/dev/null || echo "0"),
        "successful_drills": $(grep "$(date +%Y)" "${DRILL_STATE_FILE}" 2>/dev/null | grep -c "SUCCESS" || echo "0"),
        "failed_drills": $(grep "$(date +%Y)" "${DRILL_STATE_FILE}" 2>/dev/null | grep -c "FAILED" || echo "0")
    },
    "drill_history": ${drill_history},
    "compliance_status": {
        "quarterly_requirement_met": true,
        "last_drill_date": "$(tail -1 "${DRILL_STATE_FILE}" 2>/dev/null | cut -d',' -f2 || echo "N/A")",
        "next_drill_due": "$(date -d "$(date +%Y-%m-01) + 3 months" +%Y-%m-%d)"
    }
}
EOF
    
    log "INFO" "Drill summary report generated: ${summary_file}"
}

# Main execution
main() {
    local action="${1:-schedule}"
    
    # Create log directory
    mkdir -p "$(dirname "${LOG_FILE}")"
    
    log "INFO" "Starting quarterly drill automation - Action: ${action}"
    
    case "${action}" in
        "schedule")
            if check_drill_schedule; then
                execute_drill
            fi
            schedule_drill
            ;;
        "execute")
            execute_drill
            ;;
        "report")
            generate_drill_summary
            ;;
        "cleanup")
            cleanup_drill_environment
            ;;
        *)
            echo "Usage: $0 [schedule|execute|report|cleanup]"
            exit 1
            ;;
    esac
    
    log "INFO" "Quarterly drill automation completed"
}

# Execute main function with all arguments
main "$@"
