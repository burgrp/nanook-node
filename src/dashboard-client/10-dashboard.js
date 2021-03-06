wg.pages.home = {

    title: "NANOOK",

    async render(container) {

        let registers = await wg.dashboard.getRegisters();

        let notifications = DIV("notifications").click(e => {
            notifications.hide();
        });

        function showNotification(message) {
            let notification = DIV("notification").text(message);
            notifications.append(notification).fadeIn();
            setTimeout(() => {
                notification.fadeOut(() => {
                    notification.remove();
                });
            }, 5000);
        }

        async function checkAction(action) {
            try {
                return await action();
            } catch (e) {
                console.error(e);
                showNotification(e);
            }
        }

        function startStopButtons(action, lock, labels = ["stop", "start"]) {
            let start = BUTTON("start" + (lock ? " locked" : "")).text(labels[1]).click(e => checkAction(async () => await action(true)));
            let stop = BUTTON("stop" + (lock ? " locked" : "")).text(labels[0]).click(e => checkAction(async () => await action(false)));
            return [
                lock ? BUTTON("unlock").text("Unlock").click(e => {
                    $(start).toggleClass("locked", false);
                    $(stop).toggleClass("locked", false);
                    $(e.target).remove();
                }) : undefined,
                start,
                stop
            ];
        }

        function eevButton(text, change, fast) {
            return BUTTON().text(text).click(e => checkAction(async () => await wg.dashboard.eevRun(change, fast)))
        }

        function regSpinButton(text, change, reg) {
            return BUTTON().text(text).click(e => checkAction(async () => await wg.dashboard.setRegister(reg.key, reg.value + change)));
        }

        function createDialog(title, content, apply) {
            function close() {
                dialog.remove();
            }
            let dialog = DIV("overlay", [
                DIV("window", [
                    DIV("title").text(title),
                    DIV("content", content),
                    DIV("buttons", [
                        BUTTON().text("Ok").click(() => {
                            checkAction(async () => {
                                await apply();
                                close();
                            });
                        }),
                        BUTTON().text("Cancel").click(close)
                    ])
                ]).click(e => e.stopImmediatePropagation())
            ]
            ).click(close).appendTo(container);
        }

        let controls = {
            sequenceInProgress: startStopButtons(async s => await (s ? wg.dashboard.start : wg.dashboard.stop)(s), true),
            coldWaterPump: startStopButtons(async s => await wg.dashboard.setColdWaterPump(s)),
            hotWaterPump: startStopButtons(async s => await wg.dashboard.setHotWaterPump(s)),
            manualControl: startStopButtons(async s => await wg.dashboard.setRegister("manualControl", s), false, ["Auto", "Manual"]),
            eevPosition: [
                eevButton("OP", -500, true),
                eevButton("<<", -50, false),
                eevButton("<", -5, false),
                eevButton(">", 5, false),
                eevButton(">>", 50, false),
                eevButton("CL", 500, true)
            ],
            maxOutTemp: [
                regSpinButton("<<", -5, registers.maxOutTemp),
                regSpinButton("<", -1, registers.maxOutTemp),
                regSpinButton(">", 1, registers.maxOutTemp),
                regSpinButton(">>", 5, registers.maxOutTemp)
            ],
            minInTemp: [
                regSpinButton("<<", -5, registers.minInTemp),
                regSpinButton("<", -1, registers.minInTemp),
                regSpinButton(">", 1, registers.minInTemp),
                regSpinButton(">>", 5, registers.minInTemp)
            ],
            targetTemp: [
                regSpinButton("<<", -5, registers.targetTemp),
                regSpinButton("<", -1, registers.targetTemp),
                regSpinButton(">", 1, registers.targetTemp),
                regSpinButton(">>", 5, registers.targetTemp)
            ],
            superheatTarget: [
                regSpinButton("<", -1, registers.superheatTarget),
                regSpinButton(">", 1, registers.superheatTarget),
            ],
            mqttBroker: [
                BUTTON().text("Change").click(e => {
                    let input = TEXT().val(registers.mqttBroker.value);
                    createDialog("MQTT Broker", [input], () => {
                        wg.dashboard.setRegister("mqttBroker", input.val());
                    });
                    input.focus().select();
                })
            ],
            blockingHours: [
                BUTTON().text("Change").click(e => {
                    let input = TEXT().val(registers.blockingHours.value);
                    createDialog("Blocking Hours", [
                        input,
                        DIV("hint").text("example: 10-12,14:30-16:30,18,20"),
                        DIV("hint").text("means: 10:00->12:00, 14:30->16:30, 18:00->19:00, 20:00->21:00")
                    ], () => {
                        wg.dashboard.setRegister("blockingHours", input.val());
                    });
                    input.focus().select();
                })
            ]
        }

        let convertDate = d => d ? new Date(d).toLocaleString() : "-";

        let converters = {
            sequenceInProgress: v => v ? v.toUpperCase() : "NONE",
            startedAt: convertDate,
            stoppedAt: convertDate
        }

        let systemErrors = DIV("system-errors");

        function updateSystemErrors(se) {
            systemErrors.empty().append(Object.entries(se).map(([key, message]) => DIV("system-error").text(message).click(async e => {
                try {
                    await wg.dashboard.clearSystemError(key);
                } catch (e) {
                    showNotification(e);
                }
            })));
        }

        function updateRegister(register) {

            let diff;

            if (typeof register.value === "number") {
                register.value = Math.round(register.value * 10) / 10;
                diff = register.value - registers[register.key].value;
            }

            registers[register.key].value = register.value;

            $(".register-bound." + register.key)
                .text(
                    (
                        converters[register.key] ?
                            converters[register.key](register.value) :
                            register.value instanceof Object ?
                                register.value.key ?
                                    register.value.key :
                                    JSON.stringify(register.value) :
                                typeof register.value === "number" ?
                                    register.value.toFixed(1) :
                                    typeof register.value === "boolean" ?
                                        register.value ? "ON" : "OFF" :
                                        register.value === undefined ? "-" : register.value
                    ) + (register.unit ? " " + register.unit : "")
                )
                .toggleClass("goesDown", diff < 0)
                .toggleClass("goesUp", diff > 0)
                .toggleClass("on", typeof register.value === "boolean" && register.value)
                .toggleClass("off", typeof register.value === "boolean" && !register.value)
                ;

            if (register.key === "compressorRamp" || register.key === "compressorRelay") {
                let alpha = registers.compressorRelay.value ? 1 : registers.compressorRamp.value / 100;
                $("#svg-compressor").css("fill", `rgb(0, 160, 100, ${alpha})`);
            }

            //             if (register.key === "eevPosition") {
            //                 $("#eevPosition").val(register.value);
            //             }

        }

        function updateAllRegisters() {
            Object.values(registers).forEach(updateRegister);
        }

        container.append(
            notifications,
            SPAN("dashboard", [
                DIV("registers",
                    Object.values(registers)
                        .map(register =>
                            SPAN("register", [
                                SPAN("name").text(register.name),
                                SPAN("value register-bound " + register.key),
                                SPAN("controls", controls[register.key])
                            ])
                        )
                ),
                DIV("schema-errors", [
                    DIV("logo"),
                    DIV("schema", span => {
                        $.get("schema.svg", svg => {
                            let svgStr = (new window.XMLSerializer()).serializeToString(svg);
                            span.html(svgStr);
                            span.find("tspan").each((i, tspan) => {
                                tspan = $(tspan);
                                let key = tspan.text();
                                if (key.startsWith("$")) {
                                    key = key.substring(1);
                                    tspan.addClass("register-bound " + key);
                                }
                            });
                            span.find("svg").removeAttr("width").removeAttr("height");
                            updateAllRegisters();
                        });
                    }),
                    systemErrors,
                    // DIV("software-updates", async div => {
                    //     async function checkForUpdates() {
                    //         div.empty();
                    //         let updates = await wg.updates.check();
                    //         if (updates.length) {
                    //             div.append(DIV("caption").text("Software updates available:"))
                    //             div.append(updates.map(update => DIV("log-line", [
                    //                 DIV("date").text(update.date),
                    //                 DIV("message").text(update.message)
                    //             ])));
                    //             div.append(BUTTON().text("Download updates").click(async () => {
                    //                 div.empty().append(DIV().text("Downloading updates, please wait..."));
                    //                 await checkAction(wg.updates.download);
                    //                 await checkAction(checkForUpdates);
                    //             }))
                    //         }
                    //     }
                    //     checkAction(checkForUpdates);
                    // })
                ])
            ])
                .onRegisterChanged(cr => {
                    updateRegister(cr)
                })
                .onSystemErrorsChanged(se => {
                    updateSystemErrors(se);
                })
        );

        updateSystemErrors(await wg.dashboard.getSystemErrors());

        updateAllRegisters();
    }
}