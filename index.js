//NPM packages
const ejs = require("ejs");
const GenUuid = require("uuid").v4;
const express = require("express");
const passport = require("passport");
const MongoStore = require('connect-mongo');
const { MessageEmbed, WebhookClient, DiscordAPIError, Client } = require("discord.js");
const Strategy = require("passport-discord").Strategy;
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const moment = require('moment');
const path = require("path");
const session = require('express-session');
const url = require("url");
const partials = require('express-partials');

//Local
const { clientId: clientID, mongoDB, secret, webhook: webhookURL } = require("./config.json");
const { initMongoDB, App: CookingApp, User: CookingUser, FetchManager: CookingFetchManaging, CreateManager: CookingCreatorManager } = require("./mongoDB");

//Varibles
const api = express();
const app = express();
const AddManager = new CookingCreatorManager();
const FetchManager = new CookingFetchManaging();
const port = 5089;
const domain = "http://localhost:" + port;
const http = "http://";
const config = {
    "verification": "",
    "description": "🥘 Imagine an cooking game on an API!", //description
    "https": http, // leave as is
    "port": "5089",
}
const webhook = new WebhookClient({
    url: webhookURL
});

//Init mongoDb
initMongoDB();

const dataDir = path.resolve(`${process.cwd()}${path.sep}`);

const templateDir = path.resolve(`${dataDir}${path.sep}templates`);


passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new Strategy({
    clientID: `${clientID}`,
    clientSecret: `${secret}`,
    callbackURL: `${domain}/callback`,
    scope: ["identify", "guilds"]
},
    (accessToken, refreshToken, profile, done) => {

        process.nextTick(() => done(null, profile));
    }));

app.use(session({
    secret: 'gkagsahdgijgijmsagoimig',
    resave: true,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: mongoDB })
}));


// We initialize passport middleware.
app.use(passport.initialize());
app.use(passport.session());
app.set('views', path.join(__dirname, 'templates'));

app.locals.domain = domain.split("//")[1];
app.engine("html", ejs.renderFile);
app.set("view engine", "html");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(partials()); //https://stackoverflow.com/a/22543370/15751555
app.use(express.static(__dirname + '/static'));

const renderTemplate = async (res, req, template, data = {}) => {
    var hostname = req.headers.host;
    var pathname = url.parse(req.url).pathname;

    const baseData = {
        https: http,
        domain: domain,
        hostname: hostname,
        pathname: pathname,
        path: req.path,
        user: req.isAuthenticated() ? req.user : null,
        verification: config.verification,
        description: config.description,
        url: res,
        req: req,
        image: `${domain}/logo.png`,
        redirect: function (place) {
            res.redirect(place);
        }
    };
    res.render(path.resolve(`${templateDir}${path.sep}${template}`), Object.assign(baseData, data));
};

const checkAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    req.session.backURL = req.url;
    res.redirect("/login");
}

// Login endpoint.
app.get("/login", (req, res, next) => {
    res.render
    if (req.session.backURL) {
        req.session.backURL = req.session.backURL;

    } else if (req.headers.referer) {

        const parsed = url.parse(req.headers.referer);
        if (parsed.hostname === app.locals.domain) {
            req.session.backURL = parsed.path;
        }


    } else {
        req.session.backURL = "/";
    }
    // Forward the request to the passport middleware.
    next();
},
    passport.authenticate("discord"));

function genTag(reqUser){
    return reqUser.username + "#" + reqUser.discriminator
}

// Callback endpoint.
app.get("/callback", passport.authenticate("discord", {
    failWithError: true,
    failureFlash: "There was an error logging you in!",
    failureRedirect: "/",
}), async (req, res) => {
    async function tryAndCreateUser(){
        const usr = await FetchManager.fetchUser(req.user.id);

        if(!usr){
            await AddManager.createUser(req.user.id);
        }
    }

    try {
        await tryAndCreateUser();

        if (req.session.backURL) {
            const url = req.session.backURL;
            req.session.backURL = null;
            res.redirect(url);

            const member = req.user;
            if (member) {
                webhook.send({
                    embeds: [
                        {
                            color: "BLURPLE",
                            title: `👀 Login`,
                            description: `ID: \`${member.id}\`\nTag: ${genTag(member)}\nMention: <@${member.id}>`
                        }
                    ]
                });
            }

        } else {
            const member = req.user;
            if (member) {
                webhook.send({
                    embeds: [
                        {
                            color: "BLURPLE",
                            title: `👀 Login`,
                            description: `ID: \`${member.id}\`\nTag: ${genTag(member)}\nMention: <@${member.id}>`
                        }
                    ]
                });
            }

            res.redirect("/dashboard");
        }
    } catch (err) {
        console.log(`😱 Login Error:`, err);
        res.redirect('/')
    }

});

// Logout endpoint.
app.get("/logout", async function (req, res) {

    if (req.user) {
        const member = req.user;

        if (member) {
            webhook.send({
                embeds: [
                    {
                        color: "BLURPLE",
                        title: `👋 Logout`,
                        description: `ID: \`${member.id}\`\nTag: ${genTag(member)}\nMention: <@${member.id}>`
                    }
                ]
            });
        }
    }


    req.session.destroy(() => {
        req.logout();
        res.redirect("/");
    });
});

app.get("/", async (req, res) => {
    await renderTemplate(res, req, "index.ejs", {});
});

app.get("/dashboard", async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect("/login");
    }

    //Fetch & auto edit
    const ReqUser = await FetchManager.fetchUser(req.user.id);
    await ReqUser.autoEdit();
    const ReqApps = await FetchManager.fetchAllAppsWith({
        ownerId: req.user.id
    });
    ReqApps.forEach(async e => (await e.autoEdit()));

    setTimeout(async () => {
        await renderTemplate(res, req, "dashboard.ejs", {
            User: ReqUser,
            UserApps: ReqApps,
            AppsNullish: (ReqApps == null || ReqApps.length <= 0)
        });
    }, 100);
});

app.get("/newApp", async (req, res) => {
    const AppName = decodeURI(req.query.APP_NAME);

    AddManager.createApp(req.user.id,
        AppName
    );

    res.redirect("/dashboard");
});

app.listen(config.port, null, null, () => console.log(`Dashboard is up and running on port ${domain}`));


// A P I =>
// A P I =>
// A P I =>

const API = express();
