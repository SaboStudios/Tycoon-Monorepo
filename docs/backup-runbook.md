# Tycoon Backend - Backup and Restore Runbook

## Overview

This runbook provides comprehensive procedures for managing the Tycoon backend backup and restore system. It includes automated procedures, manual interventions, troubleshooting steps, and emergency response protocols.

**Last Drill Date**: 2024-03-28 (Recorded in `.drill-state`)
**System Version**: 1.0.0
**Document Version**: 1.0

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Daily Operations](#daily-operations)
3. [Backup Procedures](#backup-procedures)
4. [Restore Procedures](#restore-procedures)
5. [Quarterly Drill Procedures](#quarterly-drill-procedures)
6. [Emergency Procedures](#emergency-procedures)
7. [Troubleshooting](#troubleshooting)
8. [Monitoring and Alerting](#monitoring-and-alerting)
9. [GDPR Compliance](#gdpr-compliance)
10. [Maintenance and Updates](#maintenance-and-updates)

## System Architecture

### Components
- **Primary Database**: PostgreSQL with TypeORM
- **Backup Storage**: AWS S3 with lifecycle policies
- **WAL Archiving**: WAL-G for point-in-time recovery
- **Encryption**: AES-256 at rest and in transit
- **Automation**: Custom shell scripts with cron scheduling

### Backup Types
- **Full Backups**: Daily at 2:00 AM UTC
- **Differential Backups**: Every 6 hours
- **WAL Archives**: Continuous
- **Retention**: 30 days PITR, 7 years yearly

### Key Files
- `/scripts/backup.sh` - Main backup automation
- `/scripts/restore.sh` - Restore procedures
- `/scripts/retention-policy.sh` - Retention management
- `/scripts/restore-test.sh` - Testing framework
- `/scripts/quarterly-drill.sh` - DR drill automation

## Daily Operations

### Morning Checklist (8:00 AM UTC)
```bash
# 1. Check backup status
./scripts/backup.sh status

# 2. Verify overnight backups
aws s3 ls "s3://tycoon-backups/full/$(date +%Y%m%d)/"

# 3. Check system health
psql "${DB_CONNECTION_STRING}" -c "SELECT 1;"

# 4. Review logs
tail -100 /var/log/tycoon/backup-$(date +%Y%m%d).log
```

### Daily Health Checks
```bash
#!/bin/bash
# Daily backup health check script
check_backup_health() {
    local today=$(date +%Y%m%d)
    local errors=0
    
    # Check if today's backup exists
    if ! aws s3 ls "s3://tycoon-backups/full/${today}/" | grep -q "full_backup"; then
        echo "ERROR: Today's full backup missing"
        ((errors++))
    fi
    
    # Check backup size
    local backup_size=$(aws s3 ls "s3://tycoon-backups/full/${today}/" --recursive --human-readable | awk '{sum+=$3} END {print sum}')
    if [[ "${backup_size}" -lt 100 ]]; then  # Less than 100MB seems suspicious
        echo "WARN: Backup size seems small: ${backup_size}"
    fi
    
    # Check database connectivity
    if ! psql "${DB_CONNECTION_STRING}" -c "SELECT 1;" &> /dev/null; then
        echo "ERROR: Database connection failed"
        ((errors++))
    fi
    
    # Check WAL archiving
    local wal_count=$(aws s3 ls "s3://tycoon-backups/wal-g/" --recursive | wc -l)
    if [[ "${wal_count}" -lt 10 ]]; then
        echo "WARN: Low WAL count: ${wal_count}"
    fi
    
    return ${errors}
}
```

### Log Review
```bash
# Review backup logs for issues
grep -i "error\|warn\|failed" /var/log/tycoon/backup-$(date +%Y%m%d).log

# Check retention policy execution
grep -i "retention" /var/log/tycoon/retention-$(date +%Y%m%d).log

# Monitor storage usage
aws s3 ls "s3://tycoon-backups/" --recursive --human-readable --summarize | tail -3
```

## Backup Procedures

### Manual Full Backup
```bash
# Execute manual full backup
./scripts/backup.sh full

# Verify backup completion
aws s3 ls "s3://tycoon-backups/full/$(date +%Y%m%d)/" | grep "full_backup"

# Check backup integrity
./scripts/backup.sh verify latest
```

### Manual Differential Backup
```bash
# Execute manual differential backup
./scripts/backup.sh differential

# Verify differential backup
aws s3 ls "s3://tycoon-backups/differential/$(date +%Y%m%d)/"
```

### Emergency Backup
```bash
# Emergency backup procedure
emergency_backup() {
    local emergency_dir="/tmp/emergency_backup_$(date +%s)"
    mkdir -p "${emergency_dir}"
    
    # Create immediate backup
    pg_dump "${DB_CONNECTION_STRING}" \
        --format=custom \
        --compress=9 \
        --file="${emergency_dir}/emergency_backup.sql"
    
    # Encrypt immediately
    gpg --batch --yes \
        --passphrase-file "/scripts/.emergency-key" \
        --symmetric \
        --cipher-algo AES256 \
        --output="${emergency_dir}/emergency_backup.sql.gpg" \
        "${emergency_dir}/emergency_backup.sql"
    
    # Upload to emergency location
    aws s3 cp "${emergency_dir}/emergency_backup.sql.gpg" \
        "s3://tycoon-backups/emergency/emergency_$(date +%Y%m%d_%H%M%S).sql.gpg"
    
    # Cleanup
    rm -rf "${emergency_dir}"
    
    echo "Emergency backup completed"
}
```

## Restore Procedures

### Full Database Restore
```bash
# 1. Identify backup to restore
aws s3 ls "s3://tycoon-backups/full/" --recursive | sort -r | head -5

# 2. Execute restore
./scripts/restore.sh "full/2024/03/28/full_backup_20240328_020000.sql.gpg" "tycoon_restore_test"

# 3. Verify restore
psql "postgresql://postgres:postgres@localhost:5432/tycoon_restore_test" -c "\dt"

# 4. Validate data integrity
./scripts/restore-test.sh integration
```

### Point-in-Time Restore
```bash
# 1. Identify base backup
base_backup=$(aws s3 ls "s3://tycoon-backups/full/" --recursive | sort -r | head -1 | awk '{print $4}')

# 2. Execute PITR restore
./scripts/restore.sh "${base_backup}" "tycoon_pitr_test" "2024-03-28 10:30:00 UTC"

# 3. Verify point-in-time accuracy
psql "postgresql://postgres:postgres@localhost:5432/tycoon_pitr_test" -c "
    SELECT MAX(updated_at) FROM audit_logs 
    WHERE updated_at <= '2024-03-28 10:30:00 UTC';"
```

### Application-Specific Restore
```bash
# Restore specific tables only
restore_specific_tables() {
    local backup_file="$1"
    local target_db="$2"
    local tables="$3"  # Comma-separated list
    
    # Create temporary database
    local temp_db="temp_restore_$(date +%s)"
    ./scripts/restore.sh "${backup_file}" "${temp_db}" "" "true"
    
    # Extract specific tables
    for table in $(echo "${tables}" | tr ',' ' '); do
        pg_dump "postgresql://postgres:postgres@localhost:5432/${temp_db}" \
            --table="${table}" \
            --file="/tmp/${table}_restore.sql"
        
        psql "postgresql://postgres:postgres@localhost:5432/${target_db}" \
            -f "/tmp/${table}_restore.sql"
    done
    
    # Cleanup
    psql "${DB_CONNECTION_STRING}" -c "DROP DATABASE IF EXISTS ${temp_db};"
    rm -f /tmp/*_restore.sql
}
```

## Quarterly Drill Procedures

### Scheduled Drill Execution
```bash
# 1. Check if drill is due
./scripts/quarterly-drill.sh schedule

# 2. Execute drill manually
./scripts/quarterly-drill.sh execute

# 3. Review drill results
./scripts/quarterly-drill.sh report

# 4. Update documentation
vim docs/backup-runbook.md
```

### Manual Drill Execution
```bash
# Execute full drill suite
execute_full_drill() {
    local drill_id="manual_drill_$(date +%Y%m%d_%H%M%S)"
    
    echo "Starting manual drill: ${drill_id}"
    
    # Phase 1: Full Restore Test
    echo "Phase 1: Full Restore Test"
    ./scripts/restore-test.sh full recent
    
    # Phase 2: PITR Test
    echo "Phase 2: PITR Test"
    ./scripts/restore-test.sh pitr recent
    
    # Phase 3: Integration Test
    echo "Phase 3: Integration Test"
    ./scripts/restore-test.sh integration
    
    # Phase 4: Performance Test
    echo "Phase 4: Performance Test"
    ./scripts/restore-test.sh performance
    
    # Generate report
    echo "Generating drill report..."
    ./scripts/quarterly-drill.sh report
    
    echo "Manual drill completed: ${drill_id}"
}
```

### Drill Validation Checklist
- [ ] Full restore completes within 4 hours
- [ ] PITR restore completes within 4 hours
- [ ] Application connectivity restored
- [ ] Data integrity validated
- [ ] Performance within acceptable thresholds
- [ ] Security controls validated
- [ ] GDPR compliance verified
- [ ] Documentation updated

## Emergency Procedures

### Database Corruption Response
```bash
# 1. Immediate assessment
assess_database_status() {
    echo "Checking database status..."
    
    # Check database connectivity
    if ! psql "${DB_CONNECTION_STRING}" -c "SELECT 1;" &> /dev/null; then
        echo "CRITICAL: Database not accessible"
        return 1
    fi
    
    # Check table integrity
    local corrupted_tables=$(psql "${DB_CONNECTION_STRING}" -t -c "
        SELECT schemaname||'.'||tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND has_table_privilege(schemaname||'.'||tablename, 'SELECT')
        EXCEPT 
        SELECT schemaname||'.'||tablename 
        FROM pg_stat_user_tables;")
    
    if [[ -n "${corrupted_tables}" ]]; then
        echo "WARNING: Potentially corrupted tables: ${corrupted_tables}"
        return 2
    fi
    
    echo "Database appears healthy"
    return 0
}

# 2. Emergency restore
emergency_restore() {
    local recent_backup=$(aws s3 ls "s3://tycoon-backups/full/" --recursive | sort -r | head -1 | awk '{print $4}')
    local emergency_db="tycoon_emergency_$(date +%Y%m%d_%H%M%S)"
    
    echo "Executing emergency restore from: ${recent_backup}"
    
    # Stop application
    sudo systemctl stop tycoon-backend || true
    
    # Execute restore
    if ./scripts/restore.sh "${recent_backup}" "${emergency_db}"; then
        echo "Emergency restore successful"
        
        # Switch databases (requires application downtime)
        psql "${DB_CONNECTION_STRING}" -c "ALTER DATABASE tycoon_db RENAME TO tycoon_db_corrupted_$(date +%Y%m%d);"
        psql "${DB_CONNECTION_STRING}" -c "ALTER DATABASE ${emergency_db} RENAME TO tycoon_db;"
        
        # Start application
        sudo systemctl start tycoon-backend
        
        echo "Emergency restore completed, application restarted"
    else
        echo "CRITICAL: Emergency restore failed"
        return 1
    fi
}
```

### Storage Failure Response
```bash
# 1. Assess storage status
assess_storage_status() {
    echo "Checking storage status..."
    
    # Check S3 bucket accessibility
    if ! aws s3 ls "s3://tycoon-backups/" &> /dev/null; then
        echo "CRITICAL: S3 bucket not accessible"
        return 1
    fi
    
    # Check local storage
    local local_space=$(df -h /var/backups | awk 'NR==2 {print $5}' | sed 's/%//')
    if [[ "${local_space}" -gt 90 ]]; then
        echo "WARNING: Local storage usage high: ${local_space}%"
    fi
    
    # Check backup availability
    local recent_backups=$(aws s3 ls "s3://tycoon-backups/full/" --recursive | grep "$(date +%Y%m%d)" | wc -l)
    if [[ "${recent_backups}" -eq 0 ]]; then
        echo "WARNING: No recent backups found"
        return 2
    fi
    
    echo "Storage status healthy"
    return 0
}

# 2. Emergency backup to alternative location
emergency_backup_alternative() {
    local alt_bucket="tycoon-backups-emergency"
    local emergency_backup="/tmp/emergency_alt_$(date +%s).sql"
    
    echo "Creating emergency backup to alternative location..."
    
    # Create backup
    pg_dump "${DB_CONNECTION_STRING}" \
        --format=custom \
        --compress=9 \
        --file="${emergency_backup}"
    
    # Upload to alternative location
    aws s3 cp "${emergency_backup}" "s3://${alt_bucket}/emergency_$(date +%Y%m%d_%H%M%S).sql"
    
    # Cleanup
    rm -f "${emergency_backup}"
    
    echo "Emergency backup created to alternative location"
}
```

## Troubleshooting

### Common Issues and Solutions

#### Backup Failures
```bash
# Issue: Backup script fails with permission error
# Solution: Check database permissions and script ownership
sudo chown postgres:postgres /scripts/backup.sh
sudo chmod 750 /scripts/backup.sh

# Issue: S3 upload fails
# Solution: Check AWS credentials and bucket permissions
aws sts get-caller-identity
aws s3 ls "s3://tycoon-backups/"

# Issue: Encryption fails
# Solution: Verify encryption key file exists and is readable
ls -la /scripts/.backup-key
file /scripts/.backup-key
```

#### Restore Failures
```bash
# Issue: Restore fails with "database already exists"
# Solution: Drop existing database or use different name
psql "${DB_CONNECTION_STRING}" -c "DROP DATABASE IF EXISTS target_db;"

# Issue: Restore fails with decryption error
# Solution: Verify encryption key and backup integrity
gpg --batch --yes --passphrase-file /scripts/.backup-key --decrypt backup_file.sql.gpg --output test.sql

# Issue: Restore fails with constraint violation
# Solution: Restore without constraints, then fix data
pg_restore --no-owner --no-privileges --disable-triggers backup_file.sql
```

#### Performance Issues
```bash
# Issue: Slow backup performance
# Solution: Increase parallel jobs and optimize settings
export PGDUMP_OPTS="--jobs=8 --compress=9"
./scripts/backup.sh full

# Issue: Slow restore performance
# Solution: Increase restore parallelism
pg_restore --jobs=8 --verbose backup_file.sql

# Issue: Storage space issues
# Solution: Cleanup old backups and compress
./scripts/retention-policy.sh cleanup
```

### Diagnostic Commands
```bash
# Check database size and usage
psql "${DB_CONNECTION_STRING}" -c "
    SELECT 
        pg_database_size(current_database()) as db_size,
        (SELECT COUNT(*) FROM users) as user_count,
        (SELECT COUNT(*) FROM games) as game_count;"

# Check backup file integrity
check_backup_integrity() {
    local backup_file="$1"
    
    # Download and decrypt
    aws s3 cp "s3://tycoon-backups/${backup_file}" /tmp/backup_check.sql.gpg
    gpg --batch --yes --passphrase-file /scripts/.backup-key \
        --decrypt /tmp/backup_check.sql.gpg --output /tmp/backup_check.sql
    
    # Validate backup format
    if pg_restore --list /tmp/backup_check.sql &> /dev/null; then
        echo "Backup integrity: PASSED"
    else
        echo "Backup integrity: FAILED"
    fi
    
    # Cleanup
    rm -f /tmp/backup_check.sql*
}

# Check WAL archiving status
check_wal_status() {
    echo "WAL archiving status:"
    wal-g backup-list 2>/dev/null || echo "WAL-G not configured"
    
    echo "Recent WAL files:"
    aws s3 ls "s3://tycoon-backups/wal-g/" --recursive | tail -5
}
```

## Monitoring and Alerting

### Key Metrics to Monitor
```bash
# Backup success rate
backup_success_rate() {
    local total_backups=$(aws s3 ls "s3://tycoon-backups/full/" --recursive | grep "$(date +%Y%m)" | wc -l)
    local successful_backups=$(grep "completed successfully" /var/log/tycoon/backup-$(date +%Y%m)*.log | wc -l)
    
    if [[ "${total_backups}" -gt 0 ]]; then
        echo "Backup success rate: $((successful_backups * 100 / total_backups))%"
    else
        echo "No backups found this month"
    fi
}

# Storage utilization
storage_utilization() {
    echo "S3 storage usage:"
    aws s3 ls "s3://tycoon-backups/" --recursive --human-readable --summarize | tail -3
    
    echo "Local storage usage:"
    df -h /var/backups
}

# Restore performance trends
restore_performance_trends() {
    echo "Recent restore performance:"
    grep "restore completed" /var/log/tycoon/restore-$(date +%Y%m)*.log | \
        tail -10 | \
        awk '{print $NF}' | \
        sed 's/seconds//' | \
        awk '{sum+=$1; count++} END {print "Average:", sum/count, "seconds"}'
}
```

### Alert Thresholds
- **Backup Failure**: Immediate alert
- **Storage > 80%**: Warning alert
- **Restore > 4 hours**: Critical alert
- **WAL archiving gap > 1 hour**: Warning alert
- **GDPR deletion pending > 7 days**: Critical alert

## GDPR Compliance

### Deletion Request Processing
```bash
# Process GDPR deletion request
process_gdpr_deletion() {
    local user_id="$1"
    local requester="$2"
    
    echo "Processing GDPR deletion for user ${user_id}"
    
    # 1. Log deletion request
    psql "${DB_CONNECTION_STRING}" -c "
        INSERT INTO gdpr_deletion_requests (user_id, requester, request_source, status)
        VALUES (${user_id}, '${requester}', 'runbook', 'pending');"
    
    # 2. Soft delete in production
    psql "${DB_CONNECTION_STRING}" -c "
        UPDATE users SET deleted_at = NOW() WHERE id = ${user_id};"
    
    # 3. Schedule backup anonymization
    ./scripts/gdpr-anonymize.sh "${user_id}" &
    
    # 4. Update request status
    psql "${DB_CONNECTION_STRING}" -c "
        UPDATE gdpr_deletion_requests 
        SET status = 'completed', completed_at = NOW()
        WHERE user_id = ${user_id};"
    
    echo "GDPR deletion completed for user ${user_id}"
}
```

### Compliance Verification
```bash
# Daily GDPR compliance check
check_gdpr_compliance() {
    echo "Checking GDPR compliance..."
    
    # Check pending deletion requests
    local pending_requests=$(psql "${DB_CONNECTION_STRING}" -t -c "
        SELECT COUNT(*) FROM gdpr_deletion_requests 
        WHERE status = 'pending' AND request_date < NOW() - INTERVAL '7 days';")
    
    if [[ "${pending_requests}" -gt 0 ]]; then
        echo "ALERT: ${pending_requests} deletion requests pending > 7 days"
        return 1
    fi
    
    # Check anonymization completion
    local incomplete_anonymization=$(psql "${DB_CONNECTION_STRING}" -t -c "
        SELECT COUNT(*) FROM gdpr_anonymization_log 
        WHERE verification_status != 'completed' AND anonymization_date < NOW() - INTERVAL '3 days';")
    
    if [[ "${incomplete_anonymization}" -gt 0 ]]; then
        echo "ALERT: ${incomplete_anonymization} anonymizations incomplete > 3 days"
        return 1
    fi
    
    echo "GDPR compliance: PASSED"
    return 0
}
```

## Maintenance and Updates

### Monthly Maintenance Tasks
```bash
# Monthly maintenance checklist
monthly_maintenance() {
    echo "Starting monthly maintenance..."
    
    # 1. Review backup performance
    ./scripts/retention-policy.sh report
    
    # 2. Update encryption keys (quarterly)
    if [[ $(date +%m) =~ ^(01|04|07|10)$ ]]; then
        echo "Quarterly key rotation scheduled"
        # ./scripts/rotate-encryption-keys.sh
    fi
    
    # 3. Test backup procedures
    ./scripts/restore-test.sh full recent
    
    # 4. Update documentation
    echo "Documentation review required"
    
    # 5. Security audit
    echo "Security audit checklist:"
    # - Review IAM permissions
    # - Check encryption status
    # - Validate access logs
    
    echo "Monthly maintenance completed"
}
```

### System Updates
```bash
# Update backup scripts
update_backup_scripts() {
    echo "Updating backup scripts..."
    
    # Backup current scripts
    cp -r /scripts /scripts/backup_$(date +%Y%m%d_%H%M%S)
    
    # Pull latest versions
    git pull origin main
    
    # Verify script integrity
    ./scripts/backup.sh --version
    ./scripts/restore.sh --version
    
    echo "Backup scripts updated successfully"
}
```

### Documentation Updates
- Update runbook after each drill
- Document any procedure changes
- Review quarterly for accuracy
- Maintain change log

## Emergency Contacts

### Primary Contacts
- **Database Administrator**: dba@company.com, +1-555-0101
- **DevOps Team**: devops@company.com, +1-555-0102
- **Security Team**: security@company.com, +1-555-0103

### escalation Contacts
- **CTO**: cto@company.com, +1-555-0104
- **Legal Team**: legal@company.com, +1-555-0105
- **GDPR Officer**: gdpr@company.com, +1-555-0106

### External Services
- **AWS Support**: Available 24/7
- **PostgreSQL Support**: Available during business hours
- **Security Incident Response**: security-incident@company.com

## Runbook Maintenance

### Review Schedule
- **Daily**: Morning checklist
- **Weekly**: Performance review
- **Monthly**: Maintenance tasks
- **Quarterly**: Full drill execution
- **Annually**: Complete review and update

### Change Management
1. All changes must be tested in staging
2. Document changes in change log
3. Update relevant procedures
4. Communicate changes to team
5. Schedule training if needed

### Training Requirements
- New team members: Complete runbook review
- All team members: Quarterly drill participation
- Annual refresher: Complete review and quiz

---

**Document Owner**: DevOps Team  
**Last Updated**: 2024-03-28  
**Next Review**: 2024-06-28  
**Approval**: CTO Office  

This runbook is a living document and should be updated regularly to reflect system changes, lessons learned from drills, and evolving requirements.
