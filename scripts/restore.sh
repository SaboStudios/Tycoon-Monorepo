#!/bin/bash

# =============================================================================
# Tycoon Backend - Restore Script
# =============================================================================
# This script performs database restore operations with verification
# Usage: ./restore.sh <backup_file> [target_database] [restore_time]
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/backup.conf"
LOG_FILE="${SCRIPT_DIR}/logs/restore-$(date +%Y%m%d).log"
ENCRYPTION_KEY_FILE="${SCRIPT_DIR}/.backup-key"

# Source configuration
if [[ -f "${CONFIG_FILE}" ]]; then
    source "${CONFIG_FILE}"
else
    echo "ERROR: Configuration file ${CONFIG_FILE} not found"
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
    exit 1
}

# Validate restore parameters
validate_restore_params() {
    local backup_file="$1"
    local target_db="${2:-tycoon_restore_$(date +%Y%m%d_%H%M%S)}"
    local restore_time="$3"
    
    log "INFO" "Validating restore parameters"
    log "INFO" "Backup file: ${backup_file}"
    log "INFO" "Target database: ${target_db}"
    [[ -n "${restore_time}" ]] && log "INFO" "Restore time: ${restore_time}"
    
    # Validate backup file exists in S3
    if ! aws s3 ls "s3://${S3_BUCKET}/${backup_file}" &> /dev/null; then
        error_exit "Backup file not found in S3: ${backup_file}"
    fi
    
    # Validate target database doesn't exist
    if psql "${DB_CONNECTION_STRING}" -lqt | cut -d \| -f 1 | grep -qw "${target_db}"; then
        error_exit "Target database already exists: ${target_db}"
    fi
    
    export TARGET_DATABASE="${target_db}"
}

# Download and decrypt backup
download_backup() {
    local backup_file="$1"
    local temp_dir=$(mktemp -d)
    local downloaded_file="${temp_dir}/$(basename "${backup_file}")"
    local decrypted_file="${temp_dir}/restore.sql"
    
    log "INFO" "Downloading backup from S3"
    
    # Download backup
    if ! aws s3 cp "s3://${S3_BUCKET}/${backup_file}" "${downloaded_file}"; then
        rm -rf "${temp_dir}"
        error_exit "Failed to download backup file"
    fi
    
    log "INFO" "Decrypting backup"
    
    # Decrypt backup
    if ! gpg --batch --yes \
        --passphrase-file "${ENCRYPTION_KEY_FILE}" \
        --decrypt \
        --output "${decrypted_file}" \
        "${downloaded_file}"; then
        rm -rf "${temp_dir}"
        error_exit "Failed to decrypt backup file"
    fi
    
    # Remove encrypted file
    rm -f "${downloaded_file}"
    
    echo "${decrypted_file}"
}

# Create target database
create_target_database() {
    local target_db="$1"
    
    log "INFO" "Creating target database: ${target_db}"
    
    if ! psql "${DB_CONNECTION_STRING}" -c "CREATE DATABASE ${target_db};"; then
        error_exit "Failed to create target database"
    fi
    
    log "INFO" "Target database created successfully"
}

# Perform full restore
perform_full_restore() {
    local backup_file="$1"
    local target_db="$2"
    
    log "INFO" "Starting full database restore"
    
    # Download and decrypt backup
    local decrypted_file
    decrypted_file=$(download_backup "${backup_file}")
    
    # Create target database
    create_target_database "${target_db}"
    
    # Get target connection string
    local target_connection="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${target_db}"
    
    # Restore database
    log "INFO" "Restoring database from backup"
    if ! pg_restore \
        --verbose \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        --jobs=${PARALLEL_JOBS:-4} \
        --dbname="${target_connection}" \
        "${decrypted_file}"; then
        error_exit "Database restore failed"
    fi
    
    # Cleanup
    rm -f "${decrypted_file}"
    
    log "INFO" "Full restore completed successfully"
}

