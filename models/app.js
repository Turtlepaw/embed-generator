const mongoose = require('mongoose');

const config = {
    name: `app`
}

const Schema = new mongoose.Schema({
    name: String,
    token: String,
    requests: Number,
    ownerId: String,
    Id: String
});

const Model = module.exports = mongoose.model(config.name, Schema);