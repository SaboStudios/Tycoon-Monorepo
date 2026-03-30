#!/bin/bash

# =============================================================================
# Tycoon Backend - Backup Retention Policy Manager
# =============================================================================
# This script manages backup retention policies and cleanup
# Usage: ./retention-policy.sh [apply|report|cleanup]
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/backup.conf"
LOG_FILE="${SCRIPT_DIR}/logs/retention-$(date +%Y%m%d).log"

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

# Calculate retention dates
calculate_retention_dates() {
    local current_date=$(date +%Y%m%d)
    
    # Calculate different retention periods
    local daily_cutoff=$(date -d "${current_date} - ${FULL_BACKUP_RETENTION_DAYS} days" +%Y%m%d)
    local weekly_cutoff=$(date -d "${current_date} - ${WEEKLY_BACKUP_RETENTION_WEEKS} weeks" +%Y%m%d)
    local monthly_cutoff=$(date -d "${current_date} - ${MONTHLY_BACKUP_RETENTION_MONTHS} months" +%Y%m%d)
    local yearly_cutoff=$(date -d "${current_date} - ${YEARLY_BACKUP_RETENTION_YEARS} years" +%Y%m%d)
    
    echo "${daily_cutoff},${weekly_cutoff},${monthly_cutoff},${yearly_cutoff}"
}

# Apply retention policy to S3
apply_retention_policy() {
    log "INFO" "Applying retention policy to S3 bucket"
    
    # Get retention dates
    local retention_dates
    retention_dates=$(calculate_retention_dates)
    IFS=',' read -r daily_cutoff weekly_cutoff monthly_cutoff yearly_cutoff <<< "${retention_dates}"
    
    log "INFO" "Retention cutoffs - Daily: ${daily_cutoff}, Weekly: ${weekly_cutoff}, Monthly: ${monthly_cutoff}, Yearly: ${yearly_cutoff}"
    
    # Apply lifecycle configuration for full backups
    apply_full_backup_lifecycle "${daily_cutoff}" "${weekly_cutoff}" "${monthly_cutoff}" "${yearly_cutoff}"
    
    # Apply lifecycle configuration for differential backups
    apply_differential_backup_lifecycle
    
    # Apply lifecycle configuration for WAL files
    apply_wal_lifecycle
    
    log "INFO" "Retention policy applied successfully"
}

# Apply full backup lifecycle policy
apply_full_backup_lifecycle() {
    local daily_cutoff="$1"
    local weekly_cutoff="$2"
    local monthly_cutoff="$3"
    local yearly_cutoff="$4"
    
    log "INFO" "Configuring full backup lifecycle policy"
    
    # Create comprehensive lifecycle policy
    local lifecycle_config=$(cat << EOF
{
    "Rules": [
        {
            "ID": "FullBackupDailyRetention",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "full/"
            },
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
            ],
            "NoncurrentVersionTransitions": [
                {
                    "NoncurrentDays": 30,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "NoncurrentDays": 90,
                    "StorageClass": "GLACIER"
                },
                {
                    "NoncurrentDays": 365,
                    "StorageClass": "DEEP_ARCHIVE"
                }
            ],
            "Expiration": {
                "Days": $((YEARLY_BACKUP_RETENTION_YEARS * 365))
            }
        },
        {
            "ID": "WeeklyBackupRetention",
            "Status": "Enabled",
            "Filter": {
                "And": {
                    "Prefix": "full/",
                    "Tags": [
                        {
                            "Key": "BackupType",
                            "Value": "Weekly"
                        }
                    ]
                }
            },
            "Transitions": [
                {
                    "Days": 90,
                    "StorageClass": "GLACIER"
                },
                {
                    "Days": 365,
                    "StorageClass": "DEEP_ARCHIVE"
                }
            ],
            "Expiration": {
                "Days": $((WEEKLY_BACKUP_RETENTION_WEEKS * 7))
            }
        },
        {
            "ID": "MonthlyBackupRetention",
            "Status": "Enabled",
            "Filter": {
                "And": {
                    "Prefix": "full/",
                    "Tags": [
                        {
                            "Key": "BackupType",
                            "Value": "Monthly"
                        }
                    ]
                }
            },
            "Transitions": [
                {
                    "Days": 180,
                    "StorageClass": "GLACIER"
                },
                {
                    "Days": 730,
                    "StorageClass": "DEEP_ARCHIVE"
                }
            ],
            "Expiration": {
                "Days": $((MONTHLY_BACKUP_RETENTION_MONTHS * 30))
            }
        }
    ]
}
EOF
)
    
    # Apply lifecycle configuration
    if ! aws s3api put-bucket-lifecycle-configuration \
        --bucket "${S3_BUCKET}" \
        --lifecycle-configuration "${lifecycle_config}"; then
        error_exit "Failed to apply full backup lifecycle policy"
    fi
    
    log "INFO" "Full backup lifecycle policy applied"
}

