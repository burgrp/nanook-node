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

        async function checkAction(action, rethrow = false) {
            try {
                return await action();
            } catch (e) {
                console.error(e);
                showNotification(e);
                if (rethrow) {
                        throw e;        
                }
            }
        }

        function startStopButtons(action, lock) {
            let start = BUTTON("start" + (lock ? " locked" : "")).text("Start").click(e => checkAction(async () => await action(true)));
            let stop = BUTTON("stop" + (lock ? " locked" : "")).text("Stop").click(e => checkAction(async () => await action(false)));
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

        let controls = {
            sequenceInProgress: startStopButtons(async s => await (s ? wg.dashboard.start : wg.dashboard.stop)(s), true),
            coldWaterPump: startStopButtons(async s => await wg.dashboard.setColdWaterPump(s)),
            hotWaterPump: startStopButtons(async s => await wg.dashboard.setHotWaterPump(s)),
            manualControl: startStopButtons(async s => await wg.dashboard.setRegister("manualControl", s)),
            eevPosition: [
                eevButton("OP", -500, true),
                eevButton("<<", -50, false),
                eevButton("<", -5, false),
                eevButton(">", 5, false),
                eevButton(">>", 50, false),
                eevButton("CL", 500, true)
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
            ]
        }

        let convertDate = d => d? new Date(d).toLocaleString(): "-";

        let converters = {
                sequenceInProgress:  v => v? v.toUpperCase(): "NONE",
                startedAt: convertDate ,
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
                        converters[register.key]? 
                                converters[register.key](register.value):
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
                            updateAllRegisters();
                        });
                    }),
                    systemErrors,
                    DIV("software-updates", async div => {
                        async function checkForUpdates() {
                                div.empty();
                                let updates = await wg.updates.check();
                                if (updates.length) {
                                        div.append(DIV("caption").text("Software updates available:"))
                                        div.append(updates.map(update => DIV("log-line", [
                                                DIV("date").text(update.date),
                                                DIV("message").text(update.message)
                                        ])));
                                        div.append(BUTTON().text("Download updates").click(() => {
                                                div.empty().append(DIV().text("Downloading updates, please wait..."));
                                                checkAction(async () => {
                                                        await wg.updates.download();
                                                        await checkForUpdates();
                                                });
                                        }))
                                }
                        }
                        checkAction(checkForUpdates);
                    })
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