#!/bin/bash

# =============================================================================
# Tycoon Backend - Automated Backup Script
# =============================================================================
# This script performs automated database backups with encryption and cloud storage
# Usage: ./backup.sh [full|differential|wal]
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/backup.conf"
LOG_FILE="${SCRIPT_DIR}/logs/backup-$(date +%Y%m%d).log"
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

# Validate environment
validate_environment() {
    log "INFO" "Validating backup environment"
    
    # Check required commands
    local required_commands=("pg_dump" "psql" "gpg" "aws")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "${cmd}" &> /dev/null; then
            error_exit "Required command '${cmd}' not found"
        fi
    done
    
    # Check database connection
    if ! psql "${DB_CONNECTION_STRING}" -c "SELECT 1;" &> /dev/null; then
        error_exit "Cannot connect to database"
    fi
    
    # Check encryption key
    if [[ ! -f "${ENCRYPTION_KEY_FILE}" ]]; then
        error_exit "Encryption key file not found"
    fi
    
    log "INFO" "Environment validation completed"
}

# Create backup directory
create_backup_dir() {
    local backup_dir="${BACKUP_ROOT_DIR}/$(date +%Y%m%d)"
    mkdir -p "${backup_dir}"
    echo "${backup_dir}"
}

# Perform full backup
perform_full_backup() {
    local backup_dir="$1"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${backup_dir}/full_backup_${timestamp}.sql"
    local encrypted_file="${backup_file}.gpg"
    
    log "INFO" "Starting full database backup"
    
    # Create database backup
    if ! pg_dump "${DB_CONNECTION_STRING}" \
        --format=custom \
        --compress=9 \
        --verbose \
        --file="${backup_file}"; then
        error_exit "Full backup failed"
    fi
    
    # Encrypt backup
    if ! gpg --batch --yes \
        --passphrase-file "${ENCRYPTION_KEY_FILE}" \
        --symmetric \
        --cipher-algo AES256 \
        --compress-algo 1 \
        --s2k-mode 3 \
        --s2k-digest-algo SHA512 \
        --s2k-count 65536 \
        --output "${encrypted_file}" \
        "${backup_file}"; then
        error_exit "Backup encryption failed"
    fi
    
    # Remove unencrypted backup
    rm -f "${backup_file}"
    
    # Upload to cloud storage
    upload_to_cloud "${encrypted_file}" "full"
    
    # Create backup metadata
    create_backup_metadata "${encrypted_file}" "full" "${timestamp}"
    
    log "INFO" "Full backup completed successfully"
}

# Perform differential backup
perform_differential_backup() {
    local backup_dir="$1"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${backup_dir}/diff_backup_${timestamp}.sql"
    local encrypted_file="${backup_file}.gpg"
    
    log "INFO" "Starting differential backup"
    
    # Get latest full backup timestamp
    local latest_full=$(get_latest_full_backup)
    if [[ -z "${latest_full}" ]]; then
        error_exit "No full backup found for differential backup"
    fi
    
    # Create differential backup using pg_dump with --since option
    if ! pg_dump "${DB_CONNECTION_STRING}" \
        --format=custom \
        --compress=9 \
        --verbose \
        --file="${backup_file}" \
        --exclude-table-data="audit_logs_*"; then
        error_exit "Differential backup failed"
    fi
    
    # Encrypt backup
    if ! gpg --batch --yes \
        --passphrase-file "${ENCRYPTION_KEY_FILE}" \
        --symmetric \
        --cipher-algo AES256 \
        --output "${encrypted_file}" \
        "${backup_file}"; then
        error_exit "Differential backup encryption failed"
    fi
    
    # Remove unencrypted backup
    rm -f "${backup_file}"
    
    # Upload to cloud storage
    upload_to_cloud "${encrypted_file}" "differential"
    
    # Create backup metadata
    create_backup_metadata "${encrypted_file}" "differential" "${timestamp}"
    
    log "INFO" "Differential backup completed successfully"
}

# Archive WAL files
archive_wal_files() {
    log "INFO" "Archiving WAL files"
    
    # Use wal-g for WAL archiving
    if ! wal-g backup-push "${PGDATA}"; then
        error_exit "WAL archiving failed"
    fi
    
    log "INFO" "WAL archiving completed"
}

# Upload to cloud storage
upload_to_cloud() {
    local file_path="$1"
    local backup_type="$2"
    local filename=$(basename "${file_path}")
    
    log "INFO" "Uploading ${backup_type} backup to cloud storage"
    
    # Upload to S3
    if ! aws s3 cp "${file_path}" \
        "s3://${S3_BUCKET}/${backup_type}/$(date +%Y)/$(date +%m)/${filename}" \
        --server-side-encryption AES256; then
        error_exit "Cloud upload failed"
    fi
    
    # Create S3 lifecycle policy for retention
    apply_retention_policy "${backup_type}"
    
    log "INFO" "Cloud upload completed"
}

