const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Winner = sequelize.define(
  'Winner',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    client_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    award_type: {
      type: DataTypes.ENUM(
        'M&G Titulares',
        'M&G Suplentes',
        'Entradas Titulares',
        'Entradas Suplentes'
      ),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: 'messi25',
    tableName: 'winners',
    timestamps: false,
    underscored: true,
  }
);

module.exports = Winner;
