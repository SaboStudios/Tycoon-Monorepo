#!/bin/bash

# =============================================================================
# Tycoon Backend - Drill Date Tracking System
# =============================================================================
# This script manages drill date tracking and reporting
# Usage: ./drill-tracking.sh [record|report|schedule|next]
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRILL_STATE_FILE="${SCRIPT_DIR}/.drill-state"
DRILL_REPORT_FILE="${SCRIPT_DIR}/drill-reports/drill-tracking-$(date +%Y).json"

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${message}"
}

# Record drill completion
record_drill() {
    local drill_status="${1:-SUCCESS}"
    local drill_duration="${2:-0}"
    local drill_message="${3:-Drill completed}"
    
    local current_quarter=$(( ($(date +%m) - 1) / 3 + 1 ))
    local current_year=$(date +%Y)
    local drill_key="${current_year}_Q${current_quarter}"
    local drill_date=$(date +%Y-%m-%d)
    local drill_id="drill_$(date +%Y%m%d_%H%M%S)"
    
    # Check if drill already exists for this quarter
    if [[ -f "${DRILL_STATE_FILE}" ]]; then
        local existing_drill=$(grep "^${drill_key}," "${DRILL_STATE_FILE}" 2>/dev/null || echo "")
        if [[ -n "${existing_drill}" ]]; then
            log "WARN" "Drill already recorded for ${drill_key}"
            return 1
        fi
    fi
    
    # Record drill
    echo "${drill_key},${drill_date},${drill_id},${drill_status},${drill_duration},${drill_message}" >> "${DRILL_STATE_FILE}"
    
    log "INFO" "Drill recorded: ${drill_key} = ${drill_status} on ${drill_date}"
    
    # Update runbook with new drill date
    update_runbook_drill_date "${drill_date}"
    
    return 0
}

# Update runbook with drill date
update_runbook_drill_date() {
    local drill_date="$1"
    local runbook_file="${SCRIPT_DIR}/../docs/backup-runbook.md"
    
    if [[ -f "${runbook_file}" ]]; then
        # Update the drill date line
        sed -i "s/^**Last Drill Date**: .*/**Last Drill Date**: ${drill_date} (Recorded in \`.drill-state\`)/" "${runbook_file}"
        log "INFO" "Runbook updated with drill date: ${drill_date}"
    else
        log "WARN" "Runbook file not found: ${runbook_file}"
    fi
}