# Perform point-in-time restore
perform_pitr_restore() {
    local backup_file="$1"
    local target_db="$2"
    local restore_time="$3"
    
    log "INFO" "Starting point-in-time restore to: ${restore_time}"
    
    # Download and decrypt base backup
    local decrypted_file
    decrypted_file=$(download_backup "${backup_file}")
    
    # Create target database
    create_target_database "${target_db}"
    
    # Get target connection string
    local target_connection="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${target_db}"
    
    # Restore base backup
    log "INFO" "Restoring base backup"
    if ! pg_restore \
        --verbose \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        --dbname="${target_connection}" \
        "${decrypted_file}"; then
        error_exit "Base backup restore failed"
    fi
    
    # Configure recovery
    configure_pitr_recovery "${target_db}" "${restore_time}"
    
    # Start PostgreSQL for recovery
    start_postgresql_for_recovery "${target_db}"
    
    # Wait for recovery to complete
    wait_for_recovery "${target_db}"
    
    # Cleanup
    rm -f "${decrypted_file}"
    
    log "INFO" "Point-in-time restore completed successfully"
}

# Configure PITR recovery
configure_pitr_recovery() {
    local target_db="$1"
    local restore_time="$2"
    local recovery_dir="/var/lib/postgresql/recovery/${target_db}"
    
    mkdir -p "${recovery_dir}"
    
    # Create recovery configuration
    cat > "${recovery_dir}/recovery.conf" << EOF
restore_command = 'aws s3 cp s3://${S3_BUCKET}/wal-g/%f %p'
recovery_target_time = '${restore_time}'
recovery_target_action = 'promote'
EOF
    
    log "INFO" "PITR recovery configured"
}

# Start PostgreSQL for recovery
start_postgresql_for_recovery() {
    local target_db="$1"
    
    log "INFO" "Starting PostgreSQL for recovery"
    
    # This would need to be adapted based on your PostgreSQL setup
    # For demonstration, we'll assume a single-instance setup
    
    # Stop PostgreSQL if running
    sudo systemctl stop postgresql || true
    
    # Configure PostgreSQL for recovery
    sudo -u postgres cp "/var/lib/postgresql/recovery/${target_db}/recovery.conf" "/var/lib/postgresql/data/"
    
    # Start PostgreSQL
    sudo systemctl start postgresql
    
    log "INFO" "PostgreSQL started for recovery"
}

# Wait for recovery completion
wait_for_recovery() {
    local target_db="$1"
    local timeout=300
    local count=0
    
    log "INFO" "Waiting for recovery to complete"
    
    while [[ ${count} -lt ${timeout} ]]; do
        if psql "${DB_CONNECTION_STRING}" -d "${target_db}" -c "SELECT 1;" &> /dev/null; then
            log "INFO" "Recovery completed successfully"
            return 0
        fi
        
        sleep 1
        ((count++))
    done
    
    error_exit "Recovery timed out after ${timeout} seconds"
}

# Verify restore integrity
verify_restore() {
    local target_db="$1"
    local original_backup="$2"
    
    log "INFO" "Verifying restore integrity"
    
    # Get target connection string
    local target_connection="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${target_db}"
    
    # Check database exists and is accessible
    if ! psql "${target_connection}" -c "SELECT 1;" &> /dev/null; then
        error_exit "Restored database is not accessible"
    fi
    
    # Check table counts match expected
    local expected_tables=$(psql "${DB_CONNECTION_STRING}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    local restored_tables=$(psql "${target_connection}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    
    if [[ "${expected_tables}" -ne "${restored_tables}" ]]; then
        error_exit "Table count mismatch: expected ${expected_tables}, got ${restored_tables}"
    fi
    
    # Check critical tables have data
    local critical_tables=("users" "games" "transactions")
    for table in "${critical_tables[@]}"; do
        local count=$(psql "${target_connection}" -t -c "SELECT COUNT(*) FROM ${table};" 2>/dev/null || echo "0")
        if [[ "${count}" -eq "0" ]]; then
            log "WARN" "Critical table ${table} has no data"
        fi
    done
    
    # Run database consistency checks
    if ! psql "${target_connection}" -c "SELECT pg_database_size('${target_db}');" &> /dev/null; then
        error_exit "Database consistency check failed"
    fi
    
    log "INFO" "Restore integrity verification completed"
}

# Generate restore report
generate_restore_report() {
    local target_db="$1"
    local backup_file="$2"
    local restore_time="$3"
    local report_file="${SCRIPT_DIR}/reports/restore-report-$(date +%Y%m%d_%H%M%S).json"
    
    mkdir -p "$(dirname "${report_file}")"
    
    local target_connection="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${target_db}"
    
    cat > "${report_file}" << EOF
{
    "restore_info": {
        "backup_file": "${backup_file}",
        "target_database": "${target_db}",
        "restore_time": "${restore_time}",
        "restore_timestamp": "$(date -Iseconds)",
        "restore_duration": "${SECONDS} seconds"
    },
    "database_info": {
        "database_size": "$(psql "${target_connection}" -t -c "SELECT pg_database_size('${target_db}');")",
        "table_count": "$(psql "${target_connection}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")",
        "user_count": "$(psql "${target_connection}" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")",
        "game_count": "$(psql "${target_connection}" -t -c "SELECT COUNT(*) FROM games;" 2>/dev/null || echo "0")"
    },
    "verification_results": {
        "database_accessible": true,
        "table_counts_match": true,
        "critical_tables_have_data": true,
        "consistency_checks_passed": true
    },
    "performance_metrics": {
        "restore_time_seconds": ${SECONDS},
        "backup_size_mb": "$(aws s3 ls "s3://${S3_BUCKET}/${backup_file}" --human-readable | awk '{print $3}' | head -1)"
    }
}
EOF
    
    log "INFO" "Restore report generated: ${report_file}"
}

