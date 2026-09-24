# GDPR Deletion Interplay with Backup System

## Overview

This document outlines how GDPR requirements, particularly the "right to erasure" (Article 17), interact with the backup and restore system for the Tycoon backend. It ensures compliance while maintaining data integrity and backup functionality.

## GDPR Requirements

### Right to Erasure (Article 17)
- Individuals have the right to request deletion of their personal data
- Controllers must erase personal data without undue delay
- Exceptions exist for legitimate interests, legal obligations, and public interest

### Data Minimization (Article 5)
- Only process necessary data for specified purposes
- Limit data retention to what's necessary
- Implement appropriate security measures

### Accountability (Article 24)
- Maintain records of processing activities
- Demonstrate compliance with GDPR principles
- Implement technical and organizational measures

## Backup System Impact

### Current Backup Architecture
- **Point-in-Time Recovery**: WAL archiving enables 30-day PITR
- **Retention Period**: Up to 7 years for yearly backups
- **Encryption**: AES-256 encryption at rest and in transit
- **Storage**: Multi-tier storage (Standard, IA, Glacier, Deep Archive)

### GDPR Compliance Challenges
1. **Backup Retention vs. Right to Erasure**
2. **Data Anonymization in Historical Backups**
3. **Audit Trail for Deletion Requests**
4. **Cross-Border Data Transfer Considerations**

## Implementation Strategy

### 1. Immediate Deletion in Production
```sql
-- Soft delete user immediately
UPDATE users SET deleted_at = NOW() WHERE id = :user_id;

-- Log deletion request
INSERT INTO gdpr_deletion_requests (user_id, request_date, status, requester)
VALUES (:user_id, NOW(), 'completed', :requester);
```

### 2. Backup Anonymization Process
```bash
#!/bin/bash
# Anonymize user data in backups
anonymize_user_in_backups() {
    local user_id="$1"
    local anonymization_date=$(date -Iseconds)
    
    # Create anonymization script
    cat > /tmp/anonymize_${user_id}.sql << EOF
-- Anonymize user data in restored database
UPDATE users SET 
    email = 'deleted_user_${user_id}@deleted.local',
    first_name = 'DELETED',
    last_name = 'USER',
    address = NULL,
    phone = NULL,
    gdpr_anonymized_at = '${anonymization_date}'
WHERE id = ${user_id};

-- Anonymize sensitive audit logs
UPDATE audit_logs SET 
    user_email = 'deleted_user_${user_id}@deleted.local',
    metadata = jsonb_set(metadata, '{original_email}', to_jsonb(email))
WHERE user_id = ${user_id};

-- Add anonymization record
INSERT INTO gdpr_anonymization_log (user_id, anonymization_date, backup_version, method)
VALUES (${user_id}, '${anonymization_date}', :backup_version, 'automated');
EOF
    
    # Apply to relevant backups
    apply_anonymization_to_backups "${user_id}" "/tmp/anonymize_${user_id}.sql"
}
```

### 3. Automated Anonymization Pipeline
```yaml
# GDPR Anonymization Workflow
name: gdpr-anonymization
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:
    inputs:
      user_id:
        description: 'User ID to anonymize'
        required: true

jobs:
  anonymize-user:
    runs-on: ubuntu-latest
    steps:
      - name: Get deletion requests
        run: |
          psql "${DB_CONNECTION_STRING}" -c "
            SELECT user_id, request_date 
            FROM gdpr_deletion_requests 
            WHERE status = 'pending_anonymization' 
            AND request_date < NOW() - INTERVAL '7 days';"
      
      - name: Anonymize in backups
        run: |
          while IFS= read -r user_id; do
            ./scripts/gdpr-anonymize.sh "${user_id}"
          done
      
      - name: Update request status
        run: |
          psql "${DB_CONNECTION_STRING}" -c "
            UPDATE gdpr_deletion_requests 
            SET status = 'completed', completed_at = NOW()
            WHERE user_id = ${user_id};"
```

## Technical Implementation

### Database Schema Additions
```sql
-- GDPR deletion requests tracking
CREATE TABLE gdpr_deletion_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    request_date TIMESTAMP NOT NULL DEFAULT NOW(),
    requester VARCHAR(255) NOT NULL,
    request_source VARCHAR(50) NOT NULL, -- 'web', 'api', 'email', 'legal'
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMP NULL,
    backup_anonymization_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- GDPR anonymization log
CREATE TABLE gdpr_anonymization_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    anonymization_date TIMESTAMP NOT NULL DEFAULT NOW(),
    backup_version VARCHAR(100) NOT NULL,
    backup_date DATE NOT NULL,
    method VARCHAR(50) NOT NULL, -- 'automated', 'manual', 'restore-time'
    affected_backups TEXT[], -- Array of backup identifiers
    anonymized_fields TEXT[], -- Array of field names anonymized
    verification_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- GDPR compliance metrics
CREATE TABLE gdpr_compliance_metrics (
    id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    deletion_requests_received INTEGER DEFAULT 0,
    deletion_requests_completed INTEGER DEFAULT 0,
    average_completion_time_hours DECIMAL(10,2) DEFAULT 0,
    backups_anonymized INTEGER DEFAULT 0,
    anonymization_errors INTEGER DEFAULT 0,
    compliance_score DECIMAL(5,2) DEFAULT 100.00,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Anonymization Script Implementation
```bash
#!/bin/bash
# =============================================================================
# GDPR User Anonymization Script
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/backup.conf"
LOG_FILE="${SCRIPT_DIR}/logs/gdpr-anonymization-$(date +%Y%m%d).log"

