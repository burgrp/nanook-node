const createRegister = require("./register.js");
const asyncWait = require("./async-wait.js");
const ntcData = require("./ntc-10k-3950.json");

module.exports = async config => {

    let i2c = config.i2c;

    let obpAddress = config.obpAddress || 0x74;
    let rampDacAddress = config.rampDacAddress || 0x60;

    let registers = [];
    let tickers = [];

    Object.entries(config.analogSensors).forEach(([key, registerConfig]) => {

        function createSensor(keySuffix, name, converter, unit) {
            let register = createRegister(key + keySuffix, registerConfig.name + " " + name, undefined, unit);

            register.setRaw = async (raw, vcc) => {
                let value = converter(raw, registerConfig["transducer" + keySuffix], vcc);
                register.set(value);
            };

            return register;
        }

        function convertFlow(raw, transducerParams) {
            return transducerParams.mlPerRev * raw * 60 * 60 / 1000;
        }

        function convertPressure(raw, transducerParams, vcc) {
            let r1 = transducerParams.r1 || 4700;
            let r2 = transducerParams.r2 || 10000;
            let u2 = vcc * raw / 4095;
            let u = u2 * (r1 + r2) / r2;
            if (u < 0.2) {
                throw "Pressure sensor disconnected";
            }
            let pressure = (u - 0.5) / 4 * (transducerParams.max - transducerParams.min) + transducerParams.min;
            return pressure;
        }

        function convertTemperature(raw, transducerParams) {
            if (raw === 0) {
                throw "NTC sensor disconnected";
            }
            let r = transducerParams.r2 * (4095 - raw) / raw;

            for (let i in ntcData) {
                if (ntcData[i][1] === r) {
                    return ntcData[i][0];
                } else if (ntcData[i][1] < r) {
                    let r0 = ntcData[i - 1][1];
                    let t0 = ntcData[i - 1][0];
                    let r1 = ntcData[i][1];
                    let t1 = ntcData[i][0];
                    return (r - r0) / (r1 - r0) * (t1 - t0) + t0;
                }
            }

            throw "Error converting NTC resistance to temperature";
        }

        let sensors = [
            createSensor("WaterFlow", "Water Flow", convertFlow, "l/h"),
            createSensor("WaterPressure", "Water Pressure", convertPressure, "bar"),
            createSensor("FrigoPressure", "Refrigerant Pressure", convertPressure, "bar"),
            createSensor("WaterInTemp", "Water In Temperature", convertTemperature, "°C"),
            createSensor("WaterOutTemp", "Water Out Temperature", convertTemperature, "°C"),
            createSensor("FrigoInTemp", "Refrigerant In Temperature", convertTemperature, "°C"),
            createSensor("FrigoOutTemp", "Refrigerant Out Temperature", convertTemperature, "°C"),
        ];

        registers.push(...sensors);

        tickers.push(async () => {
            try {
                let data = Buffer.from(await i2c.read(registerConfig.address, (7 + 2) * 2));
                let vRefIntData = data.readUInt16LE(7 * 2);
                let vRefIntCal = data.readUInt16LE(8 * 2);
                let vcc = 3.3 * vRefIntCal / vRefIntData;

                for (let c in sensors) {
                    try {
                        await sensors[c].setRaw(data.readUInt16LE(c * 2), vcc);
                    } catch (e) {
                        await sensors[c].failed(e.message || e);
                    }
                }
            } catch (e) {
                for (let c in sensors) {
                    await sensors[c].failed(e.message || e);
                }
            }
        });

    });

    let compressorRamp = createRegister("compressorRamp", "Compressor Ramp", undefined, "%");
    registers.push(compressorRamp);

    let compressorRelay = createRegister("compressorRelay", "Compressor Relay", undefined, undefined);
    registers.push(compressorRelay);

    let eevPosition = createRegister("eevPosition", "Expansion Valve", undefined, "steps");
    registers.push(eevPosition);

    let coldWaterPump = createRegister("coldWaterPump", "Cold Side Circulation Pump", undefined, undefined);
    registers.push(coldWaterPump);

    let hotWaterPump = createRegister("hotWaterPump", "Hot Side Circulation Pump", undefined, undefined);
    registers.push(hotWaterPump);

    let eevFault = createRegister("eevNFault", "EEV Fault", undefined, undefined);
    registers.push(eevFault);

    let i2cAlert = createRegister("i2cAlert", "I2C Alert", undefined, undefined);
    registers.push(i2cAlert);

    let pwrOk = createRegister("pwrOk", "Power OK", undefined, undefined);
    registers.push(pwrOk);

    let psLow = createRegister("psLow", "Low Pressure Switch", undefined, undefined);
    registers.push(psLow);

    let psHigh = createRegister("psHigh", "High Pressure Switch", undefined, undefined);
    registers.push(psHigh);

    tickers.push(async () => {
        try {

            let obpData = Buffer.from(await i2c.read(obpAddress, 1 + 1 + 4));

            let outputs = obpData.readUInt8(0);
            await compressorRelay.set((outputs & 1) != 0);
            await coldWaterPump.set((outputs & 2) != 0);
            await hotWaterPump.set((outputs & 4) != 0);

            let inputs = obpData.readUInt8(1);
            await eevFault.set((inputs & 1) != 0);
            await i2cAlert.set((inputs & 2) != 0);
            await pwrOk.set((inputs & 4) != 0);
            await psLow.set((inputs & 8) != 0);
            await psHigh.set((inputs & 16) != 0);

            await eevPosition.set(obpData.readInt32LE(2));

        } catch (e) {
            await compressorRelay.failed(e);
            await coldWaterPump.failed(e);
            await hotWaterPump.failed(e);
            await eevFault.failed(e);
            await i2cAlert.failed(e);
            await pwrOk.failed(e);
            await psLow.failed(e);
            await psHigh.failed(e);
            await eevPosition.failed(e);
        }

        try {
            let rampDacData = await i2c.read(rampDacAddress, 2);
            await compressorRamp.set(rampDacData[1] * 100 / 255);
        } catch (e) {
            await compressorRamp.failed(e);
        }
    });

    async function tick() {
    };

    function scheduleNextTick() {
        setTimeout(async () => {
            try {
                for (let ticker of tickers) {
                    await ticker();
                }
            } catch (e) {
                console.error(e);
            }
            scheduleNextTick();
        }, config.tickMs);
    }

    scheduleNextTick();

    return {
        registers,

        async setCompressorRelay(state) {
            console.log("Compressor Relay =>", state);
            await i2c.write(obpAddress, [3, 0, state ? 1 : 0]);
        },

        async setCompressorRamp(ramp) {
            console.log("Compressor Ramp =>", ramp);
            await i2c.write(rampDacAddress, [0, ramp * 255 / 100]);
        },

        async setColdWaterPump(state) {
            console.log("Cold Water Pump =>", state);
            await i2c.write(obpAddress, [3, 1, state ? 1 : 0]);
        },

        async setHotWaterPump(state) {
            console.log("Hot Water Pump =>", state);
            await i2c.write(obpAddress, [3, 2, state ? 1 : 0]);
        },

        async setRgbLed(led) {
            console.log("RGB LED =>", JSON.stringify(led));
            await i2c.write(obpAddress, [1, led.rampUpTime, led.onTime, led.rampDownTime, led.offTime, ...led.rgb]);
        },

        async eevRun(fullSteps, fast) {
            console.info("EEV to run " + fullSteps + " steps" + (fast ? " fast" : ""));
            let buffer = Buffer.alloc(1 + 2 + 1);
            buffer.writeUInt8(2, 0);
            buffer.writeInt16LE(fullSteps, 1);
            buffer.writeUInt8(fast ? 1 : 0, 3);
            await i2c.write(obpAddress, [...buffer]);
        },

        async setEevPosition(position) {
            console.info("Reseting EEV position to", position);
            let buffer = Buffer.alloc(1 + 4);
            buffer.writeUInt8(4, 0);
            buffer.writeInt32LE(position, 1);
            await i2c.write(obpAddress, [...buffer]);
        }
    }
}