# Generate drill report
generate_report() {
    log "INFO" "Generating drill tracking report"
    
    mkdir -p "$(dirname "${DRILL_REPORT_FILE}")"
    
    local current_year=$(date +%Y)
    local drill_history="[]"
    local total_drills=0
    local successful_drills=0
    local failed_drills=0
    
    if [[ -f "${DRILL_STATE_FILE}" ]]; then
        # Parse drill history
        drill_history=$(awk -F',' 'NR>1 && $1 ~ /^'"${current_year}"'_/ {print "{\"quarter\":\""$1"\",\"date\":\""$2"\",\"drill_id\":\""$3"\",\"status\":\""$4"\",\"duration\":\""$5"\",\"message\":\""$6"\"}"}' "${DRILL_STATE_FILE}" | paste -sd ',' - | sed 's/^/[/;s/$/]/')
        
        # Calculate statistics
        total_drills=$(grep "^${current_year}_" "${DRILL_STATE_FILE}" 2>/dev/null | wc -l || echo "0")
        successful_drills=$(grep "^${current_year}_" "${DRILL_STATE_FILE}" 2>/dev/null | grep "SUCCESS" | wc -l || echo "0")
        failed_drills=$(grep "^${current_year}_" "${DRILL_STATE_FILE}" 2>/dev/null | grep "FAILED" | wc -l || echo "0")
    fi
    
    # Calculate next drill date
    local current_quarter=$(( ($(date +%m) - 1) / 3 + 1 ))
    local next_quarter_year=${current_year}
    local next_quarter=$((current_quarter + 1))
    
    if [[ ${next_quarter} -gt 4 ]]; then
        next_quarter=1
        next_quarter_year=$((current_year + 1))
    fi
    
    local next_drill_month=$(((next_quarter - 1) * 3 + 1))
    local next_drill_date="${next_quarter_year}-$(printf "%02d" ${next_quarter_month})-01"
    
    # Generate JSON report
    cat > "${DRILL_REPORT_FILE}" << EOF
{
    "report_info": {
        "generated_at": "$(date -Iseconds)",
        "year": "${current_year}",
        "report_type": "drill_tracking"
    },
    "summary": {
        "total_drills": ${total_drills},
        "successful_drills": ${successful_drills},
        "failed_drills": ${failed_drills},
        "success_rate": $((successful_drills * 100 / (total_drills > 0 ? total_drills : 1))),
        "compliance_status": "$((total_drills >= 1 ? "COMPLIANT" : "NON_COMPLIANT"))"
    },
    "drill_history": ${drill_history},
    "schedule": {
        "current_quarter": "Q${current_quarter}_${current_year}",
        "next_drill_date": "${next_drill_date}",
        "next_drill_quarter": "Q${next_quarter}_${next_quarter_year}",
        "drills_required_per_year": 4,
        "drills_completed_this_year": ${total_drills}
    },
    "last_drill": {
        "date": "$(tail -1 "${DRILL_STATE_FILE}" 2>/dev/null | cut -d',' -f2 || echo "N/A")",
        "status": "$(tail -1 "${DRILL_STATE_FILE}" 2>/dev/null | cut -d',' -f4 || echo "N/A")",
        "duration_seconds": "$(tail -1 "${DRILL_STATE_FILE}" 2>/dev/null | cut -d',' -f5 || echo "0")",
        "message": "$(tail -1 "${DRILL_STATE_FILE}" 2>/dev/null | cut -d',' -f6- || echo "No message")"
    },
    "compliance": {
        "quarterly_requirement_met": $((total_drills >= 1 ? "true" : "false")),
        "last_drill_within_quarter": "$(check_last_drill_compliance)",
        "upcoming_drill_scheduled": "true"
    }
}
EOF
    
    log "INFO" "Drill report generated: ${DRILL_REPORT_FILE}"
}

# Check if last drill was within current quarter
check_last_drill_compliance() {
    if [[ ! -f "${DRILL_STATE_FILE}" ]]; then
        echo "false"
        return
    fi
    
    local last_drill_date=$(tail -1 "${DRILL_STATE_FILE}" 2>/dev/null | cut -d',' -f2 || echo "")
    if [[ -z "${last_drill_date}" ]]; then
        echo "false"
        return
    fi
    
    local current_quarter_start=$(date -d "$(date +%Y)-$(((($(date +%m) - 1) / 3) * 3 + 1))-01" +%Y-%m-%d)
    
    if [[ "${last_drill_date}" > "${current_quarter_start}" ]] || [[ "${last_drill_date}" == "${current_quarter_start}" ]]; then
        echo "true"
    else
        echo "false"
    fi
}

# Schedule next drill
schedule_next_drill() {
    local current_quarter=$(( ($(date +%m) - 1) / 3 + 1 ))
    local current_year=$(date +%Y)
    local next_quarter_year=${current_year}
    local next_quarter=$((current_quarter + 1))
    
    if [[ ${next_quarter} -gt 4 ]]; then
        next_quarter=1
        next_quarter_year=$((current_year + 1))
    fi
    
    local next_drill_month=$(((next_quarter - 1) * 3 + 1))
    local next_drill_date="${next_quarter_year}-$(printf "%02d" ${next_drill_month})-01"
    
    # Create cron job for next drill
    local cron_schedule="0 2 1 $((next_quarter * 3 - 2)),$((next_quarter * 3 - 1)),$((next_quarter * 3)) *"
    local cron_command="${SCRIPT_DIR}/quarterly-drill.sh execute"
    
    log "INFO" "Next drill scheduled for ${next_drill_date} (Q${next_quarter}_${next_quarter_year})"
    log "INFO" "Cron schedule: ${cron_schedule}"
    log "INFO" "Command: ${cron_command}"
    
    # Add to crontab (commented out for safety)
    echo "# To enable, uncomment and add to crontab:"
    echo "# ${cron_schedule} ${cron_command}"
}

