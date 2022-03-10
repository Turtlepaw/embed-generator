const mongoose = require('mongoose');

const config = {
    name: `meal`
}

const Schema = new mongoose.Schema({
    creatorId: String,
    machines: Map,
    ingredients: Map,
    name: String,
    Id: String
});

const Model = module.exports = mongoose.model(config.name, Schema);