source "${CONFIG_FILE}"

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

anonymize_user_in_backups() {
    local user_id="$1"
    local anonymization_token="anon_${user_id}_$(date +%s)"
    
    log "INFO" "Starting GDPR anonymization for user ${user_id}"
    
    # Get user information before deletion
    local user_info=$(psql "${DB_CONNECTION_STRING}" -t -c "
        SELECT email, first_name, last_name, address, created_at 
        FROM users WHERE id = ${user_id};" 2>/dev/null || echo "")
    
    if [[ -z "${user_info}" ]]; then
        log "ERROR" "User ${user_id} not found"
        return 1
    fi
    
    # Create anonymization record
    local anonymization_id=$(psql "${DB_CONNECTION_STRING}" -t -c "
        INSERT INTO gdpr_anonymization_log (user_id, method)
        VALUES (${user_id}, 'automated')
        RETURNING id;" | tr -d ' ')
    
    # Get affected backups
    local affected_backups=()
    while IFS= read -r backup_file; do
        affected_backups+=("${backup_file}")
    done < <(aws s3 ls "s3://${S3_BUCKET}/full/" --recursive | awk '{print $4}')
    
    # Create anonymization SQL
    local anonymization_sql="/tmp/anonymize_${user_id}_${anonymization_id}.sql"
    cat > "${anonymization_sql}" << EOF
-- GDPR Anonymization for User ${user_id}
-- Generated: $(date -Iseconds)
-- Anonymization ID: ${anonymization_id}

-- Update users table
UPDATE users SET
    email = 'deleted_user_${user_id}@deleted.local',
    first_name = 'DELETED',
    last_name = 'USER',
    address = NULL,
    phone = NULL,
    gdpr_anonymized_at = NOW(),
    gdpr_anonymization_token = '${anonymization_token}'
WHERE id = ${user_id};

-- Update user preferences
UPDATE user_preferences SET
    preferences = jsonb_set(
        jsonb_set(preferences, '{email_notifications}', 'false'),
        '{marketing_emails}', 'false'
    )
WHERE user_id = ${user_id};

-- Anonymize audit logs (keep structure, remove PII)
UPDATE audit_logs SET
    user_email = 'deleted_user_${user_id}@deleted.local',
    metadata = jsonb_set(
        metadata, 
        '{original_email}', 
        to_jsonb('${user_info}')
    )
WHERE user_id = ${user_id};

-- Anonymize transactions (keep financial data, remove personal identifiers)
UPDATE transactions SET
    user_email = 'deleted_user_${user_id}@deleted.local',
    billing_address = NULL
WHERE user_id = ${user_id};

-- Add anonymization watermark
INSERT INTO gdpr_anonymization_watermarks (user_id, anonymization_date, token, backup_identifier)
VALUES (${user_id}, NOW(), '${anonymization_token}', :backup_identifier);
EOF
    
    # Apply anonymization to each backup
    local success_count=0
    local error_count=0
    
    for backup_file in "${affected_backups[@]}"; do
        log "INFO" "Processing backup: ${backup_file}"
        
        # Create temporary database for this backup
        local temp_db="gdpr_anon_${user_id}_$(date +%s)"
        
        if ! "${SCRIPT_DIR}/restore.sh" "${backup_file}" "${temp_db}" "" "true"; then
            log "ERROR" "Failed to restore backup ${backup_file}"
            ((error_count++))
            continue
        fi
        
        # Apply anonymization
        local temp_connection="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${temp_db}"
        
        if ! PGPASSWORD=${DB_PASSWORD} psql -h "${DB_HOST}" -U "${DB_USER}" -d "${temp_db}" -v "backup_identifier=${backup_file}" -f "${anonymization_sql}"; then
            log "ERROR" "Failed to apply anonymization to ${backup_file}"
            psql "${DB_CONNECTION_STRING}" -c "DROP DATABASE IF EXISTS ${temp_db};" 2>/dev/null || true
            ((error_count++))
            continue
        fi
        
        # Verify anonymization
        if ! verify_anonymization "${temp_connection}" "${user_id}"; then
            log "ERROR" "Anonymization verification failed for ${backup_file}"
            psql "${DB_CONNECTION_STRING}" -c "DROP DATABASE IF EXISTS ${temp_db};" 2>/dev/null || true
            ((error_count++))
            continue
        fi
        
        # Create new backup with anonymized data
        local new_backup_file="${backup_file%.gpg}_anon_${anonymization_token}.gpg"
        
        if ! create_anonymized_backup "${temp_db}" "${new_backup_file}"; then
            log "ERROR" "Failed to create anonymized backup for ${backup_file}"
            psql "${DB_CONNECTION_STRING}" -c "DROP DATABASE IF EXISTS ${temp_db};" 2>/dev/null || true
            ((error_count++))
            continue
        fi
        
        # Cleanup temporary database
        psql "${DB_CONNECTION_STRING}" -c "DROP DATABASE IF EXISTS ${temp_db};" 2>/dev/null || true
        
        ((success_count++))
        log "INFO" "Successfully anonymized backup: ${backup_file}"
    done
    
    # Update anonymization log
    psql "${DB_CONNECTION_STRING}" -c "
        UPDATE gdpr_anonymization_log 
        SET 
            backup_version = 'multiple',
            affected_backups = ARRAY[${(printf "'%s'," "${affected_backups[@]}")%?}],
            anonymized_fields = ARRAY['email', 'first_name', 'last_name', 'address', 'phone'],
            verification_status = CASE WHEN ${error_count} = 0 THEN 'completed' ELSE 'partial' END,
            completed_at = NOW()
        WHERE id = ${anonymization_id};"
    
    # Cleanup
    rm -f "${anonymization_sql}"
    
    log "INFO" "Anonymization completed for user ${user_id}: ${success_count} successful, ${error_count} errors"
    
    return ${error_count}
}

verify_anonymization() {
    local temp_connection="$1"
    local user_id="$2"
    
    log "INFO" "Verifying anonymization for user ${user_id}"
    
    # Check email is anonymized
    local email=$(psql "${temp_connection}" -t -c "SELECT email FROM users WHERE id = ${user_id};" 2>/dev/null || echo "")
    if [[ ! "${email}" =~ deleted_user_[0-9]+@deleted\.local ]]; then
        log "ERROR" "Email not properly anonymized: ${email}"
        return 1
    fi
    
    # Check names are anonymized
    local first_name=$(psql "${temp_connection}" -t -c "SELECT first_name FROM users WHERE id = ${user_id};" 2>/dev/null || echo "")
    local last_name=$(psql "${temp_connection}" -t -c "SELECT last_name FROM users WHERE id = ${user_id};" 2>/dev/null || echo "")
    
    if [[ "${first_name}" != "DELETED" ]] || [[ "${last_name}" != "USER" ]]; then
        log "ERROR" "Names not properly anonymized: ${first_name} ${last_name}"
        return 1
    fi
    
    # Check PII fields are null
    local address=$(psql "${temp_connection}" -t -c "SELECT address FROM users WHERE id = ${user_id};" 2>/dev/null || echo "")
    if [[ -n "${address}" ]]; then
        log "ERROR" "Address not nullified: ${address}"
        return 1
    fi
    
    log "INFO" "Anonymization verification passed for user ${user_id}"
    return 0
}

create_anonymized_backup() {
    local temp_db="$1"
    local new_backup_file="$2"
    
    log "INFO" "Creating anonymized backup: ${new_backup_file}"
    
    local temp_connection="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${temp_db}"
    
    # Create backup
    local temp_backup_file="/tmp/temp_anon_backup_$(date +%s).sql"
    
    if ! pg_dump "${temp_connection}" \
        --format=custom \
        --compress=9 \
        --verbose \
        --file="${temp_backup_file}"; then
        rm -f "${temp_backup_file}"
        return 1
    fi
    
    # Encrypt backup
    local encrypted_file="${temp_backup_file}.gpg"
    
    if ! gpg --batch --yes \
        --passphrase-file "${SCRIPT_DIR}/.backup-key" \
        --symmetric \
        --cipher-algo AES256 \
        --output "${encrypted_file}" \
        "${temp_backup_file}"; then
        rm -f "${temp_backup_file}" "${encrypted_file}"
        return 1
    fi
    
    # Upload to S3
    if ! aws s3 cp "${encrypted_file}" "s3://${S3_BUCKET}/${new_backup_file}" \
        --server-side-encryption AES256; then
        rm -f "${temp_backup_file}" "${encrypted_file}"
        return 1
    fi
    
    # Cleanup
    rm -f "${temp_backup_file}" "${encrypted_file}"
    
    log "INFO" "Anonymized backup created successfully: ${new_backup_file}"
    return 0
}

# Main execution
main() {
    local user_id="$1"
    
    if [[ -z "${user_id}" ]]; then
        echo "Usage: $0 <user_id>"
        exit 1
    fi
    
    mkdir -p "$(dirname "${LOG_FILE}")"
    
    log "INFO" "Starting GDPR anonymization for user ${user_id}"
    
    if anonymize_user_in_backups "${user_id}"; then
        log "INFO" "GDPR anonymization completed successfully"
        exit 0
    else
        log "ERROR" "GDPR anonymization failed"
        exit 1
    fi
}

main "$@"
```

## Compliance Monitoring

### Daily Compliance Report
```sql
-- GDPR Compliance Dashboard
SELECT 
    COUNT(*) as total_deletion_requests,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
    AVG(EXTRACT(EPOCH FROM (completed_at - request_date))/3600) as avg_completion_hours,
    COUNT(CASE WHEN backup_anonymization_required = true THEN 1 END) as backup_anonymization_required,
    COUNT(CASE WHEN verification_status = 'completed' THEN 1 END) as verification_completed
FROM gdpr_deletion_requests 
WHERE request_date >= CURRENT_DATE - INTERVAL '30 days';
```

### Automated Compliance Checks
```bash
#!/bin/bash
# Daily GDPR compliance check
check_gdpr_compliance() {
    local pending_requests=$(psql "${DB_CONNECTION_STRING}" -t -c "
        SELECT COUNT(*) FROM gdpr_deletion_requests 
        WHERE status = 'pending' AND request_date < NOW() - INTERVAL '7 days';")
    
    if [[ "${pending_requests}" -gt 0 ]]; then
        send_alert "GDPR: ${pending_requests} deletion requests pending > 7 days"
    fi
    
    local incomplete_anonymization=$(psql "${DB_CONNECTION_STRING}" -t -c "
        SELECT COUNT(*) FROM gdpr_anonymization_log 
        WHERE verification_status != 'completed' AND anonymization_date < NOW() - INTERVAL '3 days';")
    
    if [[ "${incomplete_anonymization}" -gt 0 ]]; then
        send_alert "GDPR: ${incomplete_anonymization} anonymizations incomplete > 3 days"
    fi
}
```

## Documentation Requirements

### Records of Processing Activities
- **Purpose**: Backup and disaster recovery
- **Legal Basis**: Legitimate interest (Article 6(1)(f))
- **Data Categories**: Personal data in backup systems
- **Retention Period**: Up to 7 years with anonymization
- **Recipients**: Cloud storage providers, disaster recovery teams
- **International Transfers**: Documented SCCs in place

### Data Protection Impact Assessment (DPIA)
- **Risk Assessment**: Low risk with anonymization measures
- **Mitigation Measures**: Automated anonymization, encryption, access controls
- **Review Schedule**: Annual review or after significant changes

## Incident Response

### GDPR Breach Procedure
1. **Detection**: Automated monitoring for anonymization failures
2. **Assessment**: Impact evaluation within 72 hours
3. **Notification**: Supervisory authority notification if required
4. **Communication**: Individual notification if high risk
5. **Remediation**: Corrective actions and process improvements

### Backup Restoration with GDPR Considerations
```bash
# Enhanced restore script with GDPR checks
restore_with_gdpr_check() {
    local backup_file="$1"
    local target_db="$2"
    
    # Check for GDPR restrictions
    local restricted_users=$(psql "${DB_CONNECTION_STRING}" -t -c "
        SELECT user_id FROM gdpr_deletion_requests 
        WHERE status = 'completed' AND completed_at > 
            (SELECT backup_date FROM backup_metadata WHERE backup_file = '${backup_file}');")
    
    if [[ -n "${restricted_users}" ]]; then
        log "WARN" "Restoring backup with GDPR-restricted users: ${restricted_users}"
        
        # Apply post-restore anonymization
        apply_post_restore_anonymization "${target_db}" "${restricted_users}"
    fi
}
```

## Best Practices

### 1. Proactive Anonymization
- Process deletion requests within 30 days
- Automate backup anonymization pipeline
- Maintain comprehensive audit trails

### 2. Documentation
- Keep detailed logs of all anonymization activities
- Document retention periods and legal bases
- Maintain up-to-date DPIA documentation

### 3. Monitoring
- Daily compliance checks
- Monthly compliance reports
- Quarterly process reviews

### 4. Testing
- Regular testing of anonymization procedures
- Validation of restore processes with GDPR constraints
- Incident response drills

## Conclusion

This GDPR-compliant backup system ensures:
- **Right to Erasure**: Immediate deletion in production with backup anonymization
- **Data Minimization**: Only necessary data retained with proper anonymization
- **Accountability**: Comprehensive logging and monitoring
- **Security**: Encryption and access controls throughout the process

Regular reviews and updates of this process ensure continued compliance with evolving GDPR requirements and organizational needs.
