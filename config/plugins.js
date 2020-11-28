const configure_upload_aws = env => ({
  provider: 'aws-s3-cdn',
  providerOptions: {
    accessKeyId: env('AWS_ACCESS_KEY_ID'),
    secretAccessKey: env('AWS_ACCESS_SECRET'),
    region: env('AWS_REGION'),
    params: {
      Bucket: env('AWS_BUCKET'),
    },
    cdn: env('CLOUDFRONT'),
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
