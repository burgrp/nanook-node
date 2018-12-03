const i2c = require("i2c-bus");

module.exports = config => {
    return {
        open(address) {
            try {
                let bus = i2c.openSync(parseInt(address || 0));

                return {
                    async read(address, length) {
                        let buffer = Buffer.alloc(length);
                        let read = bus.i2cReadSync(parseInt(address), length, buffer);
                        if (read !== length) {
                            throw `Could read only ${read} bytes from ${length}`;
                        }
                        return Uint8Array.from(buffer);
                    },

                    async write(address, data) {
                        let buffer = Buffer.from(data);
                        let written = bus.i2cWriteSync(parseInt(address), data.length, buffer);
                        if (written !== length) {
                            throw `Could write only ${read} bytes from ${length}`;
                        }
                    }
                }
            } catch (e) {
                console.error("Error wile opening I2C driver", e);
                throw e;
            }
        }
    }
}