#!/usr/bin/ksh93

PATH=/usr/bin
if [[ -d /native ]]; then
    PATH=/native/usr/bin
else
    grep -c ^processor /proc/cpuinfo 2>/dev/null || 1
    exit 0
fi

set -o errexit
if [[ -n ${TRACE} ]]; then
    set -o xtrace
fi

# CN parameters
CORES=$(kstat -C -m cpu_info -c misc -s core_id | wc -l | tr -d ' ')
TOTAL_MEMORY=$(($(kstat -C -m unix -n system_pages -c pages -s physmem \
    | cut -d':' -f5) * $(pagesize))).0

# zone parameters
ZONE_MEMORY=$(kstat -C -m memory_cap -c zone_memory_cap -s physcap \
    | cut -d':' -f5).0

# our fraction of the total memory on the CN
MEMORY_SHARE=$((${ZONE_MEMORY} / ${TOTAL_MEMORY}))

# best guess as to how many CPUs we should pretend like we have for tuning
CPU_GUESS=$((${CORES} * ${MEMORY_SHARE}))

# round that up to a positive integer
echo "$((ceil(${CPU_GUESS})))"

exit 0