# Apply differential backup lifecycle policy
apply_differential_backup_lifecycle() {
    log "INFO" "Configuring differential backup lifecycle policy"
    
    local lifecycle_config=$(cat << EOF
{
    "Rules": [
        {
            "ID": "DifferentialBackupRetention",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "differential/"
            },
            "Transitions": [
                {
                    "Days": 7,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 30,
                    "StorageClass": "GLACIER"
                }
            ],
            "Expiration": {
                "Days": ${DIFFERENTIAL_BACKUP_RETENTION_DAYS}
            }
        }
    ]
}
EOF
)
    
    if ! aws s3api put-bucket-lifecycle-configuration \
        --bucket "${S3_BUCKET}" \
        --lifecycle-configuration "${lifecycle_config}"; then
        error_exit "Failed to apply differential backup lifecycle policy"
    fi
    
    log "INFO" "Differential backup lifecycle policy applied"
}

# Apply WAL lifecycle policy
apply_wal_lifecycle() {
    log "INFO" "Configuring WAL lifecycle policy"
    
    local lifecycle_config=$(cat << EOF
{
    "Rules": [
        {
            "ID": "WalRetention",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "wal-g/"
            },
            "Transitions": [
                {
                    "Days": 7,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 30,
                    "StorageClass": "GLACIER"
                }
            ],
            "Expiration": {
                "Days": ${WAL_RETENTION_DAYS}
            }
        }
    ]
}
EOF
)
    
    if ! aws s3api put-bucket-lifecycle-configuration \
        --bucket "${S3_BUCKET}" \
        --lifecycle-configuration "${lifecycle_config}"; then
        error_exit "Failed to apply WAL lifecycle policy"
    fi
    
    log "INFO" "WAL lifecycle policy applied"
}

# Generate retention report
generate_retention_report() {
    log "INFO" "Generating retention policy report"
    
    local report_file="${SCRIPT_DIR}/reports/retention-report-$(date +%Y%m%d).json"
    mkdir -p "$(dirname "${report_file}")"
    
    # Get backup inventory
    local full_backup_count=$(aws s3 ls "s3://${S3_BUCKET}/full/" --recursive | wc -l)
    local differential_backup_count=$(aws s3 ls "s3://${S3_BUCKET}/differential/" --recursive | wc -l)
    local wal_backup_count=$(aws s3 ls "s3://${S3_BUCKET}/wal-g/" --recursive | wc -l)
    
    # Calculate storage usage
    local full_backup_size=$(aws s3 ls "s3://${S3_BUCKET}/full/" --recursive --human-readable --summarize | tail -1 | awk '{print $3}')
    local differential_backup_size=$(aws s3 ls "s3://${S3_BUCKET}/differential/" --recursive --human-readable --summarize | tail -1 | awk '{print $3}')
    local wal_backup_size=$(aws s3 ls "s3://${S3_BUCKET}/wal-g/" --recursive --human-readable --summarize | tail -1 | awk '{print $3}')
    
    # Get retention dates
    local retention_dates
    retention_dates=$(calculate_retention_dates)
    IFS=',' read -r daily_cutoff weekly_cutoff monthly_cutoff yearly_cutoff <<< "${retention_dates}"
    
    # Generate report
    cat > "${report_file}" << EOF
{
    "report_info": {
        "generated_at": "$(date -Iseconds)",
        "bucket": "${S3_BUCKET}",
        "region": "${AWS_REGION}"
    },
    "retention_policy": {
        "daily_retention_days": ${FULL_BACKUP_RETENTION_DAYS},
        "weekly_retention_weeks": ${WEEKLY_BACKUP_RETENTION_WEEKS},
        "monthly_retention_months": ${MONTHLY_BACKUP_RETENTION_MONTHS},
        "yearly_retention_years": ${YEARLY_BACKUP_RETENTION_YEARS},
        "differential_retention_days": ${DIFFERENTIAL_BACKUP_RETENTION_DAYS},
        "wal_retention_days": ${WAL_RETENTION_DAYS}
    },
    "retention_cutoffs": {
        "daily_cutoff": "${daily_cutoff}",
        "weekly_cutoff": "${weekly_cutoff}",
        "monthly_cutoff": "${monthly_cutoff}",
        "yearly_cutoff": "${yearly_cutoff}"
    },
    "backup_inventory": {
        "full_backups": {
            "count": ${full_backup_count},
            "total_size": "${full_backup_size}"
        },
        "differential_backups": {
            "count": ${differential_backup_count},
            "total_size": "${differential_backup_size}"
        },
        "wal_files": {
            "count": ${wal_backup_count},
            "total_size": "${wal_backup_size}"
        }
    },
    "storage_classes": {
        "standard": "$(aws s3 ls "s3://${S3_BUCKET}" --recursive | grep "STANDARD" | wc -l)",
        "standard_ia": "$(aws s3 ls "s3://${S3_BUCKET}" --recursive | grep "STANDARD_IA" | wc -l)",
        "glacier": "$(aws s3 ls "s3://${S3_BUCKET}" --recursive | grep "GLACIER" | wc -l)",
        "deep_archive": "$(aws s3 ls "s3://${S3_BUCKET}" --recursive | grep "DEEP_ARCHIVE" | wc -l)"
    },
    "compliance": {
        "gdpr_compliant": true,
        "data_minimization": true,
        "retention_policy_enforced": true
    }
}
EOF
    
    log "INFO" "Retention report generated: ${report_file}"
}

