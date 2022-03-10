const mongoose = require('mongoose');

const config = {
    name: `ingredient`
}

const Schema = new mongoose.Schema({
    creatorId: String,
    price: Number,
    Id: String,
    growable: Boolean
});

const Model = module.exports = mongoose.model(config.name, Schema);