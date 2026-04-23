# Uploads & Validation - Operational Runbook

## Overview
This runbook provides operational procedures for troubleshooting and managing the uploads module in the Tycoon backend. It covers common issues, monitoring, maintenance, and emergency procedures.

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Monitoring & Alerting](#monitoring--alerting)
3. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
4. [Maintenance Procedures](#maintenance-procedures)
5. [Emergency Procedures](#emergency-procedures)
6. [Performance Optimization](#performance-optimization)
7. [Security Procedures](#security-procedures)

## System Architecture

### Components
- **UploadsController**: HTTP endpoints for file uploads
- **UploadsService**: Core business logic for file storage
- **VirusScanService**: Malware scanning integration
- **Storage Backends**: S3 (primary) and local disk (fallback)

### Storage Flow
```
Client Upload -> Validation -> Virus Scan -> Storage -> Signed URL Generation
```

### Key Metrics
- Upload success rate
- Average upload time
- Virus scan results
- Storage utilization
- Error rates by type

## Monitoring & Alerting

### Key Performance Indicators (KPIs)
- **Upload Success Rate**: Target > 99%
- **Average Upload Time**: Target < 5 seconds
- **Virus Scan Time**: Target < 2 seconds
- **Storage Utilization**: Alert at 80%, Critical at 90%

### Alert Thresholds
```yaml
alerts:
  upload_failure_rate:
    threshold: 5%
    duration: 5m
    severity: warning
  
  virus_scan_failure:
    threshold: 1%
    duration: 1m
    severity: critical
  
  storage_full:
    threshold: 90%
    duration: 1m
    severity: critical
  
  upload_latency:
    threshold: 10s
    duration: 5m
    severity: warning
```

### Log Patterns to Monitor
```bash
# Upload failures
grep "ERROR.*upload" /var/log/tycoon/backend.log

# Virus scan issues
grep "virus.*scan.*failed" /var/log/tycoon/backend.log

# Storage issues
grep "storage.*error" /var/log/tycoon/backend.log

# S3 connectivity issues
grep "S3.*connection" /var/log/tycoon/backend.log
```

## Common Issues & Troubleshooting

### Issue 1: Upload Failures - File Size Exceeded
**Symptoms:**
- HTTP 413 responses
- "File too large" error messages
- Client-side upload timeouts

**Troubleshooting Steps:**
1. Check current file size limits:
   ```bash
   grep MAX_FILE_SIZE src/modules/uploads/uploads.controller.ts
   ```

2. Verify nginx/upload limits:
   ```bash
   grep client_max_body_size /etc/nginx/nginx.conf
   ```

3. Check application logs:
   ```bash
   grep "file.*size" /var/log/tycoon/backend.log | tail -20
   ```

**Resolution:**
- Adjust MAX_FILE_SIZE in uploads controller
- Update nginx client_max_body_size
- Restart services if needed

### Issue 2: Virus Scan Failures
**Symptoms:**
- Uploads stuck in "scanning" state
- "Virus scan failed" error messages
- High scan latency

**Troubleshooting Steps:**
1. Check virus scan service status:
   ```bash
   systemctl status clamav-daemon
   ```

2. Test virus scanner:
   ```bash
   clamscan --version
   echo "EICAR" | clamscan -
   ```

3. Check scan logs:
   ```bash
   grep "virus.*scan" /var/log/tycoon/backend.log | tail -20
   ```

**Resolution:**
- Restart clamav service: `systemctl restart clamav-daemon`
- Update virus definitions: `freshclam`
- Check scan service connectivity

### Issue 3: S3 Storage Issues
**Symptoms:**
- Upload failures with S3 errors
- Signed URL generation failures
- Storage backend errors

**Troubleshooting Steps:**
1. Check S3 connectivity:
   ```bash
   aws s3 ls s3://your-bucket-name
   ```

2. Verify credentials:
   ```bash
   aws sts get-caller-identity
   ```

3. Check S3 permissions:
   ```bash
   aws s3api get-bucket-policy --bucket your-bucket-name
   ```

4. Review application logs:
   ```bash
   grep "S3.*error" /var/log/tycoon/backend.log | tail -20
   ```

**Resolution:**
- Update AWS credentials
- Verify S3 bucket permissions
- Check network connectivity to AWS

### Issue 4: Local Storage Full
**Symptoms:**
- Upload failures with "no space left"
- Local storage fallback errors
- Disk space alerts

**Troubleshooting Steps:**
1. Check disk usage:
   ```bash
   df -h /storage/uploads
   du -sh /storage/uploads/*
   ```

2. Find large files:
   ```bash
   find /storage/uploads -type f -size +100M -ls
   ```

3. Check cleanup processes:
   ```bash
   ps aux | grep cleanup
   ```

**Resolution:**
- Implement cleanup script
- Move old files to cold storage
- Add monitoring for disk usage

### Issue 5: Memory Leaks During Upload
**Symptoms:**
- Memory usage increasing during uploads
- OOM killer events
- Slow performance

**Troubleshooting Steps:**
1. Monitor memory usage:
   ```bash
   top -p $(pgrep node)
   ```

2. Check for memory leaks:
   ```bash
   node --inspect src/main.js
   # Use Chrome DevTools to analyze
   ```

3. Review upload handling code:
   ```bash
   grep "buffer" src/modules/uploads/uploads.service.ts
   ```

**Resolution:**
- Implement streaming uploads
- Add memory limits
- Optimize buffer handling

## Maintenance Procedures

### Daily Maintenance
1. **Log Rotation**: Check log file sizes and rotate if needed
2. **Disk Space**: Monitor storage usage
3. **Performance**: Check upload metrics
4. **Security**: Review access logs for suspicious activity

### Weekly Maintenance
1. **Virus Definitions**: Update malware signatures
2. **Cleanup**: Remove old temporary files
3. **Backup**: Verify backup procedures
4. **Performance**: Analyze upload trends

### Monthly Maintenance
1. **Storage Review**: Analyze storage growth patterns
2. **Security Audit**: Review access permissions
3. **Performance Tuning**: Optimize based on metrics
4. **Documentation**: Update runbooks with new procedures

### Cleanup Script Example
```bash
#!/bin/bash
# cleanup-uploads.sh

# Remove files older than 30 days
find /storage/uploads -type f -mtime +30 -delete

# Remove empty directories
find /storage/uploads -type d -empty -delete

# Log cleanup activity
echo "$(date): Cleanup completed" >> /var/log/uploads-cleanup.log
```

## Emergency Procedures

### Emergency 1: Complete Upload Failure
**Impact**: High - Users cannot upload files

**Immediate Actions:**
1. Check service status:
   ```bash
   systemctl status tycoon-backend
   ```

2. Verify recent deployments:
   ```bash
   git log --oneline -5
   ```

3. Check error logs:
   ```bash
   tail -100 /var/log/tycoon/backend.log | grep ERROR
   ```

4. Verify storage connectivity:
   ```bash
   ping s3.amazonaws.com
   ```

**Escalation Path:**
- Level 1: Restart backend service
- Level 2: Rollback to previous deployment
- Level 3: Engage infrastructure team

### Emergency 2: Security Incident
**Impact**: Critical - Potential malware upload

**Immediate Actions:**
1. Isolate affected files:
   ```bash
   quarantine-file.sh /storage/uploads/suspicious-file
   ```

2. Scan all recent uploads:
   ```bash
   find /storage/uploads -mtime -1 -type f -exec clamscan {} \;
   ```

3. Review access logs:
   ```bash
   grep "POST.*uploads" /var/log/nginx/access.log | tail -100
   ```

4. Notify security team immediately

**Escalation Path:**
- Level 1: Quarantine suspicious files
- Level 2: Disable upload endpoint temporarily
- Level 3: Full security incident response

### Emergency 3: Storage Corruption
**Impact**: High - Data loss potential

**Immediate Actions:**
1. Stop upload service:
   ```bash
   systemctl stop tycoon-backend
   ```

2. Verify backup integrity:
   ```bash
   aws s3 ls s3://backup-bucket/$(date +%Y-%m-%d)/
   ```

3. Check file system:
   ```bash
   fsck -f /dev/sda1
   ```

4. Restore from backup if needed

**Escalation Path:**
- Level 1: Stop service and assess damage
- Level 2: Restore from recent backup
- Level 3: Engage storage team for recovery

## Performance Optimization

### Upload Optimization
1. **Parallel Processing**: Implement concurrent virus scans
2. **Caching**: Cache signed URLs for repeated access
3. **Compression**: Compress files before storage
4. **CDN**: Use CDN for file delivery

### Monitoring Optimization
1. **Metrics Collection**: Add detailed performance metrics
2. **Alert Tuning**: Reduce false positives
3. **Dashboard**: Create operations dashboard
4. **Automation**: Automate routine checks

### Code Optimization
```typescript
// Example: Streaming upload implementation
async storeStream(stream: Readable, filename: string): Promise<StoredFile> {
  const passThrough = new PassThrough();
  
  // Pipe stream to both virus scan and storage
  stream.pipe(passThrough);
  
  const [scanResult, storageResult] = await Promise.all([
    this.virusScan.scanStream(passThrough),
    this.storage.storeStream(passThrough, filename)
  ]);
  
  return storageResult;
}
```

## Security Procedures

### Access Control
1. **IAM Roles**: Use least-privilege access
2. **Network Security**: Implement VPC endpoints
3. **Encryption**: Encrypt data at rest and in transit
4. **Audit Logging**: Log all access attempts

### Malware Protection
1. **Real-time Scanning**: Scan all uploads immediately
2. **Quarantine**: Isolate suspicious files
3. **Regular Updates**: Keep virus definitions current
4. **Multiple Engines**: Use multiple antivirus engines

### Data Protection
1. **Retention Policies**: Define data retention periods
2. **Secure Deletion**: Ensure secure file deletion
3. **Backup Encryption**: Encrypt backup data
4. **Access Audits**: Regular access reviews

### Security Checklist
```bash
# Daily security checks
checklist:
  - review access logs
  - verify virus definitions
  - check for unusual upload patterns
  - validate storage permissions
  - monitor failed login attempts
```

## Contact Information

### Primary Contacts
- **Backend Team**: backend-team@company.com
- **Infrastructure**: infra-team@company.com
- **Security**: security@company.com

### Escalation Contacts
- **On-call Engineer**: +1-555-0123
- **Engineering Manager**: +1-555-0124
- **CTO**: +1-555-0125

### External Services
- **AWS Support**: 1-800-AWS-SUPPORT
- **ClamAV Support**: support@clamav.net
- **S3 Support**: Through AWS Console

## Runbook Version History
- v1.0: Initial version
- v1.1: Added S3 troubleshooting
- v1.2: Added security procedures
- v1.3: Added performance optimization

Last updated: 2024-01-15
Next review: 2024-02-15