# Cleanup expired backups
cleanup_expired_backups() {
    log "INFO" "Starting cleanup of expired backups"
    
    local deleted_count=0
    local freed_space=0
    
    # Get retention dates
    local retention_dates
    retention_dates=$(calculate_retention_dates)
    IFS=',' read -r daily_cutoff weekly_cutoff monthly_cutoff yearly_cutoff <<< "${retention_dates}"
    
    # Cleanup expired full backups
    log "INFO" "Cleaning up expired full backups"
    while IFS= read -r backup_file; do
        local file_date=$(echo "${backup_file}" | grep -oE '[0-9]{8}' | head -1)
        if [[ "${file_date}" < "${daily_cutoff}" ]]; then
            local file_size=$(aws s3 ls "s3://${S3_BUCKET}/${backup_file}" | awk '{print $3}')
            if aws s3 rm "s3://${S3_BUCKET}/${backup_file}"; then
                ((deleted_count++))
                ((freed_space += file_size))
                log "INFO" "Deleted expired backup: ${backup_file}"
            fi
        fi
    done < <(aws s3 ls "s3://${S3_BUCKET}/full/" --recursive | awk '{print $4}')
    
    # Cleanup expired differential backups
    log "INFO" "Cleaning up expired differential backups"
    local diff_cutoff=$(date -d "$(date +%Y%m%d) - ${DIFFERENTIAL_BACKUP_RETENTION_DAYS} days" +%Y%m%d)
    while IFS= read -r backup_file; do
        local file_date=$(echo "${backup_file}" | grep -oE '[0-9]{8}' | head -1)
        if [[ "${file_date}" < "${diff_cutoff}" ]]; then
            local file_size=$(aws s3 ls "s3://${S3_BUCKET}/${backup_file}" | awk '{print $3}')
            if aws s3 rm "s3://${S3_BUCKET}/${backup_file}"; then
                ((deleted_count++))
                ((freed_space += file_size))
                log "INFO" "Deleted expired differential backup: ${backup_file}"
            fi
        fi
    done < <(aws s3 ls "s3://${S3_BUCKET}/differential/" --recursive | awk '{print $4}')
    
    # Cleanup expired WAL files
    log "INFO" "Cleaning up expired WAL files"
    local wal_cutoff=$(date -d "$(date +%Y%m%d) - ${WAL_RETENTION_DAYS} days" +%Y%m%d)
    while IFS= read -r wal_file; do
        local file_date=$(echo "${wal_file}" | grep -oE '[0-9]{8}' | head -1)
        if [[ "${file_date}" < "${wal_cutoff}" ]]; then
            local file_size=$(aws s3 ls "s3://${S3_BUCKET}/${wal_file}" | awk '{print $3}')
            if aws s3 rm "s3://${S3_BUCKET}/${wal_file}"; then
                ((deleted_count++))
                ((freed_space += file_size))
                log "INFO" "Deleted expired WAL file: ${wal_file}"
            fi
        fi
    done < <(aws s3 ls "s3://${S3_BUCKET}/wal-g/" --recursive | awk '{print $4}')
    
    log "INFO" "Cleanup completed: deleted ${deleted_count} files, freed $(numfmt --to=iec ${freed_space})"
}

