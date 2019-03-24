const pro = require("util").promisify;
const fs = require("fs");
const createRegister = require("./register.js");

module.exports = async (dir, key, name, value, ...args) => {

    try {
        await pro(fs.mkdir)(dir);
    } catch (e) {
        if (e.code !== "EEXIST") {
            throw e;
        }
    }

    const fileName = `${dir}/${key}.json`;

    try {
        let strVal = await pro(fs.readFile)(fileName, "utf8");
        value = JSON.parse(strVal);
    } catch (e) {
        if (e.code !== "ENOENT") {
            console.error(`Could not read register ${key}`, e.message || e);
        }
    }

    let register = createRegister(key, name, value, ...args);

    register.watch(async () => {
        await pro(fs.writeFile)(fileName, JSON.stringify(register.value), "utf8");
    });

    return register;

}