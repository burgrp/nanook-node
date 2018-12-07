const createRegister = require("./register.js");
const asyncWait = require("./async-wait.js");

module.exports = async config => {

    let peripherals = config.peripherals;

    let registers;
    registers = [
        createRegister("sequenceInProgress", "Sequence In Progress"),
        createRegister("startedAt", "Started At"),
        createRegister("stoppedAt", "Stopped At"),
        ...peripherals.registers
    ];

    registers = registers.reduce((map, reg) => {
        map[reg.key] = reg;
        return map;
    }, {});

    let systemErrors = {};
    let systemErrorsListeners = [];


    function systemErrorsUpdated() {
        systemErrorsListeners.forEach(listener => {
            try {
                listener(systemErrors);
            } catch (e) {
                console.error("Error in system error listener", e);
            }
        });
    }

    function clearSystemError(key) {
        delete systemErrors[key];
        systemErrorsUpdated();
    }


    function setSystemError(key, message) {
        if (systemErrors[key] !== message) {
            if (message === undefined) {
                delete systemErrors[key];
            } else {
                systemErrors[key] = message;
            }
            systemErrorsUpdated();
        }
    }

    Object.values(registers).forEach(register => {
        register.watch(async register => {
            setSystemError(`register-${register.key}`, register.error ? `Register ${register.key} error: ${register.error.message || register.error}` : undefined);
        });
    });

    async function sweep(cb, from, to, timeMs, periodMs = 100) {
        for (let step = 0; step < Math.ceil(timeMs / periodMs); step++) {
            await cb(from + (to - from) * step / steps);
            await asyncWait(periodMs);
        }
    }

    let sequenceInProgress;

    function notifySequenceChange() {
        // don't wait for register update - it's for UI only
        registers.sequenceInProgress.set(sequenceInProgress).catch(console.error);
    }

    async function runSequence(sequenceName, cb) {

        clearSystemError(sequenceName + "Sequence");

        console.info(`Starting sequence '${sequenceName}'...`);
        try {

            if (sequenceInProgress) {
                throw `Can not start sequence '${sequenceName}', because '${sequenceInProgress}' is in progress`;
            }

            sequenceInProgress = sequenceName;            
            notifySequenceChange();

            await cb();
            console.info(`Sequence '${sequenceName}' finished.`);

            sequenceInProgress = undefined;
            notifySequenceChange();

        } catch (e) {
            
            console.error(`Sequence '${sequenceName}' failed: ${e.message || e}`);
            setSystemError(sequenceName + "Sequence", `${e.message || e} in sequence ${sequenceName}`);
            
            sequenceInProgress = undefined;
            notifySequenceChange();

            throw e;
        }
    }

    async function start() {
        await runSequence("start", async () => {

            await registers.startedAt.set(new Date());

            if (registers.compressorRelay === true) {
                throw "Compressor already running";
            }
            
            await config.peripherals.setColdWaterPump(true);
            await config.peripherals.setHotWaterPump(true);

            await config.peripherals.eevRun(500, true);
            await asyncWait(10000);
            await config.peripherals.eevRun(-230, false);
            await asyncWait(2000);

            await sweep(async r => {
                await peripherals.setCompressorRamp(r);
            }, 0, 100, 800);
            await peripherals.setCompressorRelay(true);
            await asyncWait(1000);
            await peripherals.setCompressorRamp(0);

        });
    }

    async function stop() {
        await runSequence("stop", async () => {

            await registers.stoppedAt.set(new Date());

            try {

                if (registers.compressorRelay === true) {

                    await peripherals.setCompressorRamp(100);
                    await asyncWait(1000);
                    await peripherals.setCompressorRelay(false);

                    await sweep(async r => {
                        await peripherals.setCompressorRamp(r);
                    }, 100, 0, 800);

                }
            } finally {

                await peripherals.setCompressorRelay(false);
                await peripherals.setCompressorRamp(0);
                await eevRun(500, true);
                await peripherals.setColdWaterPump(false);
                await peripherals.setHotWaterPump(false);

            }
            
        });
    }

    return {

        registers,

        systemErrors,

        start,

        stop,

        watchSystemErrors(listener) {
            systemErrorsListeners.push(listener);
        },

        async setColdWaterPump(state) {
            await peripherals.setColdWaterPump(state);
        },

        async setHotWaterPump(state) {
            await peripherals.setHotWaterPump(state);
        },

        async eevRun(fullSteps, fast) {
            await peripherals.eevRun(fullSteps, fast);
        },

        async clearSystemError(key) {
            clearSystemError(key);
        }
    }
}
