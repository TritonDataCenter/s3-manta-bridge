#!/usr/bin/env bats

# Sanity checks to make sure the required env vars are set and dependent
# utilities are present

if [ -z "$S3_BRIDGE_HOST" ]; then
    >&2 echo "S3_BRIDGE_HOST not set - exiting"
    exit 1
fi

if [ -z "$AWS_ACCESS_KEY_ID" ]; then
    >&2 echo "AWS_ACCESS_KEY_ID not set - exiting"
    exit 1
fi

if [ -z "$AWS_SECRET_ACCESS_KEY is set" ]; then
    >&2 echo "AWS_SECRET_ACCESS_KEY not set - exiting"
    exit 1
fi

if [ ! -f "${BATS_CWD}/node_modules/.bin/uuid" ]; then
    >&2 echo "Node.js uuid utility isn't install in modules directory - exiting"
    exit 1
fi

if [ ! -x "$(which s3cmd)" ]; then
    >&2 echo "s3cmd is not installed in path - exiting"
    exit 1
fi

if [ "$(s3cmd --version | cut -d' ' -f3 | cut -d'.' -f1,2)" != '1.6' ]; then
    >&2 echo "s3cmd is not version 1.6"
    exit 1
fi

TEST_BUCKET="test-$(${BATS_CWD}/node_modules/.bin/uuid)"
SCRIPT_DIR="$BATS_CWD/tests/integration/s3cmd"
S3_CFG="$(mktemp -t s3cmd-cfg-${S3_BRIDGE_HOST}-XXXXXX)"
PARAMS="-c $S3_CFG --access_key=$AWS_ACCESS_KEY_ID --secret_key=$AWS_SECRET_ACCESS_KEY"

if [ -x "$(which gsed)" ]; then
    SED_CMD="gsed"
else
    SED_CMD="sed"
fi

# Setup / Teardown

setup() {
    # Template out s3cmd configuration to use specified host value
    cat ${SCRIPT_DIR}/.s3cfg | ${SED_CMD} "s/%(s3bridgehost)s/$S3_BRIDGE_HOST/g" > ${S3_CFG}

    if [ ! -f ${S3_CFG} ]; then
        >&s echo "Generated s3cmd configuration file couldn't be found at: ${S3_CFG}"
        exit 1
    fi

    if [ ! -s ${S3_CFG} ]; then
        >&s echo "Generated s3cmd configuration file is empty"
        exit 1
    fi
}

teardown() {
    rm -f ${S3_CFG}
}

# Start Tests

@test "Test bucket is using random UUID suffix" {
    [ "$TEST_BUCKET" != "test-" ]
}

@test "s3cmd can list buckets" {
    run s3cmd $PARAMS ls
        [ "$status" -eq 0 ]
}

@test "s3cmd can add and remove bucket" {
    run s3cmd $PARAMS mb s3://$TEST_BUCKET
        [ "$status" -eq 0 ]
    run s3cmd $PARAMS rb s3://$TEST_BUCKET
        [ "$status" -eq 0 ]
}

@test "s3cmd can upload, download, and delete a file" {
    tempfile="$(mktemp -t s3cmd-upload-XXXXXX.random)"
    downloadfile="$(mktemp -t s3cmd-download-XXXXXX.random)"

    # Populate test file with random data
    run dd if=/dev/urandom of=${tempfile} bs=1024 count=1024
        [ -f ${tempfile} ]
        [ -s ${tempfile} ]

    # Create bucket and upload file
    run s3cmd ${PARAMS} mb s3://${TEST_BUCKET} && \
        s3cmd ${PARAMS} put ${tempfile} s3://${TEST_BUCKET}/test/upload.random
        [ "$status" -eq 0 ]

    # Pull down exact same file
    run s3cmd ${PARAMS} --force get s3://${TEST_BUCKET}/test/upload.random ${downloadfile}
        [ "$status" -eq 0 ]

    # Verify that file contents are identical
    run cmp ${tempfile} ${downloadfile}
        [ "$status" -eq 0 ]

    # Delete object and bucket
    run s3cmd ${PARAMS} del s3://${TEST_BUCKET}/test/upload.random && \
        s3cmd ${PARAMS} rb s3://${TEST_BUCKET} && \
        rm ${tempfile} && \
        rm ${downloadfile}
        [ "$status" -eq 0 ]
}

@test "s3cmd can move an object within a bucket" {
    tempfile="$(mktemp -t s3cmd-upload-XXXXXX.random)"
    downloadfile="$(mktemp -t s3cmd-download-XXXXXX.random)"

    # Populate test file with random data
    run dd if=/dev/urandom of=${tempfile} bs=1024 count=1024
        [ -f ${tempfile} ]
        [ -s ${tempfile} ]

    # Create bucket and upload file
    run s3cmd ${PARAMS} mb s3://${TEST_BUCKET} && \
        s3cmd ${PARAMS} put ${tempfile} s3://${TEST_BUCKET}/test/upload.random
        [ "$status" -eq 0 ]

    # Move file to another name
    run s3cmd ${PARAMS} mv s3://${TEST_BUCKET}/test/upload.random s3://${TEST_BUCKET}/test2/upload-moved.random && \
        [ "$status" -eq 0 ]

    # Pull down exact same file
    run s3cmd ${PARAMS} --force get s3://${TEST_BUCKET}/test2/upload-moved.random ${downloadfile}
        [ "$status" -eq 0 ]

    # Verify that file contents are identical
    run cmp ${tempfile} ${downloadfile}
        [ "$status" -eq 0 ]

    # Delete object and bucket
    run s3cmd ${PARAMS} del s3://${TEST_BUCKET}/test2/upload-moved.random && \
        s3cmd ${PARAMS} rb s3://${TEST_BUCKET} && \
        rm ${tempfile} && \
        rm ${downloadfile}
        [ "$status" -eq 0 ]
}
