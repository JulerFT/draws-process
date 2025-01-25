const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WinnerFinish = sequelize.define(
  'WinnerFinish',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    type_doc: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    num_doc: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    names: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_names: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    award_type: {
      type: DataTypes.ENUM("Meet & Greet", "Entradas"),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    schema: "messi25",
    tableName: "winners_finish",
    timestamps: false,
    underscored: true,
  }
);

module.exports = WinnerFinish;
