const mongoose = require("mongoose");
const { v4, v5 } = require("uuid");
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

    async autoEdit(){
        const d = await this.fetch();

        if(d?.apps != null && d.apps.size >= 1) this.data.apps = d.apps;

        return d;
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
            AppName: null,
            token: null,
            requests: 0,
            ownerId: ownerId,
            Id: Id || null
        }

        this.edited = {
            AppName: false,
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

        this.data.AppName = d.name;
        this.data.token = d.token;
        this.data.requests = d.requests;

        return d;
    }

    setName(name){
        this.edited.name = true
        this.data.AppName = name
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
        if(edited.AppName) d.name = data.AppName;
        if(edited.token) d.token = this.generateToken();

        return (await d.save());
    }
}

//Util Functions
function isString(val){
    return typeof val == "string";
}

function isObject(val){
    return typeof val == "object";
}

const This = this;

module.exports.FetchManager = class FetchManager {
    resolveUser(UserValue){
        if(isObject(UserValue)){
            return new This.User(UserValue.userId);
        } else if(isString(UserValue)){
            return new This.User(UserValue);
        } else {
            throw new Error(
                `[INVALID_VALUE] Unkown user`
            );
        }
    }

    resolveApp(AppValue, ownerId=null){
        if(isObject(AppValue)) ownerId = AppValue.ownerId;

        if(isObject(AppValue)){
            return new This.App(ownerId, AppValue.Id);
        } else if(isString(AppValue)){
            return new This.App(ownerId, AppValue);
        } else {
            throw new Error(
                `[INVALID_VALUE] Unkown app`
            );
        }
    }

    async asyncResolveApp(AppId){
        const ownerId = (await app.findOne({
            Id: AppId
        })).ownerId;

        return new This.App(ownerId, AppId);
    }

    async fetchAllAppsWith(options){
        const fetch = await app.find(options);
        return fetch.map(e => this.resolveApp(e));
    }
    
    async fetchAllApps(){
        const fetch = await app.find();
        return fetch.map(e => this.resolveApp(e));
    }

    async fetchAllUsers(){
        const fetch = await user.find();
        return fetch.map(e => this.resolveUser(e));
    }

    async fetchAllUsersWith(options){
        const fetch = await user.find(options);
        return fetch.map(e => this.resolveUser(e));
    }

    async fetchUser(userId){
        return this.resolveUser(userId);
    }

    async fetchApp(Id){
        return this.asyncResolveApp(Id);
    }
}

const LocalFetchManager = this.FetchManager;
module.exports.CreateManager = class CreateManager {
    async createApp(ownerId, Name){
        const Fetcher = new LocalFetchManager();
        const ownerResolved = Fetcher.resolveUser(ownerId);

        const token = v4();
        const Id = v4();

        const newapp = await new app({
            name: Name,
            token,
            requests: 0,
            ownerId: ownerId,
            Id
        }).save();

        const ResolvedApp = await (await ownerResolved.addApp(Id, ownerId)).save();


        return {
            data: newapp,
            token,
            Id,
            ResolvedApp
        }
    }

    async createUser(Id){
        const newUser = await new user({
            userId: Id,
            apps: new Map()
        }).save();

        return {
            data: newapp,
            token,
            Id
        }
    }
}