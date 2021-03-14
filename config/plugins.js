const configure_upload_aws = env => ({
  provider: 'aws-s3-cdn',
  providerOptions: {
    accessKeyId: env('S3_ACCESS_KEY_ID'),
    secretAccessKey: env('S3_ACCESS_SECRET'),
    region: env('S3_REGION'),
    endpoint: env('S3_ENDPOINT'),
    s3ForcePathStyle: env('S3_FORCE_PATH_STYLE'),
    params: {
      Bucket: env('S3_BUCKET'),
    },
    cdnBaseUrl: env('CDN_BASE_URL'),
  }
});

const configure_upload_local = env => ({});

const configure_upload = env => {
  switch(env('UPLOAD_PROVIDER')) {
    case 'aws-s3':
      console.log('setting upload provider to aws-s3');
      return configure_upload_aws(env);
    case 'local':
    default:
      console.log('setting upload provider to local storage');
      return configure_upload_local(env);
  }
};

module.exports = ({env}) => ({
  upload: configure_upload(env),
});
