const Bus = require("i2c-bus-promised").Bus;

module.exports = config => {
    return {
        async open(address) {
            try {
                const bus = new Bus();
                await bus.open(parseInt(address || 0));

                return {
                    async read(address, length) {
                        let buffer = Buffer.alloc(length);
                        let read = await bus.i2cRead(parseInt(address), length, buffer);
                        if (read !== length) {
                            throw `Could read only ${read} bytes from ${length}`;
                        }
                        return Uint8Array.from(buffer);
                    },

                    async write(address, data) {
                        let buffer = Buffer.from(data);
                        let written = await bus.i2cWrite(parseInt(address), data.length, buffer);
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