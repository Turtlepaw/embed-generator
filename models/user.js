const mongoose = require('mongoose');

const config = {
    name: `user`
}

const Schema = new mongoose.Schema({
    userId: String,
    apps: Map, //[AppId]
});

const Model = module.exports = mongoose.model(config.name, Schema);