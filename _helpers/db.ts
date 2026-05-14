import { Sequelize } from 'sequelize';
const config = require('../config.json');

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