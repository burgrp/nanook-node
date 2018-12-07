#!/usr/bin/env node

require("@device.farm/appglue")({require, file: __dirname + "/../config.json"}).main(async app => {
    await app.web.start();
});
