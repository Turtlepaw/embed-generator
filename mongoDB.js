const mongoose = require("mongoose");
const { v4 } = require("uuid");
const { mongoDB } = require("./config.json");
const app = require("./models/app");
const user = require("./models/user");

module.exports.initMongoDB = async () => {
    mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });

    mongoose.connection.on('connecting', () => {
        console.log("Mongoose: Logging in!")
    });

    mongoose.connection.on('connected', () => {
        console.log("Mongoose: Logged in!")
    });

    mongoose.connection.on('disconnecting', () => {
        console.log("Mongoose: Logging out")
    });

    mongoose.connection.on('disconnected', () => {
        console.log("Mongoose: Logged out")
    });

    mongoose.connection.on('error', error => {
        console.log(error)
    });
}

module.exports.User = class CookingUser {
    constructor(userId){
        this.data = {
            userId: userId,
            apps: new Map()
        }

        this.edited = {
            apps: false
        }

        this.userId = userId;
    }

    async fetch(){
        return (await user.findOne({
            userId: this.userId
        }));
    }

    async addApp(appId, ownerId){
        this.edited.apps = true
        const App = new module.exports.App(ownerId, appId);
        await App.autoEdit();
        this.data.apps.set(App.Id, App)
        return App;
    }

    async removeApp(appId, ownerId){
        this.edited.apps = true
        const App = new module.exports.App(ownerId, appId);
        await App.autoEdit();
        this.data.apps.delete(App.Id)
        return App;
    }

    async save(){
        const User = await this.fetch();

        if(this.edited.apps) {
            if(User.apps != null || User.apps.size >= 1){
                for(const App of this.data.apps.values()){
                    User.apps.set(App.Id, App);
                }
            } else {
                User.apps = this.data.apps;
            }
        }

        return (await User.save());
    }
}

module.exports.App = class CookingApp {
    constructor(ownerId, Id){
        this.data = {
            name: "Unknown app",
            token: null,
            requests: 0,
            ownerId: ownerId,
            Id: Id || null
        }

        this.edited = {
            name: false,
            token: false,
            requests: false
        }

        this.ownerId = ownerId;

        this.Id = Id;
    }

    async fetch(){
        return (await app.findOne({
            Id: this.Id
        }));
    }

    async autoEdit(){
        const d = await this.fetch();

        this.data.name = d.name;
        this.data.token = d.token;
        this.data.requests = d.requests;

        return d;
    }

    setName(name){
        this.edited.name = true
        this.data.name = name
        return this;
    }

    regenerateToken(){
        this.edited.token = true
        return this;
    }

    addRequest(){
        this.edited.requests = true
        this.data.requests++
        return this;
    }

    generateToken(){
        return v4();
    }

    async save(){
        const { data, edited } = this;
        const d = await this.fetch();

        function notNull(val){
            return val != null;
        }

        if(edited.requests) d.requests = (d.requests == null ? data.requests : (d.requests + data.requests));
        if(edited.name) d.name = data.name;
        if(edited.token) d.token = this.generateToken();

        return (await d.save());
    }
}