const configure_sqlite = (env) => ({
  default: {
    connector: 'bookshelf',
    settings: {
      client: 'sqlite',
      filename: env('DATABASE_FILENAME', '.tmp/data.db'),
    },
    options: {
      useNullAsDefault: true,
    }
  }
});


const configure_mysql = (env) => ({
  default: {
    connector: 'bookshelf',
    settings: {
      client: 'mysql',
      host: env('DATABASE_HOST'),
      port: env.int('DATABASE_PORT'),
      database: env('DATABASE_NAME'),
      username: env('DATABASE_USERNAME'),
      password: env('DATABASE_PASSWORD'),
    },
    options: {
      pool: {
        min: 0,
        max: 1,
        idleTimeoutMillis: 120000,
        reapIntervalMillis: 300000,
      }
    },
  }
});

const configure_db = (env) => {
  switch(env('DATABASE_PROVIDER')) {
    case 'mysql': return configure_mysql(env);
    case 'sqlite':
    default:
      return configure_sqlite(env);
  }
}

module.exports = ({ env }) => ({
  defaultConnection: 'default',
  connections: configure_db(env),
});