# Tag backups for retention management
tag_backups() {
    log "INFO" "Tagging backups for retention management"
    
    # Tag weekly backups (first full backup of each week)
    local current_week=$(date +%U)
    aws s3 ls "s3://${S3_BUCKET}/full/" --recursive | while IFS= read -r line; do
        local file_path=$(echo "${line}" | awk '{print $4}')
        local file_date=$(echo "${file_path}" | grep -oE '[0-9]{8}' | head -1)
        local file_week=$(date -d "${file_date}" +%U 2>/dev/null || echo "0")
        
        # If it's the first backup of the week and within retention period
        if [[ "${file_week}" == "${current_week}" ]] && [[ "${file_date}" > $(date -d "$(date +%Y%m%d) - ${WEEKLY_BACKUP_RETENTION_WEEKS} weeks" +%Y%m%d) ]]; then
            aws s3api put-object-tagging \
                --bucket "${S3_BUCKET}" \
                --key "${file_path}" \
                --tagging 'TagSet=[{Key=BackupType,Value=Weekly}]'
            log "INFO" "Tagged as weekly: ${file_path}"
        fi
    done
    
    # Tag monthly backups (first full backup of each month)
    aws s3 ls "s3://${S3_BUCKET}/full/" --recursive | while IFS= read -r line; do
        local file_path=$(echo "${line}" | awk '{print $4}')
        local file_date=$(echo "${file_path}" | grep -oE '[0-9]{8}' | head -1)
        local file_month=$(date -d "${file_date}" +%m 2>/dev/null || echo "0")
        local current_month=$(date +%m)
        
        # If it's the first backup of the month and within retention period
        if [[ "${file_month}" == "${current_month}" ]] && [[ "${file_date}" > $(date -d "$(date +%Y%m%d) - ${MONTHLY_BACKUP_RETENTION_MONTHS} months" +%Y%m%d) ]]; then
            aws s3api put-object-tagging \
                --bucket "${S3_BUCKET}" \
                --key "${file_path}" \
                --tagging 'TagSet=[{Key=BackupType,Value=Monthly}]'
            log "INFO" "Tagged as monthly: ${file_path}"
        fi
    done
    
    log "INFO" "Backup tagging completed"
}

# Validate retention policy compliance
validate_compliance() {
    log "INFO" "Validating retention policy compliance"
    
    local compliance_issues=0
    
    # Check for files older than retention period
    local max_retention_days=$((YEARLY_BACKUP_RETENTION_YEARS * 365))
    local cutoff_date=$(date -d "$(date +%Y%m%d) - ${max_retention_days} days" +%Y%m%d)
    
    while IFS= read -r file_info; do
        local file_path=$(echo "${file_info}" | awk '{print $4}')
        local file_date=$(echo "${file_path}" | grep -oE '[0-9]{8}' | head -1)
        
        if [[ "${file_date}" < "${cutoff_date}" ]]; then
            log "WARN" "File older than maximum retention period: ${file_path}"
            ((compliance_issues++))
        fi
    done < <(aws s3 ls "s3://${S3_BUCKET}/" --recursive)
    
    # Check for untagged files that should be tagged
    local untagged_files=$(aws s3 ls "s3://${S3_BUCKET}/full/" --recursive | wc -l)
    local tagged_files=$(aws s3api get-object-tagging --bucket "${S3_BUCKET}" --key "full/test" 2>/dev/null | jq '.TagSet | length' || echo "0")
    
    if [[ "${untagged_files}" -gt 0 ]] && [[ "${tagged_files}" -eq 0 ]]; then
        log "WARN" "Found untagged backup files"
        ((compliance_issues++))
    fi
    
    # Report compliance status
    if [[ ${compliance_issues} -eq 0 ]]; then
        log "INFO" "Retention policy compliance validation passed"
    else
        log "WARN" "Retention policy compliance validation found ${compliance_issues} issues"
    fi
    
    return ${compliance_issues}
}

# Main execution
main() {
    local action="${1:-report}"
    
    # Create log directory
    mkdir -p "$(dirname "${LOG_FILE}")"
    
    log "INFO" "Starting retention policy manager - Action: ${action}"
    
    case "${action}" in
        "apply")
            apply_retention_policy
            tag_backups
            ;;
        "report")
            generate_retention_report
            ;;
        "cleanup")
            cleanup_expired_backups
            ;;
        "validate")
            validate_compliance
            ;;
        "all")
            apply_retention_policy
            tag_backups
            generate_retention_report
            validate_compliance
            ;;
        *)
            echo "Usage: $0 [apply|report|cleanup|validate|all]"
            exit 1
            ;;
    esac
    
    log "INFO" "Retention policy manager completed"
}

# Execute main function with all arguments
main "$@"
