const mqtt = require("mqtt");

module.exports = async config => {

    let device = config.device || "NANOOK";
    let regPrefix = config.regPrefix || device.toLowerCase();
    let regTopic = (verb, reg) => `register/${regPrefix}.${reg.key}/${verb}`;

    let eachReg = cb => Object.values(config.registers).forEach(reg => cb(reg));

    let client;

    function publishValue(reg) {
        if (client) {
            client.publish(regTopic("is", reg), JSON.stringify(reg.value));
        }
    };

    function reconnect() {
        if (client) {
            console.info("Disconnecting from MQTT broker");
            client.end();
        }
        if (config.registers.mqttBroker.value) {
            console.info("Connecting to MQTT broker", config.registers.mqttBroker.value);

            client = mqtt.connect(`mqtt://${config.registers.mqttBroker.value}`);
            client.subscribe("register/advertise!");

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
            });        
        }
    }

    reconnect();

    config.registers.mqttBroker.watch(reconnect);

    eachReg(reg => {
        reg.watch(r => {
            publishValue(r);
        })
    });

};