#!/usr/bin/env bats

SCRIPT_DIR="$BATS_CWD/tests/integration/s3cmd"
PARAMS="-c $SCRIPT_DIR/.s3cfg --access_key=$AWS_ACCESS_KEY_ID --secret_key=$AWS_SECRET_ACCESS_KEY"
TEST_BUCKET="test-$(${BATS_CWD}/node_modules/.bin/uuid)"

@test "s3cmd is installed on path" {
    run which s3cmd
        [ "$status" -eq 0 ]
}

@test "s3cmd is 1.6.x" {
    result="$(s3cmd --version | cut -d' ' -f3 | cut -d'.' -f1 -f2)"
        [ "$result" = '1.6' ]
}

@test "s3cmd can list buckets" {
    run s3cmd $PARAMS ls
        [ "$status" -eq 0 ]
}

@test "s3cmd can add and remove bucket" {
    run s3cmd $PARAMS mb s3://$TEST_BUCKET && s3cmd $PARAMS rb s3://$TEST_BUCKET
        [ "$status" -eq 0 ]
}

@test "s3cmd can upload a file" {
    tempfile="$(mktemp)"
    run dd -s if=/dev/urandom of=$tempfile bs=1024 count=1024
    run s3cmd $PARAMS mb s3://$TEST_BUCKET && \
        s3cmd $PARAMS put $tempfile s3://$TEST_BUCKET/test/upload.random
        echo "path: $tempfile"
#        s3cmd $PARAMS rb s3://$TEST_BUCKET && \
#        rm $tempfile
        [ "$status" -eq 0 ]
}