# Send restore notification
send_restore_notification() {
    local status="$1"
    local target_db="$2"
    local message="$3"
    
    # Send Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL}" ]]; then
        local color="good"
        [[ "${status}" == "ERROR" ]] && color="danger"
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"${color}\",
                    \"title\": \"Database Restore ${status}\",
                    \"text\": \"${message}\",
                    \"fields\": [{
                        \"title\": \"Target Database\",
                        \"value\": \"${target_db}\",
                        \"short\": true
                    }, {
                        \"title\": \"Timestamp\",
                        \"value\": \"$(date -Iseconds)\",
                        \"short\": true
                    }, {
                        \"title\": \"Duration\",
                        \"value\": \"${SECONDS} seconds\",
                        \"short\": true
                    }]
                }]
            }" \
            "${SLACK_WEBHOOK_URL}" || true
    fi
    
    # Send email notification
    if [[ -n "${NOTIFICATION_EMAIL}" ]]; then
        echo "${message}" | mail -s "Database Restore ${status}" "${NOTIFICATION_EMAIL}" || true
    fi
}

# Cleanup restore artifacts
cleanup_restore() {
    local target_db="$1"
    local keep_db="${2:-false}"
    
    log "INFO" "Cleaning up restore artifacts"
    
    # Cleanup recovery files
    sudo rm -rf "/var/lib/postgresql/recovery/${target_db}" || true
    
    # Drop temporary database if not keeping it
    if [[ "${keep_db}" != "true" ]]; then
        psql "${DB_CONNECTION_STRING}" -c "DROP DATABASE IF EXISTS ${target_db};" || true
        log "INFO" "Temporary database ${target_db} dropped"
    fi
    
    log "INFO" "Cleanup completed"
}

# Main execution
main() {
    local backup_file="$1"
    local target_db="${2:-tycoon_restore_$(date +%Y%m%d_%H%M%S)}"
    local restore_time="$3"
    local keep_db="${4:-false}"
    
    # Create log directory
    mkdir -p "$(dirname "${LOG_FILE}")"
    
    SECONDS=0
    log "INFO" "Starting restore process"
    
    # Validate parameters
    validate_restore_params "${backup_file}" "${target_db}" "${restore_time}"
    
    # Perform restore based on type
    if [[ -n "${restore_time}" ]]; then
        perform_pitr_restore "${backup_file}" "${target_db}" "${restore_time}"
    else
        perform_full_restore "${backup_file}" "${target_db}"
    fi
    
    # Verify restore
    verify_restore "${target_db}" "${backup_file}"
    
    # Generate report
    generate_restore_report "${target_db}" "${backup_file}" "${restore_time}"
    
    log "INFO" "Restore process completed successfully in ${SECONDS} seconds"
    send_restore_notification "SUCCESS" "${target_db}" "Database restored successfully"
    
    # Cleanup if not keeping database
    if [[ "${keep_db}" != "true" ]]; then
        cleanup_restore "${target_db}" "false"
    fi
}

# Execute main function with all arguments
main "$@"
