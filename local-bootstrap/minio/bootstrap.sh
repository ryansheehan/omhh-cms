#!/bin/sh

if [ -z "$1" ]
then
  >&2 echo "No bucket specified"
  exit 1
fi
alias awslocal='aws --endpoint-url http://s3-minio:9000 --no-verify-ssl'
bucketExists=$(awslocal s3 ls "s3://$1" 2>&1 | grep 'NoSuchBucket')
if [ -z bucketExists ]
then
  echo "$1 bucket already exists"
else
  echo "Creating $1 bucket"
  awslocal s3api create-bucket --bucket $1
fi