# Show next drill information
show_next_drill() {
    local current_quarter=$(( ($(date +%m) - 1) / 3 + 1 ))
    local current_year=$(date +%Y)
    local next_quarter_year=${current_year}
    local next_quarter=$((current_quarter + 1))
    
    if [[ ${next_quarter} -gt 4 ]]; then
        next_quarter=1
        next_quarter_year=$((current_year + 1))
    fi
    
    local next_drill_month=$(((next_quarter - 1) * 3 + 1))
    local next_drill_date="${next_quarter_year}-$(printf "%02d" ${next_drill_month})-01"
    
    echo "Next drill: ${next_drill_date} (Q${next_quarter}_${next_quarter_year})"
    echo "Days until next drill: $(( ($(date -d "${next_drill_date}" +%s) - $(date +%s)) / 86400 ))"
    
    # Check if current quarter drill is completed
    local current_quarter_key="${current_year}_Q${current_quarter}"
    if [[ -f "${DRILL_STATE_FILE}" ]] && grep -q "^${current_quarter_key}," "${DRILL_STATE_FILE}"; then
        echo "Current quarter drill: COMPLETED"
        local drill_info=$(grep "^${current_quarter_key}," "${DRILL_STATE_FILE}")
        local drill_date=$(echo "${drill_info}" | cut -d',' -f2)
        local drill_status=$(echo "${drill_info}" | cut -d',' -f4)
        echo "  Date: ${drill_date}"
        echo "  Status: ${drill_status}"
    else
        echo "Current quarter drill: PENDING"
        echo "  Due by: $(date -d "${current_year}-$(((current_quarter - 1) * 3 + 3))-01" +%Y-%m-%d)"
    fi
}

# Validate drill compliance
validate_compliance() {
    log "INFO" "Validating drill compliance"
    
    local current_year=$(date +%Y)
    local current_quarter=$(( ($(date +%m) - 1) / 3 + 1 ))
    local compliance_issues=0
    
    # Check if current quarter drill is completed
    local current_quarter_key="${current_year}_Q${current_quarter}"
    if [[ ! -f "${DRILL_STATE_FILE}" ]] || ! grep -q "^${current_quarter_key}," "${DRILL_STATE_FILE}"; then
        log "ERROR" "Current quarter drill not completed: ${current_quarter_key}"
        ((compliance_issues++))
    fi
    
    # Check if we have enough drills this year
    local drills_this_year=$(grep "^${current_year}_" "${DRILL_STATE_FILE}" 2>/dev/null | wc -l || echo "0")
    local expected_drills=$((current_quarter))
    
    if [[ "${drills_this_year}" -lt "${expected_drills}" ]]; then
        log "ERROR" "Insufficient drills this year: ${drills_this_year}/${expected_drills}"
        ((compliance_issues++))
    fi
    
    # Check for failed drills
    local failed_drills=$(grep "^${current_year}_" "${DRILL_STATE_FILE}" 2>/dev/null | grep "FAILED" | wc -l || echo "0")
    if [[ "${failed_drills}" -gt 0 ]]; then
        log "WARN" "Failed drills this year: ${failed_drills}"
    fi
    
    if [[ ${compliance_issues} -eq 0 ]]; then
        log "INFO" "Drill compliance: PASSED"
        return 0
    else
        log "ERROR" "Drill compliance: FAILED (${compliance_issues} issues)"
        return 1
    fi
}

# Main execution
main() {
    local action="${1:-report}"
    
    case "${action}" in
        "record")
            record_drill "$2" "$3" "$4"
            ;;
        "report")
            generate_report
            ;;
        "schedule")
            schedule_next_drill
            ;;
        "next")
            show_next_drill
            ;;
        "validate")
            validate_compliance
            ;;
        *)
            echo "Usage: $0 [record|report|schedule|next|validate]"
            echo "  record <status> <duration> <message> - Record drill completion"
            echo "  report - Generate drill tracking report"
            echo "  schedule - Show next drill schedule"
            echo "  next - Show next drill information"
            echo "  validate - Validate drill compliance"
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"
