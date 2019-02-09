const mqtt = require("mqtt");

module.exports = async config => {

    let device = config.device || "NANOOK";
    let regPrefix = config.regPrefix || device.toLowerCase();
    let regTopic = (verb, reg) => `register/${regPrefix}.${reg.key}/${verb}`;

    let eachReg = cb => Object.values(config.registers).forEach(reg => cb(reg));

    if (config.broker) {
        var client = mqtt.connect(`mqtt://${config.broker}`);
        client.subscribe("register/advertise!");

        let publishValue = reg => {
            client.publish(regTopic("is", reg), JSON.stringify(reg.value));
        };

        client.on("message", (topic, message) => {
            try {

                if (topic === "register/advertise!") {
                    eachReg(reg => {
                        client.publish(regTopic("advertise", reg), JSON.stringify({ device, title: reg.name, unit: reg.unit }));
                    });
                }

                eachReg(reg => {
                    if (topic === regTopic("get", reg)) {
                        publishValue(reg);
                    }
                });

                eachReg(reg => {
                    if (topic === regTopic("set", reg)) {
                        if ((config.writeEnabled || []).some(rn => rn === regPrefix + "." + reg.key)) {
                            let value = JSON.parse(message);
                            console.info(`${reg.key} to be set to ${value} by MQTT`);
                            reg.set(value);
                        }
                        publishValue(reg);
                    }
                });


            } catch (e) {
                console.error(`Error in MQTT message handler on topic ${topic}: ${e.message || e}`);
            }
        });

        eachReg(reg => {
            client.subscribe(regTopic("get", reg));
            client.subscribe(regTopic("set", reg));
            reg.watch(r => {
                publishValue(r);
            })
        });
    }

};