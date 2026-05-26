import { Sequelize } from 'sequelize';
const config = {
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  },
  secret: process.env.SECRET
};

export const db: any = {};

export async function initialize() {
  const { host, port, user, password, database } = config.database;

  const sequelize = new Sequelize(database, user, password, {
    host,
    port,
    dialect: 'mysql',
    logging: false
  });

  // Init models
  const { Account } = require('../accounts/account.model');
  const { RefreshToken } = require('../accounts/refresh-token.model');
  
  db.Account = Account(sequelize);
  db.RefreshToken = RefreshToken(sequelize);

  // Relationships
  db.Account.hasMany(db.RefreshToken, { onDelete: 'CASCADE' });
  db.RefreshToken.belongsTo(db.Account);

  // Sync tables
  await sequelize.sync();
}