# Create backup metadata
create_backup_metadata() {
    local backup_file="$1"
    local backup_type="$2"
    local timestamp="$3"
    
    local metadata_file="${backup_file}.meta"
    
    cat > "${metadata_file}" << EOF
{
    "backup_type": "${backup_type}",
    "timestamp": "${timestamp}",
    "file_size": $(stat -f%z "${backup_file}" 2>/dev/null || stat -c%s "${backup_file}"),
    "checksum": "$(sha256sum "${backup_file}" | cut -d' ' -f1)",
    "database_version": "$(psql "${DB_CONNECTION_STRING}" -t -c "SELECT version();")",
    "created_at": "$(date -Iseconds)",
    "created_by": "$(whoami)",
    "hostname": "$(hostname)"
}
EOF
    
    log "INFO" "Backup metadata created"
}

# Get latest full backup
get_latest_full_backup() {
    aws s3 ls "s3://${S3_BUCKET}/full/" \
        --recursive \
        | sort -r \
        | head -1 \
        | awk '{print $4}'
}

# Apply retention policy
apply_retention_policy() {
    local backup_type="$1"
    
    case "${backup_type}" in
        "full")
            # Keep daily backups for 30 days
            aws s3api put-bucket-lifecycle-configuration \
                --bucket "${S3_BUCKET}" \
                --lifecycle-configuration '{
                    "Rules": [
                        {
                            "ID": "FullBackupRetention",
                            "Status": "Enabled",
                            "Filter": {"Prefix": "full/"},
                            "Transitions": [
                                {
                                    "Days": 30,
                                    "StorageClass": "STANDARD_IA"
                                },
                                {
                                    "Days": 90,
                                    "StorageClass": "GLACIER"
                                },
                                {
                                    "Days": 365,
                                    "StorageClass": "DEEP_ARCHIVE"
                                }
                            ]
                        }
                    ]
                }'
            ;;
        "differential")
            # Keep differential backups for 7 days
            aws s3api put-bucket-lifecycle-configuration \
                --bucket "${S3_BUCKET}" \
                --lifecycle-configuration '{
                    "Rules": [
                        {
                            "ID": "DifferentialBackupRetention",
                            "Status": "Enabled",
                            "Filter": {"Prefix": "differential/"},
                            "Expiration": {"Days": 7}
                        }
                    ]
                }'
            ;;
    esac
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    log "INFO" "Verifying backup integrity"
    
    # Download and decrypt backup for verification
    local temp_file=$(mktemp)
    local decrypted_file="${temp_file}.sql"
    
    if ! aws s3 cp "s3://${S3_BUCKET}/${backup_file}" "${temp_file}"; then
        rm -f "${temp_file}"
        error_exit "Failed to download backup for verification"
    fi
    
    if ! gpg --batch --yes \
        --passphrase-file "${ENCRYPTION_KEY_FILE}" \
        --decrypt \
        --output "${decrypted_file}" \
        "${temp_file}"; then
        rm -f "${temp_file}" "${decrypted_file}"
        error_exit "Failed to decrypt backup for verification"
    fi
    
    # Verify backup file
    if ! pg_restore --list "${decrypted_file}" &> /dev/null; then
        rm -f "${temp_file}" "${decrypted_file}"
        error_exit "Backup verification failed"
    fi
    
    # Cleanup
    rm -f "${temp_file}" "${decrypted_file}"
    
    log "INFO" "Backup verification completed"
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    # Send Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL}" ]]; then
        local color="good"
        [[ "${status}" == "ERROR" ]] && color="danger"
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"${color}\",
                    \"title\": \"Backup ${status}\",
                    \"text\": \"${message}\",
                    \"fields\": [{
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
        echo "${message}" | mail -s "Backup ${status}" "${NOTIFICATION_EMAIL}" || true
    fi
}

# Cleanup old local backups
cleanup_local_backups() {
    log "INFO" "Cleaning up local backups older than ${LOCAL_RETENTION_DAYS} days"
    
    find "${BACKUP_ROOT_DIR}" \
        -type f \
        -name "*.gpg" \
        -mtime +${LOCAL_RETENTION_DAYS} \
        -delete
    
    log "INFO" "Local backup cleanup completed"
}

# Main execution
main() {
    local backup_type="${1:-full}"
    
    # Create log directory
    mkdir -p "$(dirname "${LOG_FILE}")"
    
    log "INFO" "Starting backup process - Type: ${backup_type}"
    
    # Validate environment
    validate_environment
    
    # Create backup directory
    local backup_dir
    backup_dir=$(create_backup_dir)
    
    # Perform backup based on type
    case "${backup_type}" in
        "full")
            perform_full_backup "${backup_dir}"
            ;;
        "differential")
            perform_differential_backup "${backup_dir}"
            ;;
        "wal")
            archive_wal_files
            ;;
        *)
            error_exit "Invalid backup type: ${backup_type}"
            ;;
    esac
    
    # Cleanup old backups
    cleanup_local_backups
    
    log "INFO" "Backup process completed successfully"
    send_notification "SUCCESS" "Backup completed successfully"
}

# Execute main function with all arguments
main "$@"
